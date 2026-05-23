/**
 * Documents studio tests.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-4] [FR-7] [FR-8]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-READER] [DES-DOCS-STUDIO] [DES-DOCS-LAUNCHPAD] [DES-TEST]
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DocumentRow } from "@afx/shared";

import { WorkbenchProvider } from "../context/workbench-context";
import { _resetBridgeForTest, initWorkbenchBridge } from "../lib/bridge";
import Documents from "./documents";

const SPEC_DOC: DocumentRow = {
  type: "SPEC",
  name: "docs/specs/sample/spec.md",
  status: "Draft",
  owner: "@rix",
  filePath: "docs/specs/sample/spec.md",
  isAfx: true,
  updatedAt: "2026-05-20T08:50:05.000Z",
  excerpt: "Launchpad and PRD studio sample.",
};

const SPEC_CONTENT = `---
afx: true
type: SPEC
status: Draft
owner: "@rix"
---

# Sample Workbench PRD

<!-- AFX reader control comment -->

## Overview

Build a launchpad that makes the bottom panel useful on first open.

## Goals

- Create sample docs quickly.
- Show generated docs in a polished reader.

## Success Metrics

- Users can create a sample in under one minute.

## [FR-1] Functional Requirements

@see docs/specs/sample/spec.md [FR-1]

| Role | Need |
| ---- | ---- |
| Developer | Read planning docs in the workbench |
`;

function renderDocuments(documents: DocumentRow[] = [SPEC_DOC]) {
  return render(
    <WorkbenchProvider initialState={{ isLoading: false, documents }}>
      <Documents />
    </WorkbenchProvider>,
  );
}

describe("Documents", () => {
  beforeEach(() => {
    initWorkbenchBridge();
  });

  afterEach(() => {
    _resetBridgeForTest();
  });

  it("uses the shared launchpad when no documents exist", () => {
    renderDocuments([]);

    expect(screen.getByTestId("workbench-launchpad")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sample SDD set/i })).toBeInTheDocument();
  });

  it("renders selected specs in the PRD studio", async () => {
    renderDocuments();

    fireEvent.click(screen.getByRole("button", { name: /spec\.md/i }));
    window.postMessage(
      { type: "afxDocContent", filePath: SPEC_DOC.filePath, content: SPEC_CONTENT },
      "*",
    );

    await waitFor(() => {
      expect(screen.getAllByText("Sample Workbench PRD").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Quality pulse")).toBeInTheDocument();
    expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Success Metrics").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Functional Requirements").length).toBeGreaterThan(0);
    expect(screen.queryByText(/AFX reader control/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@see docs/i)).not.toBeInTheDocument();
    expect(screen.queryByText("[FR-1]")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "Read planning docs in the workbench" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refine/i })).toBeInTheDocument();
  });
});
