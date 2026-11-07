/**
 * Blueprint workflow context and explicit user actions.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-10] [FR-18]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-API]
 */
import type { AgentCommand, BlueprintWorkflowAction } from "@afx/shared";

export const BLUEPRINT_HOST_COMMAND: AgentCommand = {
  name: "afx-blueprint",
  source: "extension",
  description:
    "Open Blueprint in Explore; check, update, rebuild, review, apply or start a Sprint explicitly.",
};

/** Reserved commands are handled by the host and never fall through to a model. */
export function parseBlueprintCommand(
  content: string,
): { action: BlueprintWorkflowAction } | undefined {
  const match = /^\/(?:afx-blueprint|skill:afx-blueprint|afx:blueprint)(?:\s+(.*))?$/s.exec(
    content.trim(),
  );
  if (!match) return undefined;
  const token = match[1]?.trim() ?? "";
  const actions: Record<string, BlueprintWorkflowAction> = {
    "": "status",
    status: "status",
    help: "status",
    inspect: "inspect",
    open: "open",
    attach: "attach",
    read: "read",
    check: "check",
    sync: "check",
    update: "update",
    rebuild: "rebuild",
    resync: "rebuild",
    continue: "continue",
    review: "review",
    save: "save",
    apply: "save",
    reject: "discard",
    discard: "discard",
    stop: "stop",
    sprint: "sprint",
    end: "end-session",
  };
  if (!Object.hasOwn(actions, token))
    throw new Error(
      "Unknown Blueprint action. Use /afx-blueprint, or inspect, open, check, update, rebuild, continue, review, apply, reject, sprint or end.",
    );
  return { action: actions[token]! };
}
