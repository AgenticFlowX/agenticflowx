/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DropdownMenu, DropdownMenuContent } from "@afx/ui/components/dropdown-menu";

import { ChatCommandPresetSubmenu } from "./chat-command-preset-submenu";

describe("ChatCommandPresetSubmenu", () => {
  it("renders simple preset menu content and inserts the resolved draft command", () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu open>
        <DropdownMenuContent>
          <ChatCommandPresetSubmenu
            baseCommand="/afx-task code"
            asSubmenu={false}
            docContext={{ WBS: "2.3" }}
            onSelect={onSelect}
          />
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    fireEvent.click(screen.getByText("Tests First"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({
      command: "/afx-task code 2.3 tests first",
      autoSend: false,
    });
  });

  it("renders nothing when no preset resolves for the base command", () => {
    const { container } = render(
      <DropdownMenu open>
        <DropdownMenuContent>
          <ChatCommandPresetSubmenu
            baseCommand="/afx-dev code"
            asSubmenu={false}
            docContext={{ WBS: "2.3" }}
            onSelect={vi.fn()}
          />
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(container).not.toHaveTextContent("Command Presets");
  });
});
