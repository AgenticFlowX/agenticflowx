/**
 * Reads Pi's on-disk session JSONL store with `node:fs` — no `@earendil-works/*`
 * runtime import.
 *
 * Each session is one JSONL file: line 1 is the session header, each subsequent
 * line is an entry forming a `parentId` tree, stored flat under the configured
 * `sessionDir`.
 *   - `listSessionsFromDisk` scans `sessionDir` for `*.jsonl` and derives one row
 *     per file; `cwd` scopes the result to a single workspace via the header cwd.
 *   - `readTranscriptFromDisk` resolves the active leaf branch by walking
 *     `parentId` from the last entry to the root.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [NFR-6] [NFR-9]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-STORE] [DES-PERSISTENT-FLOW]
 */
import type { Dirent } from "node:fs";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, sep } from "node:path";

import type { AgentSessionInfo, AgentTranscriptEntry } from "@afx/shared";

// Minimal local mirror of the on-disk shapes (no SDK import). Pi writes a JSONL
// tree: line 1 is the session header, each subsequent line is an entry.
interface DiskHeader {
  type: "session";
  id: string;
  timestamp: string;
  cwd?: string;
  parentSession?: string;
}
interface DiskMessage {
  role: string;
  content?: unknown;
  timestamp?: number;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  command?: string;
  exitCode?: number;
  summary?: string;
  thinking?: string;
}
interface DiskEntry {
  type: string;
  id: string;
  parentId: string | null;
  timestamp?: string;
  message?: DiskMessage;
  name?: string; // session_info entries
}

export interface ParsedSession {
  info: AgentSessionInfo;
  /** Workspace the session ran in (header.cwd), used to scope the list. */
  cwd: string;
}

function parseJsonl(content: string): DiskEntry[] {
  const out: DiskEntry[] = [];
  for (const line of content.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as DiskEntry);
    } catch {
      // skip malformed lines
    }
  }
  return out;
}

/** Join the `text` of string or block-array content; ignores images/thinking/tools. */
function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (b): b is { type: string; text?: string } =>
          !!b && typeof b === "object" && (b as { type?: unknown }).type === "text",
      )
      .map((b) => (typeof b.text === "string" ? b.text : ""))
      .join("");
  }
  return "";
}

/** Parse one session file's content into a normalized list row. Pure. */
export function parseSessionInfo(content: string, path: string): ParsedSession | null {
  const entries = parseJsonl(content);
  if (entries.length === 0) return null;
  const header = entries[0] as unknown as DiskHeader;
  if (header.type !== "session") return null;

  let messageCount = 0;
  let firstMessage = "";
  let name: string | undefined;
  let lastActivity = 0;
  for (const entry of entries) {
    if (entry.type === "session_info") {
      name = entry.name?.trim() || undefined;
    }
    if (entry.type !== "message" || !entry.message) continue;
    messageCount++;
    const m = entry.message;
    if (typeof m.timestamp === "number") {
      lastActivity = Math.max(lastActivity, m.timestamp);
    } else if (typeof entry.timestamp === "string") {
      const t = Date.parse(entry.timestamp);
      if (!Number.isNaN(t)) lastActivity = Math.max(lastActivity, t);
    }
    if (!firstMessage && m.role === "user") {
      const txt = contentToText(m.content);
      if (txt) firstMessage = txt;
    }
  }

  const createdAt = Date.parse(header.timestamp) || 0;
  const updatedAt = lastActivity || createdAt;
  const label = name || firstMessage || undefined;
  const cwd = typeof header.cwd === "string" ? header.cwd : "";
  const info: AgentSessionInfo = {
    id: header.id,
    path,
    messageCount,
    createdAt,
    updatedAt,
    ...(label ? { label } : {}),
    ...(firstMessage ? { firstMessage } : {}),
    ...(cwd ? { cwd } : {}),
    ...(header.parentSession ? { forkedFrom: header.parentSession } : {}),
  };
  return { info, cwd };
}

/** Parse a session file's content into the active leaf-branch transcript. Pure. */
export function parseTranscript(content: string): AgentTranscriptEntry[] {
  const entries = parseJsonl(content);
  if (entries.length === 0) return [];
  const byId = new Map<string, DiskEntry>();
  for (const e of entries) if (e.id) byId.set(e.id, e);

  // Leaf is the last message entry; metadata rows such as session_info can be
  // appended after messages and must not make the transcript look empty.
  const branch: DiskEntry[] = [];
  let current: DiskEntry | undefined;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]?.type === "message") {
      current = entries[i];
      break;
    }
  }
  while (current) {
    branch.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  const out: AgentTranscriptEntry[] = [];
  for (const entry of branch) {
    if (entry.type !== "message" || !entry.message) continue;
    const m = entry.message;
    const createdAt =
      typeof m.timestamp === "number"
        ? m.timestamp
        : entry.timestamp
          ? Date.parse(entry.timestamp) || 0
          : 0;
    switch (m.role) {
      case "user":
        out.push({ role: "user", text: contentToText(m.content), createdAt });
        break;
      case "assistant": {
        const text = contentToText(m.content);
        const blocks = Array.isArray(m.content)
          ? (m.content as Array<Record<string, unknown>>)
          : [];
        const thinking = blocks
          .filter((b) => b["type"] === "thinking" && typeof b["thinking"] === "string")
          .map((b) => b["thinking"] as string)
          .join("");
        const toolCalls = blocks
          .filter((b) => b["type"] === "toolCall")
          .map((b) => ({
            id: typeof b["id"] === "string" ? b["id"] : "",
            name: typeof b["name"] === "string" ? b["name"] : "",
            args: (b["arguments"] as Record<string, unknown>) ?? {},
          }));
        out.push({
          role: "assistant",
          createdAt,
          ...(text ? { text } : {}),
          ...(thinking ? { thinking } : {}),
          ...(toolCalls.length ? { toolCalls } : {}),
        });
        break;
      }
      case "toolResult": {
        const summary = contentToText(m.content);
        out.push({
          role: "tool",
          createdAt,
          toolResult: {
            toolCallId: m.toolCallId ?? "",
            toolName: m.toolName ?? "",
            ok: !m.isError,
            ...(summary ? { summary } : {}),
          },
        });
        break;
      }
      case "bashExecution":
        out.push({
          role: "bash",
          createdAt,
          bash: {
            command: m.command ?? "",
            ...(typeof m.exitCode === "number" ? { exitCode: m.exitCode } : {}),
          },
          ...(typeof m.content === "string" && m.content ? { text: m.content } : {}),
        });
        break;
      case "compactionSummary":
        out.push({ role: "compaction", text: m.summary ?? "", createdAt });
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * List persisted sessions under `sessionDir` (newest-first). When `cwd` is given,
 * only sessions started in that workspace are returned (the default list);
 * omit it to list every workspace's sessions.
 */
/** Collect `*.jsonl` paths under `dir`, descending into project subdirs. */
async function findSessionFiles(dir: string, depth = 4): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // directory does not exist yet
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(full);
    } else if (entry.isDirectory() && depth > 0) {
      files.push(...(await findSessionFiles(full, depth - 1)));
    }
  }
  return files;
}

/** Most-recent sessions parsed per list; older ones beyond this are skipped. */
export const MAX_PARSED_SESSIONS = 400;

/**
 * Every directory a Pi runtime may keep sessions in, independent of how the
 * binary was installed or located:
 *   1. the AFX-managed dir (`afx.sessionDir` / `<globalStorage>/sessions`), if set;
 *   2. `<agentDir>/sessions`, where `agentDir` is the caller-resolved Pi agent dir
 *      (`$PI_CODING_AGENT_DIR` when set, else `~/.pi/agent`);
 *   3. `~/.pi/agent/sessions` — the Pi default, always included as a fallback.
 * All are scanned and merged, so history is found wherever the configured Pi
 * actually writes, not only where AFX points it. `agentDir` is injected (the
 * host owns env resolution), not read from `process.env` here.
 */
export function piSessionRoots(sessionDir?: string, agentDir?: string): string[] {
  const roots: string[] = [];
  if (sessionDir?.trim()) roots.push(sessionDir.trim());
  if (agentDir?.trim()) roots.push(join(agentDir.trim(), "sessions"));
  roots.push(join(homedir(), ".pi", "agent", "sessions"));
  return [...new Set(roots)];
}

function isInsideRoot(target: string, root: string): boolean {
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`;
  return target === root || target.startsWith(normalizedRoot);
}

/**
 * Defence-in-depth for webview-supplied session handles. History actions may
 * only read, switch, or delete JSONL files already under a configured Pi session
 * root; symlink targets are resolved before comparison.
 */
export async function isSessionPathAllowed(
  sessionPath: string,
  roots: readonly string[],
): Promise<boolean> {
  if (!sessionPath.endsWith(".jsonl")) return false;

  let target: string;
  try {
    target = await realpath(sessionPath);
  } catch {
    return false;
  }

  const resolvedRoots = await Promise.all(
    [...new Set(roots)].map(async (root) => {
      try {
        return await realpath(root);
      } catch {
        return null;
      }
    }),
  );
  return resolvedRoots.some((root) => root !== null && isInsideRoot(target, root));
}

export async function assertSessionPathAllowed(
  sessionPath: string,
  roots: readonly string[],
): Promise<void> {
  if (!(await isSessionPathAllowed(sessionPath, roots))) {
    throw new Error("Session path is outside configured Pi session roots");
  }
}

export async function listSessionsFromDisk(
  roots: string[],
  cwd?: string,
): Promise<AgentSessionInfo[]> {
  // Pi nests sessions per project: `<root>/sessions/<encoded-cwd>/*.jsonl` (some
  // legacy files sit flat). Scan each root's tree and merge to the full,
  // cross-project history; dedupe in case roots overlap.
  const fileSets = await Promise.all(roots.map((root) => findSessionFiles(root)));
  let files = [...new Set(fileSets.flat())];

  // Bound the work for large histories: parse only the most recently modified.
  if (files.length > MAX_PARSED_SESSIONS) {
    const stamped = await Promise.all(
      files.map(async (path) => {
        try {
          return { path, mtime: (await stat(path)).mtimeMs };
        } catch {
          return { path, mtime: 0 };
        }
      }),
    );
    stamped.sort((a, b) => b.mtime - a.mtime);
    files = stamped.slice(0, MAX_PARSED_SESSIONS).map((s) => s.path);
  }

  const parsed = await Promise.all(
    files.map(async (path) => {
      try {
        return parseSessionInfo(await readFile(path, "utf8"), path);
      } catch {
        return null;
      }
    }),
  );
  return parsed
    .filter((p): p is ParsedSession => p !== null)
    .filter((p) => !cwd || p.cwd === cwd)
    .map((p) => p.info)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Read a session file's active leaf-branch transcript. */
export async function readTranscriptFromDisk(sessionPath: string): Promise<AgentTranscriptEntry[]> {
  try {
    return parseTranscript(await readFile(sessionPath, "utf8"));
  } catch {
    return [];
  }
}
