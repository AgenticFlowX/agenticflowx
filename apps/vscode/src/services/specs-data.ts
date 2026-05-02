/**
 * SpecsDataProvider — scans docs/, parses AFX-shaped spec/design/tasks/journal groups,
 * derives the WorkbenchInbound payload (pipeline, featureTasks, documents, journal).
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 * @see docs/specs/220-app-workbench/spec.md [FR-7] [FR-8]
 * @see docs/specs/220-app-workbench/design.md [DES-DATA]
 */
import * as vscode from "vscode";

import { parseFrontmatter, parseJournal } from "@afx/parsers";
import {
  type DocumentRow,
  type FeatureTasksData,
  type GhostTaskResult,
  type JournalEntry,
  type KanbanData,
  type Logger,
  type PhaseRow,
  type PipelineRow,
  type QuickNote,
  type TaskItemRow,
  type WorkSessionRow,
} from "@afx/shared";

import { isSprintFile, sliceAllSprintSections } from "./sprint";

interface PanelDataPayload {
  pipeline: PipelineRow[];
  featureTasks: FeatureTasksData[];
  documents: DocumentRow[];
  journal: JournalEntry[];
  kanban: KanbanData | null;
  notes: QuickNote[];
  notesRaw: string;
  notesFilePath: string;
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
}

export function createSpecsDataProvider(
  getRoot: () => string | undefined,
  parentLog: Logger,
): SpecsDataProvider {
  const log = parentLog.child("specs-data");
  let cache: PanelDataPayload | null = null;

  async function readFileSafe(uri: vscode.Uri): Promise<string | null> {
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

  async function listMarkdownFilesRecursive(uri: vscode.Uri, relDir: string): Promise<string[]> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(uri);
    } catch {
      return [];
    }

    const out: string[] = [];
    for (const [name, type] of entries) {
      const relPath = `${relDir}/${name}`;
      if (type === vscode.FileType.Directory) {
        out.push(...(await listMarkdownFilesRecursive(vscode.Uri.joinPath(uri, name), relPath)));
      } else if (type === vscode.FileType.File && name.endsWith(".md")) {
        out.push(relPath);
      }
    }
    return out;
  }

  function prefixed(prefix: string, path: string): string {
    return prefix ? `${prefix}/${path}` : path;
  }

  async function discoverProjectRoots(rootUri: vscode.Uri): Promise<ProjectRoot[]> {
    const roots: ProjectRoot[] = [];
    const addIfDocsRoot = async (uri: vscode.Uri, prefix: string): Promise<void> => {
      const stat = await statSafe(vscode.Uri.joinPath(uri, DOCS_DIR));
      if (stat?.type === vscode.FileType.Directory) roots.push({ uri, prefix });
    };

    await addIfDocsRoot(rootUri, "");
    for (const child of await listDirs(rootUri)) {
      if (child === "node_modules" || child.startsWith(".") || child.endsWith("-bk")) continue;
      await addIfDocsRoot(vscode.Uri.joinPath(rootUri, child), child);
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
    const fmData = content ? parseFrontmatter(content).data : {};
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
    let phaseNum = 0;
    let total = 0;
    let completed = 0;

    const phaseRe = /^##\s+Phase\s+(\d+)\s*[—:-]\s*(.+)$/i;
    const altPhaseRe = /^##\s+(.+)$/;
    const taskRe = /^\s*-\s*\[( |x|X)\]\s+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i] ?? "";
      const phMatch = phaseRe.exec(ln) ?? altPhaseRe.exec(ln);
      if (phMatch) {
        if (current) phases.push(current);
        const num = /^Phase\s+(\d+)/i.exec(ln);
        phaseNum++;
        current = {
          number: num ? Number(num[1]) : phaseNum,
          name: phMatch[2] ?? phMatch[1] ?? `Phase ${phaseNum}`,
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
        const item: TaskItemRow = { text: tMatch[2] ?? "", completed: isDone, line: i + 1 };
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
  ): KanbanData["boards"][number] {
    const { data, content: body } = parseFrontmatter(content);
    const cols: Array<{ title: string; cards: { text: string }[] }> = [];
    let current: { title: string; cards: { text: string }[] } | null = null;
    let currentCard: string[] | null = null;
    const flushCard = (): void => {
      if (!current || !currentCard) return;
      const text = currentCard.join("\n").trim();
      if (text) current.cards.push({ text });
      currentCard = null;
    };
    for (const ln of body.split("\n")) {
      const h = /^##\s+(.+)$/.exec(ln);
      if (h) {
        flushCard();
        if (current) cols.push(current);
        const title = h[1] ?? "";
        current = /^board rules$/i.test(title) ? null : { title, cards: [] };
        continue;
      }
      const cardHeading = /^###\s+(.+)$/.exec(ln);
      if (cardHeading && current) {
        flushCard();
        currentCard = [cardHeading[1] ?? ""];
        continue;
      }
      const c = /^-\s+(.+)$/.exec(ln);
      if (c && current) {
        if (currentCard) {
          currentCard.push(c[1] ?? "");
        } else {
          current.cards.push({ text: c[1] ?? "" });
        }
        continue;
      }
      if (currentCard && ln.trim()) currentCard.push(ln);
    }
    flushCard();
    if (current) cols.push(current);
    const d = data;
    return {
      name,
      filePath,
      columns: cols,
      rawContent: content,
      meta: {
        title: typeof d["title"] === "string" ? d["title"] : undefined,
        status: typeof d["status"] === "string" ? d["status"] : undefined,
      },
    };
  }

  function formatQuickNoteTime(d: Date, fallback: string): string {
    if (Number.isNaN(d.getTime())) return fallback;
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  function parseQuickNotes(content: string): QuickNote[] {
    const out: QuickNote[] = [];
    const re = /^-\s+\*\*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?Z?)\*\*\s+(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const ts = m[1] ?? "";
      const text = m[2] ?? "";
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) continue;
      const rawTime = ts.slice(11).replace(/Z$/, "");
      out.push({
        timestamp: ts,
        time: rawTime,
        displayTime: formatQuickNoteTime(d, rawTime),
        date: ts.slice(0, 10),
        text,
      });
    }
    const lines = parseFrontmatter(content).content.split("\n");
    let currentDate = "";
    for (let i = 0; i < lines.length; i++) {
      const dateMatch = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(lines[i] ?? "");
      if (dateMatch) {
        currentDate = dateMatch[1] ?? "";
        continue;
      }
      const timeMatch = /^###\s+(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s*$/.exec(lines[i] ?? "");
      if (!timeMatch || !currentDate) continue;
      const textLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j] ?? "";
        if (/^##\s+\d{4}-\d{2}-\d{2}\s*$/.test(next) || /^###\s+\d{2}:\d{2}:\d{2}/.test(next)) {
          break;
        }
        textLines.push(next);
      }
      const time = timeMatch[1] ?? "";
      const text = textLines.join("\n").trim();
      if (!text) continue;
      const timestamp = `${currentDate}T${time}`;
      if (out.some((note) => note.timestamp === timestamp)) continue;
      const d = new Date(timestamp);
      out.push({
        timestamp,
        time,
        displayTime: formatQuickNoteTime(d, time),
        date: currentDate,
        text,
      });
    }
    return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async function scan(): Promise<PanelDataPayload> {
    const rootPath = getRoot();
    if (!rootPath) {
      log.debug("no workspace root");
      return emptyPayload();
    }
    const rootUri = vscode.Uri.file(rootPath);
    const projectRoots = await discoverProjectRoots(rootUri);
    if (projectRoots.length === 0) {
      log.debug(() => `no docs roots under ${rootUri.fsPath}`);
      return emptyPayload();
    }

    const pipeline: PipelineRow[] = [];
    const featureTasks: FeatureTasksData[] = [];
    const journalEntries: JournalEntry[] = [];
    const documents: DocumentRow[] = [];

    for (const project of projectRoots) {
      const docsUri = vscode.Uri.joinPath(project.uri, DOCS_DIR);
      const docPaths = await listMarkdownFilesRecursive(
        docsUri,
        prefixed(project.prefix, DOCS_DIR),
      );
      const byDir = new Map<string, Map<string, { path: string; raw: string }>>();

      for (const filePath of docPaths) {
        const uri = vscode.Uri.joinPath(rootUri, ...filePath.split("/"));
        const [raw, docStat] = await Promise.all([readFileSafe(uri), statSafe(uri)]);
        if (!raw) continue;

        const filename = filePath.split("/").pop() ?? filePath;
        const dir = filePath.slice(0, Math.max(0, filePath.length - filename.length - 1));
        const fmType = parseFrontmatter(raw).data["type"];
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

        const specFm = specRaw ? parseFrontmatter(specRaw).data : {};
        const designFm = designRaw ? parseFrontmatter(designRaw).data : {};
        const tasksFm = tasksRaw ? parseFrontmatter(tasksRaw).data : {};

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

    // Boards (.afx/kanban/*.md)
    let kanban: KanbanData | null = null;
    const boards: KanbanData["boards"] = [];
    const boardRoots: ProjectRoot[] = [{ uri: rootUri, prefix: "" }, ...projectRoots];
    const seenBoardFiles = new Set<string>();
    for (const project of boardRoots) {
      const boardsUri = vscode.Uri.joinPath(project.uri, BOARDS_DIR);
      const boardFiles = await listFiles(boardsUri);
      for (const f of boardFiles) {
        if (!f.endsWith(".md")) continue;
        const fp = prefixed(project.prefix, `${BOARDS_DIR}/${f}`);
        if (seenBoardFiles.has(fp)) continue;
        seenBoardFiles.add(fp);
        const raw = await readFileSafe(vscode.Uri.joinPath(boardsUri, f));
        if (raw) boards.push(parseKanbanFile(f.replace(/\.md$/, ""), fp, raw));
      }
    }
    if (boards.length > 0) kanban = { boards, dirPath: BOARDS_DIR };

    // Notes (.afx/notes.md)
    let notesRaw = "";
    let notesFilePath = NOTES_PATH;
    for (const project of boardRoots) {
      const candidate = vscode.Uri.joinPath(project.uri, NOTES_PATH);
      const raw = await readFileSafe(candidate);
      if (raw) {
        notesRaw = raw;
        notesFilePath = prefixed(project.prefix, NOTES_PATH);
        break;
      }
    }
    const notes = notesRaw ? parseQuickNotes(notesRaw) : [];

    const payload: PanelDataPayload = {
      pipeline,
      featureTasks,
      documents,
      journal: journalEntries,
      kanban,
      notes,
      notesRaw,
      notesFilePath,
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
      ghostTasks: { count: 0, items: [] },
    };
  }

  return {
    async getPanelData(): Promise<PanelDataPayload> {
      if (cache) return cache;
      cache = await scan();
      return cache;
    },
    refresh() {
      cache = null;
    },
    dispose() {
      cache = null;
    },
  };
}
