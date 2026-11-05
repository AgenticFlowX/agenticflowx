/**
 * Durable AFX Blueprint v1/v2 artifacts, validation and revision-aware writes.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-9] [FR-10] [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-FORMAT] [DES-STORAGE] [DES-ERR]
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { portableBlueprintSchema, validatePortableBlueprint } from "./blueprint-validation";
import { withBlueprintLock } from "./blueprint-writer";

export const BLUEPRINT_SCHEMA_VERSION = 3;
export const BLUEPRINT_MANIFEST = "blueprint.json";
export const BLUEPRINT_TRANSACTION = ".afx-blueprint-transaction.json";

export interface BlueprintRepository {
  id: string;
  name: string;
  kind: "git" | "folder";
  description?: string;
}

export interface BlueprintManifest {
  $schema?: string;
  kind: "afx-blueprint";
  schemaVersion: 1 | 2 | 3;
  id: string;
  name: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  repositories: BlueprintRepository[];
  artifacts: {
    overview: string;
    research: string;
    sprints: string;
    decisions: string;
    traces: string;
    evidence: string;
    specs: string;
    modelIndex?: string;
    modelRevisions?: string;
    evolution?: string;
  };
  traceability: { mode: "external"; policyVersion: 1 };
  documents?: Array<{ id: string; name: string; kind: "sdd" }>;
  model?: unknown;
  links?: unknown[];
  reviews?: unknown[];
  reconciliation?: unknown;
  evidence?: unknown[];
  description?: string;
}

export interface BlueprintBinding {
  blueprintId: string;
  artifactRoot: string;
  checkouts: Record<string, string>;
  documentRoots?: Record<string, string>;
}

export interface CreateBlueprintInput {
  schemaVersion?: 1 | 2 | 3;
  artifactRoot: string;
  name: string;
  description?: string;
  repository: Omit<BlueprintRepository, "id"> & { id?: string };
  researchMarkdown: string;
  now?: string;
}

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
) {
  const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
  if (unknown.length > 0)
    throw new Error(`${label} contains unknown properties: ${unknown.join(", ")}.`);
}

export function isPortableRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes(":"))
    return false;
  if (path.posix.isAbsolute(value) || [...value].some((character) => character.charCodeAt(0) < 32))
    return false;
  return !value.split("/").some((part) => part === "." || part === ".." || part === ".git");
}

/**
 * Validates the strict portable manifest shape before semantic/root checks.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-9] [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-FORMAT]
 */
export function validateBlueprintManifest(value: unknown): BlueprintManifest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Blueprint manifest must be an object.");
  const record = value as Record<string, unknown>;
  if (
    record["schemaVersion"] !== 1 &&
    record["schemaVersion"] !== 2 &&
    record["schemaVersion"] !== 3
  )
    throw new Error("Unsupported Blueprint schema version; open read-only or migrate explicitly.");
  if (record["schemaVersion"] === 3) {
    rejectUnknownKeys(
      record,
      [
        "$schema",
        "kind",
        "schemaVersion",
        "id",
        "name",
        "description",
        "revision",
        "createdAt",
        "updatedAt",
        "repositories",
        "documents",
        "traceability",
        "model",
        "links",
        "reviews",
        "reconciliation",
        "evidence",
      ],
      "Blueprint manifest",
    );
    validatePortableBlueprint(value);
    const repositories = record["repositories"] as Array<Record<string, unknown>>;
    if (repositories.length !== 1) throw new Error("Blueprint v3 supports one repository.");
    const ids = new Set<string>();
    for (const document of record["documents"] as Array<Record<string, unknown>>) {
      const id = String(document["id"]);
      if (ids.has(id)) throw new Error("Blueprint document root ids must be unique.");
      ids.add(id);
    }
    return value as BlueprintManifest;
  }
  rejectUnknownKeys(
    record,
    [
      "$schema",
      "kind",
      "schemaVersion",
      "id",
      "name",
      "revision",
      "createdAt",
      "updatedAt",
      "repositories",
      "artifacts",
      "traceability",
      "description",
    ],
    "Blueprint manifest",
  );
  if (record["kind"] !== "afx-blueprint") throw new Error("Unsupported Blueprint kind.");
  if (record["schemaVersion"] !== 1 && record["schemaVersion"] !== 2)
    throw new Error("Unsupported Blueprint schema version; open read-only or migrate explicitly.");
  if (!UUID_RE.test(String(record["id"]))) throw new Error("Blueprint id must be a UUID.");
  if (typeof record["name"] !== "string" || !record["name"].trim())
    throw new Error("Blueprint name is required.");
  if (!Number.isInteger(record["revision"]) || Number(record["revision"]) < 0)
    throw new Error("Blueprint revision must be a non-negative integer.");
  if (
    !TIMESTAMP_RE.test(String(record["createdAt"])) ||
    !TIMESTAMP_RE.test(String(record["updatedAt"]))
  )
    throw new Error("Blueprint timestamps require UTC millisecond precision.");
  const repositories = record["repositories"];
  if (!Array.isArray(repositories) || repositories.length === 0)
    throw new Error("Blueprint must declare at least one repository.");
  const repoIds = new Set<string>();
  for (const repository of repositories as Array<Record<string, unknown>>) {
    rejectUnknownKeys(repository, ["id", "name", "kind", "description"], "Repository");
    if (!UUID_RE.test(String(repository["id"]))) throw new Error("Repository id must be a UUID.");
    if (repoIds.has(String(repository["id"]))) throw new Error("Repository ids must be unique.");
    repoIds.add(String(repository["id"]));
    if (repository["kind"] !== "git" && repository["kind"] !== "folder")
      throw new Error("Repository kind must be git or folder.");
    if (typeof repository["name"] !== "string" || !repository["name"])
      throw new Error("Repository name is required.");
  }
  const artifacts = record["artifacts"] as Record<string, unknown> | undefined;
  if (!artifacts) throw new Error("Blueprint artifact paths are required.");
  rejectUnknownKeys(
    artifacts,
    [
      "overview",
      "research",
      "sprints",
      "decisions",
      "traces",
      "evidence",
      "specs",
      ...(record["schemaVersion"] === 2 ? ["modelIndex", "modelRevisions", "evolution"] : []),
    ],
    "Artifacts",
  );
  for (const key of ["overview", "research", "sprints", "decisions", "traces", "evidence", "specs"])
    if (!isPortableRelativePath(artifacts?.[key]))
      throw new Error(`Invalid artifact path: ${key}.`);
  if (record["schemaVersion"] === 2)
    for (const key of ["modelIndex", "modelRevisions", "evolution"])
      if (!isPortableRelativePath(artifacts[key]))
        throw new Error(`Invalid v2 artifact path: ${key}.`);
  const traceability = record["traceability"] as Record<string, unknown> | undefined;
  if (!traceability) throw new Error("Blueprint traceability policy is required.");
  rejectUnknownKeys(traceability, ["mode", "policyVersion"], "Traceability policy");
  if (traceability?.["mode"] !== "external" || traceability["policyVersion"] !== 1)
    throw new Error("Unsupported external traceability policy.");
  validatePortableBlueprint(value);
  return value as BlueprintManifest;
}

export function resolveInside(root: string, relativePath: string): string {
  if (!isPortableRelativePath(relativePath)) throw new Error("Artifact path must be portable.");
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(path.resolve(root), resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error("Artifact path escapes the Blueprint root.");
  return resolved;
}

async function atomicWrite(file: string, content: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.afx-${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Creates a self-contained, portable Blueprint without placing machine paths in the manifest.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-9] [FR-10] [NFR-6]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-STORAGE] [DES-FORMAT]
 */
export async function createBlueprint(input: CreateBlueprintInput): Promise<BlueprintManifest> {
  return withBlueprintLock(input.artifactRoot, async () => {
    const entries = await readdir(input.artifactRoot);
    if (entries.some((entry) => entry !== ".afx-blueprint.lock"))
      throw new Error(
        `Blueprint destination is not empty: ${input.artifactRoot}. Open the existing Blueprint or choose a different name/location. Existing files will not be overwritten.`,
      );
    const manifestPath = path.join(input.artifactRoot, BLUEPRINT_MANIFEST);
    await stat(manifestPath).then(
      () => Promise.reject(new Error("A Blueprint already exists at the selected destination.")),
      () => undefined,
    );
    const now = input.now ?? new Date().toISOString();
    const schemaVersion = input.schemaVersion ?? BLUEPRINT_SCHEMA_VERSION;
    const common = {
      $schema: schemaVersion === 3 ? "urn:afx:blueprint:3" : "./blueprint.schema.json",
      kind: "afx-blueprint",
      schemaVersion,
      id: randomUUID(),
      name: input.name.trim(),
      revision: 1,
      createdAt: now,
      updatedAt: now,
      repositories: [{ ...input.repository, id: input.repository.id ?? randomUUID() }],
      traceability: { mode: "external" as const, policyVersion: 1 as const },
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    };
    const manifest = (
      schemaVersion === 3
        ? {
            ...common,
            documents: [{ id: "sdd", name: "AFX documents", kind: "sdd" as const }],
            links: [],
            reviews: [],
            evidence: [],
          }
        : {
            ...common,
            artifacts: {
              overview: "blueprint.md",
              research: "research",
              sprints: "docs/specs",
              decisions: "decisions",
              traces: "traces/links.json",
              evidence: "evidence",
              specs: "docs/specs",
              ...(schemaVersion === 2
                ? {
                    modelIndex: "model/index.json",
                    modelRevisions: "model/revisions",
                    evolution: "evolution",
                  }
                : {}),
            },
          }
    ) as BlueprintManifest;
    validateBlueprintManifest(manifest);
    const traceStore = {
      kind: "afx-blueprint-traces",
      schemaVersion: manifest.schemaVersion,
      blueprintId: manifest.id,
      revision: 1,
      updatedAt: now,
      positionEncoding: "utf-16",
      links: [],
    };
    const transactionPath = path.join(input.artifactRoot, BLUEPRINT_TRANSACTION);
    await atomicWrite(
      transactionPath,
      stableJson({
        kind: "afx-blueprint-transaction",
        operation: "create",
        blueprintId: manifest.id,
        startedAt: now,
      }),
    );
    await atomicWrite(
      path.join(input.artifactRoot, "blueprint.md"),
      `# ${manifest.name}\n\n${manifest.description ?? "AFX Blueprint"}\n\n${input.researchMarkdown.trim()}\n`,
    );
    if (manifest.schemaVersion < 3) {
      for (const folder of ["research", "docs/specs", "decisions", "traces", "evidence"])
        await mkdir(path.join(input.artifactRoot, folder), { recursive: true });
      await atomicWrite(
        path.join(input.artifactRoot, "research", "repository.md"),
        input.researchMarkdown,
      );
      await atomicWrite(
        path.join(input.artifactRoot, "traces", "links.json"),
        stableJson(traceStore),
      );
      await atomicWrite(
        path.join(input.artifactRoot, "blueprint.schema.json"),
        stableJson(portableBlueprintSchema(manifest.schemaVersion)),
      );
    }
    if (manifest.schemaVersion === 2)
      await atomicWrite(
        resolveInside(input.artifactRoot, manifest.artifacts.modelIndex!),
        stableJson({
          kind: "afx-blueprint-model-index",
          schemaVersion: 2,
          blueprintId: manifest.id,
          revision: 0,
          updatedAt: now,
          entries: [],
        }),
      );
    await atomicWrite(manifestPath, stableJson(manifest));
    await rm(transactionPath, { force: true });
    return manifest;
  });
}

export async function openBlueprint(artifactRootOrManifest: string): Promise<BlueprintManifest> {
  const manifestPath = artifactRootOrManifest.endsWith(".json")
    ? artifactRootOrManifest
    : path.join(artifactRootOrManifest, BLUEPRINT_MANIFEST);
  await stat(path.join(path.dirname(manifestPath), BLUEPRINT_TRANSACTION)).then(
    () =>
      Promise.reject(new Error("Blueprint has an interrupted operation that requires recovery.")),
    () => undefined,
  );
  const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  return validateBlueprintManifest(parsed);
}

/**
 * Performs an expected-revision manifest update with atomic replacement.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-STORAGE] [DES-ERR]
 */
export async function updateBlueprint(
  artifactRoot: string,
  expectedRevision: number,
  transform: (manifest: BlueprintManifest) => BlueprintManifest,
): Promise<BlueprintManifest> {
  return withBlueprintLock(artifactRoot, async () => {
    const current = await openBlueprint(artifactRoot);
    if (current.revision !== expectedRevision) throw new Error("Blueprint revision conflict.");
    const next = transform(structuredClone(current));
    next.revision = current.revision + 1;
    next.updatedAt = new Date().toISOString();
    validateBlueprintManifest(next);
    await atomicWrite(path.join(artifactRoot, BLUEPRINT_MANIFEST), stableJson(next));
    return next;
  });
}

export const blueprintArtifactInternals = { atomicWrite, stableJson };
