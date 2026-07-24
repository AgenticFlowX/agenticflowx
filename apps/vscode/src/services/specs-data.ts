/**
 * SpecsDataProvider — scans docs/, parses AFX-shaped spec/design/tasks/journal groups,
 * derives the WorkbenchInbound payload (pipeline, featureTasks, documents, journal).
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 * @see docs/specs/220-app-workbench/spec.md [FR-7] [FR-8]
 * @see docs/specs/220-app-workbench/design.md [DES-WORKBENCH-HOST-DATA]
 */
import * as vscode from "vscode";

import { parseFrontmatter, parseJournal } from "@afx/parsers";
import {
  type DocumentRow,
  type FeatureTasksData,
  type GhostTaskResult,
  type JournalEntry,
  type KanbanData,
  type LinkedWorkItemRef,
  type Logger,
  type NotesSourceSnapshot,
  type PhaseRow,
  type PipelineRow,
  type QuickNote,
  type TaskItemRow,
  type WorkSessionRow,
  type WorkbenchSourceIdentity,
} from "@afx/shared";

import { parseKanbanMarkdown } from "./kanban-markdown";
import {
  type LinkedWorkCatalog,
  type LinkedWorkSource,
  buildLinkedWorkCatalog,
} from "./linked-work-items";
import { NotesMarkdownDocument, notesContentRevision } from "./notes-markdown";
import { isSprintFile, sliceAllSprintSections } from "./sprint";
import type { WorkbenchFileState } from "./workbench-file-state";

interface PanelDataPayload {
  pipeline: PipelineRow[];
  featureTasks: FeatureTasksData[];
  documents: DocumentRow[];
  journal: JournalEntry[];
  kanban: KanbanData | null;
  notes: QuickNote[];
  notesRaw: string;
  notesFilePath: string;
  notesSources: NotesSourceSnapshot[];
  ghostTasks: GhostTaskResult;
}

export interface SpecsDataProvider {
  getPanelData(): Promise<PanelDataPayload>;
  refresh(): void;
  dispose(): void;
}

const DOCS_DIR = "docs";
const NOTES_PATH = ".afx/notes.md";
const BOARDS_DIR = ".afx/kanban";

interface ProjectRoot {
  uri: vscode.Uri;
  prefix: string;
  hasDocs: boolean;
}

export interface SpecsDataProviderOptions {
  fileState?: WorkbenchFileState;
  getWorkspaceFolders?: () => readonly vscode.WorkspaceFolder[] | undefined;
}

/**
 * Creates the Workbench scanner with live-buffer overlays and latest-wins
 * single-flight caching.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-17] [FR-19] [FR-20]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LIVE-DOCUMENTS]
 * @see docs/specs/221-app-workbench-board/spec.md [FR-11]
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-11]
 */
export function createSpecsDataProvider(
  getRoot: () => string | undefined,
  parentLog: Logger,
  options: SpecsDataProviderOptions = {},
): SpecsDataProvider {
  const log = parentLog.child("specs-data");
  let cache: PanelDataPayload | null = null;
  let generation = 0;
  let inFlight: Promise<void> | null = null;
  let disposed = false;
  const lastValidNotes = new Map<string, QuickNote[]>();

  async function readFileSafe(uri: vscode.Uri): Promise<string | null> {
    const liveSnapshot = await options.fileState?.readText(uri);
    if (liveSnapshot) return liveSnapshot.content;
    try {
      const buf = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(buf).toString("utf8");
    } catch {
      return null;
    }
  }

  async function statSafe(uri: vscode.Uri): Promise<vscode.FileStat | null> {
    try {
      return await vscode.workspace.fs.stat(uri);
    } catch {
      return null;
    }
  }

  async function listDirs(uri: vscode.Uri): Promise<string[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(uri);
      return entries.filter(([, type]) => type === vscode.FileType.Directory).map(([n]) => n);
    } catch {
      return [];
    }
  }

  async function listFiles(uri: vscode.Uri): Promise<string[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(uri);
      return entries.filter(([, type]) => type === vscode.FileType.File).map(([n]) => n);
    } catch {
      return [];
    }
  }

  async function listMarkdownFilesRecursive(
    uri: vscode.Uri,
    relDir: string,
  ): Promise<Array<{ path: string; uri: vscode.Uri }>> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(uri);
    } catch {
      return [];
    }

    const out: Array<{ path: string; uri: vscode.Uri }> = [];
    for (const [name, type] of entries) {
      const relPath = `${relDir}/${name}`;
      const entryUri = vscode.Uri.joinPath(uri, name);
      if (type === vscode.FileType.Directory) {
        out.push(...(await listMarkdownFilesRecursive(entryUri, relPath)));
      } else if (type === vscode.FileType.File && name.endsWith(".md")) {
        out.push({ path: relPath, uri: entryUri });
      }
    }
    return out;
  }

  function prefixed(prefix: string, path: string): string {
    return prefix ? `${prefix}/${path}` : path;
  }

  function sourceIdentity(
    uri: vscode.Uri,
    workspaceFolders: readonly vscode.WorkspaceFolder[],
  ): WorkbenchSourceIdentity | undefined {
    for (const folder of workspaceFolders) {
      const rootPath = folder.uri.path.replace(/\/$/, "");
      if (uri.scheme !== folder.uri.scheme || uri.authority !== folder.uri.authority) continue;
      if (uri.path !== rootPath && !uri.path.startsWith(`${rootPath}/`)) continue;
      const renderedRoot = folder.uri.toString();
      return {
        rootUri:
          renderedRoot && renderedRoot !== "[object Object]"
            ? renderedRoot
            : `${folder.uri.scheme ?? "file"}://${folder.uri.path}`,
        rootName: folder.name,
        relativePath: uri.path.slice(rootPath.length).replace(/^\//, ""),
      };
    }
    return undefined;
  }

  function sourceKey(source: WorkbenchSourceIdentity): string {
    return `${source.rootUri}\u0000${source.relativePath}`;
  }

  function recoverSimpleFrontmatter(raw: string): Record<string, unknown> {
    const source = raw.replace(/^\uFEFF/, "");
    const lines = source.split(/\r?\n/);
    if (lines[0]?.trim() !== "---") return {};
    const closeIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (closeIndex === -1) return {};

    const data: Record<string, unknown> = {};
    for (const rawLine of lines.slice(1, closeIndex)) {
      const line = rawLine.trim();
      const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
      if (!match) continue;
      const key = match[1] ?? "";
      const value = (match[2] ?? "").trim();
      if (/^true$/i.test(value)) data[key] = true;
      else if (/^false$/i.test(value)) data[key] = false;
      else if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        data[key] = value.slice(1, -1);
      } else {
        data[key] = value;
      }
    }
    return data;
  }

  function frontmatterData(raw: string): Record<string, unknown> {
    const data = parseFrontmatter(raw).data ?? {};
    return Object.keys(data).length > 0 ? data : recoverSimpleFrontmatter(raw);
  }

  async function discoverProjectRoots(
    workspaceFolders: readonly vscode.WorkspaceFolder[],
  ): Promise<ProjectRoot[]> {
    const roots: ProjectRoot[] = [];
    const multipleFolders = workspaceFolders.length > 1;
    const addIfProjectRoot = async (
      uri: vscode.Uri,
      prefix: string,
      always = false,
    ): Promise<void> => {
      const [docsStat, afxStat] = await Promise.all([
        statSafe(vscode.Uri.joinPath(uri, DOCS_DIR)),
        statSafe(vscode.Uri.joinPath(uri, ".afx")),
      ]);
      const hasDocs = docsStat?.type === vscode.FileType.Directory;
      const hasAfx = afxStat?.type === vscode.FileType.Directory;
      if (always || hasDocs || hasAfx) roots.push({ uri, prefix, hasDocs });
    };

    for (const folder of workspaceFolders) {
      const basePrefix = multipleFolders ? folder.name : "";
      await addIfProjectRoot(folder.uri, basePrefix, true);
      for (const child of await listDirs(folder.uri)) {
        if (child === "node_modules" || child.startsWith(".") || child.endsWith("-bk")) continue;
        await addIfProjectRoot(vscode.Uri.joinPath(folder.uri, child), prefixed(basePrefix, child));
      }
    }
    return roots;
  }

  function deriveDocumentRow(
    type: string,
    name: string,
    filePath: string,
    content: string | null,
    stat: vscode.FileStat | null,
  ): DocumentRow {
    const fmData = content ? frontmatterData(content) : {};
    const isAfx = fmData["afx"] === true;
    const status = (fmData["status"] as string | undefined) ?? "";
    const owner = (fmData["owner"] as string | undefined) ?? "";
    const updatedAt =
      (fmData["updated_at"] as string | undefined) ??
      (stat ? new Date(stat.mtime).toISOString() : undefined);
    const excerpt = content
      ? content
          .replace(/^---[\s\S]*?---/m, "")
          .replace(/^#+\s.*$/gm, "")
          .trim()
          .slice(0, 80)
      : undefined;
    return {
      type,
      name,
      status,
      owner,
      filePath,
      isAfx,
      updatedAt,
      excerpt,
      size: stat?.size,
    };
  }

  function buildPhaseRows(rawTasks: string): {
    phases: PhaseRow[];
    total: number;
    completed: number;
  } {
    const lines = rawTasks.split("\n");
    const phases: PhaseRow[] = [];
    let current: PhaseRow | null = null;
    let total = 0;
    let completed = 0;

    const phaseRe = /^##\s+Phase\s+(\d+):?\s*(.*)$/i;
    const taskRe = /^\s*-\s*\[( |x|X)\]\s+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i] ?? "";
      const phMatch = phaseRe.exec(ln);
      if (phMatch) {
        if (current) phases.push(current);
        const phaseNum = Number(phMatch[1]);
        current = {
          number: phaseNum,
          name: (phMatch[2] ?? "").trim() || `Phase ${phaseNum}`,
          completed: 0,
          total: 0,
          line: i + 1,
          items: [],
        };
        continue;
      }
      const tMatch = taskRe.exec(ln);
      if (tMatch && current) {
        const isDone = tMatch[1]?.toLowerCase() === "x";
        const item: TaskItemRow = {
          text: tMatch[2] ?? "",
          completed: isDone,
          line: i + 1,
          wbsId: `${current.number}.${current.total + 1}`,
        };
        current.items.push(item);
        current.total++;
        total++;
        if (isDone) {
          current.completed++;
          completed++;
        }
      }
    }
    if (current) phases.push(current);
    return { phases, total, completed };
  }

  function parseWorkSessions(rawTasks: string): WorkSessionRow[] {
    const out: WorkSessionRow[] = [];
    const lines = rawTasks.split("\n");
    let inTable = false;
    let pastHeader = false;
    for (const ln of lines) {
      if (/^\|\s*Date\s*\|/.test(ln)) {
        inTable = true;
        pastHeader = false;
        continue;
      }
      if (!inTable) continue;
      if (/^\|\s*-+\s*\|/.test(ln)) {
        pastHeader = true;
        continue;
      }
      if (!pastHeader) continue;
      if (!ln.startsWith("|")) {
        inTable = false;
        continue;
      }
      const cells = ln
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.length < 6) continue;
      out.push({
        date: cells[0] ?? "",
        task: cells[1] ?? "",
        action: cells[2] ?? "",
        filesModified: cells[3] ?? "",
        agent: /\[x\]/i.test(cells[4] ?? ""),
        human: /\[x\]/i.test(cells[5] ?? ""),
      });
    }
    return out;
  }

  function parseKanbanFile(
    name: string,
    filePath: string,
    content: string,
    source: WorkbenchSourceIdentity | undefined,
    revision: Awaited<ReturnType<WorkbenchFileState["readText"]>>,
    scanGeneration: number,
    catalog: LinkedWorkCatalog,
    workspaceFolders: readonly vscode.WorkspaceFolder[],
  ): KanbanData["boards"][number] {
    const { data } = parseFrontmatter(content);
    const document = parseKanbanMarkdown(content);
    const hydrateLink = (link: LinkedWorkItemRef | undefined): LinkedWorkItemRef | undefined => {
      if (!link || link.source.rootUri) return link;
      const roots = workspaceFolders.filter((folder) => folder.name === link.source.rootName);
      if (roots.length !== 1) return link;
      const target = sourceIdentity(
        vscode.Uri.joinPath(roots[0]?.uri ?? vscode.Uri.file("/"), link.source.relativePath),
        workspaceFolders,
      );
      return target ? { ...link, source: target } : link;
    };
    return {
      name,
      filePath,
      columns: document.columns.map((column) => ({
        id: column.id,
        title: column.title,
        cards: column.cards.map((card) => {
          const link = hydrateLink(card.link);
          return {
            id: card.id,
            text: card.text,
            link,
            resolved: link ? catalog.resolve(link) : undefined,
          };
        }),
      })),
      rawContent: content,
      meta: {
        title: typeof data["title"] === "string" ? data["title"] : undefined,
        status: typeof data["status"] === "string" ? data["status"] : undefined,
      },
      source,
      revision:
        revision?.sourceRevision ??
        (source
          ? {
              contentRevision: notesContentRevision(content),
              diskRevision: notesContentRevision(content),
              dirty: false,
            }
          : undefined),
      scanGeneration,
      editorDirty: revision?.dirty ?? false,
    };
  }

  async function scan(scanGeneration: number): Promise<PanelDataPayload> {
    const configuredFolders = options.getWorkspaceFolders?.() ?? [];
    const rootPath = getRoot();
    const fallbackUri = rootPath ? vscode.Uri.file(rootPath) : undefined;
    const workspaceFolders =
      configuredFolders.length > 0
        ? configuredFolders
        : fallbackUri
          ? [
              {
                uri: fallbackUri,
                name: fallbackUri.path.split("/").filter(Boolean).at(-1) ?? "workspace",
                index: 0,
              } as vscode.WorkspaceFolder,
            ]
          : [];
    if (workspaceFolders.length === 0) {
      log.debug("no workspace root");
      return emptyPayload();
    }
    const projectRoots = await discoverProjectRoots(workspaceFolders);

    const pipeline: PipelineRow[] = [];
    const featureTasks: FeatureTasksData[] = [];
    const journalEntries: JournalEntry[] = [];
    const documents: DocumentRow[] = [];
    const linkedWorkSources: LinkedWorkSource[] = [];

    for (const project of projectRoots) {
      if (!project.hasDocs) continue;
      const docsUri = vscode.Uri.joinPath(project.uri, DOCS_DIR);
      const docPaths = await listMarkdownFilesRecursive(
        docsUri,
        prefixed(project.prefix, DOCS_DIR),
      );
      const byDir = new Map<string, Map<string, { path: string; raw: string }>>();

      for (const document of docPaths) {
        const filePath = document.path;
        const liveDocument = await options.fileState?.readText(document.uri);
        const [raw, docStat] = await Promise.all([
          liveDocument?.content ?? readFileSafe(document.uri),
          statSafe(document.uri),
        ]);
        if (!raw) continue;

        const linkedSource = liveDocument?.source ?? sourceIdentity(document.uri, workspaceFolders);
        if (linkedSource) {
          linkedWorkSources.push({
            source: linkedSource,
            content: raw,
            revision: liveDocument?.revision ?? notesContentRevision(raw),
          });
        }

        const filename = filePath.split("/").pop() ?? filePath;
        const dir = filePath.slice(0, Math.max(0, filePath.length - filename.length - 1));
        const fmType = frontmatterData(raw)["type"];
        const type =
          typeof fmType === "string" && fmType.trim()
            ? fmType.trim().toUpperCase()
            : filename.replace(/\.md$/, "").toUpperCase();
        documents.push(
          deriveDocumentRow(
            type,
            filePath.replace(prefixed(project.prefix, `${DOCS_DIR}/`), ""),
            filePath,
            raw,
            docStat,
          ),
        );

        const group = byDir.get(dir) ?? new Map<string, { path: string; raw: string }>();
        group.set(filename.toLowerCase(), { path: filePath, raw });
        byDir.set(dir, group);
      }

      for (const [dir, files] of byDir.entries()) {
        let spec = files.get("spec.md");
        let design = files.get("design.md");
        let tasks = files.get("tasks.md");
        const journal = files.get("journal.md");

        // Sprint detection — if any file in this dir has type: SPRINT, treat
        // its sliced sections as spec/design/tasks so the rest of the pipeline
        // can stay unchanged. A sibling journal.md is the discussion log;
        // the sprint's SESSIONS slice is the Work Sessions table that gets
        // appended to tasks.md on graduation, so we feed it to the work-session
        // parser instead of the journal parser.
        let sprintSessionsRaw: string | null = null;
        if (!spec && !design && !tasks) {
          for (const file of files.values()) {
            if (!isSprintFile(file.raw)) continue;
            const slices = sliceAllSprintSections(file.raw);
            if (slices.SPEC) spec = { path: `${file.path}#SPEC`, raw: slices.SPEC.content };
            if (slices.DESIGN) design = { path: `${file.path}#DESIGN`, raw: slices.DESIGN.content };
            if (slices.TASKS) tasks = { path: `${file.path}#TASKS`, raw: slices.TASKS.content };
            if (slices.SESSIONS) sprintSessionsRaw = slices.SESSIONS.content;
            break;
          }
        }

        if (!spec && !design && !tasks && !journal) continue;

        const specRaw = spec?.raw ?? null;
        const designRaw = design?.raw ?? null;
        const tasksRaw = tasks?.raw ?? null;
        const journalRaw = journal?.raw ?? null;
        const displayName = dir.replace(prefixed(project.prefix, `${DOCS_DIR}/`), "");

        const specFm = specRaw ? frontmatterData(specRaw) : {};
        const designFm = designRaw ? frontmatterData(designRaw) : {};
        const tasksFm = tasksRaw ? frontmatterData(tasksRaw) : {};

        const phaseInfo = tasksRaw
          ? buildPhaseRows(tasksRaw)
          : { phases: [], total: 0, completed: 0 };

        const featureStatus =
          (specFm["status"] as string | undefined) ??
          (designFm["status"] as string | undefined) ??
          "";

        pipeline.push({
          name: displayName,
          specStatus: (specFm["status"] as string | undefined) ?? "",
          designStatus: (designFm["status"] as string | undefined) ?? "",
          tasksStatus: (tasksFm["status"] as string | undefined) ?? "",
          completed: phaseInfo.completed,
          total: phaseInfo.total,
          featureStatus,
          specPath: spec?.path,
          designPath: design?.path,
          tasksPath: tasks?.path,
        });

        if (tasksRaw) {
          // Sprints keep the Work Sessions table in their SESSIONS slice; concatenate
          // so the parser sees the same shape as a graduated tasks.md.
          const workSessionsSource = sprintSessionsRaw
            ? `${tasksRaw}\n${sprintSessionsRaw}`
            : tasksRaw;
          featureTasks.push({
            name: displayName,
            tasksPath: tasks?.path,
            completed: phaseInfo.completed,
            total: phaseInfo.total,
            phases: phaseInfo.phases,
            workSessions: parseWorkSessions(workSessionsSource),
          });
        }

        if (journalRaw) {
          const parsed = parseJournal(journalRaw);
          for (const d of parsed.discussions) {
            journalEntries.push({
              id: d.id,
              date: d.timestamp,
              title: d.summary,
              status:
                d.status === "resolved" ? "closed" : d.status === "promoted" ? "closed" : "active",
              feature: displayName,
              filePath: journal?.path ?? "",
              line: d.line,
              summary: d.summary,
            });
          }
        }
      }
    }

    const linkedWorkCatalog = buildLinkedWorkCatalog(linkedWorkSources);

    // Boards (.afx/kanban/*.md)
    let kanban: KanbanData | null = null;
    const boards: KanbanData["boards"] = [];
    const boardRoots = projectRoots;
    const seenBoardFiles = new Set<string>();
    for (const project of boardRoots) {
      const boardsUri = vscode.Uri.joinPath(project.uri, BOARDS_DIR);
      const boardFiles = await listFiles(boardsUri);
      for (const f of boardFiles) {
        if (!f.endsWith(".md")) continue;
        const fp = prefixed(project.prefix, `${BOARDS_DIR}/${f}`);
        if (seenBoardFiles.has(fp)) continue;
        seenBoardFiles.add(fp);
        const boardUri = vscode.Uri.joinPath(boardsUri, f);
        const liveBoard = await options.fileState?.readText(boardUri);
        const raw = liveBoard?.content ?? (await readFileSafe(boardUri));
        if (raw) {
          boards.push(
            parseKanbanFile(
              f.replace(/\.md$/, ""),
              fp,
              raw,
              liveBoard?.source ?? sourceIdentity(boardUri, workspaceFolders),
              liveBoard ?? null,
              scanGeneration,
              linkedWorkCatalog,
              workspaceFolders,
            ),
          );
        }
      }
    }
    if (boards.length > 0) {
      kanban = {
        boards,
        dirPath: BOARDS_DIR,
        availableWorkItems: linkedWorkCatalog.candidates,
      };
    }

    // Notes (.afx/notes.md). Every workspace root remains a creatable target;
    // nested project roots are included only when their Notes source exists.
    // @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-IDENTITY] [DES-NOTES-LIVE-SYNC]
    const notesSources: NotesSourceSnapshot[] = [];
    const notesRawByKey = new Map<string, string>();
    const notesCandidates: Array<{ uri: vscode.Uri; rootCandidate: boolean }> = [];
    const seenNoteUris = new Set<string>();
    const addNotesCandidate = (uri: vscode.Uri, rootCandidate: boolean): void => {
      const key = `${uri.scheme}\u0000${uri.authority}\u0000${uri.path}`;
      if (seenNoteUris.has(key)) return;
      seenNoteUris.add(key);
      notesCandidates.push({ uri, rootCandidate });
    };
    for (const folder of workspaceFolders) {
      addNotesCandidate(vscode.Uri.joinPath(folder.uri, NOTES_PATH), true);
    }
    for (const project of projectRoots) {
      addNotesCandidate(vscode.Uri.joinPath(project.uri, NOTES_PATH), false);
    }

    for (const candidate of notesCandidates) {
      const source = sourceIdentity(candidate.uri, workspaceFolders);
      if (!source) continue;
      const live = await options.fileState?.readText(candidate.uri);
      let raw: string | null = live?.content ?? null;
      if (raw === null) {
        try {
          raw = Buffer.from(await vscode.workspace.fs.readFile(candidate.uri)).toString("utf8");
        } catch {
          raw = null;
        }
      }
      if (raw === null && !candidate.rootCandidate) continue;

      const key = sourceKey(source);
      const document = NotesMarkdownDocument.parse(raw ?? "");
      if (document.valid) lastValidNotes.set(key, document.notes);
      const notesForSource = document.valid ? document.notes : (lastValidNotes.get(key) ?? []);
      const contentRevision = raw === null ? "" : (live?.revision ?? notesContentRevision(raw));
      notesSources.push({
        source,
        revision: {
          contentRevision,
          diskRevision: raw === null || live?.dirty ? undefined : contentRevision,
          dirty: live?.dirty ?? false,
        },
        scanGeneration,
        notes: notesForSource,
        parseError: document.valid ? undefined : document.diagnostics.join(" "),
      });
      notesRawByKey.set(key, raw ?? "");
    }

    const activeNotes =
      notesSources.find(
        (snapshot) => snapshot.revision.contentRevision !== notesContentRevision(""),
      ) ?? notesSources[0];
    const notes = activeNotes?.notes ?? [];
    const notesRaw = activeNotes ? (notesRawByKey.get(sourceKey(activeNotes.source)) ?? "") : "";
    const notesFilePath = activeNotes
      ? prefixed(
          workspaceFolders.length > 1 ? activeNotes.source.rootName : "",
          activeNotes.source.relativePath,
        )
      : NOTES_PATH;

    const payload: PanelDataPayload = {
      pipeline,
      featureTasks,
      documents,
      journal: journalEntries,
      kanban,
      notes,
      notesRaw,
      notesFilePath,
      notesSources,
      ghostTasks: { count: 0, items: [] },
    };

    log.debug(
      () =>
        `scan complete — roots=${projectRoots.length} features=${pipeline.length} docs=${documents.length} journal=${journalEntries.length} notes=${notes.length}`,
    );

    return payload;
  }

  function emptyPayload(): PanelDataPayload {
    return {
      pipeline: [],
      featureTasks: [],
      documents: [],
      journal: [],
      kanban: null,
      notes: [],
      notesRaw: "",
      notesFilePath: NOTES_PATH,
      notesSources: [],
      ghostTasks: { count: 0, items: [] },
    };
  }

  return {
    async getPanelData(): Promise<PanelDataPayload> {
      if (disposed) return emptyPayload();
      if (cache) return cache;
      if (!inFlight) {
        inFlight = (async () => {
          do {
            const scanGeneration = generation;
            const scanned = await scan(scanGeneration);
            if (scanGeneration === generation) cache = scanned;
          } while (!cache && !disposed);
        })().finally(() => {
          inFlight = null;
        });
      }
      await inFlight;
      if (disposed) return emptyPayload();
      if (!cache) return this.getPanelData();
      return cache;
    },
    refresh() {
      if (disposed) return;
      generation += 1;
      cache = null;
    },
    dispose() {
      disposed = true;
      generation += 1;
      cache = null;
    },
  };
}
