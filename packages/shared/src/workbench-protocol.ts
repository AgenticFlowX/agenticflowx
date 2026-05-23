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
 */
import type {
  DocumentRow,
  FeatureTasksData,
  GhostTaskResult,
  JournalEntry,
  KanbanData,
  PipelineRow,
  QuickNote,
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
      ghostTasks?: GhostTaskResult;
    }
  | { type: "afxDocContent"; filePath: string; content: string }
  | { type: "afxPreviewShow"; filePath: string; content: string; isAfxHint?: boolean }
  | { type: "afxAppearanceUpdated"; appearanceClass: string }
  | { type: "afxTelemetryUpdated"; enabled: boolean };

/** Webview → host. */
export type WorkbenchOutbound =
  | { type: "afxReady" }
  | { type: "afxOpenFile"; path: string; mode: "editor" | "preview" | "afxPreview"; line?: number }
  | { type: "afxOpenChatCommand"; command: string; mode: "insert" | "send" }
  | { type: "afxCopyMarkdown"; content: string; label?: string }
  | { type: "afxFetchDocContent"; filePath: string }
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
  | { type: "afxCreateKanbanBoard"; name: string }
  | { type: "afxRenameKanbanBoard"; filePath: string; name: string }
  | { type: "afxDeleteKanbanBoard"; filePath: string }
  | { type: "afxAppendNote"; text: string }
  | { type: "afxEditNote"; timestamp: string; text: string }
  | { type: "afxDeleteNote"; timestamp: string };
