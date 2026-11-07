import { useRef, useState } from "react";

import type {
  BlueprintSprintSubmission,
  BlueprintWorkflowAction,
  BlueprintWorkflowState,
} from "@afx/shared";

import { BlueprintHandoff } from "./blueprint-handoff";

/** @see docs/specs/900-fleet/22-blueprint-explore/tasks.md [7.5] */
export function BlueprintRail({
  state,
  onAction,
  onCreateSprint,
}: {
  state: BlueprintWorkflowState;
  onAction: (action: BlueprintWorkflowAction) => void;
  onCreateSprint?: (input: BlueprintSprintSubmission) => void;
}) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("afx.blueprint.collapsed") === "true",
  );
  const headingRef = useRef<HTMLButtonElement>(null);
  const busy = state.phase === "inspecting";
  const runAction = (action: BlueprintWorkflowAction) => {
    if (!["review", "read", "check"].includes(action))
      headingRef.current?.focus({ preventScroll: true });
    onAction(action);
  };
  const button = (action: BlueprintWorkflowAction, label: string) => (
    <button
      type="button"
      className="rounded border px-2 py-1 text-xs hover:bg-accent focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={action === "save" && (!state.reviewed || state.canSave === false)}
      onClick={() => runAction(action)}
    >
      {label}
    </button>
  );
  return (
    <section aria-label="Blueprint workflow" className="min-w-0 border-t px-3 py-2 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <button
          ref={headingRef}
          type="button"
          aria-expanded={!collapsed}
          aria-controls="blueprint-rail-content"
          className="min-w-0 flex-1 truncate text-left"
          onClick={() =>
            setCollapsed((value) => {
              localStorage.setItem("afx.blueprint.collapsed", String(!value));
              return !value;
            })
          }
        >
          Blueprint{state.name ? ` · ${state.name}` : ""} ·{" "}
          {busy
            ? "Inspecting"
            : state.phase === "review"
              ? "Review findings"
              : state.hasSaved
                ? "Saved"
                : "Explore your project"}
        </button>
        {busy ? button("stop", "Stop investigation") : null}
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {busy
          ? "Blueprint investigation in progress."
          : state.handoff
            ? "Review Blueprint Sprint handoff."
            : state.phase === "review"
              ? `${state.findingCount} Blueprint findings ready for review.`
              : state.hasSaved
                ? "Blueprint saved."
                : "Blueprint ready to inspect."}
      </p>
      {state.error ? (
        <p role="alert" className="my-2 break-words">
          {state.error}
        </p>
      ) : null}
      <div id="blueprint-rail-content" hidden={collapsed}>
        {state.phase === "inspecting" || state.phase === "review" ? (
          <ol
            aria-label="Blueprint steps"
            className="my-2 flex flex-wrap gap-3 text-muted-foreground"
          >
            <li aria-current={busy ? "step" : undefined}>1. Inspect</li>
            <li aria-current={state.phase === "review" ? "step" : undefined}>2. Review</li>
            <li>3. Save</li>
          </ol>
        ) : null}
        {state.phase === "idle" ? (
          <p className="my-2 text-muted-foreground">
            Inspect uses your selected model and saved source files. It creates a local draft
            without changing source. Each run has a ten-minute limit.
          </p>
        ) : null}
        {state.proposal ? (
          <p className="my-2">
            Proposed {state.proposal.kind}: {state.proposal.added} added · {state.proposal.modified}{" "}
            revised · {state.proposal.retired} retired
          </p>
        ) : null}
        {state.detail ? (
          <p className="my-2 break-words text-muted-foreground">{state.detail}</p>
        ) : null}
        {state.handoff && onCreateSprint ? (
          <BlueprintHandoff
            busy={state.handoffBusy}
            handoff={state.handoff}
            onCreate={onCreateSprint}
            onCancel={() => runAction("discard")}
          />
        ) : null}
        {!busy && !state.handoff ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {state.phase === "review" ? (
              <>
                {button(
                  "review",
                  state.proposal ? "Review proposal" : `Review ${state.findingCount} findings`,
                )}
                {button(
                  "save",
                  state.hasSaved
                    ? "Apply reviewed findings"
                    : state.findingCount
                      ? "Save Blueprint"
                      : "Save incomplete draft",
                )}
                {state.canContinue ? button("continue", "Continue investigation") : null}
                {button("discard", "Discard draft")}
              </>
            ) : (
              <>
                {button("inspect", "Inspect project")}
                {button("open", "Open Blueprint")}
                {state.hasSaved ? (
                  <>
                    {button("read", "Read Blueprint")}
                    {state.attached ? (
                      <>
                        {button("check", "Check Changes")}
                        {button("update", "Update Blueprint")}
                        {button("sprint", "Start Sprint")}
                        <details>
                          <summary>More</summary>
                          {button("rebuild", "Rebuild Blueprint")}
                        </details>
                      </>
                    ) : null}
                    {!state.attached ? button("attach", "Use in chat") : null}
                  </>
                ) : null}
                {state.canContinue ? button("continue", "Continue investigation") : null}
              </>
            )}
            {state.error ? (
              <>
                {state.hasSaved && /no unique generated section/.test(state.error)
                  ? button("adopt", "Adopt legacy reader")
                  : null}
                {/interrupted|recovery|abandoned lock/.test(state.error)
                  ? button("recover", "Recover interrupted save")
                  : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
