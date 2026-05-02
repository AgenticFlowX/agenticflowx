/**
 * Lightweight toast notifications used to confirm runtime mutations and host actions
 * without pulling sonner/next-themes into the webview bundle.
 *
 * @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-13]
 */
import { useEffect, useState } from "react";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

import { cn } from "@afx/ui/lib/utils";

export type ToastTone = "success" | "info" | "error";

export interface ToastEntry {
  id: string;
  message: string;
  tone: ToastTone;
  description?: string;
  durationMs: number;
  createdAt: number;
}

type Listener = (entries: readonly ToastEntry[]) => void;

const listeners = new Set<Listener>();
let entries: ToastEntry[] = [];

function emit(): void {
  for (const listener of listeners) listener(entries);
}

function makeId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function push(message: string, tone: ToastTone, description?: string, durationMs = 2400): string {
  const id = makeId();
  const entry: ToastEntry = {
    id,
    message,
    tone,
    description,
    durationMs,
    createdAt: Date.now(),
  };
  entries = [...entries, entry];
  emit();
  if (durationMs > 0) {
    setTimeout(() => dismiss(id), durationMs);
  }
  return id;
}

function dismiss(id: string): void {
  const next = entries.filter((entry) => entry.id !== id);
  if (next.length === entries.length) return;
  entries = next;
  emit();
}

export const toast = {
  success(message: string, description?: string, durationMs?: number): string {
    return push(message, "success", description, durationMs);
  },
  info(message: string, description?: string, durationMs?: number): string {
    return push(message, "info", description, durationMs);
  },
  error(message: string, description?: string, durationMs?: number): string {
    return push(message, "error", description, durationMs ?? 4200);
  },
  dismiss,
};

export function Toaster() {
  const [items, setItems] = useState<readonly ToastEntry[]>(entries);

  useEffect(() => {
    const listener: Listener = (next) => setItems(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <ol
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-2 z-50 mx-auto flex max-w-md flex-col items-stretch gap-1.5 px-3"
    >
      {items.map((entry) => (
        <li
          key={entry.id}
          className={cn(
            "afx-surface-card pointer-events-auto flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px] leading-relaxed shadow-md ring-1 transition-all",
            entry.tone === "success" && "ring-afx-success/25",
            entry.tone === "info" && "ring-afx-info/25",
            entry.tone === "error" && "ring-destructive/30",
          )}
        >
          <ToastIcon tone={entry.tone} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{entry.message}</p>
            {entry.description ? (
              <p className="mt-0.5 text-[10px] text-muted-foreground">{entry.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dismiss(entry.id)}
            className="-mr-0.5 -mt-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
            aria-label="Dismiss notification"
          >
            <X size={11} />
          </button>
        </li>
      ))}
    </ol>
  );
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") {
    return <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-afx-success" />;
  }
  if (tone === "error") {
    return <TriangleAlert size={13} className="mt-0.5 shrink-0 text-destructive" />;
  }
  return <Info size={13} className="mt-0.5 shrink-0 text-afx-info" />;
}
