/**
 * Disposable, versioned Blueprint observation storage outside inspected projects.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-5] [FR-7]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-STORAGE] [DES-ERR]
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ObservationCacheRecord {
  schemaVersion: 1;
  producer: "afx-vscode";
  projectId: string;
  collectedAt: string;
  payload: unknown;
}

function cacheFile(storageRoot: string, projectId: string): string {
  const key = createHash("sha256").update(projectId).digest("hex");
  return path.join(storageRoot, "blueprints", `${key}.json`);
}

export interface BlueprintObservationStorage {
  available: boolean;
  read(projectId: string): Promise<ObservationCacheRecord | undefined>;
  write(record: ObservationCacheRecord): Promise<void>;
  clear(projectId?: string): Promise<void>;
  cleanup(activeProjectIds: readonly string[]): Promise<void>;
  details(): { storageRoot?: string; mode: "disk" | "memory" };
}

/**
 * Creates recoverable observation storage. A missing storage URI uses memory and never falls back into a project.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-5] [NFR-1]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-STORAGE]
 */
export function createBlueprintObservationStorage(
  storageRoot?: string,
): BlueprintObservationStorage {
  const memory = new Map<string, ObservationCacheRecord>();
  let generation = 0;

  return {
    available: Boolean(storageRoot),
    async read(projectId) {
      if (!storageRoot) return memory.get(projectId);
      try {
        const parsed = JSON.parse(
          await readFile(cacheFile(storageRoot, projectId), "utf8"),
        ) as ObservationCacheRecord;
        if (
          parsed.schemaVersion !== 1 ||
          parsed.producer !== "afx-vscode" ||
          parsed.projectId !== projectId
        )
          throw new Error("incompatible cache");
        return parsed;
      } catch {
        await rm(cacheFile(storageRoot, projectId), { force: true }).catch(() => undefined);
        return undefined;
      }
    },
    async write(record) {
      const started = generation;
      if (!storageRoot) {
        if (started === generation) memory.set(record.projectId, structuredClone(record));
        return;
      }
      const file = cacheFile(storageRoot, record.projectId);
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, "utf8");
      if (started !== generation) {
        await rm(temporary, { force: true });
        return;
      }
      await rename(temporary, file);
    },
    async clear(projectId) {
      generation += 1;
      if (projectId) memory.delete(projectId);
      else memory.clear();
      if (!storageRoot) return;
      if (projectId) await rm(cacheFile(storageRoot, projectId), { force: true });
      else await rm(path.join(storageRoot, "blueprints"), { recursive: true, force: true });
    },
    async cleanup(activeProjectIds) {
      const active = new Set(activeProjectIds.map((id) => path.basename(cacheFile("", id))));
      if (!storageRoot) {
        for (const key of memory.keys()) if (!activeProjectIds.includes(key)) memory.delete(key);
        return;
      }
      const directory = path.join(storageRoot, "blueprints");
      const entries = await readdir(directory).catch(() => []);
      await Promise.all(
        entries
          .filter((entry) => !active.has(entry))
          .map((entry) => rm(path.join(directory, entry), { force: true })),
      );
    },
    details: () => ({
      ...(storageRoot ? { storageRoot } : {}),
      mode: storageRoot ? "disk" : "memory",
    }),
  };
}
