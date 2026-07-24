/**
 * Editor-area boot shell for the optional `.canvas` custom text editor.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-32]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-EDITOR-AREA] [DES-CANVAS-MULTI-INSTANCE]
 */
import { useEffect, useState } from "react";

import type { CanvasDocumentSnapshot, CanvasViewState } from "@afx/shared";

import { CanvasApp } from "./components/canvas/canvas-app";
import { WorkbenchProvider } from "./context/workbench-context";
import { workbenchOn, workbenchSend } from "./lib/bridge";

function clientId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `canvas-editor-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function CanvasEditorApp() {
  const [id] = useState(clientId);
  const [document, setDocument] = useState<CanvasDocumentSnapshot>();
  const [enabled, setEnabled] = useState<boolean>();
  const [viewState, setViewState] = useState<CanvasViewState>();

  useEffect(() => {
    const disposables = [
      workbenchOn("afxCanvasEditorDocument", (message) => {
        if (message.clientId !== id && message.clientId !== "pending") return;
        setDocument(message.document);
        setEnabled(message.enabled);
      }),
      workbenchOn("afxCanvasEditorState", (message) => {
        if (message.clientId === id) setViewState(message.viewState);
      }),
    ];
    workbenchSend({ type: "afxCanvasEditorReady", clientId: id });
    return () => disposables.forEach((dispose) => dispose());
  }, [id]);

  if (enabled === undefined || !document) {
    return (
      <main className="flex h-full items-center justify-center bg-background text-xs text-muted-foreground">
        Opening Canvas…
      </main>
    );
  }

  if (!enabled) {
    return (
      <main className="flex h-full items-center justify-center bg-background p-6 text-foreground">
        <section className="afx-surface-card max-w-md rounded-md border border-border p-5 text-center">
          <h1 className="text-sm font-semibold">AFX Canvas is experimental</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Enable Workbench Canvas to edit this JSON Canvas visually. The file remains unchanged
            and can still be opened as text or by another JSON Canvas editor.
          </p>
          <button
            type="button"
            className="mt-4 rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() =>
              workbenchSend({ type: "afxOpenSettings", setting: "afx.experimental.canvas" })
            }
          >
            Enable in Settings
          </button>
        </section>
      </main>
    );
  }

  return (
    <WorkbenchProvider initialState={{ canvasEnabled: true, isLoading: false, canvas: undefined }}>
      <CanvasApp editorClientId={id} editorDocument={document} editorViewState={viewState} />
    </WorkbenchProvider>
  );
}
