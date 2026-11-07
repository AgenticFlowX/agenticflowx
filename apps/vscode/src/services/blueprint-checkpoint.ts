import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { isPortableRelativePath } from "./blueprint-artifacts";
import type { InvestigationResult } from "./blueprint-investigation";

export interface BlueprintCheckpoint {
  version: 1;
  root: string;
  parentRevision: string | null;
  savedAt: string;
  result: InvestigationResult;
  operation?: {
    kind: "update" | "rebuild";
    parentManifestRevision: number;
    affectedIds: string[];
    scopePaths: string[];
    inventory: string[];
  };
}
const MAX_BYTES = 2 * 1024 * 1024;
const TTL = 14 * 24 * 60 * 60 * 1000;
const key = (root: string) =>
  `${createHash("sha256").update(path.resolve(root)).digest("hex")}.json`;

function validate(record: BlueprintCheckpoint): void {
  const r = record.result;
  const op = record.operation;
  if (
    op &&
    (!["update", "rebuild"].includes(op.kind) ||
      !Number.isInteger(op.parentManifestRevision) ||
      !Array.isArray(op.affectedIds) ||
      !op.affectedIds.every((id) => typeof id === "string") ||
      !Array.isArray(op.scopePaths) ||
      !op.scopePaths.every(isPortableRelativePath) ||
      !Array.isArray(op.inventory) ||
      !op.inventory.every(isPortableRelativePath))
  )
    throw new Error("Invalid checkpoint maintenance operation.");
  if (
    record.version !== 1 ||
    typeof record.root !== "string" ||
    !(record.parentRevision === null || typeof record.parentRevision === "string") ||
    !Number.isFinite(Date.parse(record.savedAt)) ||
    !r ||
    typeof r.id !== "string" ||
    !Number.isFinite(Date.parse(r.collectedAt)) ||
    !["partial", "cancelled", "complete", "failed"].includes(r.outcome) ||
    typeof r.stopReason !== "string" ||
    !Array.isArray(r.inventory) ||
    r.inventory.length > 5000 ||
    !r.inventory.every(isPortableRelativePath) ||
    !Array.isArray(r.evidence) ||
    !Array.isArray(r.findings) ||
    !Array.isArray(r.gaps) ||
    !r.gaps.every((v) => typeof v === "string") ||
    !r.usage ||
    ![
      r.usage.calls,
      r.usage.bytes,
      r.usage.estimatedInputTokens,
      r.usage.estimatedOutputTokens,
    ].every((v) => Number.isFinite(v) && v >= 0)
  )
    throw new Error("Invalid investigation checkpoint.");
  const ids = new Set<string>();
  for (const e of r.evidence) {
    if (
      !e ||
      typeof e.id !== "string" ||
      !isPortableRelativePath(e.path) ||
      !/^sha256:[a-f0-9]{64}$/.test(e.contentHash) ||
      !Number.isInteger(e.startLine) ||
      e.startLine < 1 ||
      !Number.isInteger(e.endLine) ||
      e.endLine < e.startLine
    )
      throw new Error("Invalid checkpoint evidence.");
    ids.add(e.id);
  }
  for (const f of r.findings)
    if (
      !f ||
      typeof f.id !== "string" ||
      typeof f.title !== "string" ||
      typeof f.description !== "string" ||
      !["purpose", "component", "flow", "build", "test", "release", "integration", "risk"].includes(
        f.category,
      ) ||
      !["observed", "inferred"].includes(f.classification) ||
      !Array.isArray(f.evidenceIds) ||
      !f.evidenceIds.length ||
      !f.evidenceIds.every((id) => ids.has(id))
    )
      throw new Error("Invalid checkpoint findings.");
}

/** Local-only validated state: four checkpoints maximum, 2 MiB each, 14-day retention. */
export function createBlueprintCheckpointStore(directory: string) {
  return {
    async save(record: BlueprintCheckpoint): Promise<void> {
      validate(record);
      await mkdir(directory, { recursive: true });
      const value = JSON.stringify(record);
      if (Buffer.byteLength(value) > MAX_BYTES)
        throw new Error(
          "Checkpoint exceeds 2 MiB; current findings remain available but cannot be resumed after restart.",
        );
      const file = path.join(directory, key(record.root));
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, value, { mode: 0o600 });
        await rename(temporary, file);
      } finally {
        await rm(temporary, { force: true });
      }
      const entries = await Promise.all(
        (await readdir(directory))
          .filter((name) => /^[a-f0-9]{64}\.json$/.test(name))
          .map(async (name) => ({
            name,
            mtime: (await lstat(path.join(directory, name))).mtimeMs,
          })),
      );
      for (const entry of entries
        .filter((entry) => entry.name !== path.basename(file))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(3))
        await rm(path.join(directory, entry.name), { force: true });
    },
    async load(
      root: string,
      parentRevision: string | null,
    ): Promise<BlueprintCheckpoint | undefined> {
      const file = path.join(directory, key(root));
      const info = await lstat(file).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      });
      if (!info) return undefined;
      if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_BYTES)
        throw new Error("Unsafe investigation checkpoint.");
      const record = JSON.parse(await readFile(file, "utf8")) as BlueprintCheckpoint;
      validate(record);
      if (
        path.resolve(record.root) !== path.resolve(root) ||
        record.parentRevision !== parentRevision
      )
        throw new Error(
          "Checkpoint belongs to another checkout or Blueprint revision. Start a new inspection or restore the original binding.",
        );
      if (Date.now() - Date.parse(record.savedAt) > TTL) {
        await rm(file);
        return undefined;
      }
      return record;
    },
    async clear(root: string): Promise<void> {
      await rm(path.join(directory, key(root)), { force: true });
    },
  };
}
