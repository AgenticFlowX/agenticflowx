/**
 * Fixed Workbench registry filtering. Unknown future views are visible by
 * default because only explicit IDs in the hidden set are removed.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-16]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-TAB-VISIBILITY]
 */
import { WORKBENCH_VIEW_IDS } from "@afx/shared";
import type { WorkbenchViewId } from "@afx/shared";

export function visibleWorkbenchViews(
  hidden: readonly WorkbenchViewId[],
  canvasEnabled: boolean,
): WorkbenchViewId[] {
  const hiddenSet = new Set(hidden);
  return WORKBENCH_VIEW_IDS.filter(
    (id) => (id !== "canvas" || canvasEnabled) && !hiddenSet.has(id),
  );
}

export function nextWorkbenchView(
  current: WorkbenchViewId,
  visible: readonly WorkbenchViewId[],
): WorkbenchViewId | undefined {
  return visible.includes(current) ? current : visible[0];
}
