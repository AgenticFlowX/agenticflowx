/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-15] [FR-19]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TEST] [DES-STORAGE]
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import { blueprintArtifactInternals, createBlueprint, openBlueprint } from "./blueprint-artifacts";
import { migrateBlueprint, recoverBlueprintMigration } from "./blueprint-migration";
import { validatePortableBlueprint } from "./blueprint-validation";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "afx-migration-"));
  roots.push(root);
  const manifest = await createBlueprint({
    schemaVersion: 1,
    artifactRoot: root,
    name: "Legacy",
    repository: { name: "repo", kind: "folder" },
    researchMarkdown: "# Authored research\n",
  });
  return { root, manifest };
}
it("migrates v1 explicitly without inventing a model or changing authored history", async () => {
  const { root, manifest } = await fixture();
  const next = await migrateBlueprint(root);
  expect(next.id).toBe(manifest.id);
  expect(next.schemaVersion).toBe(2);
  expect(next.revision).toBe(manifest.revision + 1);
  expect(await readFile(path.join(root, "research/repository.md"), "utf8")).toBe(
    "# Authored research\n",
  );
  const index = JSON.parse(await readFile(path.join(root, "model/index.json"), "utf8"));
  validatePortableBlueprint(index);
  expect(index.entries).toEqual([]);
  expect(await migrateBlueprint(root)).toEqual(next);
});
it("recovers an interruption after a partial write and does not expose mixed versions", async () => {
  const { root } = await fixture();
  const write = blueprintArtifactInternals.atomicWrite;
  let calls = 0;
  const spy = vi
    .spyOn(blueprintArtifactInternals, "atomicWrite")
    .mockImplementation(async (file, content) => {
      if (++calls === 2) throw new Error("disk interruption");
      return write(file, content);
    });
  await expect(migrateBlueprint(root)).rejects.toThrow(/disk interruption/);
  spy.mockRestore();
  await expect(openBlueprint(root)).rejects.toThrow(/requires recovery/);
  const recovered = await recoverBlueprintMigration(root);
  expect(recovered.schemaVersion).toBe(2);
  expect((await openBlueprint(root)).id).toBe(recovered.id);
});
it("refuses to overwrite independent edits during recovery", async () => {
  const { root } = await fixture();
  const write = blueprintArtifactInternals.atomicWrite;
  let calls = 0;
  const spy = vi
    .spyOn(blueprintArtifactInternals, "atomicWrite")
    .mockImplementation(async (file, content) => {
      if (++calls === 2) throw new Error("disk interruption");
      return write(file, content);
    });
  await expect(migrateBlueprint(root)).rejects.toThrow();
  spy.mockRestore();
  await writeFile(path.join(root, "traces/links.json"), '{"authored":"independent edit"}\n');
  await expect(recoverBlueprintMigration(root)).rejects.toThrow(/changed independently/);
  expect(await readFile(path.join(root, "traces/links.json"), "utf8")).toContain(
    "independent edit",
  );
});
