import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createBlueprint, openBlueprint } from "./blueprint-artifacts";
import { renderBlueprintHandoff } from "./blueprint-handoff";
import type { InvestigationResult } from "./blueprint-investigation";
import { validateInvestigationResume } from "./blueprint-investigation";
import {
  loadBlueprintModel,
  reconcileBlueprintModel,
  saveBlueprintModel,
} from "./blueprint-model-store";
import {
  affectedBlueprintFindings,
  buildBlueprintProposal,
  renderBlueprintProposal,
} from "./blueprint-proposal";
import { saveFindingReview } from "./blueprint-review";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const hash = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "afx-maintenance-"));
  roots.push(root);
  const code = path.join(root, "code");
  const artifact = path.join(root, "blueprint");
  await mkdir(code);
  await writeFile(path.join(code, "README.md"), "Old purpose\n");
  await writeFile(path.join(code, "engine.ts"), "export const engine = true;\n");
  const manifest = await createBlueprint({
    artifactRoot: artifact,
    name: "App",
    repository: { name: "app", kind: "folder" },
    researchMarkdown: "Initial report",
  });
  const now = new Date().toISOString();
  const evidence = [
    {
      id: randomUUID(),
      path: "README.md",
      startLine: 1,
      endLine: 1,
      contentHash: hash("Old purpose\n"),
      collectedAt: now,
    },
    {
      id: randomUUID(),
      path: "engine.ts",
      startLine: 1,
      endLine: 1,
      contentHash: hash("export const engine = true;\n"),
      collectedAt: now,
    },
  ];
  const investigation: InvestigationResult = {
    id: randomUUID(),
    collectedAt: now,
    outcome: "partial",
    stopReason: "Scoped",
    inventory: ["README.md", "engine.ts"],
    evidence,
    findings: [
      {
        id: randomUUID(),
        category: "purpose",
        title: "Purpose",
        description: "Old purpose",
        classification: "observed",
        evidenceIds: [evidence[0]!.id],
      },
      {
        id: randomUUID(),
        category: "component",
        title: "Engine",
        description: "Retain this component",
        classification: "observed",
        evidenceIds: [evidence[1]!.id],
      },
    ],
    gaps: ["Deployment"],
    usage: { calls: 2, bytes: 100, estimatedInputTokens: 100, estimatedOutputTokens: 100 },
  };
  await saveBlueprintModel(artifact, manifest, manifest.repositories[0]!.id, investigation);
  const current = await openBlueprint(artifact);
  const model = (await loadBlueprintModel(artifact, current, manifest.repositories[0]!.id))!;
  return { code, artifact, manifest: current, model };
}

describe("reviewed Blueprint maintenance", () => {
  it("checks without writes, preserves unaffected findings and notes, and retains review provenance", async () => {
    const f = await fixture();
    await saveFindingReview(
      f.artifact,
      f.manifest,
      f.model,
      f.model.investigation.findings[1]!.id,
      "accepted",
      "Authored review",
    );
    const pinned = await openBlueprint(f.artifact);
    const notes = "Authored notes\r\n";
    await writeFile(
      path.join(f.artifact, "blueprint.md"),
      notes + (await readFile(path.join(f.artifact, "blueprint.md"), "utf8")),
    );
    const before = await Promise.all(
      ["blueprint.md", "blueprint.json"].map((file) =>
        readFile(path.join(f.artifact, file), "utf8"),
      ),
    );
    await writeFile(path.join(f.code, "README.md"), "New purpose\n");
    const changes = await reconcileBlueprintModel(f.model, f.code);
    expect(changes.changed).toEqual(["README.md"]);
    expect(
      await Promise.all(
        ["blueprint.md", "blueprint.json"].map((file) =>
          readFile(path.join(f.artifact, file), "utf8"),
        ),
      ),
    ).toEqual(before);
    const affectedIds = affectedBlueprintFindings(f.model, changes);
    expect(affectedIds).toEqual([f.model.investigation.findings[0]!.id]);
    const evidence = {
      ...f.model.investigation.evidence[0]!,
      id: randomUUID(),
      contentHash: hash("New purpose\n"),
    };
    const candidate: InvestigationResult = {
      ...f.model.investigation,
      evidence: [evidence],
      findings: [
        {
          ...f.model.investigation.findings[0]!,
          description: "New purpose",
          evidenceIds: [evidence.id],
        },
      ],
    };
    const proposal = buildBlueprintProposal({
      kind: "update",
      base: f.model,
      parentRevision: pinned.revision,
      candidate,
      affectedIds,
      inventory: candidate.inventory,
    });
    expect(proposal.investigation.findings[0]).toEqual(f.model.investigation.findings[1]);
    expect(proposal.retired).toEqual([]);
    expect(renderBlueprintProposal(proposal, f.model)).toContain("Before: Old purpose");
    await validateInvestigationResume(f.code, proposal.investigation);
    await saveBlueprintModel(
      f.artifact,
      pinned,
      f.model.repositoryId,
      proposal.investigation,
      f.model.modelRevisionId,
    );
    expect(await readFile(path.join(f.artifact, "blueprint.md"), "utf8")).toMatch(
      /^Authored notes\r\n/,
    );
    expect(JSON.stringify((await openBlueprint(f.artifact)).reviews)).toContain("Authored review");
  });
  it("shows rebuild retirements and blocks changed evidence before applying", async () => {
    const f = await fixture();
    const candidate = {
      ...f.model.investigation,
      findings: f.model.investigation.findings.slice(0, 1),
    };
    const proposal = buildBlueprintProposal({
      kind: "rebuild",
      base: f.model,
      parentRevision: f.manifest.revision,
      candidate,
      affectedIds: [],
      inventory: candidate.inventory,
    });
    expect(proposal.retired).toEqual([f.model.investigation.findings[1]!.id]);
    expect(renderBlueprintProposal(proposal, f.model)).toContain("retired (1)");
    await writeFile(path.join(f.code, "README.md"), "Another change\n");
    await expect(validateInvestigationResume(f.code, proposal.investigation)).rejects.toThrow(
      /source evidence changed/,
    );
    expect((await openBlueprint(f.artifact)).revision).toBe(f.manifest.revision);
  });
  it("reviews changed evidence even when finding wording and evidence identity stay the same", async () => {
    const f = await fixture();
    const candidate = structuredClone(f.model.investigation);
    candidate.evidence[0]!.contentHash = hash("Different evidence, same architectural claim\n");
    candidate.findings[1]!.classification = "inferred";
    candidate.relationships = [
      {
        id: randomUUID(),
        fromFindingId: candidate.findings[0]!.id,
        toFindingId: candidate.findings[1]!.id,
        type: "depends-on",
        classification: "inferred",
        description: "Proposed connection",
        evidenceIds: [candidate.evidence[0]!.id],
      },
    ];
    const proposal = buildBlueprintProposal({
      kind: "rebuild",
      base: f.model,
      parentRevision: f.manifest.revision,
      candidate,
      affectedIds: [],
      inventory: candidate.inventory,
    });
    expect(proposal.modified).toEqual(candidate.findings.map((finding) => finding.id));
    const review = renderBlueprintProposal(proposal, f.model);
    expect(review).toContain(f.model.investigation.evidence[0]!.contentHash);
    expect(review).toContain(candidate.evidence[0]!.contentHash);
    expect(review).toContain("component / observed");
    expect(review).toContain("component / inferred");
    expect(review).toContain("Proposed connection");
    expect(review).toContain("Before: absent");
    expect(review).toContain("README.md:1-1");
  });
  it("builds only selected Sprint context without machine paths or implicit approvals", async () => {
    const f = await fixture();
    const selected = f.model.investigation.findings[0]!;
    const markdown = renderBlueprintHandoff(f.manifest, f.model, {
      name: "Improve",
      goal: "Improve the feature",
      discussion: "Reviewed excerpt",
      findingIds: [selected.id],
    });
    expect(markdown).toContain(f.model.modelRevisionId);
    expect(markdown).toContain(selected.id);
    expect(markdown).not.toContain("Retain this component");
    expect(markdown).not.toContain(f.code);
    expect(markdown).toContain("Reviewed excerpt");
    expect(() =>
      renderBlueprintHandoff(f.manifest, f.model, {
        name: "x",
        goal: "Goal",
        discussion: "",
        findingIds: ["foreign"],
      }),
    ).toThrow(/not in the pinned/);
  });
});
