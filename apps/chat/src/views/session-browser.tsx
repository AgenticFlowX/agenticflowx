/**
 * Persistent session browser — lists past conversations, opens one read-only,
 * and reopens it to continue. Owns its bridge subscriptions (`session/list`,
 * `history/loaded`).
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-16] [FR-17] [FR-18] [FR-19] [FR-22]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI] [DES-HISTORY-MOCKUPS] [DES-PERSISTENT-FLOW]
 */
import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  CalendarClock,
  Check,
  ChevronLeft,
  Copy,
  Cpu,
  ExternalLink,
  Folder,
  GitBranch,
  Hammer,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Search,
  Sparkles,
  Terminal,
  Trash2,
  UserRound,
} from "lucide-react";

import type { AgentSessionInfo, AgentTranscriptEntry } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Input } from "@afx/ui/components/input";
import { cn } from "@afx/ui/lib/utils";

import { toast } from "../components/toast";
import { bridgeOn, bridgeSend } from "../lib/bridge";

interface ListState {
  loading: boolean;
  supported: boolean;
  sessions: AgentSessionInfo[];
}

interface OpenedState {
  session: AgentSessionInfo;
  entries: AgentTranscriptEntry[] | null;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Last path segment of a workspace dir — the project name shown on a session. */
function projectName(cwd: string): string {
  const parts = cwd.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

function oneLine(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function recapEntry(entry: AgentTranscriptEntry): string | null {
  switch (entry.role) {
    case "user": {
      const text = oneLine(entry.text);
      return text ? `- User: ${text}` : null;
    }
    case "assistant": {
      const lines: string[] = [];
      const text = oneLine(entry.text);
      if (text) lines.push(`- Assistant: ${text}`);
      for (const call of entry.toolCalls ?? []) {
        if (call.name) lines.push(`  - Tool call: ${call.name}`);
      }
      return lines.length ? lines.join("\n") : null;
    }
    case "tool": {
      const name = entry.toolResult?.toolName;
      if (!name) return null;
      return `- Tool result: ${name}${entry.toolResult?.ok === false ? " (failed)" : " (ok)"}`;
    }
    case "bash": {
      const command = oneLine(entry.bash?.command);
      if (!command) return null;
      const exit = entry.bash?.exitCode;
      return `- Bash: ${command}${typeof exit === "number" ? ` (exit ${exit})` : ""}`;
    }
    case "compaction": {
      const text = oneLine(entry.text);
      return text ? `- Compaction: ${text}` : null;
    }
    default:
      return null;
  }
}

function buildSessionRecap(session: AgentSessionInfo, entries: AgentTranscriptEntry[]): string {
  const title = session.label ?? session.firstMessage ?? session.id;
  const lines = [
    `# ${title}`,
    "",
    "## Session",
    `- Project: ${session.cwd ? projectName(session.cwd) : "Unknown"}`,
    `- Messages: ${session.messageCount}`,
    `- Updated: ${new Date(session.updatedAt).toLocaleString()}`,
  ];

  const firstPrompt = oneLine(session.firstMessage);
  if (firstPrompt) lines.push(`- First prompt: ${firstPrompt}`);

  const outline = entries.map(recapEntry).filter((line): line is string => Boolean(line));
  const visible = outline.slice(0, 24);
  lines.push(
    "",
    "## Transcript Outline",
    ...(visible.length ? visible : ["- No transcript entries."]),
  );
  if (outline.length > visible.length) {
    lines.push(`- ...${outline.length - visible.length} more entries`);
  }

  return `${lines.join("\n")}\n`;
}

export function SessionBrowser({
  active = true,
  onReopened,
}: {
  active?: boolean;
  /** Called after a session is reopened, so the host can return to the chat view. */
  onReopened?: () => void;
}) {
  const [list, setList] = useState<ListState>({ loading: true, supported: true, sessions: [] });
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<OpenedState | null>(null);

  useEffect(() => {
    const offs = [
      bridgeOn("session/list", (msg) =>
        setList({ loading: false, supported: msg.supported, sessions: msg.sessions }),
      ),
      bridgeOn("history/loaded", (msg) =>
        setOpened((prev) =>
          prev && prev.session.path === msg.sessionPath ? { ...prev, entries: msg.entries } : prev,
        ),
      ),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // Re-read the list each time this surface becomes active — the agent writes
  // sessions to disk between visits.
  useEffect(() => {
    if (active) bridgeSend({ type: "session/list" });
  }, [active]);

  const refresh = () => {
    setList((prev) => ({ ...prev, loading: true }));
    bridgeSend({ type: "session/list" });
  };

  const openSession = (session: AgentSessionInfo) => {
    setOpened({ session, entries: null });
    bridgeSend({ type: "history/load", sessionPath: session.path });
  };

  const reopen = (session: AgentSessionInfo) => {
    bridgeSend({ type: "history/reopen", sessionPath: session.path });
    setOpened(null);
    onReopened?.();
  };

  const remove = (session: AgentSessionInfo) =>
    bridgeSend({ type: "session/delete", sessionPath: session.path });

  const revealCwd = (cwd: string) => {
    if (cwd) bridgeSend({ type: "session/revealCwd", cwd });
  };

  // Aggregate overview of the persisted sessions (all, not the filtered view).
  const stats = useMemo(() => {
    const messages = list.sessions.reduce((n, s) => n + s.messageCount, 0);
    const projects = new Set(list.sessions.map((s) => s.cwd).filter((c): c is string => !!c)).size;
    return { sessions: list.sessions.length, messages, projects };
  }, [list.sessions]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.sessions.filter(
          (s) =>
            (s.label ?? s.firstMessage ?? "").toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q) ||
            new Date(s.updatedAt).toLocaleDateString().toLowerCase().includes(q),
        )
      : list.sessions;
    const sorted = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
    const byDay = new Map<string, AgentSessionInfo[]>();
    for (const s of sorted) {
      const label = dayLabel(s.updatedAt);
      const arr = byDay.get(label) ?? [];
      arr.push(s);
      byDay.set(label, arr);
    }
    return [...byDay.entries()];
  }, [list.sessions, query]);

  if (opened) {
    return (
      <TranscriptView
        session={opened.session}
        entries={opened.entries}
        onBack={() => setOpened(null)}
        onReopen={() => reopen(opened.session)}
        onDelete={() => {
          remove(opened.session);
          setOpened(null);
        }}
      />
    );
  }

  return (
    <section className="flex flex-col gap-2.5" aria-label="Past sessions">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-8 pl-8 text-[13px]"
            aria-label="Search sessions"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={refresh}
          aria-label="Refresh sessions"
        >
          <RefreshCw
            className={cn("size-4 text-muted-foreground", list.loading && "animate-spin")}
          />
        </Button>
      </div>

      {!list.loading && list.supported && stats.sessions > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-0.5 font-mono text-[10px] text-muted-foreground">
          <span className="whitespace-nowrap">
            <span className="text-foreground">{stats.sessions}</span>{" "}
            {stats.sessions === 1 ? "session" : "sessions"}
          </span>
          <span className="opacity-40">·</span>
          <span className="whitespace-nowrap">
            <span className="text-foreground">{stats.messages}</span> messages
          </span>
          {stats.projects > 0 ? (
            <>
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Folder size={10} className="text-afx-brand-soft/70" />
                <span className="text-foreground">{stats.projects}</span>{" "}
                {stats.projects === 1 ? "project" : "projects"}
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      {list.loading ? (
        <StatusBlock
          icon={<LoaderCircle className="size-5 animate-spin text-afx-brand-soft" />}
          title="Reading sessions…"
        />
      ) : !list.supported ? (
        <StatusBlock
          icon={<Cpu className="size-5 text-afx-brand-soft" />}
          title="Managed by the runtime"
          detail="This runtime keeps its own conversation history; AFX lists sessions for the bundled runtime."
        />
      ) : list.sessions.length === 0 ? (
        <StatusBlock
          icon={<MessageSquareText className="size-5 text-afx-brand-soft" />}
          title="No past conversations yet"
          detail="Sessions you run with the agent are saved here automatically."
        />
      ) : groups.length === 0 ? (
        <StatusBlock
          icon={<Search className="size-5 text-afx-brand-soft" />}
          title={`No sessions match “${query}”`}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map(([label, sessions]) => (
            <li key={label}>
              <div className="sticky top-0 z-10 -mx-2 mb-1.5 border-y bg-muted/80 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <CalendarClock size={10} className="shrink-0 text-afx-brand-soft" />
                  <span className="min-w-0 truncate">{label}</span>
                  <span className="shrink-0 opacity-50">· {sessions.length}</span>
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {sessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    onOpen={() => openSession(s)}
                    onDelete={() => remove(s)}
                    onReveal={() => revealCwd(s.cwd ?? "")}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusBlock({ icon, title, detail }: { icon: ReactNode; title: string; detail?: string }) {
  return (
    <div className="afx-surface-card mt-1 flex flex-col items-center gap-1.5 rounded-md border px-3 py-8 text-center @[280px]:px-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/40">
        {icon}
      </span>
      <p className="max-w-full break-words text-[13px] font-medium text-foreground">{title}</p>
      {detail ? (
        <p className="max-w-full break-words text-[11px] leading-snug text-muted-foreground @[300px]:max-w-[18rem]">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function SessionRow({
  session,
  onOpen,
  onDelete,
  onReveal,
}: {
  session: AgentSessionInfo;
  onOpen: () => void;
  onDelete: () => void;
  onReveal: () => void;
}) {
  const label = session.label ?? session.firstMessage ?? session.id;
  const project = session.cwd ? projectName(session.cwd) : null;
  return (
    <li data-testid={`session-row-${session.id}`} className="group flex items-stretch gap-1">
      <div className="afx-surface-card flex min-w-0 flex-1 items-center gap-1 rounded-md border border-border/50 pr-1.5 transition-colors hover:border-afx-brand-soft/40 hover:bg-muted/40">
        <button
          type="button"
          onClick={onOpen}
          title="Open session"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-2 pl-2.5 text-left"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-afx-brand-soft">
            <MessageSquareText size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium text-foreground">{label}</span>
              {session.forkedFrom ? (
                <GitBranch
                  size={11}
                  className="shrink-0 text-muted-foreground"
                  aria-label="Forked session"
                />
              ) : null}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[10px] text-muted-foreground">
              <span className="shrink-0 whitespace-nowrap">
                {session.messageCount} {session.messageCount === 1 ? "message" : "messages"}
              </span>
              <span className="shrink-0 opacity-50">·</span>
              <span className="min-w-0 truncate">{relativeTime(session.updatedAt)}</span>
            </span>
          </span>
        </button>
        {project ? (
          <button
            type="button"
            onClick={onReveal}
            title="Reveal project in file manager"
            aria-label={`Reveal ${project} in file manager`}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-afx-brand-soft/40 hover:bg-muted hover:text-foreground"
          >
            <Folder size={11} className="shrink-0 text-afx-brand-soft/70" />
            <span className="hidden max-w-[7rem] truncate @[280px]:inline">{project}</span>
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${label}`}
        title="Delete session"
        className="flex w-0 shrink-0 items-center justify-center overflow-hidden rounded-md text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:w-8 group-hover:opacity-100"
      >
        <Trash2 size={14} className="shrink-0" />
      </button>
    </li>
  );
}

function TranscriptView({
  session,
  entries,
  onBack,
  onReopen,
  onDelete,
}: {
  session: AgentSessionInfo;
  entries: AgentTranscriptEntry[] | null;
  onBack: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyRecap(): Promise<void> {
    if (entries === null) return;
    try {
      await navigator.clipboard.writeText(buildSessionRecap(session, entries));
      setCopied(true);
      toast.success("Session recap copied");
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Copy failed", "Could not copy the session recap.");
    }
  }

  return (
    <section className="@container flex flex-col" aria-label="Session transcript">
      <header className="sticky top-0 z-10 -mx-2 flex items-center gap-1.5 border-b bg-background/95 px-2 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onBack}
          aria-label="Back to sessions"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
          {session.label ?? session.firstMessage ?? session.id}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1.5 px-2 text-muted-foreground"
          onClick={() => void copyRecap()}
          disabled={entries === null}
          aria-label="Copy session recap"
          title="Copy session recap"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          <span aria-hidden="true" className="hidden @[360px]:inline">
            {copied ? "Copied" : "Copy recap"}
          </span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          onClick={onDelete}
          aria-label="Delete session"
        >
          <Trash2 className="size-4" />
        </Button>
      </header>

      <div className="py-3">
        {entries === null ? (
          <StatusBlock
            icon={<LoaderCircle className="size-5 animate-spin text-afx-brand-soft" />}
            title="Loading transcript…"
          />
        ) : entries.length === 0 ? (
          <StatusBlock
            icon={<MessageSquareText className="size-5 text-afx-brand-soft" />}
            title="This session has no messages."
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {entries.map((entry, i) => (
              <TranscriptRow key={i} entry={entry} />
            ))}
          </ol>
        )}
      </div>

      <footer className="sticky bottom-0 -mx-2 flex items-center justify-between gap-2 border-t bg-background/95 px-2 py-2 backdrop-blur">
        <span className="min-w-0 shrink truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Read-only
        </span>
        <Button
          size="sm"
          className="h-7 shrink-0 gap-1.5 whitespace-nowrap"
          onClick={onReopen}
          aria-label="Reopen & continue"
        >
          <ExternalLink size={13} />
          <span aria-hidden="true" className="hidden @[280px]:inline">
            Reopen &amp; continue
          </span>
          <span aria-hidden="true" className="@[280px]:hidden">
            Reopen
          </span>
        </Button>
      </footer>
    </section>
  );
}

function TranscriptRow({ entry }: { entry: AgentTranscriptEntry }) {
  if (entry.role === "user") {
    return (
      <li className="flex gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
          <UserRound size={13} />
        </span>
        <p className="min-w-0 whitespace-pre-wrap break-words pt-0.5 text-[13px] text-foreground">
          {entry.text}
        </p>
      </li>
    );
  }
  if (entry.role === "assistant") {
    return (
      <li className="flex gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-afx-brand-soft/30 bg-afx-brand/10 text-afx-brand-soft">
          <Sparkles size={13} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          {entry.text ? (
            <p className="whitespace-pre-wrap break-words text-[13px] text-foreground">
              {entry.text}
            </p>
          ) : null}
          {entry.toolCalls?.length ? (
            <div className="mt-1 flex flex-col gap-0.5">
              {entry.toolCalls.map((tc) => (
                <span
                  key={tc.id}
                  className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] text-muted-foreground"
                >
                  <Hammer size={11} className="shrink-0 text-afx-brand-soft/70" />
                  <span className="truncate">{tc.name}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </li>
    );
  }
  if (entry.role === "bash") {
    return (
      <li className="ml-8 flex min-w-0 items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
        <Terminal size={11} className="shrink-0 text-afx-brand-soft/70" />
        <code className="min-w-0 truncate">{entry.bash?.command}</code>
        {entry.bash?.exitCode !== undefined && entry.bash.exitCode !== 0 ? (
          <span className="shrink-0 whitespace-nowrap text-red-400">
            exit {entry.bash.exitCode}
          </span>
        ) : null}
      </li>
    );
  }
  if (entry.role === "tool") {
    return (
      <li className="ml-8 flex min-w-0 items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
        <Hammer size={11} className="shrink-0 text-afx-brand-soft/70" />
        <span className="min-w-0 truncate">{entry.toolResult?.toolName}</span>
        {entry.toolResult?.ok === false ? (
          <span className="shrink-0 whitespace-nowrap text-red-400">failed</span>
        ) : null}
      </li>
    );
  }
  return (
    <li className="ml-8 flex min-w-0 items-center gap-1.5 text-[10px] italic text-muted-foreground">
      <Cpu size={11} className="shrink-0" />
      <span className="min-w-0 truncate">{entry.text}</span>
    </li>
  );
}
