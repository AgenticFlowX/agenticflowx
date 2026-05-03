/**
 * MarkdownMessage — renders assistant message content as GFM markdown with code copy buttons.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-2]
 * @see docs/specs/210-app-chat/design.md [DES-UI]
 * @see docs/specs/212-app-chat-messages/spec.md [FR-3]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENT-MARKDOWN] [DES-MESSAGES-MARKDOWN]
 */
import { useMemo, useState } from "react";

import { Check, Copy } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@afx/ui/components/button";

interface MarkdownMessageProps {
  content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const components = useMemo<Components>(
    () => ({
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
      ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
      li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
      blockquote: ({ children }) => (
        <blockquote className="mb-2 border-l-2 pl-3 text-muted-foreground last:mb-0">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="my-2 border-border" />,
      table: ({ children }) => (
        <div className="mb-2 overflow-x-auto rounded-md border last:mb-0">
          <table className="w-full text-left text-xs">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
      th: ({ children }) => <th className="border-b px-2 py-1.5 font-medium">{children}</th>,
      td: ({ children }) => <td className="border-b px-2 py-1.5 align-top">{children}</td>,
      a: ({ href, children }) => (
        <a href={href} className="underline underline-offset-2" target="_blank" rel="noreferrer">
          {children}
        </a>
      ),
      code: ({ className, children }) => {
        const raw = typeof children === "string" ? children : "";
        const isBlock = (className ?? "").includes("language-") || raw.includes("\n");
        if (!isBlock) {
          return (
            <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[12px]">
              {children}
            </code>
          );
        }

        const language = className?.replace("language-", "")?.trim() || "text";
        return <CodeFence code={raw.replace(/\n$/, "")} language={language} />;
      },
    }),
    [],
  );

  return (
    <div className="text-[13px] leading-relaxed break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Renders fenced code blocks with a language label and copy affordance.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-3]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENT-MARKDOWN] [DES-MESSAGES-MARKDOWN]
 */
function CodeFence({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      // Ignore clipboard failures in restricted webview environments.
    }
  }

  return (
    <div className="mb-2 overflow-hidden rounded-md border bg-muted/30 last:mb-0">
      <div className="flex items-center justify-between border-b bg-muted/40 px-2 py-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {language}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => void onCopy()}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-2 text-[12px]">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
