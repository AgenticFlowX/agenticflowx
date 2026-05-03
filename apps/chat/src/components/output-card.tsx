/**
 * OutputCard — renders streamed shell command output in the message timeline.
 * Shows stdout (muted), stderr (red), exit badge (amber for non-zero).
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-9]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-SYSTEM-COMMAND]
 */
import type { ReactNode } from "react";

import { Terminal } from "lucide-react";

export interface OutputCardProps {
  /** The shell command that was executed. */
  command?: string;
  /** Accumulated stdout text. */
  stdout?: string;
  /** Accumulated stderr text. */
  stderr?: string;
  /** Exit code when the process has closed. */
  exitCode?: number;
  /** Error message if the process failed to start. */
  error?: string;
}

/**
 * Renders command output as a terminal-style card.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-9]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-SYSTEM-COMMAND]
 */
export function OutputCard({
  command = "",
  stdout = "",
  stderr = "",
  exitCode,
  error,
}: OutputCardProps): ReactNode {
  const stdoutLines = stdout.split("\n");
  const stderrLines = stderr.split("\n");

  return (
    <div className="my-2 rounded-md border border-border bg-muted/40 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-3 py-1.5">
        <Terminal size={11} className="shrink-0 text-muted-foreground/60" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Shell Output
        </span>
        {exitCode !== undefined && (
          <span
            className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
              exitCode === 0 ? "bg-green-500/20 text-green-500" : "bg-amber-500/20 text-amber-500"
            }`}
          >
            exit {exitCode}
          </span>
        )}
        {error && <span className="ml-auto text-[10px] font-semibold text-red-500">error</span>}
      </div>

      {/* Body */}
      <div className="max-h-64 overflow-y-auto px-3 py-2">
        {command && (
          <pre className="mb-2 whitespace-pre-wrap border-b border-border/50 pb-1.5 text-[11px] text-muted-foreground/60">
            <span className="text-muted-foreground/40">$</span> {command}
          </pre>
        )}
        {error ? (
          <pre className="whitespace-pre-wrap text-red-400">{error}</pre>
        ) : (
          <>
            <pre className="whitespace-pre-wrap text-muted-foreground/80">
              {stdoutLines.map((line, i) => (
                <div key={`out-${i}`}>{line || "\u00A0"}</div>
              ))}
            </pre>
            {stderr.length > 0 && (
              <pre className="whitespace-pre-wrap text-red-400">
                {stderrLines.map((line, i) => (
                  <div key={`err-${i}`}>{line || "\u00A0"}</div>
                ))}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}
