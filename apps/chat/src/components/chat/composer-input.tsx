/**
 * Composer input shell with textarea, shell warning, and toolbar/action slot.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-A11Y]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-KEYS] [DES-COMPOSER-HELPERS]
 */
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";

import type { WorkspaceMode } from "@afx/shared";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@afx/ui/components/input-group";

export interface ComposerInputProps {
  workspaceMode: WorkspaceMode;
  draft: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled: boolean;
  isSystemCommand: boolean;
  describedBy?: string;
  helpers?: ReactNode;
  children: ReactNode;
}

export function getComposerPlaceholder({
  isCheckingAgent,
  runtimeUnconfigured,
  rpcEnabled,
  runtimeUnavailable,
  isCompacting,
  isStreaming,
  workspaceMode,
}: {
  isCheckingAgent: boolean;
  runtimeUnconfigured: boolean;
  rpcEnabled: boolean;
  runtimeUnavailable: boolean;
  isCompacting: boolean;
  isStreaming: boolean;
  workspaceMode: WorkspaceMode;
}): string {
  if (isCheckingAgent) return "Waiting for the agent runtime to be ready…";
  if (runtimeUnconfigured) {
    return rpcEnabled
      ? "Configure a provider or fix Pi RPC in Settings…"
      : "Configure an API provider or enable Pi RPC to continue…";
  }
  if (runtimeUnavailable) return "Reconnect the agent runtime to continue…";
  if (isCompacting) return "Compacting session — wait for it to finish…";
  if (workspaceMode === "explore") {
    return isStreaming
      ? "Explore mode is read-only — queue another analysis question…"
      : "Explore mode is read-only — ask about files, risks, or the next step…";
  }
  if (workspaceMode === "spec") {
    return isStreaming
      ? "Spec mode — queue a refinement, validation, or approval question…"
      : "Spec mode — refine specs, evolve designs, or slice tasks…";
  }
  if (isStreaming) return "Queue a follow-up… (⌘⏎ to steer this turn)";
  return "Ask AFX about this workspace — ⌘⇧⏎ saves a note";
}

export function ComposerInput({
  workspaceMode,
  draft,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  isSystemCommand,
  describedBy,
  helpers,
  children,
}: ComposerInputProps) {
  return (
    <>
      {helpers}
      <InputGroup
        role="form"
        aria-label="Compose message"
        data-workspace-mode={workspaceMode}
        className="afx-surface-composer @container h-auto flex-col items-stretch"
      >
        <InputGroupTextarea
          id="afx-chat-composer"
          aria-label="Chat composer"
          aria-describedby={describedBy}
          value={draft}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="min-h-14 max-h-56"
        />
        {isSystemCommand && (
          <div className="px-3 py-1 text-[10px] text-amber-500/80">
            ⚠ Shell · output is local only
          </div>
        )}
        <InputGroupAddon align="block-end" className="flex-wrap justify-between gap-1">
          {children}
        </InputGroupAddon>
      </InputGroup>
    </>
  );
}
