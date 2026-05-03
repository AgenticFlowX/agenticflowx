/**
 * Workbench domain types — pipeline, documents, tasks, journal, board, notes.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-WORKBENCH-TYPES]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-3]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-DATA]
 * @see docs/specs/221-app-workbench-board/spec.md [FR-1]
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-1]
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-1]
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-1]
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-1]
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-7]
 */

/**
 * One feature row in the pipeline overview.
 *
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-DATA] [DES-PIPELINE-CARD]
 */
export interface PipelineRow {
  name: string;
  specStatus: string;
  designStatus: string;
  tasksStatus: string;
  completed: number;
  total: number;
  featureStatus: string;
  specPath?: string;
  designPath?: string;
  tasksPath?: string;
  specLastVerified?: string;
  designLastVerified?: string;
  tasksLastVerified?: string;
}

/**
 * One markdown document row in the documents explorer.
 *
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-DATA] [DES-DOCS-TREE]
 */
export interface DocumentRow {
  type: string;
  name: string;
  status: string;
  owner: string;
  filePath: string;
  isAfx?: boolean;
  kind?: string;
  size?: number;
  /** ISO timestamp — prefer frontmatter.updated_at, fallback to fs.stat.mtime. */
  updatedAt?: string;
  /** First ~80 chars of body, frontmatter + headings stripped. */
  excerpt?: string;
}

/**
 * One occurrence within a document during search.
 *
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-DATA]
 */
export interface SearchMatch {
  line: number;
  snippet: string;
  ranges: Array<[start: number, end: number]>;
}

/**
 * A document plus its matching occurrences from a search query.
 *
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-DATA]
 */
export interface SearchHit {
  filePath: string;
  type: string;
  matches: SearchMatch[];
}

/**
 * One leaf task row inside a phase.
 *
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-DATA]
 */
export interface TaskItemRow {
  text: string;
  completed: boolean;
  line: number;
}

/**
 * A phase header with its task children.
 *
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-DATA] [DES-PIPELINE-GROUPED]
 */
export interface PhaseRow {
  number: number;
  name: string;
  completed: number;
  total: number;
  line: number;
  items: TaskItemRow[];
}

/**
 * One session row in the recent-sessions strip.
 *
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-DATA] [DES-SHELL-FEATURE-COLUMNS]
 */
export interface WorkSessionRow {
  date: string;
  task: string;
  action: string;
  filesModified: string;
  agent: boolean;
  human: boolean;
}

/**
 * Full task tree for a feature (phases + flat tasks + stats + work sessions).
 *
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-DATA]
 */
export interface FeatureTasksData {
  name: string;
  tasksPath?: string;
  completed: number;
  total: number;
  phases: PhaseRow[];
  workSessions: WorkSessionRow[];
}

/**
 * One card in a kanban column.
 *
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-DATA] [DES-BOARD-CARD]
 */
export interface KanbanCard {
  text: string;
}

/**
 * One column in a kanban board.
 *
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-DATA] [DES-BOARD-COLUMN]
 */
export interface KanbanColumn {
  title: string;
  cards: KanbanCard[];
}

/**
 * Frontmatter slice for a kanban board file.
 *
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-DATA]
 */
export interface KanbanMeta {
  title?: string;
  description?: string;
  status?: string;
  tags?: string[];
  created?: string;
  updated?: string;
}

/**
 * One kanban board file: name, path, columns, raw markdown.
 *
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-DATA] [DES-BOARD-SERIALIZATION]
 */
export interface KanbanBoard {
  name: string;
  filePath: string;
  columns: KanbanColumn[];
  rawContent?: string;
  meta?: KanbanMeta;
}

/**
 * Workbench payload: an array of boards plus the directory they live in.
 *
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-DATA]
 */
export interface KanbanData {
  boards: KanbanBoard[];
  dirPath: string;
}

/**
 * One journal record: feature, file path, timestamps, status, excerpt.
 *
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-DATA] [DES-JOURNAL-CARD]
 */
export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  status: "active" | "blocked" | "closed";
  feature: string;
  filePath: string;
  line: number;
  context?: string;
  summary?: string;
  decisions?: string[];
}

/**
 * One quick-note item displayed in the workbench notes view.
 *
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-ITEM]
 */
export interface QuickNote {
  timestamp: string;
  time: string;
  displayTime: string;
  date: string;
  text: string;
}

/**
 * Documents-side reverse-trace summary; seed for Impact Lens future work.
 *
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-DATA]
 * @see docs/specs/228-app-workbench-impact-lens/design.md [DES-IMPACT-DATA]
 */
export interface GhostTaskResult {
  count: number;
  items: Array<{ feature: string; task: string; target: string }>;
}
