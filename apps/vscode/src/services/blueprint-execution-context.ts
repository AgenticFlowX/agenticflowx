/**
 * Explicit code/artifact execution context and external Sprint creation.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-10] [FR-13] [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-SDD] [DES-FLOW] [DES-SEC]
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BlueprintBinding, BlueprintManifest } from "./blueprint-artifacts";
import {
  BLUEPRINT_TRANSACTION,
  blueprintArtifactInternals,
  resolveInside,
  updateBlueprint,
} from "./blueprint-artifacts";
import { ensureArtifactParent, withBlueprintLock } from "./blueprint-writer";

export interface BlueprintExecutionContext {
  blueprintId: string;
  repositoryId: string;
  checkoutId: string;
  codeRoot: string;
  artifactRoot: string;
  blueprintRoot: string;
  documentRoots: Record<string, string>;
  sprintId?: string;
  taskId?: string;
  blueprintRevision: number;
  tracePolicy: { mode: "external"; version: 1 };
}

/**
 * Prepares a pinned execution context and rejects missing or mismatched bindings.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-13] [NFR-7]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-SDD] [DES-API]
 */
export function prepareBlueprintExecutionContext(input: {
  manifest: BlueprintManifest;
  binding: BlueprintBinding;
  repositoryId: string;
  sprintId?: string;
  taskId?: string;
}): BlueprintExecutionContext {
  if (input.binding.blueprintId !== input.manifest.id)
    throw new Error("The selected local binding belongs to another Blueprint.");
  if (!input.manifest.repositories.some((repository) => repository.id === input.repositoryId))
    throw new Error("The selected repository is not declared by this Blueprint.");
  const codeRoot = input.binding.checkouts[input.repositoryId];
  if (!codeRoot) throw new Error("Bind the selected repository checkout before starting work.");
  if (!input.binding.artifactRoot) throw new Error("The Blueprint artifact root is unavailable.");
  return {
    blueprintId: input.manifest.id,
    repositoryId: input.repositoryId,
    checkoutId: `${input.repositoryId}:${codeRoot}`,
    codeRoot,
    artifactRoot: input.binding.artifactRoot,
    blueprintRoot: input.binding.artifactRoot,
    documentRoots: input.binding.documentRoots ?? {},
    ...(input.sprintId ? { sprintId: input.sprintId } : {}),
    ...(input.taskId ? { taskId: input.taskId } : {}),
    blueprintRevision: input.manifest.revision,
    tracePolicy: { mode: "external", version: input.manifest.traceability.policyVersion },
  };
}

function safeSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) throw new Error("Sprint name must contain a letter or number.");
  return slug;
}

/**
 * Creates an ordinary single-document AFX Sprint and companion journal under the declared artifact root.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-10] [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-SDD] [DES-STORAGE]
 */
export async function createBlueprintSprint(input: {
  manifest: BlueprintManifest;
  artifactRoot: string;
  documentRoot?: string;
  name: string;
  owner: string;
  now?: string;
}): Promise<{ id: string; sprintPath: string; journalPath: string }> {
  return withBlueprintLock(input.artifactRoot, async () => {
    const id = safeSlug(input.name);
    const documentRoot =
      input.manifest.schemaVersion === 3 ? input.documentRoot : input.artifactRoot;
    if (!documentRoot)
      throw new Error("Choose where AFX Sprint documents should be saved before creating one.");
    const directory = resolveInside(
      documentRoot,
      path.posix.join(
        input.manifest.schemaVersion === 3 ? "docs/specs" : input.manifest.artifacts.sprints,
        id,
      ),
    );
    const sprintPath = path.join(directory, `${id}.md`);
    const journalPath = path.join(directory, "journal.md");
    await readFile(sprintPath).then(
      () => Promise.reject(new Error("A Sprint with this name already exists.")),
      () => undefined,
    );
    const now = input.now ?? new Date().toISOString();
    const sprint = `---\nafx: true\ntype: SPRINT\nstatus: Draft\nowner: "${input.owner}"\nversion: "0.1"\ncreated_at: "${now}"\nupdated_at: "${now}"\ntags: ["${id}", "blueprint", "external-traceability"]\napproval:\n  spec: Draft\n  design: Draft\n  tasks: Draft\n---\n\n# ${input.name}\n\n## 1. Spec\n\n### Problem Statement\n\nDescribe the intended outcome.\n\n## 2. Design\n\n### [DES-OVR] Overview\n\nDescribe the implementation approach.\n\n## 3. Tasks\n\n### Phase 1: Delivery\n\n#### 1.1 Define the first task\n\n- [ ] Replace this placeholder with verifiable criteria.\n\n### Cross-Reference Index\n\n| Task | Spec requirements | Design sections |\n| --- | --- | --- |\n| 1.1 | TBD | DES-OVR |\n\n## 4. Work Sessions\n\n| Date | Task | Action | Files Modified | Agent | Human |\n| --- | --- | --- | --- | --- | --- |\n`;
    const journal = `---\nafx: true\ntype: JOURNAL\nowner: "${input.owner}"\nversion: "1.0"\ncreated_at: "${now}"\nupdated_at: "${now}"\ntags: ["${id}", "blueprint"]\n---\n\n# ${input.name} Journal\n`;
    await ensureArtifactParent(
      documentRoot,
      path.relative(documentRoot, sprintPath).split(path.sep).join("/"),
    );
    await ensureArtifactParent(
      documentRoot,
      path.relative(documentRoot, journalPath).split(path.sep).join("/"),
    );
    await mkdir(directory, { recursive: true });
    const transactionPath = path.join(input.artifactRoot, BLUEPRINT_TRANSACTION);
    await blueprintArtifactInternals.atomicWrite(
      transactionPath,
      blueprintArtifactInternals.stableJson({
        kind: "afx-blueprint-transaction",
        operation: "create-sprint",
        sprintId: id,
        startedAt: now,
      }),
    );
    await writeFile(sprintPath, sprint, { encoding: "utf8", flag: "wx" });
    try {
      await writeFile(journalPath, journal, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      throw new Error("Sprint was created but its journal could not be persisted.", {
        cause: error,
      });
    }
    await rm(transactionPath, { force: true });
    return { id, sprintPath, journalPath };
  });
}

export async function listBlueprintSprints(
  manifest: BlueprintManifest,
  artifactRoot: string,
  documentRoot?: string,
): Promise<Array<{ id: string; sprintPath: string }>> {
  await stat(path.join(artifactRoot, BLUEPRINT_TRANSACTION)).then(
    () =>
      Promise.reject(new Error("Blueprint has an interrupted operation that requires recovery.")),
    () => undefined,
  );
  const root = resolveInside(
    manifest.schemaVersion === 3 ? (documentRoot ?? artifactRoot) : artifactRoot,
    manifest.schemaVersion === 3 ? "docs/specs" : manifest.artifacts.sprints,
  );
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const sprints: Array<{ id: string; sprintPath: string }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sprintPath = path.join(root, entry.name, `${entry.name}.md`);
    try {
      const content = await readFile(sprintPath, "utf8");
      if (/^type:\s*SPRINT\s*$/m.test(content)) sprints.push({ id: entry.name, sprintPath });
    } catch {
      // Incomplete/non-Sprint folders are ignored and remain user-owned.
    }
  }
  return sprints.sort((left, right) => left.id.localeCompare(right.id));
}

export function assertSessionContext(
  active: BlueprintExecutionContext | undefined,
  requested: BlueprintExecutionContext,
): void {
  if (!active) return;
  if (
    active.blueprintId !== requested.blueprintId ||
    active.checkoutId !== requested.checkoutId ||
    active.blueprintRoot !== requested.blueprintRoot ||
    active.sprintId !== requested.sprintId
  )
    throw new Error("The active agent session is pinned to another Blueprint or checkout.");
}

export interface BlueprintEvidenceInput {
  actor: "agent" | "human";
  procedure: "command" | "manual-review";
  outcome: "passed" | "failed" | "unknown";
  repositoryId: string;
  commit?: string;
  dirty: boolean;
  files: Array<{ path: string; contentHash: `sha256:${string}` }>;
  artifacts: Array<{ path: string; contentHash: `sha256:${string}` }>;
  command?: { argv: string[]; exitCode: number | null };
  notes?: string;
  now?: string;
}

/**
 * Records revision-bound command or Human review evidence without inferring acceptance.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-SDD] [DES-FORMAT]
 */
export async function recordBlueprintEvidence(
  manifest: BlueprintManifest,
  artifactRoot: string,
  input: BlueprintEvidenceInput,
): Promise<string> {
  if (manifest.schemaVersion === 3) {
    if (!manifest.repositories.some((repository) => repository.id === input.repositoryId))
      throw new Error("Evidence repository is not declared by this Blueprint.");
    if (input.procedure === "command" && !input.command)
      throw new Error("Command evidence requires argv and exitCode.");
    const id = randomUUID();
    const evidence = createEvidence(manifest, id, input);
    await updateBlueprint(artifactRoot, manifest.revision, (current) => ({
      ...current,
      evidence: [...(current.evidence ?? []), evidence],
    }));
    return `${path.join(artifactRoot, "blueprint.json")}#evidence/${id}`;
  }
  return withBlueprintLock(artifactRoot, async () => {
    if (!manifest.repositories.some((repository) => repository.id === input.repositoryId))
      throw new Error("Evidence repository is not declared by this Blueprint.");
    if (input.procedure === "command" && !input.command)
      throw new Error("Command evidence requires argv and exitCode.");
    if (input.files.length === 0 || input.artifacts.length === 0)
      throw new Error("Evidence requires code and artifact revision hashes.");
    const id = randomUUID();
    const location = resolveInside(
      artifactRoot,
      path.posix.join(manifest.artifacts.evidence, `${id}.json`),
    );
    const evidence = createEvidence(manifest, id, input);
    await ensureArtifactParent(
      artifactRoot,
      path.relative(artifactRoot, location).split(path.sep).join("/"),
    );
    await mkdir(path.dirname(location), { recursive: true });
    await writeFile(location, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    return location;
  });
}

function createEvidence(
  manifest: BlueprintManifest,
  id: string,
  input: BlueprintEvidenceInput,
): Record<string, unknown> {
  return {
    kind: "afx-blueprint-evidence",
    schemaVersion: manifest.schemaVersion,
    id,
    blueprintId: manifest.id,
    recordedAt: input.now ?? new Date().toISOString(),
    actor: input.actor,
    procedure: input.procedure,
    outcome: input.outcome,
    code: {
      repositoryId: input.repositoryId,
      ...(input.commit ? { commit: input.commit } : {}),
      dirty: input.dirty,
      files: input.files,
    },
    artifacts: input.artifacts,
    ...(input.command ? { command: input.command } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  };
}
