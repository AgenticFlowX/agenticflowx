/**
 * Reviewable, revision-pinned Blueprint maintenance without artifact writes.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-18] [FR-19]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-EVOLUTION]
 */
import type { InvestigationFinding, InvestigationResult } from "./blueprint-investigation";
import type { BlueprintChanges, BlueprintModel } from "./blueprint-model-store";

export interface BlueprintProposal {
  kind: "update" | "rebuild";
  blueprintId: string;
  repositoryId: string;
  parentRevision: number;
  parentModelRevision: string;
  investigation: InvestigationResult;
  added: string[];
  modified: string[];
  retired: string[];
}

function findingSnapshot(finding: InvestigationFinding, result: InvestigationResult): string {
  const ids = new Set([
    ...finding.evidenceIds,
    ...(finding.steps?.flatMap((step) => step.evidenceIds) ?? []),
  ]);
  return JSON.stringify({
    finding,
    evidence: result.evidence
      .filter((item) => ids.has(item.id))
      .map(({ id, path, startLine, endLine, contentHash }) => ({
        id,
        path,
        startLine,
        endLine,
        contentHash,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}

export function affectedBlueprintFindings(
  model: BlueprintModel,
  changes: BlueprintChanges,
): string[] {
  const paths = new Set([...changes.changed, ...changes.missing, ...changes.unknown]);
  const evidence = new Set(
    model.investigation.evidence.filter((item) => paths.has(item.path)).map((item) => item.id),
  );
  const affected = new Set(
    model.investigation.findings
      .filter((finding) => finding.evidenceIds.some((id) => evidence.has(id)))
      .map((finding) => finding.id),
  );
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const edge of model.investigation.relationships ?? []) {
      if (!affected.has(edge.fromFindingId) && !affected.has(edge.toFindingId)) continue;
      for (const id of [edge.fromFindingId, edge.toFindingId])
        if (!affected.has(id)) {
          affected.add(id);
          expanded = true;
        }
    }
  }
  return [...affected];
}

export function buildBlueprintProposal(input: {
  kind: BlueprintProposal["kind"];
  base: BlueprintModel;
  parentRevision: number;
  candidate: InvestigationResult;
  affectedIds: string[];
  inventory: string[];
}): BlueprintProposal {
  const { base, candidate } = input;
  if (!candidate.findings.length || !candidate.evidence.length)
    throw new Error(
      "No evidence-backed proposal is available. Continue the investigation before replacing saved knowledge.",
    );
  const affected = new Set(input.affectedIds);
  const retained =
    input.kind === "update"
      ? base.investigation.findings.filter((finding) => !affected.has(finding.id))
      : [];
  const retainedEvidence = new Set(retained.flatMap((finding) => finding.evidenceIds));
  const findings = [...retained, ...candidate.findings];
  if (new Set(findings.map((finding) => finding.id)).size !== findings.length)
    throw new Error("Proposal finding identity conflict.");
  const evidence = [
    ...new Map(
      [
        ...base.investigation.evidence.filter((item) => retainedEvidence.has(item.id)),
        ...candidate.evidence,
      ].map((item) => [item.id, item]),
    ).values(),
  ];
  const ids = new Set(findings.map((finding) => finding.id));
  const relationships = [
    ...(input.kind === "update"
      ? (base.investigation.relationships?.filter(
          (edge) => !affected.has(edge.fromFindingId) && !affected.has(edge.toFindingId),
        ) ?? [])
      : []),
    ...(candidate.relationships ?? []).map((edge) => ({
      ...edge,
      id:
        base.investigation.relationships?.find(
          (old) =>
            old.fromFindingId === edge.fromFindingId &&
            old.toFindingId === edge.toFindingId &&
            old.type === edge.type,
        )?.id ?? edge.id,
    })),
  ].filter((edge) => ids.has(edge.fromFindingId) && ids.has(edge.toFindingId));
  const investigation: InvestigationResult = {
    ...structuredClone(candidate),
    symbols: [
      ...(input.kind === "update"
        ? (base.investigation.symbols?.filter(
            (item) =>
              retained.some((finding) =>
                finding.evidenceIds.some((id) =>
                  base.investigation.evidence.some((e) => e.id === id && e.path === item.path),
                ),
              ) && !candidate.symbols?.some((observed) => observed.path === item.path),
          ) ?? [])
        : []),
      ...(candidate.symbols ?? []),
    ],
    findings,
    evidence,
    relationships,
    inventory: input.inventory,
    gaps: [
      ...new Set([...(input.kind === "update" ? base.investigation.gaps : []), ...candidate.gaps]),
    ],
  };
  if (investigation.gaps.length) investigation.outcome = "partial";
  const previous = new Map(base.investigation.findings.map((finding) => [finding.id, finding]));
  return {
    kind: input.kind,
    blueprintId: base.blueprintId,
    repositoryId: base.repositoryId,
    parentRevision: input.parentRevision,
    parentModelRevision: base.modelRevisionId,
    investigation,
    added: findings.filter((finding) => !previous.has(finding.id)).map((finding) => finding.id),
    modified: findings
      .filter(
        (finding) =>
          previous.has(finding.id) &&
          findingSnapshot(previous.get(finding.id)!, base.investigation) !==
            findingSnapshot(finding, investigation),
      )
      .map((finding) => finding.id),
    retired: [...previous.keys()].filter((id) => !ids.has(id)),
  };
}

export function renderBlueprintProposal(proposal: BlueprintProposal, base: BlueprintModel): string {
  const clean = (value: string) => value.replace(/[<>]/g, "");
  const sources = (ids: string[], result: InvestigationResult): string =>
    ids
      .map((id) => {
        const source = result.evidence.find((item) => item.id === id);
        return source
          ? `${id}: ${source.path}:${source.startLine}-${source.endLine} (${source.contentHash})`
          : `${id}: unresolved`;
      })
      .map(clean)
      .join("; ");
  const state = (
    label: string,
    finding: InvestigationFinding,
    result: InvestigationResult,
  ): string[] => [
    `${label}: ${clean(finding.description)}`,
    `${label} title/category/classification: ${clean(finding.title)} / ${finding.category} / ${finding.classification}`,
    `${label} evidence: ${sources(finding.evidenceIds, result)}`,
    ...(finding.steps?.map(
      (step, index) =>
        `${label} step ${index + 1}: ${clean(step.description)} — ${sources(step.evidenceIds, result)}`,
    ) ?? []),
    ...(finding.command ? [`${label} command: ${clean(JSON.stringify(finding.command))}`] : []),
  ];
  const beforeEdges = base.investigation.relationships ?? [];
  const afterEdges = proposal.investigation.relationships ?? [];
  const edgeIds = new Set([...beforeEdges, ...afterEdges].map((edge) => edge.id));
  return [
    `# Review Blueprint ${proposal.kind}`,
    "",
    `Pinned Blueprint revision ${proposal.parentRevision}; model ${proposal.parentModelRevision}.`,
    "",
    "Applying this proposal changes the generated understanding. Authored notes, links and revision-bound reviews are retained. Review is not behavioral verification.",
    ...(["added", "modified", "retired"] as const).flatMap((kind) => [
      "",
      `## ${kind} (${proposal[kind].length})`,
      ...proposal[kind].flatMap((id) => {
        const before = base.investigation.findings.find((finding) => finding.id === id);
        const after = proposal.investigation.findings.find((finding) => finding.id === id);
        return [
          "",
          `### ${clean(after?.title ?? before?.title ?? id)}`,
          `Identity: ${id}`,
          ...(before ? state("Before", before, base.investigation) : []),
          ...(after
            ? state("Proposed", after, proposal.investigation)
            : ["Proposed: retire from the current model; historical review records remain."]),
        ];
      }),
    ]),
    "",
    "## Relationships before and after",
    ...[...edgeIds].flatMap((id) => {
      const before = beforeEdges.find((edge) => edge.id === id);
      const after = afterEdges.find((edge) => edge.id === id);
      return [
        "",
        `### ${clean(id)}`,
        `Before: ${before ? clean(JSON.stringify(before)) : "absent"}`,
        ...(before ? [`Before evidence: ${sources(before.evidenceIds, base.investigation)}`] : []),
        `Proposed: ${after ? clean(JSON.stringify(after)) : "retired"}`,
        ...(after
          ? [`Proposed evidence: ${sources(after.evidenceIds, proposal.investigation)}`]
          : []),
      ];
    }),
    "",
    `Proposed outcome: ${proposal.investigation.outcome}`,
    `Stop reason: ${clean(proposal.investigation.stopReason)}`,
    "",
    "## Remaining gaps",
    ...proposal.investigation.gaps.map((gap) => `- ${clean(gap)}`),
    "",
    "Apply only after reviewing the complete proposal. A changed parent revision or source evidence blocks Apply.",
  ].join("\n");
}
