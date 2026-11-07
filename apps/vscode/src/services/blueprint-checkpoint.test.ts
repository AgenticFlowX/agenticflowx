import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { type BlueprintCheckpoint, createBlueprintCheckpointStore } from "./blueprint-checkpoint";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
function record(root: string): BlueprintCheckpoint {
  return {
    version: 1,
    root,
    parentRevision: null,
    savedAt: new Date().toISOString(),
    result: {
      id: "run",
      collectedAt: new Date().toISOString(),
      outcome: "partial",
      stopReason: "Allowance",
      inventory: ["README.md"],
      evidence: [],
      findings: [],
      gaps: ["Deployment"],
      usage: { calls: 1, bytes: 0, estimatedInputTokens: 100, estimatedOutputTokens: 10 },
    },
  };
}
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "afx-checkpoint-"));
  roots.push(root);
  return root;
}

describe("local investigation checkpoints", () => {
  it("survives store recreation, checks parent identity, and supports explicit discard", async () => {
    const directory = await fixture();
    const source = "/code/project";
    await createBlueprintCheckpointStore(directory).save(record(source));
    const reopened = createBlueprintCheckpointStore(directory);
    expect((await reopened.load(source, null))?.result.gaps).toEqual(["Deployment"]);
    await expect(reopened.load(source, "different-revision")).rejects.toThrow(
      /another checkout or Blueprint revision/,
    );
    await reopened.clear(source);
    expect(await reopened.load(source, null)).toBeUndefined();
  });
  it("bounds retention, expires old drafts, and rejects corrupt state", async () => {
    const directory = await fixture();
    const store = createBlueprintCheckpointStore(directory);
    for (let i = 0; i < 6; i++) await store.save(record(`/code/project${i}`));
    expect((await readdir(directory)).filter((file) => file.endsWith(".json"))).toHaveLength(4);
    await store.save({ ...record("/code/expired"), savedAt: "2020-01-01T01:02:03.000Z" });
    expect(await store.load("/code/expired", null)).toBeUndefined();
    await store.clear("/code/project5");
    await store.save(record("/code/corrupt"));
    const names = await readdir(directory);
    for (const name of names) await writeFile(path.join(directory, name), "{}");
    await expect(store.load("/code/corrupt", null)).rejects.toThrow(/Invalid/);
  });
});
