/**
 * Durable model snapshots, source reconciliation and cooperating-writer serialization.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-15] [FR-18] [FR-19]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-MODEL] [DES-EVOLUTION] [DES-STORAGE]
 */
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  type BlueprintManifest,
  openBlueprint,
  resolveInside,
  updateBlueprint,
} from "./blueprint-artifacts";
import { type InvestigationResult, inventoryRepository } from "./blueprint-investigation";
import { validatePortableBlueprint } from "./blueprint-validation";
import { atomicJson, withBlueprintLock } from "./blueprint-writer";
import type { SymbolObservation } from "./repository-blueprint";

export interface BlueprintModel {
  kind: "afx-blueprint-model";
  schemaVersion: 2 | 3;
  blueprintId: string;
  repositoryId: string;
  modelRevisionId: string;
  parentModelRevisionId?: string;
  baseline: {
    id: string;
    repositoryId: string;
    collectedAt: string;
    gitRevision?: string;
    dirty?: boolean;
    files: Array<{ path: string; contentHash: string; source: "disk" }>;
  };
  entities: Array<{
    id: string;
    type: "component" | "file" | "symbol" | "integration";
    name: string;
    description: string;
    evidenceIds: string[];
    source?: {
      path: string;
      positionEncoding: "utf-16";
      symbol?: SymbolObservation;
    };
  }>;
  claims: Array<{
    id: string;
    description: string;
    entityIds: string[];
    evidenceIds: string[];
    classification: "observed" | "inferred";
    confidence: { level: "high" | "medium"; basis: string };
  }>;
  flows: Array<{
    id: string;
    name: string;
    description: string;
    classification: "observed" | "inferred";
    evidenceIds: string[];
    steps: Array<{ description: string; evidenceIds: string[] }>;
  }>;
  relationships: Array<{
    id: string;
    fromEntityId: string;
    toEntityId: string;
    type: string;
    description: string;
    classification: "observed" | "inferred";
    evidenceIds: string[];
  }>;
  commands: Array<{
    id: string;
    purpose: "build" | "test" | "release";
    argv: string[];
    workingDirectory: string;
    prerequisites: string[];
    evidenceIds: string[];
  }>;
  investigation: InvestigationResult;
}
export interface BlueprintChanges {
  kind: "afx-blueprint-reconciliation";
  schemaVersion: 2 | 3;
  blueprintId: string;
  repositoryId: string;
  id: string;
  createdAt: string;
  modelRevisionId: string;
  changed: string[];
  missing: string[];
  added: string[];
  current: string[];
  unknown: string[];
  affectedClaimIds: string[];
  affectedEntityIds: string[];
  renameCandidates: Array<{
    from: string;
    to: string;
    basis: "identical-content";
    state: "needs-review";
  }>;
  fromBaselineId: string;
  toGitRevision?: string;
}
const digest = (value: string | Buffer): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

interface ModelIndex {
  kind: "afx-blueprint-model-index";
  schemaVersion: 2;
  blueprintId: string;
  revision: number;
  updatedAt: string;
  entries: Array<{
    repositoryId: string;
    modelRevisionId: string;
    baselineId: string;
    path: string;
    contentHash: string;
  }>;
}

async function loadIndex(root: string, manifest: BlueprintManifest): Promise<ModelIndex> {
  if (!manifest.artifacts.modelIndex)
    throw new Error("Blueprint needs migration to contract v2 before saving a semantic model.");
  const raw = await readFile(resolveInside(root, manifest.artifacts.modelIndex), "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    },
  );
  if (!raw)
    return {
      kind: "afx-blueprint-model-index",
      schemaVersion: 2,
      blueprintId: manifest.id,
      revision: 0,
      updatedAt: new Date().toISOString(),
      entries: [],
    };
  const index = JSON.parse(raw) as ModelIndex;
  validatePortableBlueprint(index);
  if (
    index.kind !== "afx-blueprint-model-index" ||
    index.schemaVersion !== 2 ||
    index.blueprintId !== manifest.id ||
    !Array.isArray(index.entries) ||
    !Number.isInteger(index.revision)
  )
    throw new Error("Invalid Blueprint model index.");
  return index;
}

/** @see docs/specs/231-app-vscode-blueprint/design.md [DES-MODEL] */
export async function saveBlueprintModel(
  root: string,
  manifest: BlueprintManifest,
  repositoryId: string,
  investigation: InvestigationResult,
  expectedParent?: string | null,
): Promise<BlueprintModel> {
  if (!manifest.repositories.some((repo) => repo.id === repositoryId))
    throw new Error("Unknown model repository.");
  if (manifest.schemaVersion === 3) {
    const previous = manifest.model as BlueprintModel | undefined;
    if (expectedParent !== undefined && (previous?.modelRevisionId ?? null) !== expectedParent)
      throw new Error(
        "Blueprint model changed since inspection. Reinspect or review the newer revision before saving.",
      );
    const model: BlueprintModel = {
      kind: "afx-blueprint-model",
      schemaVersion: 3,
      blueprintId: manifest.id,
      repositoryId,
      modelRevisionId: randomUUID(),
      ...(previous ? { parentModelRevisionId: previous.modelRevisionId } : {}),
      ...deriveModel(repositoryId, investigation),
      investigation,
    };
    validateModelReferences(model);
    await updateBlueprint(root, manifest.revision, (current) => ({ ...current, model }));
    return model;
  }
  return withBlueprintLock(root, async () => {
    const index = await loadIndex(root, manifest);
    const previous = [...index.entries]
      .reverse()
      .find((entry) => entry.repositoryId === repositoryId);
    if (expectedParent !== undefined && (previous?.modelRevisionId ?? null) !== expectedParent)
      throw new Error(
        "Blueprint model changed since inspection. Reinspect or review the newer revision before saving.",
      );
    const model: BlueprintModel = {
      kind: "afx-blueprint-model",
      schemaVersion: 2,
      blueprintId: manifest.id,
      repositoryId,
      modelRevisionId: randomUUID(),
      ...(previous ? { parentModelRevisionId: previous.modelRevisionId } : {}),
      ...deriveModel(repositoryId, investigation),
      investigation,
    };
    validatePortableBlueprint(model);
    validateModelReferences(model);
    const relative = `${manifest.artifacts.modelRevisions}/${model.modelRevisionId}.json`;
    await atomicJson(root, relative, model);
    index.entries.push({
      repositoryId,
      baselineId: model.baseline.id,
      modelRevisionId: model.modelRevisionId,
      path: relative,
      contentHash: digest(`${JSON.stringify(model, null, 2)}\n`),
    });
    index.revision++;
    index.updatedAt = new Date().toISOString();
    await atomicJson(root, manifest.artifacts.modelIndex!, index);
    return model;
  });
}

/** @see docs/specs/231-app-vscode-blueprint/design.md [DES-MODEL] [DES-EVOLUTION] */
export async function loadBlueprintModel(
  root: string,
  manifest: BlueprintManifest,
  repositoryId: string,
): Promise<BlueprintModel | undefined> {
  if (manifest.schemaVersion === 3) {
    const current = await openBlueprint(root);
    const model = current.model as BlueprintModel | undefined;
    if (!model) return undefined;
    validateModelReferences(model);
    if (
      model.schemaVersion !== 3 ||
      model.blueprintId !== current.id ||
      model.repositoryId !== repositoryId
    )
      throw new Error("Model identity does not match its Blueprint.");
    return model;
  }
  if (manifest.schemaVersion !== 2) return undefined;
  const entry = [...(await loadIndex(root, manifest)).entries]
    .reverse()
    .find((item) => item.repositoryId === repositoryId);
  if (!entry) return undefined;
  const raw = await readFile(resolveInside(root, entry.path), "utf8");
  if (digest(raw) !== entry.contentHash)
    throw new Error("Immutable Blueprint model has changed; review the artifact before use.");
  const model = JSON.parse(raw) as BlueprintModel;
  validatePortableBlueprint(model);
  validateModelReferences(model);
  if (
    model.kind !== "afx-blueprint-model" ||
    model.schemaVersion !== 2 ||
    model.blueprintId !== manifest.id ||
    model.repositoryId !== repositoryId ||
    model.modelRevisionId !== entry.modelRevisionId
  )
    throw new Error("Model identity does not match its index.");
  return model;
}

/** @see docs/specs/231-app-vscode-blueprint/spec.md [FR-18] */
export async function reconcileBlueprintModel(
  model: BlueprintModel,
  codeRoot: string,
): Promise<BlueprintChanges> {
  const files = await inventoryRepository(codeRoot);
  const inventory = new Set(files);
  const changes: BlueprintChanges = {
    kind: "afx-blueprint-reconciliation",
    schemaVersion: model.schemaVersion,
    blueprintId: model.blueprintId,
    repositoryId: model.repositoryId,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    modelRevisionId: model.modelRevisionId,
    changed: [],
    missing: [],
    added: files.filter((file) => !model.investigation.inventory.includes(file)),
    current: [],
    unknown: [],
    affectedClaimIds: [],
    affectedEntityIds: [],
    renameCandidates: [],
    fromBaselineId: model.baseline.id,
  };
  try {
    changes.toGitRevision = (
      await promisify(execFile)(
        "git",
        ["--no-optional-locks", "-c", "core.fsmonitor=false", "-C", codeRoot, "rev-parse", "HEAD"],
        { timeout: 5000 },
      )
    ).stdout.trim();
  } catch {
    /* Non-Git/absent history remains explicit. */
  }
  const evidence = new Map(model.investigation.evidence.map((item) => [item.path, item]));
  for (const [file, item] of evidence) {
    if (!inventory.has(file)) {
      changes.missing.push(file);
      continue;
    }
    try {
      const canonical = await realpath(resolveInside(codeRoot, file));
      const relative = path.relative(await realpath(codeRoot), canonical);
      if (relative.startsWith("..") || path.isAbsolute(relative))
        throw new Error("Unbound source.");
      (digest(await readFile(canonical)) === item.contentHash
        ? changes.current
        : changes.changed
      ).push(file);
    } catch {
      changes.unknown.push(file);
    }
  }
  changes.unknown.push(
    ...files.filter((file) => !evidence.has(file) && !changes.added.includes(file)),
  );
  const affectedEvidence = new Set(
    model.investigation.evidence
      .filter(
        (item) =>
          changes.changed.includes(item.path) ||
          changes.missing.includes(item.path) ||
          changes.unknown.includes(item.path),
      )
      .map((item) => item.id),
  );
  changes.affectedClaimIds = model.claims
    .filter((item) => item.evidenceIds.some((id) => affectedEvidence.has(id)))
    .map((item) => item.id);
  changes.affectedEntityIds = model.entities
    .filter((item) => item.evidenceIds.some((id) => affectedEvidence.has(id)))
    .map((item) => item.id);
  for (const added of changes.added) {
    try {
      const location = await realpath(resolveInside(codeRoot, added));
      const relative = path.relative(await realpath(codeRoot), location);
      if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
      const contentHash = digest(await readFile(location));
      for (const missing of changes.missing)
        if (evidence.get(missing)?.contentHash === contentHash)
          changes.renameCandidates.push({
            from: missing,
            to: added,
            basis: "identical-content",
            state: "needs-review",
          });
    } catch {
      /* A concurrent deletion is not a supported rename. */
    }
  }
  return changes;
}

/** @see docs/specs/231-app-vscode-blueprint/design.md [DES-EVOLUTION] */
export async function saveBlueprintChanges(
  root: string,
  manifest: BlueprintManifest,
  changes: BlueprintChanges,
): Promise<void> {
  if (manifest.id !== changes.blueprintId)
    throw new Error("Invalid Blueprint evolution destination.");
  if (manifest.schemaVersion === 3) {
    await updateBlueprint(root, manifest.revision, (current) => ({
      ...current,
      reconciliation: changes,
    }));
    return;
  }
  if (!manifest.artifacts.evolution) throw new Error("Invalid Blueprint evolution destination.");
  validatePortableBlueprint(changes);
  await withBlueprintLock(root, () =>
    atomicJson(root, `${manifest.artifacts.evolution}/${changes.id}.json`, changes),
  );
}

/** Builds only relationships supported by source reads; no inferred call graph from filenames. */
function deriveModel(
  repositoryId: string,
  investigation: InvestigationResult,
): Pick<
  BlueprintModel,
  "baseline" | "entities" | "claims" | "flows" | "relationships" | "commands"
> {
  const entities: BlueprintModel["entities"] = [];
  const files = new Map(investigation.evidence.map((item) => [item.path, item]));
  const stableId = (key: string): string => {
    const hex = createHash("sha256").update(`${repositoryId}:${key}`).digest("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  };
  for (const [file] of files)
    entities.push({
      id: stableId(`file:${file}`),
      type: "file",
      name: file,
      description: "Source examined during repository investigation.",
      source: { path: file, positionEncoding: "utf-16" },
      evidenceIds: investigation.evidence
        .filter((item) => item.path === file)
        .map((item) => item.id),
    });
  for (const observed of investigation.symbols ?? []) {
    const visit = (symbols: typeof observed.symbols, container: string[]): void => {
      for (const symbol of symbols) {
        const evidenceIds = investigation.evidence
          .filter(
            (item) => item.path === observed.path && item.contentHash === observed.contentHash,
          )
          .map((item) => item.id);
        if (evidenceIds.length)
          entities.push({
            id: stableId(
              `symbol:${observed.path}:${[...container, symbol.name].join("/")}:${symbol.kind}:${symbol.detail ?? ""}`,
            ),
            type: "symbol",
            name: symbol.name,
            description: symbol.detail ?? symbol.name,
            source: { path: observed.path, positionEncoding: "utf-16", symbol },
            evidenceIds,
          });
        visit(symbol.children ?? [], [...container, symbol.name]);
      }
    };
    visit(observed.symbols, []);
  }
  for (const finding of investigation.findings)
    if (finding.category === "component" || finding.category === "integration")
      entities.push({
        id: finding.id,
        type: finding.category,
        name: finding.title,
        description: finding.description,
        evidenceIds: finding.evidenceIds,
      });
  const claims = investigation.findings.map((finding) => ({
    id: stableId(`claim:${finding.id}`),
    description: finding.description,
    entityIds: entities
      .filter((entity) => entity.evidenceIds.some((id) => finding.evidenceIds.includes(id)))
      .map((entity) => entity.id),
    evidenceIds: finding.evidenceIds,
    classification: finding.classification,
    confidence: {
      level: finding.classification === "observed" ? ("high" as const) : ("medium" as const),
      basis:
        finding.classification === "observed"
          ? "Investigator cites source reads; this is not execution verification."
          : "Interpretation of cited source; review before treating as intent.",
    },
  }));
  const flows = investigation.findings
    .filter((finding) => finding.category === "flow")
    .map((finding) => ({
      id: stableId(`flow:${finding.id}`),
      name: finding.title,
      description: finding.description,
      classification: finding.classification,
      evidenceIds: finding.evidenceIds,
      steps: finding.steps ?? [],
    }));
  return {
    baseline: {
      id: randomUUID(),
      repositoryId,
      collectedAt: investigation.collectedAt,
      ...(investigation.gitRevision ? { gitRevision: investigation.gitRevision } : {}),
      ...(investigation.dirty !== undefined ? { dirty: investigation.dirty } : {}),
      files: [...files].map(([file, item]) => ({
        path: file,
        contentHash: item.contentHash,
        source: "disk",
      })),
    },
    entities,
    claims,
    flows,
    relationships: (investigation.relationships ?? []).map((item) => ({
      id: stableId(`relationship:${item.fromFindingId}:${item.toFindingId}:${item.type}`),
      fromEntityId: item.fromFindingId,
      toEntityId: item.toFindingId,
      type: item.type,
      description: item.description,
      classification: item.classification,
      evidenceIds: item.evidenceIds,
    })),
    commands: investigation.findings.flatMap((finding) =>
      finding.command &&
      (finding.category === "build" ||
        finding.category === "test" ||
        finding.category === "release")
        ? [
            {
              id: stableId(`command:${finding.id}`),
              purpose: finding.category,
              ...finding.command,
              evidenceIds: finding.evidenceIds,
            },
          ]
        : [],
    ),
  };
}

function validateModelReferences(model: BlueprintModel): void {
  for (const records of [
    model.entities,
    model.claims,
    model.flows,
    model.investigation.evidence,
    model.investigation.findings,
  ]) {
    if (new Set(records.map((item) => item.id)).size !== records.length)
      throw new Error("Duplicate model record identity.");
  }
  const compare = (
    left: { line: number; character: number },
    right: { line: number; character: number },
  ) => left.line - right.line || left.character - right.character;
  const checkSymbol = (symbol: SymbolObservation): void => {
    if (
      compare(symbol.range.start, symbol.range.end) > 0 ||
      compare(symbol.selectionRange.start, symbol.selectionRange.end) > 0 ||
      compare(symbol.range.start, symbol.selectionRange.start) > 0 ||
      compare(symbol.selectionRange.end, symbol.range.end) > 0
    )
      throw new Error("Model has invalid LSP ranges.");
    for (const child of symbol.children ?? []) checkSymbol(child);
  };
  for (const entity of model.entities) if (entity.source?.symbol) checkSymbol(entity.source.symbol);
  const evidence = new Set(model.investigation.evidence.map((item) => item.id));
  const entities = new Set(model.entities.map((item) => item.id));
  if (model.baseline.repositoryId !== model.repositoryId)
    throw new Error("Model baseline repository mismatch.");
  for (const item of [
    ...model.claims,
    ...model.entities,
    ...model.flows,
    ...model.relationships,
    ...model.commands,
    ...model.investigation.findings,
  ]) {
    if (!item.evidenceIds.every((id) => evidence.has(id)))
      throw new Error("Model references undeclared source evidence.");
  }
  if (
    model.relationships.some(
      (item) => !entities.has(item.fromEntityId) || !entities.has(item.toEntityId),
    )
  )
    throw new Error("Relationship references an undeclared entity.");
  if (model.claims.some((claim) => claim.entityIds.some((id) => !entities.has(id))))
    throw new Error("Claim references undeclared model entity.");
}
