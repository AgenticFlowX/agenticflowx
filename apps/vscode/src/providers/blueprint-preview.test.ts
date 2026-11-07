/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-6] [FR-7]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-UI] [DES-TEST]
 */
import { describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { createBlueprintPreviewProvider } from "./blueprint-preview";

describe("Blueprint preview provider", () => {
  it("uses an opaque path even when the captured identity begins with a slash", () => {
    const provider = createBlueprintPreviewProvider();
    const uri = provider.update({
      id: "/code/private project",
      projectId: "source",
      content: "# Project",
    });
    expect(uri.scheme).toBe("afx-blueprint");
    expect(uri.path).toMatch(/^\/[a-f0-9]{64}\.md$/);
    expect(uri.toString()).not.toContain("private");
    expect(provider.get(uri)?.content).toBe("# Project");
  });
  it("reuses one preview URI per project and binds its captured source", () => {
    const provider = createBlueprintPreviewProvider();
    const source = vscode.Uri.file("/code/src/index.ts");
    const first = provider.update({
      id: "one",
      projectId: "project",
      sourceUri: source,
      content: "# One\n",
    });
    const second = provider.update({
      id: "two",
      projectId: "project",
      sourceUri: source,
      content: "# Two\n",
    });
    expect(second.toString()).toBe(first.toString());
    expect(provider.get(first)?.content).toBe("# Two\n");
  });

  it("marks affected previews stale without replacing another project", () => {
    const provider = createBlueprintPreviewProvider();
    const changed = vi.fn();
    provider.onDidChange?.(changed);
    const first = provider.update({ id: "one", projectId: "one", content: "# One\n" });
    const second = provider.update({ id: "two", projectId: "two", content: "# Two\n" });
    provider.markStale("one", "dirty");
    expect(provider.provideTextDocumentContent(first, {} as vscode.CancellationToken)).toContain(
      "Preview state: dirty",
    );
    expect(provider.provideTextDocumentContent(second, {} as vscode.CancellationToken)).toBe(
      "# Two\n",
    );
    expect(changed).toHaveBeenCalledWith(first);
  });
});
