/**
 * Stable browser-safe content revision for optimistic projection checks.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-31]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 */
export function canvasContentRevision(content: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
