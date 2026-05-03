/**
 * Shared constants: AFX version, mode names, and VSCode command IDs.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-3]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-DOMAIN-TYPES]
 */

export const AFX_VERSION = "2.5.4";

export const AFX_MODES = [
  "spec",
  "design",
  "dev",
  "check",
  "report",
  "session",
  "task",
  "discover",
] as const;

export const AFX_COMMANDS = {
  OPEN_SIDEBAR: "afx.openSidebar",
  OPEN_WORKBENCH: "afx.openWorkbench",
  CLOSE_SIDEBAR: "afx.closeSidebar",
  CLOSE_WORKBENCH: "afx.closeWorkbench",
  SET_MODE: "afx.setMode",
  RUN_CHECK: "afx.runCheck",
} as const;
