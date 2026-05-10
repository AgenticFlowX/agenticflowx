/** CommandReceipt component tests. */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommandReceipt, type CommandReceiptValue } from "./command-receipt";

const receipt: CommandReceiptValue = {
  label: "Plan a new feature",
  command: "/afx-spec new onboarding",
  originalText: "help me plan onboarding",
  vocabularyHint: "Spec = shape requirements before design and tasks.",
  defaultMode: "run",
};

describe("CommandReceipt", () => {
  it("renders the human label, vocabulary hint, editable command, and original prose", () => {
    render(<CommandReceipt receipt={receipt} onRun={vi.fn()} onInsert={vi.fn()} />);

    expect(
      screen.getByRole("region", { name: "Plan a new feature command receipt" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Plan a new feature")).toBeInTheDocument();
    expect(
      screen.getByText("Spec = shape requirements before design and tasks."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Generated AFX command")).toHaveValue("/afx-spec new onboarding");
    expect(screen.getByText("Original: help me plan onboarding")).toBeInTheDocument();
  });

  it("runs and inserts the edited command", () => {
    const onRun = vi.fn();
    const onInsert = vi.fn();
    const onCommandChange = vi.fn();

    render(
      <CommandReceipt
        receipt={receipt}
        onRun={onRun}
        onInsert={onInsert}
        onCommandChange={onCommandChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Generated AFX command"), {
      target: { value: "  /afx-spec refine onboarding  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));

    expect(onCommandChange).toHaveBeenCalledWith("  /afx-spec refine onboarding  ");
    expect(onRun).toHaveBeenCalledWith("/afx-spec refine onboarding", receipt);
    expect(onInsert).toHaveBeenCalledWith("/afx-spec refine onboarding", receipt);
  });

  it("sends original prose as normal chat when provided", () => {
    const onSendAsChat = vi.fn();

    render(<CommandReceipt receipt={receipt} onSendAsChat={onSendAsChat} />);
    fireEvent.click(screen.getByRole("button", { name: "Send as normal chat" }));

    expect(onSendAsChat).toHaveBeenCalledWith("help me plan onboarding", receipt);
  });

  it("hides unavailable affordances", () => {
    render(<CommandReceipt receipt={{ label: "Resume workflow", command: "/afx-next" }} />);

    expect(screen.queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Insert" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send as normal chat" })).not.toBeInTheDocument();
  });
});
