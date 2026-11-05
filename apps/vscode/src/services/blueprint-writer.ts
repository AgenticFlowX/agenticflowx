/**
 * Serialized and bounded durable Blueprint writes.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-STORAGE]
 */
import { randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveInside } from "./blueprint-artifacts";

/** Lock acquisition is exclusive across windows/processes; abandoned locks require explicit recovery. */
export async function withBlueprintLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  await mkdir(root, { recursive: true });
  const lock = path.join(root, ".afx-blueprint.lock");
  try {
    await mkdir(lock);
  } catch {
    throw new Error(
      "Blueprint is being written by another process, or has an abandoned lock. Inspect .afx-blueprint.lock before explicit recovery.",
    );
  }
  try {
    await writeFile(
      path.join(lock, "owner.json"),
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
    return await action();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}

/** Writes new immutable files before publishing the index pointer. */
export async function atomicJson(root: string, relative: string, value: unknown): Promise<void> {
  const location = resolveInside(root, relative);
  await ensureArtifactParent(root, relative);
  const temporary = `${location}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, location);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Walk existing components before creating anything; never traverse an artifact symlink. */
export async function ensureArtifactParent(root: string, relative: string): Promise<void> {
  resolveInside(root, relative);
  let parent = await realpath(root);
  const parts = relative.split("/");
  for (const part of parts.slice(0, -1)) {
    parent = path.join(parent, part);
    try {
      await mkdir(parent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const info = await lstat(parent);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Blueprint storage contains a symlink or non-directory parent.");
  }
  const destination = path.join(parent, parts.at(-1)!);
  const existing = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (existing?.isSymbolicLink()) throw new Error("Blueprint destination is a symlink.");
}
