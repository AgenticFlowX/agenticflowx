/**
 * One-click source copy affordance for rendered markdown surfaces.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11] [FR-14]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN]
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { Check, Copy } from "lucide-react";

import { Button } from "@afx/ui/components/button";
import { cn } from "@afx/ui/lib/utils";

import { isInVsCodeWebview, workbenchSend } from "../lib/bridge";

interface CopyMarkdownButtonProps {
  content: string | null | undefined;
  label?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Copies raw markdown, not rendered text, so hidden frontmatter/comments remain
 * available to users who want the full source.
 */
export function CopyMarkdownButton({
  content,
  label = "markdown",
  ariaLabel = "Copy markdown source",
  className,
}: CopyMarkdownButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const text = content ?? "";

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const showCopied = useCallback(() => {
    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 1400);
  }, []);

  const onCopy = useCallback(async () => {
    if (!text) return;
    if (isInVsCodeWebview()) {
      workbenchSend({ type: "afxCopyMarkdown", content: text, label });
      showCopied();
      return;
    }

    const copiedInWebview = (await copyWithClipboardApi(text)) || copyWithTextareaFallback(text);

    if (!copiedInWebview) {
      workbenchSend({ type: "afxCopyMarkdown", content: text, label });
    }

    showCopied();
  }, [label, showCopied, text]);

  const Icon = copied ? Check : Copy;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={cn("text-muted-foreground hover:text-foreground", className)}
      aria-label={ariaLabel}
      title={copied ? "Copied markdown" : "Copy markdown"}
      disabled={!text}
      onClick={() => void onCopy()}
    >
      <Icon size={12} aria-hidden />
    </Button>
  );
}

async function copyWithClipboardApi(text: string): Promise<boolean> {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function copyWithTextareaFallback(text: string): boolean {
  if (
    typeof document === "undefined" ||
    !document.body ||
    typeof document.execCommand !== "function"
  ) {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
