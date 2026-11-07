import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  BLUEPRINT_TRANSACTION,
  createBlueprint,
  openBlueprint,
  recoverBlueprintReader,
} from "./blueprint-artifacts";
import type { InvestigationResult } from "./blueprint-investigation";
import { saveBlueprintModel } from "./blueprint-model-store";
import {
  adoptBlueprintReader,
  generatedBlueprintSection,
  updateBlueprintReader,
} from "./blueprint-reader";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const investigation: InvestigationResult = {
  id: randomUUID(),
  collectedAt: new Date().toISOString(),
  outcome: "partial",
  stopReason: "More work remains",
  findings: [],
  evidence: [],
  inventory: [],
  gaps: ["Deployment"],
  usage: { calls: 0, bytes: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0 },
};
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "afx-reader-"));
  roots.push(root);
  const manifest = await createBlueprint({
    artifactRoot: root,
    name: "Project",
    repository: { name: "source", kind: "folder" },
    researchMarkdown: "Old report",
  });
  return {
    root,
    manifest,
    file: path.join(root, "blueprint.md"),
    manifestFile: path.join(root, "blueprint.json"),
  };
}

describe("Blueprint reader lifecycle", () => {
  it("refreshes the report while retaining surrounding authored bytes", async () => {
    const f = await fixture();
    const notes = "Private notes\r\n  preserve whitespace\n";
    await writeFile(f.file, notes + (await readFile(f.file, "utf8")) + "\nTrailing note\n");
    await saveBlueprintModel(f.root, f.manifest, f.manifest.repositories[0]!.id, investigation);
    const current = await readFile(f.file, "utf8");
    expect(current.startsWith(notes)).toBe(true);
    expect(current.endsWith("\nTrailing note\n")).toBe(true);
    expect(current).toContain("More work remains");
    expect(current).not.toContain("Old report");
    expect((await openBlueprint(f.root)).revision).toBe(2);
  });
  it("rejects edited generated text without changing model or notes", async () => {
    const f = await fixture();
    const before = await readFile(f.manifestFile, "utf8");
    const edited = (await readFile(f.file, "utf8")).replace("Old report", "User correction");
    await writeFile(f.file, edited);
    await expect(
      saveBlueprintModel(f.root, f.manifest, f.manifest.repositories[0]!.id, investigation),
    ).rejects.toThrow(/was edited/);
    expect(await readFile(f.file, "utf8")).toBe(edited);
    expect(await readFile(f.manifestFile, "utf8")).toBe(before);
  });
  it("requires explicit legacy adoption and rejects duplicate or hostile markers", () => {
    expect(() => updateBlueprintReader("Legacy document", "New report")).toThrow(/Adopt/);
    const adopted = adoptBlueprintReader("Legacy document", "New report");
    expect(updateBlueprintReader(adopted, "Second report")).toContain("Legacy document");
    expect(() =>
      updateBlueprintReader(adopted + generatedBlueprintSection("Other"), "New"),
    ).toThrow(/unique/);
    expect(() => generatedBlueprintSection("<!-- AFX-BLUEPRINT:END -->")).toThrow(/reserved/);
  });
  it("recovers an interrupted reader/model pair and refuses subsequent manual edits", async () => {
    const f = await fixture();
    const before = { manifest: f.manifest, reader: await readFile(f.file, "utf8") };
    const after = {
      manifest: { ...f.manifest, revision: 2 },
      reader: updateBlueprintReader(before.reader, "New report"),
    };
    await writeFile(
      path.join(f.root, BLUEPRINT_TRANSACTION),
      JSON.stringify({ kind: "afx-blueprint-reader-transaction", before, after }),
    );
    await writeFile(f.file, after.reader);
    await expect(openBlueprint(f.root)).rejects.toThrow(/recovery/);
    await recoverBlueprintReader(f.root);
    expect(await readFile(f.file, "utf8")).toBe(before.reader);
    expect((await openBlueprint(f.root)).revision).toBe(1);
    await writeFile(
      path.join(f.root, BLUEPRINT_TRANSACTION),
      JSON.stringify({ kind: "afx-blueprint-reader-transaction", before, after }),
    );
    await writeFile(f.file, after.reader + "Authored after crash");
    await expect(recoverBlueprintReader(f.root)).rejects.toThrow(/changed after interruption/);
    expect(await readFile(f.file, "utf8")).toContain("Authored after crash");
  });
});
