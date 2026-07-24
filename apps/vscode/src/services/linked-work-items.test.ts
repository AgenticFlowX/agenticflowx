/**
 * @see docs/specs/221-app-workbench-board/spec.md [FR-12] [FR-13] [FR-14] [NFR-5]
 * @see docs/specs/221-app-workbench-board/design.md [DES-TEST] [DES-BOARD-LINK-WORK]
 */
import { describe, expect, it } from "vitest";

import type { LinkedWorkItemRef, WorkbenchSourceIdentity } from "@afx/shared";

import { buildLinkedWorkCatalog, toggleLinkedTaskItem } from "./linked-work-items";

const root = (rootUri = "file:///workspace/root"): WorkbenchSourceIdentity => ({
  rootUri,
  rootName: "root",
  relativePath: "docs/specs/221-board/spec.md",
});

const TASKS = `---
afx: true
type: TASKS
---

# Board tasks

## Phase 4: Live work

### 4.1 Discover Work

- [x] Parse specs.
- [ ] Resolve tasks.

### 4.2 Picker

- [ ] Search candidates.
- [ ] Search candidates.
`;

describe("linked work item catalog", () => {
  it("groups spec and stable WBS task candidates with live progress", () => {
    const specSource = {
      source: root(),
      revision: "spec-rev",
      content: "---\nafx: true\ntype: SPEC\nstatus: Living\n---\n\n# Board UX\n",
    };
    const tasksSource = {
      source: { ...root(), relativePath: "docs/specs/221-board/tasks.md" },
      revision: "tasks-rev",
      content: TASKS,
    };

    const catalog = buildLinkedWorkCatalog([specSource, tasksSource]);

    expect(catalog.candidates.map((candidate) => candidate.label)).toEqual([
      "4.1 · Discover Work",
      "4.2 · Picker",
      "Board UX",
    ]);
    expect(catalog.candidates.find((candidate) => candidate.label.startsWith("4.1"))).toMatchObject(
      {
        completed: 1,
        total: 2,
        status: "Open",
      },
    );
  });

  it("resolves live task title, progress, and fingerprinted checklist", () => {
    const source = { ...root(), relativePath: "docs/specs/221-board/tasks.md" };
    const catalog = buildLinkedWorkCatalog([{ source, revision: "tasks-rev", content: TASKS }]);
    const ref: LinkedWorkItemRef = { version: 1, kind: "task", source, wbsId: "4.1" };

    const snapshot = catalog.resolve(ref);

    expect(snapshot).toMatchObject({
      state: "resolved",
      sourceRevision: "tasks-rev",
      title: "4.1 · Discover Work",
      completed: 1,
      total: 2,
    });
    if (snapshot.state !== "resolved") return;
    expect(snapshot.checklist?.map((item) => item.text)).toEqual([
      "Parse specs.",
      "Resolve tasks.",
    ]);
    expect(new Set(snapshot.checklist?.map((item) => item.fingerprint)).size).toBe(2);
  });

  it("does not silently rebind missing or cross-root references", () => {
    const exactSource = { ...root(), relativePath: "docs/specs/221-board/tasks.md" };
    const catalog = buildLinkedWorkCatalog([
      { source: exactSource, revision: "tasks-rev", content: TASKS },
    ]);
    const crossRootRef: LinkedWorkItemRef = {
      version: 1,
      kind: "task",
      source: { ...exactSource, rootUri: "file:///other" },
      wbsId: "4.1",
    };
    const missingRef: LinkedWorkItemRef = {
      ...crossRootRef,
      source: { ...crossRootRef.source, rootName: "other", relativePath: "missing.md" },
    };

    expect(catalog.resolve(crossRootRef)).toMatchObject({
      state: "unresolved",
      reason: "cross-root",
    });
    expect(catalog.resolve(missingRef)).toMatchObject({ state: "unresolved", reason: "missing" });
  });

  it("reports moved and duplicated WBS sections explicitly", () => {
    const source = { ...root(), relativePath: "docs/specs/221-board/tasks.md" };
    const movedCatalog = buildLinkedWorkCatalog([{ source, revision: "rev", content: TASKS }]);
    const movedRef: LinkedWorkItemRef = { version: 1, kind: "task", source, wbsId: "9.9" };
    expect(movedCatalog.resolve(movedRef)).toMatchObject({ state: "unresolved", reason: "moved" });

    const duplicateContent = `${TASKS}\n### 4.1 Duplicate\n\n- [ ] Duplicate.\n`;
    const duplicateCatalog = buildLinkedWorkCatalog([
      { source, revision: "rev", content: duplicateContent },
    ]);
    const duplicateRef: LinkedWorkItemRef = { version: 1, kind: "task", source, wbsId: "4.1" };
    expect(duplicateCatalog.resolve(duplicateRef)).toMatchObject({
      state: "unresolved",
      reason: "ambiguous",
    });
  });

  it("toggles only the matching source checklist range and preserves CRLF", () => {
    const crlf = TASKS.replace(/\n/g, "\r\n");
    const source = { ...root(), relativePath: "docs/specs/221-board/tasks.md" };
    const resolved = buildLinkedWorkCatalog([{ source, revision: "rev", content: crlf }]).resolve({
      version: 1,
      kind: "task",
      source,
      wbsId: "4.1",
    });
    if (resolved.state !== "resolved") throw new Error("expected resolved fixture");
    const target = resolved.checklist?.find((item) => item.text === "Resolve tasks.");
    if (!target) throw new Error("expected checklist item");

    const result = toggleLinkedTaskItem(crlf, "4.1", target.fingerprint, true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toContain("- [x] Resolve tasks.");
    expect(result.content).toContain("- [ ] Search candidates.");
    expect(result.content.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("fails closed when a fingerprint is stale or a WBS id is duplicated", () => {
    expect(toggleLinkedTaskItem(TASKS, "4.1", "stale", true)).toMatchObject({
      ok: false,
      reason: "missing",
    });
    expect(
      toggleLinkedTaskItem(
        `${TASKS}\n### 4.1 Duplicate\n\n- [ ] Duplicate.\n`,
        "4.1",
        "stale",
        true,
      ),
    ).toMatchObject({ ok: false, reason: "ambiguous" });
  });
});
