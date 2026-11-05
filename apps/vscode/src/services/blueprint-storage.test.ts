/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-5] [FR-7] [NFR-1]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-STORAGE] [DES-TEST]
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createBlueprintObservationStorage } from "./blueprint-storage";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

describe("Blueprint observation storage", () => {
  it("uses memory when extension storage is unavailable", async () => {
    const storage = createBlueprintObservationStorage();
    await storage.write({
      schemaVersion: 1,
      producer: "afx-vscode",
      projectId: "one",
      collectedAt: "now",
      payload: {},
    });
    expect(storage.details().mode).toBe("memory");
    expect((await storage.read("one"))?.projectId).toBe("one");
    await storage.clear("one");
    expect(await storage.read("one")).toBeUndefined();
  });

  it("recovers corrupt cache outside the project tree", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-cache-"));
    roots.push(root);
    const storage = createBlueprintObservationStorage(root);
    await storage.write({
      schemaVersion: 1,
      producer: "afx-vscode",
      projectId: "one",
      collectedAt: "now",
      payload: { ok: true },
    });
    expect((await storage.read("one"))?.payload).toEqual({ ok: true });
    await mkdir(path.join(root, "blueprints"), { recursive: true });
    const files = await import("node:fs/promises").then((fs) =>
      fs.readdir(path.join(root, "blueprints")),
    );
    await writeFile(path.join(root, "blueprints", files[0]!), "not json");
    expect(await storage.read("one")).toBeUndefined();
  });
});
