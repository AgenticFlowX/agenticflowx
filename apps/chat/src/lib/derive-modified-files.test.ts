/**
 * Unit tests for `deriveModifiedFiles`.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 */
import { describe, expect, it } from "vitest";

import type { ChatMessageView, ChatTimelineItem, ChatToolView } from "@afx/shared";

import { deriveModifiedFiles } from "./derive-modified-files";

function tool(
  toolName: string,
  args: Record<string, unknown>,
  status: ChatToolView["status"] = "ok",
  toolCallId = `${toolName}-${Math.random().toString(36).slice(2, 8)}`,
  extras: Partial<ChatToolView> = {},
): ChatToolView {
  return { toolCallId, toolName, status, args, ...extras };
}

function asst(id: string, tools: ChatToolView[]): ChatMessageView {
  return {
    id,
    role: "assistant",
    content: "",
    createdAt: 0,
    tools,
  };
}

function user(id: string): ChatMessageView {
  return {
    id,
    role: "user",
    content: "",
    createdAt: 0,
  };
}

describe("deriveModifiedFiles", () => {
  it("returns empty when timeline has no tool calls", () => {
    const tl: ChatTimelineItem[] = [user("u1"), asst("a1", [])];
    const out = deriveModifiedFiles(tl);
    expect(out.files).toEqual([]);
    expect(out.latestEditingAssistantMessageId).toBeNull();
  });

  it("ignores non-edit tool calls (Read, Bash)", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [tool("Read", { path: "src/a.ts" }), tool("Bash", { command: "ls" })]),
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.files).toEqual([]);
    expect(out.latestEditingAssistantMessageId).toBeNull();
  });

  it("collects Edit and Write tool calls and reports the latest assistant id", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [
        tool("Edit", { path: "src/x.ts" }, "ok"),
        tool("Write", { filePath: "src/y.ts" }, "ok"),
      ]),
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.files.map((f) => f.path).sort()).toEqual(["src/x.ts", "src/y.ts"]);
    expect(out.latestEditingAssistantMessageId).toBe("a1");
  });

  it("matches NotebookEdit tool name (case-insensitive substring)", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [tool("NotebookEdit", { notebook_path: "n/foo.ipynb" })]),
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.files).toHaveLength(1);
    expect(out.files[0]?.path).toBe("n/foo.ipynb");
  });

  it("dedupes by path with most-recent-win across turns", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [tool("Edit", { path: "src/x.ts" }, "ok", "tc-1")]),
      user("u2"),
      asst("a2", [tool("Edit", { path: "src/x.ts" }, "running", "tc-2")]),
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.files).toHaveLength(1);
    expect(out.files[0]?.path).toBe("src/x.ts");
    expect(out.files[0]?.toolCallId).toBe("tc-2");
    expect(out.files[0]?.status).toBe("running");
    expect(out.latestEditingAssistantMessageId).toBe("a2");
  });

  it("orders files most-recent first", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [tool("Edit", { path: "src/old.ts" })]),
      user("u2"),
      asst("a2", [tool("Edit", { path: "src/new.ts" })]),
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.files.map((f) => f.path)).toEqual(["src/new.ts", "src/old.ts"]);
  });

  it("falls through PATH_KEYS in order: path, filePath, file_path, notebook_path", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [
        tool("Write", { filePath: "f1.ts" }),
        tool("Edit", { file_path: "f2.ts" }),
        tool("NotebookEdit", { notebook_path: "f3.ipynb" }),
      ]),
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.files.map((f) => f.path).sort()).toEqual(["f1.ts", "f2.ts", "f3.ipynb"]);
  });

  it("skips tool calls with missing or empty path", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [
        tool("Edit", {}),
        tool("Edit", { path: "" }),
        tool("Edit", { path: "  " }),
        tool("Edit", { path: 123 }),
        tool("Edit", { path: "src/ok.ts" }),
      ]),
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.files).toHaveLength(1);
    expect(out.files[0]?.path).toBe("src/ok.ts");
  });

  it("trims whitespace around paths", () => {
    const tl: ChatTimelineItem[] = [asst("a1", [tool("Edit", { path: "  src/trim.ts  " })])];
    const out = deriveModifiedFiles(tl);
    expect(out.files[0]?.path).toBe("src/trim.ts");
  });

  it("ignores user messages even if they had tools (defensive)", () => {
    const userMsg: ChatMessageView = {
      ...user("u1"),
      // intentionally attach tools to make sure they are skipped
      tools: [tool("Edit", { path: "src/should-not-show.ts" })],
    };
    const out = deriveModifiedFiles([userMsg]);
    expect(out.files).toEqual([]);
  });

  it("matches edit-like substrings case-insensitively (e.g. multiEdit, str_replace_editor)", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [
        tool("multiEdit", { path: "a.ts" }),
        tool("str_replace_editor", { path: "b.ts" }),
        tool("CREATE_FILE", { path: "c.ts" }),
      ]),
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.files.map((f) => f.path).sort()).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  it("reports the LATEST assistant message id when multiple turns edit", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [tool("Edit", { path: "x.ts" })]),
      user("u2"),
      asst("a2", [tool("Edit", { path: "y.ts" })]),
      user("u3"),
      asst("a3", [tool("Read", { path: "z.ts" })]), // no edits in this turn
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.latestEditingAssistantMessageId).toBe("a2");
  });

  it("threads firstChangedLine onto ModifiedFile.line when present", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [tool("Edit", { path: "src/x.ts" }, "ok", "tc-1", { firstChangedLine: 42 })]),
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.files[0]?.line).toBe(42);
  });

  it("leaves line undefined when the tool call has no firstChangedLine", () => {
    const tl: ChatTimelineItem[] = [asst("a1", [tool("Edit", { path: "src/x.ts" })])];
    const out = deriveModifiedFiles(tl);
    expect(out.files[0]?.line).toBeUndefined();
  });

  it("most-recent-win dedupe also takes the latest tool's line", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [tool("Edit", { path: "src/x.ts" }, "ok", "tc-1", { firstChangedLine: 10 })]),
      user("u2"),
      asst("a2", [tool("Edit", { path: "src/x.ts" }, "ok", "tc-2", { firstChangedLine: 99 })]),
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.files[0]?.line).toBe(99);
  });

  it("dedupes path variants that differ only in normalization (./, double-slashes, backslashes)", () => {
    const tl: ChatTimelineItem[] = [
      asst("a1", [tool("Edit", { path: "src/x.ts" })]),
      user("u2"),
      asst("a2", [tool("Edit", { path: "./src/x.ts" })]),
      user("u3"),
      asst("a3", [tool("Edit", { path: "src//x.ts" })]),
      user("u4"),
      asst("a4", [tool("Edit", { path: "src\\x.ts" })]),
    ];
    const out = deriveModifiedFiles(tl);
    expect(out.files).toHaveLength(1);
    expect(out.files[0]?.path).toBe("src/x.ts");
  });

  it("normalizes the path on output (strips leading ./)", () => {
    const tl: ChatTimelineItem[] = [asst("a1", [tool("Edit", { path: "./packages/x.ts" })])];
    const out = deriveModifiedFiles(tl);
    expect(out.files[0]?.path).toBe("packages/x.ts");
  });
});
