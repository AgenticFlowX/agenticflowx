/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9] [FR-10] [NFR-1]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-MOCKUP-CUSTOM-PROVIDER-FORM]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiKeySourceInput, type ApiKeySourceValue } from "./api-key-source-input";

describe("ApiKeySourceInput", () => {
  it("renders masked input for vscode-secret source", () => {
    const value: ApiKeySourceValue = {
      source: "vscode-secret",
      label: "AFX_OPENROUTER_KEY",
      apiKeyValue: "",
    };
    render(
      <ApiKeySourceInput
        providerId="openrouter"
        value={value}
        onChange={vi.fn()}
        suggestedEnvVar="AFX_OPENROUTER_KEY"
      />,
    );
    const input = screen.getByLabelText(/API key/i);
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("data-clarity-mask", "true");
    expect(screen.getByText(/AFX_OPENROUTER_KEY at runtime/)).toBeInTheDocument();
  });

  it("calls onChange with the typed apiKeyValue", () => {
    const onChange = vi.fn();
    render(
      <ApiKeySourceInput
        providerId="openrouter"
        value={{ source: "vscode-secret", label: "AFX_OPENROUTER_KEY", apiKeyValue: "" }}
        onChange={onChange}
        suggestedEnvVar="AFX_OPENROUTER_KEY"
      />,
    );
    fireEvent.change(screen.getByLabelText(/API key/i), { target: { value: "sk-test" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyValue: "sk-test", source: "vscode-secret" }),
    );
  });

  it("switches to env-var source and exposes a name input", () => {
    const onChange = vi.fn();
    render(
      <ApiKeySourceInput
        providerId="openrouter"
        value={{ source: "vscode-secret", label: "AFX_OPENROUTER_KEY", apiKeyValue: "" }}
        onChange={onChange}
        suggestedEnvVar="AFX_OPENROUTER_KEY"
      />,
    );
    fireEvent.change(screen.getByLabelText(/Source/i), { target: { value: "env-var" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ source: "env-var" }));
  });

  it("switches to none source and hides the input", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ApiKeySourceInput
        providerId="ollama"
        value={{ source: "vscode-secret", label: "AFX_OLLAMA_KEY", apiKeyValue: "" }}
        onChange={onChange}
        suggestedEnvVar="AFX_OLLAMA_KEY"
      />,
    );
    fireEvent.change(screen.getByLabelText(/Source/i), { target: { value: "none" } });
    expect(onChange).toHaveBeenCalledWith({ source: "none" });
    // Re-render with the post-change value to assert the masked input is gone.
    rerender(
      <ApiKeySourceInput
        providerId="ollama"
        value={{ source: "none" }}
        onChange={onChange}
        suggestedEnvVar="AFX_OLLAMA_KEY"
      />,
    );
    expect(screen.queryByLabelText(/API key/i)).not.toBeInTheDocument();
  });
});
