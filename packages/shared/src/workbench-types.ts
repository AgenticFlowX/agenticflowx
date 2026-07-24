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
  wbsId?: string;
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
 * Parsed or canonical focus target for section-aware document actions.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
export interface FocusOption {
  id: string;
  label: string;
  slug: string;
  /** Optional command suffix, e.g. `phase-2` or `des-data`. */
  commandSuffix?: string;
  /** Short body preview for rich focus-target tooltips. */
  excerpt?: string;
  /** 1-indexed source line when parsed from the active document. */
  line?: number;
}

/**
 * Focus dropdown group. UI labels are intentionally data-driven so parsed
 * sections and canonical fallbacks can share one renderer.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export interface FocusGroup {
  label: string;
  items: FocusOption[];
}

/**
 * Summary used to decide whether the tasks sign-off host action can render.
 *
 * - `ready` is the strict gate (all body `[x]` + all Agent `[x]` + ≥1 Human
 *   `[ ]`). When true, Sign Off may promote `status` to `Living`.
 * - `signable` is the loose gate (≥1 Human `[ ]` regardless of body / Agent
 *   completeness). Hosts use this for button visibility so users can tick
 *   Human cells mid-flight; the popover surfaces warnings about
 *   `pendingTasks` / `pendingAgentRows` and the host action only promotes
 *   `status` when `ready` is true.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-19]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
export interface SignOffSummary {
  ready: boolean;
  signable: boolean;
  allTasksChecked: boolean;
  allAgentVerified: boolean;
  pendingTasks: number;
  pendingAgentRows: number;
  pendingHumanRows: number;
  alreadyLiving: boolean;
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
 * Stable identifiers for the views that can be hidden from the Workbench tab
 * strip. Capability flags (notably Canvas) remain independent.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-20]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-VIEW-VISIBILITY]
 */
export const WORKBENCH_VIEW_IDS = [
  "workbench",
  "pipeline",
  "documents",
  "analytics",
  "journal",
  "board",
  "notes",
  "canvas",
] as const;

export type WorkbenchViewId = (typeof WORKBENCH_VIEW_IDS)[number];

export function normalizeWorkbenchViewIds(value: unknown): WorkbenchViewId[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(WORKBENCH_VIEW_IDS);
  const selected = new Set(
    value.filter((entry): entry is WorkbenchViewId =>
      typeof entry === "string" ? allowed.has(entry) : false,
    ),
  );
  return WORKBENCH_VIEW_IDS.filter((id) => selected.has(id));
}

/**
 * Browser-safe source identity. The host is solely responsible for resolving
 * the opaque root URI and validating that the relative path remains inside it.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-18]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-WORKBENCH-IDENTITY]
 */
export interface WorkbenchSourceIdentity {
  rootUri: string;
  rootName: string;
  relativePath: string;
}

const PORTABLE_CANVAS_ROOT_PREFIX = "afx-workspace://";

/**
 * Stable Canvas document identity shared by both host surfaces.
 *
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE] [DES-CANVAS-MULTI-INSTANCE]
 */
export function canvasDocumentId(source: WorkbenchSourceIdentity): string {
  const relativePath = source.relativePath
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/");
  return `${source.rootUri.replace(/\/+$/, "")}::${relativePath}`;
}

/** Replace a machine URI with a stable logical workspace hint before persisting Canvas metadata. */
export function portableCanvasSourceIdentity(
  source: WorkbenchSourceIdentity,
): WorkbenchSourceIdentity {
  const existingHint = canvasWorkspaceRootHint(source);
  const rootName = existingHint ?? source.rootName;
  return {
    ...source,
    rootUri: `${PORTABLE_CANVAS_ROOT_PREFIX}${encodeURIComponent(rootName)}`,
    rootName,
  };
}

/** Decode only the namespaced logical root form; ordinary host URIs return undefined. */
export function canvasWorkspaceRootHint(
  source: Pick<WorkbenchSourceIdentity, "rootUri" | "rootName">,
): string | undefined {
  if (!source.rootUri.startsWith(PORTABLE_CANVAS_ROOT_PREFIX)) return undefined;
  const encoded = source.rootUri.slice(PORTABLE_CANVAS_ROOT_PREFIX.length);
  try {
    return decodeURIComponent(encoded) || source.rootName;
  } catch {
    return source.rootName || undefined;
  }
}

export interface WorkbenchSourceRevision {
  contentRevision: string;
  diskRevision?: string;
  documentVersion?: number;
  dirty: boolean;
}

export interface WorkbenchSourceSnapshot {
  source: WorkbenchSourceIdentity;
  revision: WorkbenchSourceRevision;
}

/** Browser-safe state shared by host-mediated Canvas content previews. */
export type CanvasContentPreviewState = "ready" | "missing" | "blocked" | "error" | "offline";

export type CanvasContentPreviewCode =
  | "outside-workspace"
  | "not-found"
  | "read-failed"
  | "file-too-large"
  | "image-too-large"
  | "invalid-image"
  | "unsafe-image-type"
  | "invalid-notes"
  | "invalid-board"
  | "network-disabled"
  | "unsupported-url"
  | "credentialed-url"
  | "private-address"
  | "dns-failed"
  | "network-error"
  | "timeout"
  | "redirect-without-location"
  | "redirect-loop"
  | "too-many-redirects"
  | "response-too-large"
  | "unsupported-content-type"
  | "http-status";

export interface CanvasNotesPreviewSummary {
  totalNotes: number;
  items: Array<{ timestamp: string; text: string }>;
}

export interface CanvasBoardPreviewSummary {
  totalColumns: number;
  totalCards: number;
  columns: Array<{ title: string; cardCount: number; items: string[] }>;
}

/** Narrow serializable local preview. Host-only URIs are never part of this contract. */
export interface CanvasContentPreviewPayload {
  kind: "markdown" | "file" | "image" | "notes" | "board";
  state: CanvasContentPreviewState;
  code?: CanvasContentPreviewCode;
  message?: string;
  content?: string;
  excerpt?: string;
  truncated?: boolean;
  mediaType?: string;
  byteLength?: number;
  /** Host-approved webview resource URL for a validated local raster image. */
  resourceUri?: string;
  summary?: CanvasNotesPreviewSummary | CanvasBoardPreviewSummary;
}

export interface CanvasUrlPreviewMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
}

/** Sanitized URL metadata only; remote response HTML is never serialized. */
export interface CanvasUrlPreviewPayload {
  state: CanvasContentPreviewState;
  finalUrl?: string;
  code?: CanvasContentPreviewCode;
  message?: string;
  httpStatus?: number;
  metadata?: CanvasUrlPreviewMetadata;
}

/** Portable workspace reference returned by the user-mediated Canvas picker. */
export interface CanvasPickedReference {
  filePath: string;
  source: WorkbenchSourceIdentity;
}

/**
 * User-visible Canvas export container.
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-42]
 */
export type CanvasExportFormat = "canvas" | "svg" | "png";

/**
 * Explicit wire encoding prevents binary PNG bytes from crossing a UTF-8 path.
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-42] [NFR-9]
 */
export type CanvasExportEncoding = "utf8" | "base64";

/**
 * Format/encoding pairs accepted by the host export boundary.
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-EXPORT] [DES-API]
 */
export type CanvasExportPayload =
  | { format: "canvas" | "svg"; encoding: "utf8"; content: string }
  | { format: "png"; encoding: "base64"; content: string };

export type CanvasExportErrorCode =
  | "invalid-request"
  | "too-large"
  | "dialog-failed"
  | "unsupported-target"
  | "invalid-target"
  | "write-failed"
  | "capability-unavailable";

export interface WorkbenchMutationTarget {
  source: WorkbenchSourceIdentity;
  expectedRevision?: string;
}

export type WorkbenchMutationErrorCode =
  | "stale-revision"
  | "dirty-document"
  | "outside-workspace"
  | "not-found"
  | "collision"
  | "parse-error"
  | "confirmation-required"
  | "untrusted-workspace"
  | "capability-unavailable"
  | "unsupported-action"
  | "cancelled"
  | "write-failed";

/**
 * Exactly-one terminal result shared by every source-backed Workbench write.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-17]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-WORKBENCH-MUTATIONS]
 */
export type WorkbenchMutationResult =
  | {
      type: "afxMutationResult";
      requestId: string;
      outcome: "success";
      target: WorkbenchSourceIdentity;
      revision: WorkbenchSourceRevision;
    }
  | {
      type: "afxMutationResult";
      requestId: string;
      outcome: "conflict" | "error";
      target: WorkbenchSourceIdentity;
      code: WorkbenchMutationErrorCode;
      message: string;
      revision?: WorkbenchSourceRevision;
      retryable: boolean;
    };

/**
 * JSON Canvas 1.0 bridge types used by the experimental Workbench canvas.
 *
 * The shape mirrors https://jsoncanvas.org/spec/1.0/ and intentionally keeps
 * unknown fields so AFX can round-trip canvases authored elsewhere.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [FR-13] [FR-18]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 */
export type CanvasColor = string;

export type CanvasExtensionFields = Record<string, unknown>;

export interface CanvasGenericNode extends CanvasExtensionFields {
  id: string;
  type: "text" | "file" | "link" | "group";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CanvasColor;
}

export interface CanvasTextNode extends CanvasGenericNode {
  type: "text";
  text: string;
  /**
   * Presentation style for AFX surfaces. "annotation" renders a numbered
   * callout card with a leader arrow; foreign tools see a standard text node.
   * @see docs/specs/229-app-workbench-canvas/spec.md [FR-46]
   */
  afxNodeKind?: "note" | "label" | "annotation";
}

export interface CanvasFileNode extends CanvasGenericNode {
  type: "file";
  file: string;
  subpath?: string;
  /** Canonical workspace identity for generated cross-root file nodes. */
  afxSource?: WorkbenchSourceIdentity;
  /** Optional inert metadata for generated spec-map cards. */
  afxSpec?: {
    version: 1;
    documentKind: "spec" | "sprint";
    status?: string;
    [key: string]: unknown;
  };
}

export interface CanvasLinkNode extends CanvasGenericNode {
  type: "link";
  url: string;
}

export interface CanvasGroupNode extends CanvasGenericNode {
  type: "group";
  label?: string;
  background?: string;
  backgroundStyle?: "cover" | "ratio" | "repeat";
  afxGroup?: {
    version: 1;
    collapsed?: boolean;
    /** Optional author-defined frame order used only by AFX presentation mode. */
    presentationOrder?: number;
    [key: string]: unknown;
  };
}

export type CanvasNode = CanvasTextNode | CanvasFileNode | CanvasLinkNode | CanvasGroupNode;

export interface CanvasEdge extends CanvasExtensionFields {
  id: string;
  fromNode: string;
  fromSide?: "top" | "right" | "bottom" | "left";
  fromEnd?: "none" | "arrow";
  toNode: string;
  toSide?: "top" | "right" | "bottom" | "left";
  toEnd?: "none" | "arrow";
  color?: CanvasColor;
  label?: string;
  /** Optional AFX presentation data; ignored by standard JSON Canvas tools. */
  afxStyle?: CanvasEdgeStyle;
  /** Marks a generated declared-dependency edge without changing its standard shape. */
  afxProvenance?: CanvasEdgeProvenance;
}

export interface JSONCanvas extends CanvasExtensionFields {
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
}

export interface CanvasFilePayload {
  path: string;
  content: string;
  exists: boolean;
  source?: WorkbenchSourceIdentity;
  revision?: WorkbenchSourceRevision;
  documentId?: string;
}

export type CanvasKind = "project" | "named" | "external";

export interface CanvasDescriptor {
  id: string;
  kind: CanvasKind;
  label: string;
  source: WorkbenchSourceIdentity;
  exists: boolean;
  updatedAt?: string;
}

export interface CanvasDocumentSnapshot extends WorkbenchSourceSnapshot {
  documentId: string;
  descriptor: CanvasDescriptor;
  content: string;
  parseError?: string;
}

export type CanvasEdgeRoute = "bezier" | "straight" | "step" | "smoothstep";
export type CanvasEdgeStroke = "solid" | "dashed" | "dotted";

export interface CanvasEdgeStyle {
  version: 1;
  route?: CanvasEdgeRoute;
  stroke?: CanvasEdgeStroke;
  /** Optional portable semantic label used by architecture legends. */
  relationship?: string;
  /** Optional intermediate routing points when authored by an advanced client. */
  waypoints?: CanvasEdgeWaypoint[];
  opacity?: number;
}

export interface CanvasEdgeWaypoint {
  x: number;
  y: number;
}

/**
 * Compact index of an AFX document for Spec Map's "Add spec" picker and
 * dependency badges (230). Carries no file content — just identity, kind, and
 * declared relationships — so even a large repository serializes cheaply.
 */
export interface CanvasDocIndexEntry {
  /** Stable id (folder id for spec/sprint, path-based for other kinds). */
  id: string;
  /**
   * Bare frontmatter reference token — the value draw-to-author writes into a
   * `depends_on`/`supersedes`/`relates_to` list (folder id for spec/sprint, file
   * stem otherwise). Distinct from `id`, which is root-qualified for canvas
   * identity and must never leak into a document's YAML.
   */
  token: string;
  title: string;
  kind: "spec" | "design" | "tasks" | "journal" | "sprint" | "adr" | "research";
  source: WorkbenchSourceIdentity;
  status?: string;
  relationships: Partial<Record<"depends_on" | "supersedes" | "relates_to", string[]>>;
}

export interface CanvasEdgeProvenance {
  version: 1;
  /**
   * `declared-dependency` — a `depends_on` edge (retained kind for 229 back-compat).
   * `declared-relationship` — a `supersedes`/`relates_to` edge (230); see `relationship`.
   * `soft-link` — a read-only edge inferred from a body `@see` reference (230 FR-10).
   */
  kind: "declared-dependency" | "declared-relationship" | "soft-link";
  /** Present for `declared-relationship`: which frontmatter key produced this edge. */
  relationship?: "depends_on" | "supersedes" | "relates_to";
  owner: string;
  /** Exact source scalar used to generate the edge, for symmetric surgical removal. */
  declaredToken?: string;
  detached?: boolean;
  /** Stable generated edge identity suppressed by a detached manual edge. */
  generatedEdgeId?: string;
  /** Namespaced durable declaration suppression identity. */
  suppressionKey?: string;
}

export interface CanvasActionMetadata {
  version: 1;
  action: "open-source" | "send-chat" | "promote-note" | "prepare-spec" | "prepare-sprint";
  label?: string;
  command?: string;
}

export interface CanvasViewState {
  x: number;
  y: number;
  zoom: number;
  selectedIds?: string[];
}

export type CanvasMutation =
  | { kind: "addNode"; node: CanvasNode }
  | { kind: "updateNode"; nodeId: string; patch: Partial<CanvasNode> }
  | { kind: "removeNodes"; nodeIds: string[] }
  | { kind: "addEdge"; edge: CanvasEdge }
  | { kind: "updateEdge"; edgeId: string; patch: Partial<CanvasEdge> }
  | { kind: "removeEdges"; edgeIds: string[] }
  | { kind: "replaceDocument"; document: JSONCanvas };

/**
 * One immediate, ordered Canvas content edit handed to a host-owned document
 * session. React may unmount after delivery; sequence order and persistence
 * remain owned by the extension host.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-11] [FR-31] [FR-32]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE]
 */
export interface CanvasEditRequest {
  type: "afxCanvasEdit";
  requestId: string;
  sessionId: string;
  sequence: number;
  documentId: string;
  target: WorkbenchSourceIdentity;
  baseRevision?: string;
  content: string;
}

/**
 * Sequence-correlated terminal state for a host-owned Canvas edit.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-31] [FR-32]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE]
 */
export type CanvasEditResult =
  | {
      type: "afxCanvasEditResult";
      requestId: string;
      sessionId: string;
      sequence: number;
      outcome: "success";
      target: WorkbenchSourceIdentity;
      revision: WorkbenchSourceRevision;
    }
  | {
      type: "afxCanvasEditResult";
      requestId: string;
      sessionId: string;
      sequence: number;
      outcome: "superseded";
      target: WorkbenchSourceIdentity;
    }
  | {
      type: "afxCanvasEditResult";
      requestId: string;
      sessionId: string;
      sequence: number;
      outcome: "conflict" | "error";
      target: WorkbenchSourceIdentity;
      code: WorkbenchMutationErrorCode;
      message: string;
      revision?: WorkbenchSourceRevision;
      retryable: boolean;
    };

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
  id?: string;
  text: string;
  link?: LinkedWorkItemRef;
  resolved?: LinkedWorkItemSnapshot;
}

/**
 * One column in a kanban board.
 *
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-DATA] [DES-BOARD-COLUMN]
 */
export interface KanbanColumn {
  id?: string;
  title: string;
  cards: KanbanCard[];
}

export type LinkedWorkItemRef =
  | { version: 1; kind: "spec"; source: WorkbenchSourceIdentity }
  | { version: 1; kind: "task"; source: WorkbenchSourceIdentity; wbsId: string };

export type LinkedWorkItemSnapshot =
  | {
      state: "resolved";
      sourceRevision: string;
      title: string;
      lifecycle?: string;
      completed: number;
      total: number;
      checklist?: Array<{
        fingerprint: string;
        text: string;
        completed: boolean;
      }>;
    }
  | {
      state: "unresolved";
      reason: "missing" | "moved" | "malformed" | "ambiguous" | "cross-root";
      message: string;
    };

export interface LinkedWorkItemCandidate {
  key: string;
  ref: LinkedWorkItemRef;
  label: string;
  group: string;
  status?: string;
  completed: number;
  total: number;
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
  source?: WorkbenchSourceIdentity;
  revision?: WorkbenchSourceRevision;
  scanGeneration?: number;
  editorDirty?: boolean;
}

/**
 * Workbench payload: an array of boards plus the directory they live in.
 *
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-DATA]
 */
export interface KanbanData {
  boards: KanbanBoard[];
  dirPath: string;
  availableWorkItems?: LinkedWorkItemCandidate[];
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
  id?: string;
  timestamp: string;
  time: string;
  displayTime: string;
  date: string;
  text: string;
  checkboxes?: Array<{
    fingerprint: string;
    text: string;
    completed: boolean;
  }>;
}

export interface NotesSourceSnapshot extends WorkbenchSourceSnapshot {
  scanGeneration: number;
  notes: QuickNote[];
  parseError?: string;
}

export type NotesMutation =
  | { kind: "append"; text: string }
  | { kind: "edit"; noteId: string; text: string }
  | { kind: "delete"; noteId: string }
  | {
      kind: "toggleCheckbox";
      noteId: string;
      itemFingerprint: string;
      completed: boolean;
    };

export type KanbanBoardMutation =
  | { kind: "addColumn"; title: string }
  | { kind: "renameColumn"; columnId: string; title: string }
  | { kind: "deleteColumn"; columnId: string }
  | { kind: "addCard"; columnId: string; text: string; link?: LinkedWorkItemRef }
  | { kind: "editCard"; cardId: string; text: string }
  | { kind: "deleteCard"; cardId: string }
  | { kind: "moveCard"; cardId: string; toColumnId: string; beforeCardId?: string }
  | { kind: "moveColumn"; columnId: string; beforeColumnId?: string };

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
