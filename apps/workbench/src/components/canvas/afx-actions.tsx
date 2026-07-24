/**
 * Explicit UI for versioned, allowlisted AFX Canvas actions.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-33] [NFR-8]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-INTERACTIONS] [DES-SEC]
 * @see docs/specs/229-app-workbench-canvas/tasks.md [12.2]
 */
import { Play } from "lucide-react";

import { parseCanvasAction } from "@afx/canvas-engine";
import type { CanvasActionMetadata, CanvasNode } from "@afx/shared";

export interface CanvasActionConfirmation {
  target: string;
  nodes: string[];
  action: CanvasActionMetadata;
}

export function CanvasRunActionButton({
  node,
  disabled,
  onRun,
}: {
  node: CanvasNode;
  disabled?: boolean;
  onRun: (action: CanvasActionMetadata) => void;
}) {
  const action = parseCanvasAction(node["afxAction"]);
  if (!action) return null;
  const label = `Run ${action.label ?? action.action}`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="nodrag rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
      onClick={() => onRun(action)}
    >
      <Play size={12} />
    </button>
  );
}

export function canvasActionConfirmation(
  target: string,
  nodeIds: readonly string[],
  action: CanvasActionMetadata,
): string {
  const exactAction: CanvasActionConfirmation = {
    target,
    nodes: [...nodeIds],
    action,
  };
  return `Run this exact Canvas action?\n\n${JSON.stringify(exactAction, null, 2)}`;
}
