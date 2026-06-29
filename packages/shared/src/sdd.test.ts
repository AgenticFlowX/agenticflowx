/**
 * Unit tests for shared SDD document helpers.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-LOC]
 */
import { describe, expect, it } from "vitest";

import {
  classifySddDocumentPath,
  isSddDocumentPath,
  normalizeSddPath,
  sddJournalActionForPath,
  sddPrimaryActionForPath,
} from "./sdd";

describe("shared SDD helpers", () => {
  it("normalizes relative and Windows-style paths", () => {
    expect(normalizeSddPath(".\\docs\\specs\\12-auth\\spec.md")).toBe("docs/specs/12-auth/spec.md");
    expect(normalizeSddPath("./docs//specs/12-auth//tasks.md")).toBe("docs/specs/12-auth/tasks.md");
  });

  it("classifies canonical SDD docs", () => {
    expect(classifySddDocumentPath("docs/specs/12-auth/spec.md")).toMatchObject({
      kind: "spec",
      feature: "12-auth",
      commandTarget: "12-auth",
      label: "Spec",
    });
    expect(classifySddDocumentPath("docs/specs/12-auth/design.md")).toMatchObject({
      kind: "design",
      feature: "12-auth",
    });
    expect(classifySddDocumentPath("docs/specs/12-auth/tasks.md")).toMatchObject({
      kind: "tasks",
      feature: "12-auth",
    });
    expect(classifySddDocumentPath("docs/specs/12-auth/journal.md")).toMatchObject({
      kind: "journal",
      feature: "12-auth",
    });
  });

  it("classifies nested sprint-style docs without flattening the fleet path", () => {
    expect(
      classifySddDocumentPath("docs/specs/900-fleet/15-sdd-ux-upgrade/sdd-ux-upgrade.md"),
    ).toMatchObject({
      kind: "sprint",
      feature: "900-fleet/15-sdd-ux-upgrade",
      commandTarget: "900-fleet/15-sdd-ux-upgrade",
      label: "Sprint",
    });
  });

  it("classifies research and ADR paths", () => {
    expect(classifySddDocumentPath("docs/research/res-chatprd.md")).toMatchObject({
      kind: "research",
      commandTarget: "res-chatprd",
    });
    expect(classifySddDocumentPath("docs/adr/adr-001.md")).toMatchObject({
      kind: "adr",
      commandTarget: "adr-001",
    });
  });

  it("does not classify generic markdown outside AFX doc paths", () => {
    expect(isSddDocumentPath("README.md")).toBe(false);
    expect(classifySddDocumentPath("apps/workbench/README.md")).toBeNull();
    expect(classifySddDocumentPath("docs/specs/12-auth/spec.txt")).toBeNull();
  });

  it("derives primary actions from document kind", () => {
    expect(sddPrimaryActionForPath("docs/specs/12-auth/spec.md")).toEqual({
      label: "Refine spec",
      command: "/afx-spec refine 12-auth",
      mode: "insert",
    });
    expect(sddPrimaryActionForPath("docs/specs/12-auth/design.md")).toEqual({
      label: "Refine design",
      command: "/afx-design refine 12-auth",
      mode: "insert",
    });
    expect(sddPrimaryActionForPath("docs/specs/12-auth/tasks.md")).toEqual({
      label: "Task status",
      command: "/afx-task status 12-auth",
      mode: "send",
    });
    expect(sddPrimaryActionForPath("docs/specs/12-auth/journal.md")).toEqual({
      label: "Capture note",
      command: "/afx-session note 12-auth",
      mode: "insert",
    });
    expect(sddPrimaryActionForPath("docs/specs/12-auth/12-auth.md")).toEqual({
      label: "Refine sprint",
      command: "/afx-sprint verify 12-auth",
      mode: "send",
    });
    expect(sddPrimaryActionForPath("docs/adr/adr-001.md")).toEqual({
      label: "Review ADR",
      command: "/afx-adr review adr-001",
      mode: "insert",
    });
    expect(sddPrimaryActionForPath("docs/research/res-chatprd.md")).toEqual({
      label: "Summarize research",
      command: "/afx-research summarize res-chatprd",
      mode: "insert",
    });
    expect(sddPrimaryActionForPath("README.md")).toBeNull();
  });

  it("derives journal capture actions with source links", () => {
    expect(sddJournalActionForPath("docs/specs/12-auth/design.md")).toEqual({
      label: "Journal",
      command: "/afx-session capture --links 12-auth",
      mode: "insert",
    });
    expect(sddJournalActionForPath("README.md")).toBeNull();
  });
});
