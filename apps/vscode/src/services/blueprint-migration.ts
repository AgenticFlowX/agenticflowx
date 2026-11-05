/**
 * Explicit, restartable v1 migration with original-byte conflict detection.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-15] [FR-19]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-MODEL] [DES-STORAGE]
 */
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

import {
  BLUEPRINT_TRANSACTION,
  type BlueprintManifest,
  blueprintArtifactInternals,
  openBlueprint,
  resolveInside,
  validateBlueprintManifest,
} from "./blueprint-artifacts";
import { portableBlueprintSchema, validatePortableBlueprint } from "./blueprint-validation";
import { atomicJson, ensureArtifactParent, withBlueprintLock } from "./blueprint-writer";

interface MigrationTransaction {
  kind: "afx-blueprint-migration";
  version: 1;
  writes: Array<{ path: string; before: string | null; after: string }>;
}
async function readOptional(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
async function finishMigration(
  root: string,
  transaction: MigrationTransaction,
): Promise<BlueprintManifest> {
  if (
    transaction.kind !== "afx-blueprint-migration" ||
    transaction.version !== 1 ||
    !Array.isArray(transaction.writes) ||
    !transaction.writes.length
  )
    throw new Error(
      "This interrupted operation is not a recoverable v2 migration. Retain the transaction for manual review.",
    );
  const finalWrite = transaction.writes.at(-1);
  if (finalWrite?.path !== "blueprint.json")
    throw new Error("Migration must publish its manifest last.");
  const manifest = validateBlueprintManifest(JSON.parse(finalWrite.after));
  if (manifest.schemaVersion !== 2) throw new Error("Recovery requires a v2 manifest.");
  const allowed = new Set([
    "blueprint.json",
    "blueprint.schema.json",
    manifest.artifacts.traces,
    manifest.artifacts.modelIndex,
  ]);
  if (
    transaction.writes.some(
      (item) =>
        !allowed.has(item.path) &&
        !(item.path.startsWith(`${manifest.artifacts.evidence}/`) && item.path.endsWith(".json")),
    )
  )
    throw new Error("Migration contains a destination outside its declared contract.");
  // Check every destination before changing anything. Independently edited bytes are never overwritten.
  for (const item of transaction.writes) {
    const current = await readOptional(resolveInside(root, item.path));
    if (current !== item.before && current !== item.after)
      throw new Error(
        `Migration conflict: ${item.path} changed independently. Original bytes remain in the transaction.`,
      );
    await ensureArtifactParent(root, item.path);
    if (item.path.endsWith(".json") && item.path !== "blueprint.schema.json")
      validatePortableBlueprint(JSON.parse(item.after));
  }
  for (const item of transaction.writes)
    await blueprintArtifactInternals.atomicWrite(resolveInside(root, item.path), item.after);
  await rm(path.join(root, BLUEPRINT_TRANSACTION));
  return openBlueprint(root);
}
export async function migrateBlueprint(root: string): Promise<BlueprintManifest> {
  return withBlueprintLock(root, async () => {
    const current = await openBlueprint(root);
    if (current.schemaVersion === 2) return current;
    const now = new Date().toISOString();
    const next = validateBlueprintManifest({
      ...current,
      schemaVersion: 2,
      revision: current.revision + 1,
      updatedAt: now,
      artifacts: {
        ...current.artifacts,
        modelIndex: "model/index.json",
        modelRevisions: "model/revisions",
        evolution: "evolution",
      },
    });
    const writes: MigrationTransaction["writes"] = [];
    const stage = async (relative: string, value: unknown): Promise<void> => {
      writes.push({
        path: relative,
        before: await readOptional(resolveInside(root, relative)),
        after: blueprintArtifactInternals.stableJson(value),
      });
    };
    const trace = JSON.parse(
      await readFile(resolveInside(root, current.artifacts.traces), "utf8"),
    ) as Record<string, unknown>;
    validatePortableBlueprint(trace);
    if (trace["blueprintId"] !== current.id)
      throw new Error("Trace store belongs to another Blueprint.");
    await stage(current.artifacts.traces, { ...trace, schemaVersion: 2 });
    const evidenceRoot = resolveInside(root, current.artifacts.evidence);
    for (const entry of await readdir(evidenceRoot, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const relative = `${current.artifacts.evidence}/${entry.name}`;
      const evidence = JSON.parse(await readFile(resolveInside(root, relative), "utf8")) as Record<
        string,
        unknown
      >;
      validatePortableBlueprint(evidence);
      if (evidence["blueprintId"] !== current.id)
        throw new Error("Evidence belongs to another Blueprint.");
      await stage(relative, { ...evidence, schemaVersion: 2 });
    }
    if ((await readOptional(resolveInside(root, next.artifacts.modelIndex!))) !== null)
      throw new Error("Migration would replace an existing model index.");
    await stage(next.artifacts.modelIndex!, {
      kind: "afx-blueprint-model-index",
      schemaVersion: 2,
      blueprintId: next.id,
      revision: 0,
      updatedAt: now,
      entries: [],
    });
    await stage("blueprint.schema.json", portableBlueprintSchema(2));
    await stage("blueprint.json", next); // Manifest becomes visible last.
    const transaction: MigrationTransaction = {
      kind: "afx-blueprint-migration",
      version: 1,
      writes,
    };
    await atomicJson(root, BLUEPRINT_TRANSACTION, transaction);
    return finishMigration(root, transaction);
  });
}
export async function recoverBlueprintMigration(root: string): Promise<BlueprintManifest> {
  return withBlueprintLock(root, async () => {
    const transaction = JSON.parse(
      await readFile(path.join(root, BLUEPRINT_TRANSACTION), "utf8"),
    ) as MigrationTransaction;
    return finishMigration(root, transaction);
  });
}
