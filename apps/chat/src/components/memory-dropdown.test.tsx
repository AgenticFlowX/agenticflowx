/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MEMORY_CATALOG } from "../lib/doc-actions";
import { MemoryDropdown } from "./memory-dropdown";

function renderDropdown(anchorLabel: string) {
  return render(
    <MemoryDropdown defaultOpen onSelect={vi.fn()}>
      <button type="button">{anchorLabel}</button>
    </MemoryDropdown>,
  );
}

function catalogSnapshot() {
  return within(screen.getByRole("menu"))
    .getAllByRole("menuitem")
    .map((item) => item.textContent);
}

describe("MemoryDropdown", () => {
  it("renders the same memory catalog from top-right and strip anchors", () => {
    const topRight = renderDropdown("Top-right memory");
    const topRightSnapshot = catalogSnapshot();

    expect(topRightSnapshot).toMatchInlineSnapshot(`
      [
        "Save/afx-context saveDraft",
        "Load/afx-context loadAuto",
        "History/afx-context historyAuto",
        "Impact/afx-context impactDraft",
        "Note/afx-session noteDraft",
        "Log/afx-session logDraft",
        "Recap/afx-session recapAuto",
        "Promote/afx-session promoteDraft",
        "Capture/afx-session captureDraft",
      ]
    `);

    topRight.unmount();
    cleanup();

    renderDropdown("Strip memory");
    expect(catalogSnapshot()).toEqual(topRightSnapshot);
  });

  it("renders every MEMORY_CATALOG entry exactly once", () => {
    renderDropdown("Memory");

    const labels = catalogSnapshot();

    expect(labels).toHaveLength(MEMORY_CATALOG.flatMap((group) => group.items).length);
    for (const catalogItem of MEMORY_CATALOG.flatMap((group) => group.items)) {
      expect(labels.filter((label) => label?.includes(catalogItem.command))).toHaveLength(1);
    }
    expect(
      screen.getByRole("menuitem", { name: /Save: \/afx-context save Draft first/i }),
    ).not.toHaveAttribute("title");
  });

  it("shows workflow tooltip details for memory commands on focus", async () => {
    renderDropdown("Memory");

    const saveItem = screen.getByRole("menuitem", {
      name: /Save: \/afx-context save Draft first/i,
    });

    fireEvent.focus(saveItem);

    await waitFor(() => {
      expect(screen.getAllByText("/afx-context save [feature]").length).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByText(/Generate a detailed \.afx\/context\.md bundle/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("keeps Save and Log draft-first when selected", () => {
    const onSelect = vi.fn();
    render(
      <MemoryDropdown defaultOpen onSelect={onSelect}>
        <button type="button">Memory</button>
      </MemoryDropdown>,
    );

    fireEvent.click(screen.getByText("/afx-context save"));
    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: "Save", autoSend: false }),
    );

    cleanup();
    render(
      <MemoryDropdown defaultOpen onSelect={onSelect}>
        <button type="button">Memory</button>
      </MemoryDropdown>,
    );

    fireEvent.click(screen.getByText("/afx-session log"));
    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: "Log", autoSend: false }),
    );
  });
});
