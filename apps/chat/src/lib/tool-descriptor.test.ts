import { describe, expect, it } from "vitest";

import type { ChatToolView } from "@afx/shared";

import { toolDescriptor } from "./tool-descriptor";

function tool(toolName: string): ChatToolView {
  return {
    toolCallId: `tool-${toolName}`,
    toolName,
    status: "ok",
    args: { path: "apps/chat/src/views/chat.tsx" },
  };
}

describe("toolDescriptor", () => {
  it.each([
    ["edit_file", "Edited"],
    ["write_file", "Edited"],
    ["apply_patch", "Edited"],
    ["read_file", "Read"],
    ["bash", "Ran command"],
    ["shell_command", "Ran command"],
  ])("classifies %s as %s", (name, action) => {
    expect(toolDescriptor(tool(name)).action).toBe(action);
  });

  it("classifies edit_file before generic file fallback", () => {
    expect(toolDescriptor(tool("edit_file")).action).toBe("Edited");
  });
});
