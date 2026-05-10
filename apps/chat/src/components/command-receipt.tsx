/** CommandReceipt - editable preview for UI-generated AFX commands. */
import { useId, useState } from "react";

import { Button } from "@afx/ui/components/button";
import { Textarea } from "@afx/ui/components/textarea";
import { cn } from "@afx/ui/lib/utils";

export interface CommandReceiptValue {
  /** Human-first action label, e.g. "Plan a new feature". */
  label: string;
  /** Generated slash command shown before any send/insert action. */
  command: string;
  /** Optional original user prose for the "Send as normal chat" escape hatch. */
  originalText?: string;
  /** One-sentence AFX vocabulary hint. */
  vocabularyHint?: string;
  /** Preferred action affordance for visual emphasis. */
  defaultMode?: "run" | "insert";
}

export interface CommandReceiptProps {
  receipt: CommandReceiptValue;
  className?: string;
  disabled?: boolean;
  onCommandChange?: (command: string) => void;
  onRun?: (command: string, receipt: CommandReceiptValue) => void;
  onInsert?: (command: string, receipt: CommandReceiptValue) => void;
  onSendAsChat?: (text: string, receipt: CommandReceiptValue) => void;
}

export function CommandReceipt({
  receipt,
  className,
  disabled = false,
  onCommandChange,
  onRun,
  onInsert,
  onSendAsChat,
}: CommandReceiptProps) {
  const commandId = useId();
  const [draft, setDraft] = useState(() => ({
    sourceCommand: receipt.command,
    command: receipt.command,
  }));
  const command = draft.sourceCommand === receipt.command ? draft.command : receipt.command;
  const trimmedCommand = command.trim();
  const canSubmitCommand = !disabled && trimmedCommand.length > 0;
  const canSendOriginal = !disabled && Boolean(receipt.originalText?.trim() && onSendAsChat);

  function updateCommand(nextCommand: string) {
    setDraft({ sourceCommand: receipt.command, command: nextCommand });
    onCommandChange?.(nextCommand);
  }

  function runCommand() {
    if (!canSubmitCommand || !onRun) return;
    onRun(trimmedCommand, receipt);
  }

  function insertCommand() {
    if (!canSubmitCommand || !onInsert) return;
    onInsert(trimmedCommand, receipt);
  }

  function sendOriginal() {
    const originalText = receipt.originalText?.trim();
    if (!canSendOriginal || !originalText || !onSendAsChat) return;
    onSendAsChat(originalText, receipt);
  }

  return (
    <section
      aria-label={`${receipt.label} command receipt`}
      className={cn(
        "rounded-md border border-border bg-background/85 p-2.5 shadow-sm",
        "flex max-w-full flex-col gap-2 text-xs",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="min-w-0 truncate text-[12px] font-semibold text-foreground">
            {receipt.label}
          </h3>
          {receipt.defaultMode ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              {receipt.defaultMode}
            </span>
          ) : null}
        </div>
        {receipt.vocabularyHint ? (
          <p className="text-[11px] leading-snug text-muted-foreground">{receipt.vocabularyHint}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={commandId}
          className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70"
        >
          Command
        </label>
        <Textarea
          id={commandId}
          value={command}
          disabled={disabled}
          spellCheck={false}
          rows={2}
          aria-label="Generated AFX command"
          onChange={(event) => updateCommand(event.currentTarget.value)}
          className="min-h-14 resize-y font-mono text-[11px] leading-snug"
        />
      </div>

      {receipt.originalText ? (
        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground/75">
          Original: {receipt.originalText}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {onRun ? (
          <Button
            type="button"
            size="xs"
            variant={receipt.defaultMode === "run" ? "default" : "outline"}
            disabled={!canSubmitCommand}
            onClick={runCommand}
          >
            Run
          </Button>
        ) : null}
        {onInsert ? (
          <Button
            type="button"
            size="xs"
            variant={receipt.defaultMode === "insert" ? "default" : "outline"}
            disabled={!canSubmitCommand}
            onClick={insertCommand}
          >
            Insert
          </Button>
        ) : null}
        {receipt.originalText && onSendAsChat ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={!canSendOriginal}
            onClick={sendOriginal}
          >
            Send as normal chat
          </Button>
        ) : null}
      </div>
    </section>
  );
}
