/**
 * Runtime style hook coverage checks for generated shadcn primitives.
 *
 * @see docs/specs/131-package-ui-design-system/spec.md [FR-1]
 * @see docs/specs/131-package-ui-design-system/design.md [DES-TEST]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_DIR = join(HERE, "..", "components");
const STYLES_DIR = join(HERE, "..", "styles");

const HOOKED_FILES = [
  "accordion.tsx",
  "alert-dialog.tsx",
  "alert.tsx",
  "avatar.tsx",
  "badge.tsx",
  "breadcrumb.tsx",
  "button-group.tsx",
  "button.tsx",
  "calendar.tsx",
  "card.tsx",
  "chart.tsx",
  "checkbox.tsx",
  "combobox.tsx",
  "command.tsx",
  "context-menu.tsx",
  "dialog.tsx",
  "drawer.tsx",
  "dropdown-menu.tsx",
  "empty.tsx",
  "field.tsx",
  "hover-card.tsx",
  "input-group.tsx",
  "input-otp.tsx",
  "input.tsx",
  "item.tsx",
  "kbd.tsx",
  "label.tsx",
  "menubar.tsx",
  "native-select.tsx",
  "navigation-menu.tsx",
  "pagination.tsx",
  "popover.tsx",
  "progress.tsx",
  "radio-group.tsx",
  "resizable.tsx",
  "scroll-area.tsx",
  "select.tsx",
  "separator.tsx",
  "sheet.tsx",
  "sidebar.tsx",
  "skeleton.tsx",
  "slider.tsx",
  "sonner.tsx",
  "switch.tsx",
  "table.tsx",
  "tabs.tsx",
  "textarea.tsx",
  "toggle-group.tsx",
  "toggle.tsx",
  "tooltip.tsx",
] as const;

const EXEMPT_FILES = [
  "aspect-ratio.tsx",
  "carousel.tsx",
  "collapsible.tsx",
  "direction.tsx",
  "spinner.tsx",
] as const;

const STYLE_IDS = ["lyra", "luma", "maia", "nova", "vega", "mira", "sera"] as const;

function readComponent(name: string): string {
  return readFileSync(join(COMPONENTS_DIR, name), "utf8");
}

describe("runtime cn hook coverage", () => {
  it("keeps all non-exempt primitives on the cn hook path", () => {
    expect(HOOKED_FILES).toHaveLength(50);
    expect(EXEMPT_FILES).toHaveLength(5);

    for (const file of HOOKED_FILES) {
      expect(readComponent(file), `${file} missing cn-* hooks`).toMatch(/\bcn-[a-z0-9-]+/);
    }
  });

  it("keeps priority variant and size hook suffixes present", () => {
    const button = readComponent("button.tsx");
    expect(button).toContain("cn-button");
    expect(button).toContain("cn-button-variant-");
    expect(button).toContain("cn-button-size-");

    const badge = readComponent("badge.tsx");
    expect(badge).toContain("cn-badge");
    expect(badge).toContain("cn-badge-variant-");

    const inputGroup = readComponent("input-group.tsx");
    expect(inputGroup).toContain("cn-input-group-addon-align-");
    expect(inputGroup).toContain("cn-input-group-button-size-");
  });

  it("imports every runtime treatment stylesheet from globals", () => {
    const globals = readFileSync(join(STYLES_DIR, "globals.css"), "utf8");
    for (const id of STYLE_IDS) {
      expect(readFileSync(join(STYLES_DIR, `style-${id}.css`), "utf8")).toContain(`.style-${id}`);
      expect(globals).toContain(`./style-${id}.css`);
    }
  });
});
