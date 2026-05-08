/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-MOCKUP-CUSTOM-PRESET]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PresetPicker } from "./preset-picker";

describe("PresetPicker", () => {
  it("renders all canonical presets", () => {
    render(<PresetPicker onSelect={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Use Ollama preset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Use OpenRouter preset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Use Custom preset/i })).toBeInTheDocument();
  });

  it("invokes onSelect with the chosen preset", () => {
    const onSelect = vi.fn();
    render(<PresetPicker onSelect={onSelect} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Use Ollama preset/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ presetId: "ollama" });
  });

  it("invokes onCancel from the Cancel button", () => {
    const onCancel = vi.fn();
    render(<PresetPicker onSelect={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
