/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-18] [FR-19]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TEST] [DES-STORAGE]
 */
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createBlueprint, openBlueprint } from "./blueprint-artifacts";
import type { InvestigationResult } from "./blueprint-investigation";
import {
  loadBlueprintModel,
  reconcileBlueprintModel,
  saveBlueprintChanges,
  saveBlueprintModel,
} from "./blueprint-model-store";
import { loadFindingReviews, saveFindingReview } from "./blueprint-review";
import { validatePortableBlueprint } from "./blueprint-validation";
import { atomicJson, withBlueprintLock } from "./blueprint-writer";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function setup(schemaVersion: 2 | 3 = 2) {
  const root = await mkdtemp(path.join(tmpdir(), "afx-model-"));
  roots.push(root);
  const codeRoot = path.join(root, "code");
  const artifactRoot = path.join(root, "private");
  await mkdir(codeRoot);
  await writeFile(path.join(codeRoot, "main.ts"), "export function run() {}\n");
  const manifest = await createBlueprint({
    schemaVersion,
    artifactRoot,
    name: "Audio",
    repository: { name: "audio", kind: "folder" },
    researchMarkdown: "# Audio\n",
  });
  const evidenceId = randomUUID();
  const investigation: InvestigationResult = {
    id: randomUUID(),
    collectedAt: new Date().toISOString(),
    outcome: "partial",
    stopReason: "Budget reached",
    inventory: ["main.ts"],
    findings: [
      {
        id: randomUUID(),
        category: "component",
        title: "Engine",
        description: "Runs audio",
        classification: "inferred",
        evidenceIds: [evidenceId],
      },
    ],
    evidence: [
      {
        id: evidenceId,
        path: "main.ts",
        startLine: 1,
        endLine: 1,
        contentHash: `sha256:${createHash("sha256").update("export function run() {}\n").digest("hex")}`,
        collectedAt: new Date().toISOString(),
      },
    ],
    gaps: ["Tests not inspected"],
    usage: { calls: 1, bytes: 20, estimatedInputTokens: 500, estimatedOutputTokens: 20 },
  };
  return {
    artifactRoot,
    codeRoot,
    manifest,
    investigation,
    repositoryId: manifest.repositories[0]!.id,
  };
}

describe("durable semantic Blueprint models", () => {
  it("keeps the current v3 model and authored reviews in the two-file Blueprint", async () => {
    const f = await setup(3);
    const model = await saveBlueprintModel(
      f.artifactRoot,
      f.manifest,
      f.repositoryId,
      f.investigation,
    );
    let current = await openBlueprint(f.artifactRoot);
    expect(
      (await loadBlueprintModel(f.artifactRoot, current, f.repositoryId))?.modelRevisionId,
    ).toBe(model.modelRevisionId);
    const review = await saveFindingReview(
      f.artifactRoot,
      current,
      model,
      f.investigation.findings[0]!.id,
      "corrected",
      "Renderer, not engine.",
    );
    current = await openBlueprint(f.artifactRoot);
    expect(current.reviews).toEqual([review]);
    expect((await readdir(f.artifactRoot)).sort()).toEqual(["blueprint.json", "blueprint.md"]);
  });

  it("saves partial models offline, retains immutable lineage and authorship", async () => {
    const f = await setup();
    const first = await saveBlueprintModel(
      f.artifactRoot,
      f.manifest,
      f.repositoryId,
      f.investigation,
    );
    validatePortableBlueprint(first);
    expect(first.investigation.outcome).toBe("partial");
    const second = await saveBlueprintModel(f.artifactRoot, f.manifest, f.repositoryId, {
      ...f.investigation,
      id: randomUUID(),
    });
    expect(second.parentModelRevisionId).toBe(first.modelRevisionId);
    expect(second.entities.map((e) => e.id)).toEqual(first.entities.map((e) => e.id));
    expect(
      (await loadBlueprintModel(f.artifactRoot, f.manifest, f.repositoryId))?.modelRevisionId,
    ).toBe(second.modelRevisionId);
    expect(
      await readFile(
        path.join(f.artifactRoot, "model/revisions", `${first.modelRevisionId}.json`),
        "utf8",
      ),
    ).toContain(first.modelRevisionId);
    expect(await readFile(path.join(f.artifactRoot, "research/repository.md"), "utf8")).toBe(
      "# Audio\n",
    );
    expect(JSON.stringify(first)).not.toContain(f.codeRoot);
  });

  it("detects changed and missing evidence, new coverage and rename candidates without retargeting", async () => {
    const f = await setup();
    const model = await saveBlueprintModel(
      f.artifactRoot,
      f.manifest,
      f.repositoryId,
      f.investigation,
    );
    expect((await reconcileBlueprintModel(model, f.codeRoot)).current).toEqual(["main.ts"]);
    await rename(path.join(f.codeRoot, "main.ts"), path.join(f.codeRoot, "engine.ts"));
    let changes = await reconcileBlueprintModel(model, f.codeRoot);
    expect(changes.missing).toEqual(["main.ts"]);
    expect(changes.added).toEqual(["engine.ts"]);
    expect(changes.renameCandidates).toEqual([
      { from: "main.ts", to: "engine.ts", basis: "identical-content", state: "needs-review" },
    ]);
    expect(changes.affectedClaimIds).toEqual(model.claims.map((item) => item.id));
    await saveBlueprintChanges(f.artifactRoot, f.manifest, changes);
    validatePortableBlueprint(changes);
    await writeFile(path.join(f.codeRoot, "main.ts"), "new behavior\n");
    changes = await reconcileBlueprintModel(model, f.codeRoot);
    expect(changes.changed).toEqual(["main.ts"]);
  });

  it("preserves authored finding corrections across model revisions", async () => {
    const f = await setup();
    const model = await saveBlueprintModel(
      f.artifactRoot,
      f.manifest,
      f.repositoryId,
      f.investigation,
    );
    const review = await saveFindingReview(
      f.artifactRoot,
      f.manifest,
      model,
      f.investigation.findings[0]!.id,
      "corrected",
      "This is a renderer, not an audio engine.",
    );
    await saveBlueprintModel(f.artifactRoot, f.manifest, f.repositoryId, f.investigation);
    expect(await loadFindingReviews(f.artifactRoot, f.manifest, f.repositoryId)).toEqual([review]);
    expect(review.actor).toBe("human");
  });

  it("rejects tampered snapshots, foreign evidence and unknown future contracts", async () => {
    const f = await setup();
    const model = await saveBlueprintModel(
      f.artifactRoot,
      f.manifest,
      f.repositoryId,
      f.investigation,
    );
    const file = path.join(f.artifactRoot, "model/revisions", `${model.modelRevisionId}.json`);
    await writeFile(file, "{}\n");
    await expect(loadBlueprintModel(f.artifactRoot, f.manifest, f.repositoryId)).rejects.toThrow(
      /Immutable/,
    );
    expect(() => validatePortableBlueprint({ ...model, schemaVersion: 99 })).toThrow(/Unsupported/);
    expect(() => validatePortableBlueprint({ ...model, surprise: true })).toThrow(/Invalid/);
  });

  it("serializes independent writers and prevents symlink traversal before creating directories", async () => {
    const f = await setup();
    await withBlueprintLock(f.artifactRoot, async () => {
      await expect(
        saveBlueprintModel(f.artifactRoot, f.manifest, f.repositoryId, f.investigation),
      ).rejects.toThrow(/another process/);
    });
    await symlink(f.codeRoot, path.join(f.artifactRoot, "escape"));
    await expect(atomicJson(f.artifactRoot, "escape/new/unsafe.json", {})).rejects.toThrow(
      /symlink/,
    );
    await expect(readFile(path.join(f.codeRoot, "new/unsafe.json"))).rejects.toThrow();
    await saveBlueprintModel(f.artifactRoot, f.manifest, f.repositoryId, f.investigation);
  });
});
