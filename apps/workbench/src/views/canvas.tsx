import { CanvasApp } from "../components/canvas/canvas-app";

/**
 * Mounts the shared React Flow Canvas implementation in the Workbench route.
 * CanvasApp owns experiment gating and the complete document surface so the
 * Workbench and editor-area entry points cannot drift between renderers.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-1] [FR-2] [FR-44]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-ARCH] [DES-FILES]
 */
export default function Canvas() {
  return <CanvasApp />;
}
