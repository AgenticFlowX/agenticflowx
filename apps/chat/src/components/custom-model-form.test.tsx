/**
 * CustomModelForm component tests.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-MOCKUP-CUSTOM-MODEL-FORM]
 */
import type { ComponentProps } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@afx/ui/components/tooltip";

import { CustomModelForm } from "./custom-model-form";

const IMAGE_INPUT_READONLY_TOOLTIP =
  "Image input metadata is read-only for now. Custom-provider image routing is not wired yet.";

function renderForm(props: Partial<ComponentProps<typeof CustomModelForm>> = {}) {
  return render(
    <TooltipProvider>
      <CustomModelForm
        providerApi="openai-completions"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        {...props}
      />
    </TooltipProvider>,
  );
}

describe("CustomModelForm", () => {
  it("keeps image input read-only while the custom-provider path is not wired", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    const imageInput = screen.getByLabelText(/image input/i);
    expect(imageInput).toBeDisabled();
    expect(imageInput).not.toBeChecked();

    await user.hover(screen.getByText(/image input/i));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(IMAGE_INPUT_READONLY_TOOLTIP);

    fireEvent.change(screen.getByLabelText(/model id/i), { target: { value: "kimi-local" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onSubmit).toHaveBeenCalledWith({
      id: "kimi-local",
      name: "kimi-local",
    });
  });

  it("preserves an existing image capability but does not let the user edit it", () => {
    const onSubmit = vi.fn();
    renderForm({
      initial: {
        id: "vision-model",
        capabilities: { image: true },
      },
      onSubmit,
    });

    const imageInput = screen.getByLabelText(/image input/i);
    expect(imageInput).toBeDisabled();
    expect(imageInput).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      id: "vision-model",
      name: "vision-model",
      capabilities: { image: true },
    });
  });
});
