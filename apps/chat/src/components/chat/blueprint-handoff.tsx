/**
 * Blueprint workflow context and explicit user actions.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-10] [FR-18]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-UI]
 */
import { useState } from "react";

import type { BlueprintSprintSubmission, BlueprintWorkflowState } from "@afx/shared";

export function BlueprintHandoff({
  handoff,
  onCreate,
  onCancel,
  busy = false,
}: {
  handoff: NonNullable<BlueprintWorkflowState["handoff"]>;
  onCreate: (input: BlueprintSprintSubmission) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [discussion, setDiscussion] = useState(handoff.discussion);
  const [findingIds, setFindingIds] = useState<string[]>([]);
  return (
    <form
      aria-label="Review Blueprint Sprint handoff"
      className="my-2 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate({ name, goal, discussion, findingIds });
      }}
    >
      <p>
        Review Sprint scope · Blueprint revision {handoff.revision}. Documents remain Draft; source
        changes need a separate coding step.
      </p>
      <label>
        Sprint name
        <input
          className="mt-1 w-full rounded border bg-background p-1"
          maxLength={120}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        Desired outcome
        <textarea
          className="mt-1 w-full rounded border bg-background p-1"
          maxLength={4000}
          required
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        />
      </label>
      <fieldset className="max-h-40 overflow-auto">
        <legend>Findings to carry</legend>
        {handoff.findings.map((finding) => (
          <label key={finding.id} className="my-1 flex items-start gap-2">
            <input
              type="checkbox"
              checked={findingIds.includes(finding.id)}
              onChange={(event) =>
                setFindingIds((ids) =>
                  event.target.checked
                    ? [...ids, finding.id]
                    : ids.filter((id) => id !== finding.id),
                )
              }
            />
            <span className="min-w-0 break-words" title={finding.description}>
              {finding.title}
            </span>
          </label>
        ))}
      </fieldset>
      <label>
        Discussion to carry
        <textarea
          className="mt-1 w-full rounded border bg-background p-1"
          maxLength={8000}
          value={discussion}
          onChange={(event) => setDiscussion(event.target.value)}
        />
      </label>
      <p className="text-muted-foreground">
        Choose the document folder next. Only the selected context is carried into the Sprint.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded border px-2 py-1 disabled:opacity-50"
          disabled={busy || !name.trim() || !goal.trim()}
        >
          Create Draft Sprint
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel handoff
        </button>
      </div>
    </form>
  );
}
