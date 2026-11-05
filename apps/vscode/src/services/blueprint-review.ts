/**
 * Authored reviews survive semantic-model refreshes and never become execution evidence.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-18] [FR-19]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-MODEL] [DES-EVOLUTION]
 */
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

import {
  type BlueprintManifest,
  openBlueprint,
  resolveInside,
  updateBlueprint,
} from "./blueprint-artifacts";
import type { BlueprintModel } from "./blueprint-model-store";
import { validatePortableBlueprint } from "./blueprint-validation";
import { atomicJson, withBlueprintLock } from "./blueprint-writer";

export interface BlueprintFindingReview {
  kind: "afx-blueprint-review";
  schemaVersion: 2 | 3;
  id: string;
  blueprintId: string;
  repositoryId: string;
  modelRevisionId: string;
  findingId: string;
  recordedAt: string;
  decision: "accepted" | "rejected" | "corrected";
  notes: string;
  actor: "human";
}
export async function saveFindingReview(
  root: string,
  manifest: BlueprintManifest,
  model: BlueprintModel,
  findingId: string,
  decision: BlueprintFindingReview["decision"],
  notes: string,
): Promise<BlueprintFindingReview> {
  if (
    manifest.id !== model.blueprintId ||
    (manifest.schemaVersion !== 3 && !manifest.artifacts.evolution) ||
    !model.investigation.findings.some((finding) => finding.id === findingId)
  )
    throw new Error("Review must reference a finding in this Blueprint model.");
  const review: BlueprintFindingReview = {
    kind: "afx-blueprint-review",
    schemaVersion: manifest.schemaVersion === 3 ? 3 : 2,
    id: randomUUID(),
    blueprintId: manifest.id,
    repositoryId: model.repositoryId,
    modelRevisionId: model.modelRevisionId,
    findingId,
    recordedAt: new Date().toISOString(),
    decision,
    notes,
    actor: "human",
  };
  if (manifest.schemaVersion === 3) {
    await updateBlueprint(root, manifest.revision, (current) => ({
      ...current,
      reviews: [...(current.reviews ?? []), review],
    }));
    return review;
  }
  validatePortableBlueprint(review);
  await withBlueprintLock(root, () =>
    atomicJson(root, `${manifest.artifacts.evolution}/review-${review.id}.json`, review),
  );
  return review;
}
export async function loadFindingReviews(
  root: string,
  manifest: BlueprintManifest,
  repositoryId: string,
): Promise<BlueprintFindingReview[]> {
  if (manifest.schemaVersion === 3) {
    const current = await openBlueprint(root);
    return (current.reviews ?? [])
      .filter(
        (review): review is BlueprintFindingReview =>
          (review as BlueprintFindingReview).blueprintId === manifest.id &&
          (review as BlueprintFindingReview).repositoryId === repositoryId,
      )
      .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  }
  if (!manifest.artifacts.evolution) return [];
  const directory = resolveInside(root, manifest.artifacts.evolution);
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const reviews: BlueprintFindingReview[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^review-[a-f0-9-]+\.json$/.test(entry.name)) continue;
    const review = JSON.parse(
      await readFile(resolveInside(root, `${manifest.artifacts.evolution}/${entry.name}`), "utf8"),
    ) as BlueprintFindingReview;
    validatePortableBlueprint(review);
    if (review.blueprintId === manifest.id && review.repositoryId === repositoryId)
      reviews.push(review);
  }
  return reviews.sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
}
