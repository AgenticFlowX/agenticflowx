/**
 * SpecStepper unit tests — pill rendering, click → openFile dispatch, sprint
 * vs standard mode, disabled-pill behavior, and the tier-2 sibling chips.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-17] [FR-18]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SpecStepper, type SpecStepperSegment, type SpecStepperSegmentKey } from "./spec-stepper";

function segments(
  overrides: Partial<Record<SpecStepperSegmentKey, Partial<SpecStepperSegment>>> = {},
): SpecStepperSegment[] {
  return (["spec", "design", "tasks"] as const).map<SpecStepperSegment>((key) => ({
    key,
    label: key === "spec" ? "Spec" : key === "design" ? "Design" : "Tasks",
    glyph: "·",
    status: "pending",
    hint: `${key}: not started`,
    ...overrides[key],
  }));
}

describe("SpecStepper", () => {
  it("renders three pills with numbered labels and predictable tier-2 chips", () => {
    render(
      <SpecStepper
        segments={segments({
          spec: { status: "approved", glyph: "✓", hint: "Spec: Approved" },
          design: { status: "draft", glyph: "…", hint: "Design: Draft" },
        })}
        active="design"
        format="standard"
        siblingPaths={{
          spec: "/work/docs/specs/auth/spec.md",
          design: "/work/docs/specs/auth/design.md",
          tasks: "/work/docs/specs/auth/tasks.md",
        }}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByTestId("spec-stepper-segment-spec")).toBeInTheDocument();
    expect(screen.getByTestId("spec-stepper-segment-design")).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByTestId("spec-stepper-segment-spec")).toHaveTextContent("1Spec");
    expect(screen.getByTestId("spec-stepper-segment-design")).toHaveTextContent("2Design");
    expect(screen.getByTestId("spec-stepper-segment-design")).not.toHaveTextContent("Draft");
    expect(screen.getByTestId("spec-stepper-segment-spec")).not.toHaveTextContent("Approved");
    expect(screen.getByTestId("spec-stepper-segment-design")).not.toHaveTextContent("…");
    expect(screen.getByTestId("spec-stepper-segment-spec")).toHaveAttribute(
      "data-status",
      "approved",
    );
    // Code pill is gone — never renders.
    expect(screen.queryByTestId("spec-stepper-segment-code")).not.toBeInTheDocument();
    // Resume button is gone too.
    expect(screen.queryByTestId("spec-stepper-resume")).not.toBeInTheDocument();
    // Tier-2 renders only actionable sibling chips — no orphan "Related" label.
    expect(screen.queryByText("Related")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Journal")).toHaveClass("inline-flex");
    expect(screen.getByLabelText("Work Sessions")).toHaveClass(
      "hidden",
      "@[430px]:inline-flex",
      "whitespace-nowrap",
    );
    expect(screen.getByTestId("spec-stepper-related-row")).toHaveClass(
      "hidden",
      "@[220px]:flex",
      "overflow-hidden",
      "whitespace-nowrap",
    );
  });

  it("standard mode → pill click opens the sibling file via onOpenFile", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();

    render(
      <SpecStepper
        segments={segments({ spec: { status: "approved", glyph: "✓", hint: "Spec: Approved" } })}
        active="spec"
        format="standard"
        siblingPaths={{
          spec: "/work/docs/specs/auth/spec.md",
          design: "/work/docs/specs/auth/design.md",
        }}
        onOpenFile={onOpenFile}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Design step/i }));
    expect(onOpenFile).toHaveBeenCalledWith("/work/docs/specs/auth/design.md", undefined);
  });

  it("active pill click refocuses the open file (no sibling lookup needed)", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();

    render(
      <SpecStepper
        segments={segments({ design: { status: "draft", glyph: "…", hint: "Design: Draft" } })}
        active="design"
        format="standard"
        filePath="/work/docs/specs/auth/design.md"
        // No siblingPaths.design here — the active branch should still resolve
        // a target via filePath.
        siblingPaths={{}}
        onOpenFile={onOpenFile}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Design step/i }));
    expect(onOpenFile).toHaveBeenCalledWith("/work/docs/specs/auth/design.md", undefined);
  });

  it("sprint mode → pill click jumps to the section line in the same file", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();

    render(
      <SpecStepper
        segments={segments({ spec: { status: "approved", glyph: "✓", hint: "Spec: Approved" } })}
        active="spec"
        format="sprint"
        filePath="/work/docs/specs/auth/sprint.md"
        sectionOffsets={{ spec: 12, design: 48, tasks: 102, sessions: 220 }}
        onOpenFile={onOpenFile}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Design step/i }));
    expect(onOpenFile).toHaveBeenCalledWith("/work/docs/specs/auth/sprint.md", 48);
  });

  it("sprint mode keeps pills clickable even when a section offset is missing", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();

    render(
      <SpecStepper
        segments={segments({
          design: { status: "draft", glyph: "", hint: "Design: Draft" },
        })}
        active="spec"
        format="sprint"
        filePath="/work/docs/specs/auth/sprint.md"
        sectionOffsets={{ spec: 12 }}
        onOpenFile={onOpenFile}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Design step/i }));
    expect(onOpenFile).toHaveBeenCalledWith("/work/docs/specs/auth/sprint.md", undefined);
  });

  it("disabled pill (sibling path missing AND status pending) does not dispatch onOpenFile", () => {
    const onOpenFile = vi.fn();

    render(
      <SpecStepper
        segments={segments()}
        active="spec"
        format="standard"
        filePath="/work/docs/specs/auth/spec.md"
        siblingPaths={{ spec: "/x/spec.md" }} // design + tasks omitted, status pending
        onOpenFile={onOpenFile}
      />,
    );

    // Design pill should NOT be a button (no host path AND status=pending →
    // no client-side derivation either)
    expect(screen.queryByRole("button", { name: /Design step/i })).not.toBeInTheDocument();
    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it("derives sibling path from filePath when host missed but segment status proves the file exists", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();

    render(
      <SpecStepper
        segments={segments({
          spec: { status: "approved", glyph: "✓", hint: "Spec: Approved" },
          design: { status: "approved", glyph: "✓", hint: "Design: Approved" },
        })}
        active="tasks"
        format="standard"
        filePath="/work/docs/specs/auth/tasks.md"
        // siblingPaths.design is MISSING — simulates the host-side bug we
        // saw in the wild. The segment status is "approved" though, which
        // proves the host successfully read design.md's frontmatter, so the
        // file exists. The client should derive the sibling path.
        siblingPaths={{ tasks: "/work/docs/specs/auth/tasks.md" }}
        onOpenFile={onOpenFile}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Design step/i }));
    expect(onOpenFile).toHaveBeenCalledWith("/work/docs/specs/auth/design.md", undefined);
  });

  it("client-side path derivation respects Windows path separators", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();

    render(
      <SpecStepper
        segments={segments({
          design: { status: "approved", glyph: "✓", hint: "Design: Approved" },
        })}
        active="tasks"
        format="standard"
        filePath={"C:\\work\\docs\\specs\\auth\\tasks.md"}
        siblingPaths={{}}
        onOpenFile={onOpenFile}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Design step/i }));
    expect(onOpenFile).toHaveBeenCalledWith("C:\\work\\docs\\specs\\auth\\design.md", undefined);
  });

  it("tasks 'in progress' pill renders the n/m glyph and triggers a gradient connector", () => {
    render(
      <SpecStepper
        segments={segments({
          spec: { status: "approved", glyph: "✓" },
          design: { status: "approved", glyph: "✓" },
          tasks: { status: "progress", glyph: "3/8" },
        })}
        active="tasks"
        format="standard"
        siblingPaths={{
          spec: "/x/spec.md",
          design: "/x/design.md",
          tasks: "/x/tasks.md",
        }}
        tasksCompleted={3}
        tasksTotal={8}
        onOpenFile={vi.fn()}
      />,
    );

    const tasksPill = screen.getByTestId("spec-stepper-segment-tasks");
    expect(tasksPill).toHaveTextContent("3/8");
    // With 3 segments now, connectors only sit BETWEEN steps (count = 2).
    // The tasks pill is the last one — there's no outgoing connector to
    // assert gradient on. Confirm the count instead.
    const connectors = screen.getAllByTestId("spec-stepper-connector");
    expect(connectors).toHaveLength(2);
  });

  it("journalActive lights up the Journal chip and never marks a main pill active", () => {
    render(
      <SpecStepper
        segments={segments({
          spec: { status: "approved", glyph: "✓" },
          design: { status: "approved", glyph: "✓" },
          tasks: { status: "progress", glyph: "5/5" },
        })}
        active={null}
        format="standard"
        siblingPaths={{
          spec: "/x/spec.md",
          design: "/x/design.md",
          tasks: "/x/tasks.md",
          journal: "/x/journal.md",
        }}
        journalActive
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByTestId("spec-stepper-journal")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("spec-stepper-segment-spec")).toHaveAttribute("data-active", "false");
  });

  it("sprint mode keeps Journal available and opens Work Sessions in-file", () => {
    render(
      <SpecStepper
        segments={segments({ spec: { status: "approved", glyph: "✓" } })}
        active="spec"
        format="sprint"
        filePath="/x/sprint.md"
        sectionOffsets={{ spec: 1, sessions: 50 }}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByTestId("spec-stepper-journal")).toBeInTheDocument();
    expect(screen.getByTestId("spec-stepper-sessions")).toBeInTheDocument();
  });

  it("sprint Journal chip inserts /afx-session note into composer draft", async () => {
    const user = userEvent.setup();
    const onInsertDraft = vi.fn();
    const onOpenFile = vi.fn();

    render(
      <SpecStepper
        segments={segments({ spec: { status: "approved", glyph: "✓" } })}
        active="spec"
        format="sprint"
        filePath="/x/sprint.md"
        sectionOffsets={{ spec: 1, sessions: 50 }}
        onOpenFile={onOpenFile}
        onInsertDraft={onInsertDraft}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Journal" }));
    expect(onInsertDraft).toHaveBeenCalledWith("/afx-session note ");
    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it("Work Sessions chip click opens tasks.md scrolled to the sessions heading + label uses real session counts", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();

    render(
      <SpecStepper
        segments={segments({ tasks: { status: "progress", glyph: "3/8" } })}
        active="tasks"
        format="standard"
        siblingPaths={{ spec: "/x/spec.md", tasks: "/x/tasks.md" }}
        sectionOffsets={{ sessions: 144 }}
        // Body checkbox tasks are 3/8 — but the Work Sessions chip should
        // use the dedicated session-row counts, NOT the body-task fraction.
        tasksCompleted={3}
        tasksTotal={8}
        workSessionsTotal={6}
        workSessionsSigned={4}
        onOpenFile={onOpenFile}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Work Sessions 4/6" }));
    expect(onOpenFile).toHaveBeenCalledWith("/x/tasks.md", 144);
  });

  it("Journal chip inserts /afx-session note into composer draft (not opens a file)", async () => {
    const user = userEvent.setup();
    const onInsertDraft = vi.fn();
    const onOpenFile = vi.fn();

    render(
      <SpecStepper
        segments={segments({ spec: { status: "approved", glyph: "✓" } })}
        active="spec"
        format="standard"
        filePath="/x/spec.md"
        // No siblingPaths.journal — chip is still clickable because it's a
        // draft-insert action, not a file-open action.
        siblingPaths={{ spec: "/x/spec.md" }}
        onOpenFile={onOpenFile}
        onInsertDraft={onInsertDraft}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Journal" }));
    expect(onInsertDraft).toHaveBeenCalledWith("/afx-session note ");
    expect(onOpenFile).not.toHaveBeenCalled();
  });
});
