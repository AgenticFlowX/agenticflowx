/**
 * Workbench IPC protocol — discriminated unions for host ↔ webview messages.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-WORKBENCH-PROTOCOL]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-4] [FR-9] [FR-10]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-API]
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
  | { type: "afxAppearanceUpdated"; appearanceClass: string }
  | { type: "afxTelemetryUpdated"; enabled: boolean };

/** Webview → host. */
export type WorkbenchOutbound =
  | { type: "afxReady" }
  | { type: "afxOpenFile"; path: string; mode: "editor" | "preview"; line?: number }
  | { type: "afxOpenChatCommand"; command: string; mode: "insert" | "send" }
  | { type: "afxFetchDocContent"; filePath: string }
  | { type: "afxSelectFeature"; name: string }
  | { type: "afxChangeStatus"; filePath: string; status: string }
  | { type: "afxToggleTask"; path: string; line: number; completed: boolean }
  | {
      type: "afxToggleSession";
      filePath: string;
      sessionIndex: number;
      column: string;
      completed: boolean;
    }
  | { type: "afxSaveFile"; path: string; content: string }
  | { type: "afxCreateSampleDocs"; kind: "full-spec" | "sprint" }
  | { type: "afxCreateKanbanBoard"; name: string }
  | { type: "afxRenameKanbanBoard"; filePath: string; name: string }
  | { type: "afxDeleteKanbanBoard"; filePath: string }
  | { type: "afxAppendNote"; text: string }
  | { type: "afxEditNote"; timestamp: string; text: string }
  | { type: "afxDeleteNote"; timestamp: string };
