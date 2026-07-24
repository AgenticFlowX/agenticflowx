/**
 * Workbench IPC protocol — discriminated unions for host ↔ webview messages.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-4] [FR-16]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-WORKBENCH-PROTOCOL]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-4] [FR-9] [FR-10] [FR-15]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-API] [DES-SHELL-PREVIEW-MODE]
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-6]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-PREVIEW-PANEL]
 * @see docs/specs/221-app-workbench-board/spec.md [FR-2]
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-6]
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-19]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-API]
 */
import type {
  CanvasActionMetadata,
  CanvasContentPreviewPayload,
  CanvasDescriptor,
  CanvasDocIndexEntry,
  CanvasDocumentSnapshot,
  CanvasEditRequest,
  CanvasEditResult,
  CanvasExportErrorCode,
  CanvasExportPayload,
  CanvasFilePayload,
  CanvasMutation,
  CanvasPickedReference,
  CanvasUrlPreviewPayload,
  CanvasViewState,
  DocumentRow,
  FeatureTasksData,
  GhostTaskResult,
  JournalEntry,
  KanbanBoardMutation,
  KanbanData,
  NotesMutation,
  NotesSourceSnapshot,
  PipelineRow,
  QuickNote,
  WorkbenchMutationResult,
  WorkbenchSourceIdentity,
  WorkbenchSourceRevision,
  WorkbenchViewId,
} from "./workbench-types";

/** Host → webview. */
export type WorkbenchInbound =
  | {
      type: "afxUpdate";
      pipeline?: PipelineRow[];
      featureTasks?: FeatureTasksData[];
      documents?: DocumentRow[];
      journal?: JournalEntry[];
      kanban?: KanbanData | null;
      notes?: QuickNote[];
      notesRaw?: string;
      notesFilePath?: string;
      notesSources?: NotesSourceSnapshot[];
      ghostTasks?: GhostTaskResult;
      canvasEnabled?: boolean;
      canvas?: CanvasFilePayload;
      hiddenViews?: WorkbenchViewId[];
    }
  | WorkbenchMutationResult
  | CanvasEditResult
  | { type: "afxCanvasLibrary"; canvases: CanvasDescriptor[]; selectedId?: string }
  | { type: "afxCanvasDocIndex"; requestId: string; entries: CanvasDocIndexEntry[] }
  | { type: "afxCanvasDocument"; document: CanvasDocumentSnapshot }
  | {
      type: "afxCanvasEditorDocument";
      clientId: string;
      document: CanvasDocumentSnapshot;
      enabled: boolean;
    }
  | { type: "afxCanvasEditorState"; clientId: string; viewState?: CanvasViewState }
  | {
      type: "afxDocContent";
      filePath: string;
      content: string;
      /** Correlates revisioned Canvas requests; omitted by legacy document consumers. */
      requestId?: string;
      /** Canonical identity of the referenced document, not the owning Canvas. */
      owner?: WorkbenchSourceIdentity;
      /** Live buffer/disk revision returned by the extension host. */
      revision?: WorkbenchSourceRevision;
    }
  | {
      type: "afxDocContentInvalidated";
      /** Exact referenced document whose live buffer or disk state changed. */
      owner: WorkbenchSourceIdentity;
    }
  | {
      type: "afxCanvasContentPreviewResult";
      requestId: string;
      owner: WorkbenchSourceIdentity;
      revision?: WorkbenchSourceRevision;
      preview: CanvasContentPreviewPayload;
    }
  | { type: "afxCanvasContentPreviewInvalidated"; owner: WorkbenchSourceIdentity }
  | {
      type: "afxCanvasUrlPreviewResult";
      requestId: string;
      url: string;
      preview: CanvasUrlPreviewPayload;
    }
  | {
      type: "afxCanvasReferencesPicked";
      requestId: string;
      outcome: "success";
      references: CanvasPickedReference[];
    }
  | {
      type: "afxCanvasReferencesPicked";
      requestId: string;
      outcome: "cancelled";
      references: [];
    }
  | {
      type: "afxCanvasReferencesPicked";
      requestId: string;
      outcome: "error";
      references: [];
      message: string;
    }
  | {
      type: "afxCanvasExportResult";
      requestId: string;
      outcome: "success";
      targetName: string;
      byteLength: number;
    }
  | { type: "afxCanvasExportResult"; requestId: string; outcome: "cancelled" }
  | {
      type: "afxCanvasExportResult";
      requestId: string;
      outcome: "error";
      code: CanvasExportErrorCode;
      message: string;
    }
  | { type: "afxMarkdownFilePicked"; filePath: string }
  | { type: "afxPreviewShow"; filePath: string; content: string; isAfxHint?: boolean }
  | { type: "afxAppearanceUpdated"; appearanceClass: string }
  | { type: "afxTelemetryUpdated"; enabled: boolean };

/** Webview → host. */
export type WorkbenchOutbound =
  | { type: "afxReady" }
  | CanvasEditRequest
  | {
      type: "afxOpenFile";
      path: string;
      mode: "editor" | "preview" | "afxPreview";
      line?: number;
      /** Canvas document that owns a portable relative file-node reference. */
      owner?: WorkbenchSourceIdentity;
      /** Standard JSON Canvas file-node fragment (heading or block reference). */
      subpath?: string;
    }
  | { type: "afxOpenChatCommand"; command: string; mode: "insert" | "send" }
  | { type: "afxCopyMarkdown"; content: string; label?: string }
  | { type: "afxOpenSettings"; setting?: string }
  | {
      type: "afxFetchDocContent";
      filePath: string;
      /** Required by revision-aware Canvas consumers; optional for legacy document views. */
      requestId?: string;
      /** Canvas/file-node root used for deterministic multi-root resolution. */
      owner?: WorkbenchSourceIdentity;
    }
  | {
      type: "afxCanvasContentPreviewRequest";
      requestId: string;
      owner: WorkbenchSourceIdentity;
      knownRevision?: string;
    }
  | {
      type: "afxCanvasUrlPreviewRequest";
      requestId: string;
      url: string;
      /** Literal true proves the user explicitly requested remote metadata. */
      allowNetwork: true;
    }
  | { type: "afxOpenExternalUrl"; url: string }
  | {
      type: "afxCanvasPickReferences";
      requestId: string;
      owner?: WorkbenchSourceIdentity;
      kind: "any" | "image" | "markdown";
      allowMultiple: true;
    }
  | ({
      type: "afxCanvasExport";
      requestId: string;
      suggestedName: string;
    } & CanvasExportPayload)
  | { type: "afxPickMarkdownFile"; owner?: WorkbenchSourceIdentity }
  | { type: "afxSelectFeature"; name: string }
  | { type: "afxChangeStatus"; filePath: string; status: string }
  | { type: "afxToggleTask"; path: string; line: number; completed: boolean }
  | {
      type: "afxToggleSession";
      filePath: string;
      sessionIndex: number;
      column: "agent" | "human";
      completed: boolean;
      line?: number;
    }
  | {
      type: "afxToggleAllSessions";
      filePath: string;
      column: "agent" | "human";
      completed: boolean;
    }
  | { type: "afxApproveSessions"; filePath: string }
  | { type: "afxSaveFile"; path: string; content: string }
  | { type: "afxCreateSampleDocs"; kind: "full-spec" | "sprint" }
  | {
      type: "afxCreateKanbanBoard";
      name: string;
      requestId: string;
      targetRootUri: string;
    }
  | { type: "afxCreateKanbanBoard"; name: string; requestId?: never; targetRootUri?: never }
  | {
      type: "afxRenameKanbanBoard";
      name: string;
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
    }
  | { type: "afxRenameKanbanBoard"; name: string; filePath: string; requestId?: never }
  | {
      type: "afxDeleteKanbanBoard";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
    }
  | { type: "afxDeleteKanbanBoard"; filePath: string; requestId?: never }
  | {
      type: "afxMutateKanbanBoard";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
      mutation: KanbanBoardMutation;
    }
  | {
      type: "afxToggleLinkedTask";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
      wbsId: string;
      itemFingerprint: string;
      completed: boolean;
    }
  | { type: "afxAppendNote"; text: string }
  | { type: "afxEditNote"; timestamp: string; text: string }
  | { type: "afxDeleteNote"; timestamp: string }
  | {
      type: "afxMutateNotes";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision?: string;
      mutation: NotesMutation;
    }
  | { type: "afxCanvasList" }
  | { type: "afxCanvasSelect"; canvasId: string }
  | {
      type: "afxCanvasCreate";
      requestId: string;
      targetRootUri: string;
      name: string;
      /** True when the user wants a folder picker instead of .afx/canvases/. */
      pickLocation?: boolean;
      template?:
        | "blank"
        | "ideas"
        | "feature"
        | "roadmap"
        | "next-spec"
        | "architecture"
        | "low-fidelity"
        | "high-fidelity";
    }
  | {
      type: "afxCanvasRename";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
      name: string;
    }
  | {
      type: "afxCanvasDuplicate";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
      name: string;
    }
  | {
      type: "afxCanvasDelete";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
    }
  | {
      type: "afxCanvasSave";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision?: string;
      content: string;
    }
  | {
      type: "afxCanvasRefreshDependencies";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
    }
  | {
      /** Request the compact AFX-doc index for the "Add spec" picker and badges (230). */
      type: "afxCanvasDocIndex";
      requestId: string;
    }
  | {
      /**
       * Author (or remove) a typed relationship in a source document's
       * frontmatter, then reconcile the canvas. Drives draw-to-author and
       * delete-to-remove from Spec Map (230 FR-4, FR-6).
       */
      type: "afxCanvasAuthorRelationship";
      requestId: string;
      /** The document whose frontmatter list is edited (the edge's source). */
      source: WorkbenchSourceIdentity;
      sourceExpectedRevision?: string;
      /** Resolved id of the relationship target (folder id or doc stem). */
      targetId: string;
      /** Exact previously-declared scalar, present only for delete-to-remove. */
      declaredToken?: string;
      relationship: "depends_on" | "supersedes" | "relates_to";
      /** true removes the entry (delete-to-remove); omitted/false authors it. */
      remove?: boolean;
      /** The canvas to reconcile after the frontmatter edit. */
      canvasTarget: WorkbenchSourceIdentity;
      canvasExpectedRevision?: string;
    }
  | { type: "afxOpenCanvasEditor"; target: WorkbenchSourceIdentity }
  | { type: "afxCanvasEditorReady"; clientId: string; documentId?: string }
  | {
      type: "afxCanvasApplyMutation";
      requestId: string;
      clientId: string;
      documentId: string;
      baseVersion: string;
      mutation: CanvasMutation;
    }
  | { type: "afxCanvasEditorSetViewState"; clientId: string; viewState: CanvasViewState }
  | {
      type: "afxCanvasRunAction";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
      action: CanvasActionMetadata;
      nodeIds: string[];
      confirmed: boolean;
    };
