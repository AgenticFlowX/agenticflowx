/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-10] [FR-13] [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-SDD] [DES-TEST]
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { BLUEPRINT_TRANSACTION, createBlueprint, openBlueprint } from "./blueprint-artifacts";
import {
  assertSessionContext,
  createBlueprintSprint,
  listBlueprintSprints,
  prepareBlueprintExecutionContext,
  recordBlueprintEvidence,
} from "./blueprint-execution-context";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

describe("Blueprint execution context", () => {
  it("creates resumable Sprint artifacts and pins the external code root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-sprint-"));
    roots.push(root);
    const manifest = await createBlueprint({
      artifactRoot: root,
      name: "App",
      repository: { name: "app", kind: "git" },
      researchMarkdown: "research",
      now: "2026-10-21T01:02:03.000Z",
    });
    const documentRoot = await mkdtemp(path.join(tmpdir(), "afx-documents-"));
    roots.push(documentRoot);
    const created = await createBlueprintSprint({
      manifest,
      artifactRoot: root,
      documentRoot,
      name: "Sprint One",
      owner: "@rix",
      now: "2026-10-21T01:02:03.000Z",
    });
    expect(await readFile(created.sprintPath, "utf8")).toContain("type: SPRINT");
    expect(await readFile(created.journalPath, "utf8")).toContain("type: JOURNAL");
    const repositoryId = manifest.repositories[0]!.id;
    const context = prepareBlueprintExecutionContext({
      manifest,
      binding: {
        blueprintId: manifest.id,
        artifactRoot: root,
        checkouts: { [repositoryId]: "/code/app" },
        documentRoots: { sdd: documentRoot },
      },
      repositoryId,
      sprintId: created.id,
    });
    const planning = prepareBlueprintExecutionContext({
      manifest,
      binding: {
        blueprintId: manifest.id,
        artifactRoot: root,
        checkouts: { [repositoryId]: "/code/app" },
        documentRoots: { sdd: documentRoot },
      },
      repositoryId,
    });
    expect(planning.sprintId).toBeUndefined();
    expect(planning.tracePolicy.mode).toBe("external");
    expect(context.codeRoot).toBe("/code/app");
    expect(context.artifactRoot).toBe(root);
    expect(context.blueprintRoot).toBe(root);
    expect(context.documentRoots["sdd"]).toBe(documentRoot);
    expect(context.tracePolicy).toEqual({ mode: "external", version: 1 });
  });

  it("blocks silent session rebinding", () => {
    const base = {
      blueprintId: "one",
      repositoryId: "repo",
      checkoutId: "one:/code",
      codeRoot: "/code",
      artifactRoot: "/artifacts",
      blueprintRoot: "/artifacts",
      documentRoots: {},
      sprintId: "sprint",
      blueprintRevision: 1,
      tracePolicy: { mode: "external" as const, version: 1 as const },
    };
    expect(() =>
      assertSessionContext(base, { ...base, checkoutId: "one:/other", codeRoot: "/other" }),
    ).toThrow(/pinned/);
  });

  it("does not list resumable Sprints while a durable operation needs recovery", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-sprint-"));
    roots.push(root);
    const manifest = await createBlueprint({
      artifactRoot: root,
      name: "App",
      repository: { name: "app", kind: "git" },
      researchMarkdown: "research",
    });
    await writeFile(path.join(root, BLUEPRINT_TRANSACTION), '{"operation":"create-sprint"}\n');
    await expect(listBlueprintSprints(manifest, root)).rejects.toThrow(/requires recovery/);
  });

  it("keeps Agent and Human evidence explicit and revision-bound", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-evidence-"));
    roots.push(root);
    const manifest = await createBlueprint({
      artifactRoot: root,
      name: "App",
      repository: { name: "app", kind: "git" },
      researchMarkdown: "research",
      now: "2026-10-21T01:02:03.000Z",
    });
    await recordBlueprintEvidence(manifest, root, {
      actor: "agent",
      procedure: "command",
      outcome: "passed",
      repositoryId: manifest.repositories[0]!.id,
      dirty: true,
      files: [{ path: "src/index.ts", contentHash: `sha256:${"a".repeat(64)}` }],
      artifacts: [{ path: "docs/specs/sprint/sprint.md", contentHash: `sha256:${"b".repeat(64)}` }],
      command: { argv: ["pnpm", "test"], exitCode: 0 },
      now: "2026-10-21T01:02:03.000Z",
    });
    const evidence = (await openBlueprint(root)).evidence?.[0] as {
      actor: string;
      outcome: string;
    };
    expect(evidence).toMatchObject({ actor: "agent", outcome: "passed" });
    expect(JSON.stringify(evidence)).not.toContain('"actor":"human"');
  });
});
