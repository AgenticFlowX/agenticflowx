/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-9] [FR-10] [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TEST]
 */
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  BLUEPRINT_MAX_BYTES,
  BLUEPRINT_TRANSACTION,
  createBlueprint,
  openBlueprint,
  resolveInside,
  updateBlueprint,
  validateBlueprintManifest,
} from "./blueprint-artifacts";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

describe("Blueprint artifacts", () => {
  it("saves and reopens portable research independently of extension cache", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-blueprint-"));
    roots.push(root);
    const manifest = await createBlueprint({
      artifactRoot: root,
      name: "Public App",
      description: "Private planning",
      repository: { name: "public-app", kind: "git" },
      researchMarkdown: "# Research\n",
      now: "2026-10-21T01:02:03.000Z",
    });
    const reopened = await openBlueprint(root);
    expect(reopened).toEqual(manifest);
    expect(JSON.stringify(reopened)).not.toContain("/tmp/");
    expect(await readFile(path.join(root, "blueprint.md"), "utf8")).toContain("# Research");
    expect((await readdir(root)).sort()).toEqual(["blueprint.json", "blueprint.md"]);
  });

  it("rejects traversal, future schemas and stale revisions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-blueprint-"));
    roots.push(root);
    const manifest = await createBlueprint({
      artifactRoot: root,
      name: "App",
      repository: { name: "app", kind: "git" },
      researchMarkdown: "research",
      now: "2026-10-21T01:02:03.000Z",
    });
    expect(() => resolveInside(root, "../escape")).toThrow(/portable|escapes/);
    expect(() => validateBlueprintManifest({ ...manifest, schemaVersion: 99 })).toThrow(
      /Unsupported/,
    );
    await expect(updateBlueprint(root, 0, (value) => value)).rejects.toThrow(/revision conflict/);
  });

  it("advances the revision without losing the last committed manifest", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-blueprint-"));
    roots.push(root);
    const created = await createBlueprint({
      artifactRoot: root,
      name: "App",
      repository: { name: "app", kind: "folder" },
      researchMarkdown: "research",
      now: "2026-10-21T01:02:03.000Z",
    });
    const updated = await updateBlueprint(root, created.revision, (value) => ({
      ...value,
      description: "Authored",
    }));
    expect(updated.revision).toBe(2);
    expect((await openBlueprint(root)).description).toBe("Authored");
  });

  it("reports interrupted cross-file operations before claiming consistency", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-blueprint-"));
    roots.push(root);
    await createBlueprint({
      artifactRoot: root,
      name: "App",
      repository: { name: "app", kind: "git" },
      researchMarkdown: "research",
      now: "2026-10-21T01:02:03.000Z",
    });
    await writeFile(path.join(root, BLUEPRINT_TRANSACTION), '{"operation":"create-sprint"}\n');
    await expect(openBlueprint(root)).rejects.toThrow(/requires recovery/);
  });

  it("rejects oversized and symlinked manifests before parsing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-blueprint-"));
    const outside = await mkdtemp(path.join(tmpdir(), "afx-blueprint-outside-"));
    roots.push(root, outside);
    const manifestPath = path.join(root, "blueprint.json");
    await writeFile(manifestPath, " ".repeat(BLUEPRINT_MAX_BYTES + 1));
    await expect(openBlueprint(root)).rejects.toThrow(/2 MiB safety limit/);

    await rm(manifestPath);
    const outsideManifest = path.join(outside, "blueprint.json");
    await writeFile(outsideManifest, "{}\n");
    await symlink(outsideManifest, manifestPath);
    await expect(openBlueprint(root)).rejects.toThrow(/regular file, not a symlink/);
  });
});
