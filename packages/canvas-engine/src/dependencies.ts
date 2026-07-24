/**
 * Detach lifecycle for generated dependency edges: convert to user-owned edges
 * with suppression provenance so dependency refreshes do not resurrect them.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-21] [FR-26]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-ARCH]
 */
import type { CanvasEdge, CanvasEdgeProvenance, JSONCanvas } from "@afx/shared";

/** Namespaced identity used to suppress one generated dependency after detach. */
export function dependencySuppressionKey(owner: string, generatedEdgeId: string): string {
  return `afx:declared-dependency:${encodeURIComponent(owner)}:${generatedEdgeId}`;
}

/**
 * Converts selected generated dependencies into user-owned edges. The manual
 * edge gets a fresh deterministic ID while provenance retains the generated
 * identity that future dependency refreshes must suppress.
 */
export function detachGeneratedDependencies(
  canvas: JSONCanvas,
  selectedEdgeIds: readonly string[],
): JSONCanvas {
  const selected = new Set(selectedEdgeIds);
  if (selected.size === 0) return canvas;
  const known = new Set((canvas.edges ?? []).map((edge) => edge.id));
  let changed = false;
  const edges = (canvas.edges ?? []).map((edge) => {
    if (!selected.has(edge.id) || !isAttachedGeneratedDependency(edge)) return edge;
    changed = true;
    const generatedEdgeId = edge.id;
    const id = allocateManualEdgeId(generatedEdgeId, known);
    known.add(id);
    return {
      ...edge,
      id,
      afxProvenance: detachedProvenance(edge.afxProvenance, generatedEdgeId),
    };
  });
  return changed ? { ...canvas, edges } : canvas;
}

/** Migrates the pre-fresh-ID detached shape once, then remains idempotent. */
export function normalizeDetachedDependencyEdges(canvas: JSONCanvas): CanvasEdge[] {
  const known = new Set((canvas.edges ?? []).map((edge) => edge.id));
  return (canvas.edges ?? []).map((edge) => {
    const provenance = edge.afxProvenance;
    if (provenance?.kind !== "declared-dependency" || provenance.detached !== true) return edge;
    if (provenance.generatedEdgeId && provenance.suppressionKey) return edge;
    const generatedEdgeId = provenance.generatedEdgeId ?? edge.id;
    const id = provenance.generatedEdgeId ? edge.id : allocateManualEdgeId(generatedEdgeId, known);
    known.add(id);
    return {
      ...edge,
      id,
      afxProvenance: detachedProvenance(provenance, generatedEdgeId),
    };
  });
}

export function suppressesGeneratedDependency(edge: CanvasEdge, generatedEdgeId: string): boolean {
  const provenance = edge.afxProvenance;
  if (provenance?.kind !== "declared-dependency" || provenance.detached !== true) return false;
  return (
    provenance.generatedEdgeId === generatedEdgeId ||
    provenance.suppressionKey === dependencySuppressionKey(provenance.owner, generatedEdgeId) ||
    (!provenance.generatedEdgeId && edge.id === generatedEdgeId)
  );
}

function isAttachedGeneratedDependency(edge: CanvasEdge): edge is CanvasEdge & {
  afxProvenance: CanvasEdgeProvenance;
} {
  return edge.afxProvenance?.kind === "declared-dependency" && edge.afxProvenance.detached !== true;
}

function detachedProvenance(
  provenance: CanvasEdgeProvenance,
  generatedEdgeId: string,
): CanvasEdgeProvenance {
  return {
    ...provenance,
    detached: true,
    generatedEdgeId,
    suppressionKey: dependencySuppressionKey(provenance.owner, generatedEdgeId),
  };
}

function allocateManualEdgeId(generatedEdgeId: string, known: ReadonlySet<string>): string {
  const base = `${generatedEdgeId}:manual`;
  if (!known.has(base)) return base;
  let suffix = 2;
  while (known.has(`${base}:${suffix}`)) suffix += 1;
  return `${base}:${suffix}`;
}
