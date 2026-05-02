/**
 * Workbench domain types — pipeline, documents, tasks, journal, board, notes.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-1] [FR-4] [FR-5] [FR-6] [FR-7] [FR-8] [FR-9] [FR-10]
 * @see docs/specs/220-app-workbench/design.md [DES-DATA]
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

export interface SearchMatch {
  line: number;
  snippet: string;
  ranges: Array<[start: number, end: number]>;
}

export interface SearchHit {
  filePath: string;
  type: string;
  matches: SearchMatch[];
}

export interface TaskItemRow {
  text: string;
  completed: boolean;
  line: number;
}

export interface PhaseRow {
  number: number;
  name: string;
  completed: number;
  total: number;
  line: number;
  items: TaskItemRow[];
}

export interface WorkSessionRow {
  date: string;
  task: string;
  action: string;
  filesModified: string;
  agent: boolean;
  human: boolean;
}

export interface FeatureTasksData {
  name: string;
  tasksPath?: string;
  completed: number;
  total: number;
  phases: PhaseRow[];
  workSessions: WorkSessionRow[];
}

export interface KanbanCard {
  text: string;
}

export interface KanbanColumn {
  title: string;
  cards: KanbanCard[];
}

export interface KanbanMeta {
  title?: string;
  description?: string;
  status?: string;
  tags?: string[];
  created?: string;
  updated?: string;
}

export interface KanbanBoard {
  name: string;
  filePath: string;
  columns: KanbanColumn[];
  rawContent?: string;
  meta?: KanbanMeta;
}

export interface KanbanData {
  boards: KanbanBoard[];
  dirPath: string;
}

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

export interface QuickNote {
  timestamp: string;
  time: string;
  displayTime: string;
  date: string;
  text: string;
}

export interface GhostTaskResult {
  count: number;
  items: Array<{ feature: string; task: string; target: string }>;
}
