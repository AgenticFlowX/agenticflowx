/**
 * Workbench IPC protocol — discriminated unions for host ↔ webview messages.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-3]
 * @see docs/specs/220-app-workbench/design.md [DES-API]
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
  | { type: "afxCreateKanbanBoard"; name: string }
  | { type: "afxRenameKanbanBoard"; filePath: string; name: string }
  | { type: "afxDeleteKanbanBoard"; filePath: string }
  | { type: "afxAppendNote"; text: string }
  | { type: "afxEditNote"; timestamp: string; text: string }
  | { type: "afxDeleteNote"; timestamp: string };
