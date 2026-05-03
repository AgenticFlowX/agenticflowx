/**
 * Workbench appearance helpers — keep runtime style classes in sync with Chat settings.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-1]
 * @see docs/specs/131-package-ui-design-system/spec.md [FR-1] [FR-4]
 * @see docs/specs/131-package-ui-design-system/design.md [DES-API]
 */
import { AFX_STYLE_IDS, AFX_THEME_IDS } from "@afx/shared";

const THEME_CLASSES = AFX_THEME_IDS.map((id) => `theme-${id}`);
const STYLE_CLASSES = AFX_STYLE_IDS.map((id) => `style-${id}`);

export function applyAppearanceClass(appearanceClass: string): void {
  const next = appearanceClass
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  document.body.classList.remove(...THEME_CLASSES, ...STYLE_CLASSES, "theme-lyra");
  document.body.classList.add(...next);
}
