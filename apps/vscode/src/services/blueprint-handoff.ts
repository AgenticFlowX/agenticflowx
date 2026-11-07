/**
 * Blueprint workflow context and explicit user actions.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-10] [FR-18]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-SDD]
 */
import type { BlueprintManifest } from "./blueprint-artifacts";
import type { BlueprintModel } from "./blueprint-model-store";

export interface BlueprintSprintInput {
  name: string;
  goal: string;
  discussion: string;
  findingIds: string[];
}

/** User-reviewed context for ordinary Draft AFX documents; never source-write authority. */
export function renderBlueprintHandoff(
  manifest: BlueprintManifest,
  model: BlueprintModel | undefined,
  input: BlueprintSprintInput,
): string {
  if (
    !input ||
    typeof input.name !== "string" ||
    typeof input.goal !== "string" ||
    typeof input.discussion !== "string"
  )
    throw new Error("Invalid Sprint handoff fields.");
  if (
    !input.name.trim() ||
    input.name.length > 120 ||
    !input.goal.trim() ||
    input.goal.length > 4000 ||
    input.discussion.length > 8000 ||
    !Array.isArray(input.findingIds) ||
    input.findingIds.length > 100 ||
    new Set(input.findingIds).size !== input.findingIds.length
  )
    throw new Error("Supply a Sprint name, desired outcome and a bounded selection of findings.");
  const selected = input.findingIds.map((id) => {
    const finding = model?.investigation.findings.find((item) => item.id === id);
    if (!finding) throw new Error("A selected finding is not in the pinned Blueprint model.");
    return finding;
  });
  const clean = (value: string) => value.replace(/[<>]/g, "");
  return [
    clean(input.goal.trim()),
    "",
    "### Blueprint context",
    `Blueprint: ${manifest.id}`,
    `Blueprint revision: ${manifest.revision}`,
    `Model revision: ${model?.modelRevisionId ?? "uninspected"}`,
    "Saved observations inform this Draft. They are not requirements approval or verification.",
    ...selected.flatMap((finding) => [
      "",
      `- ${clean(finding.title)} (${finding.id}; ${finding.classification})`,
      `  ${clean(finding.description)}`,
      ...finding.evidenceIds.flatMap((id) => {
        const evidence = model?.investigation.evidence.find((item) => item.id === id);
        return evidence
          ? [`  Source: ${evidence.path}:${evidence.startLine}–${evidence.endLine}`]
          : [];
      }),
    ]),
    "",
    "### Unknowns",
    ...(model?.investigation.gaps ?? ["No investigated model is attached."]).map(
      (gap) => `- ${clean(gap)}`,
    ),
    ...(input.discussion.trim()
      ? ["", "### Reviewed discussion excerpt", clean(input.discussion.trim())]
      : []),
  ].join("\n");
}
