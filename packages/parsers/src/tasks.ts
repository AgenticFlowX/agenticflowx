/**
 * tasks.md parser — extracts task items and phase groups from AFX tasks documents.
 *
 * @see docs/specs/120-package-parsers/spec.md [FR-3]
 * @see docs/specs/120-package-parsers/design.md [DES-PARSERS-TASKS]
 */
export interface TaskItem {
  id: string;
  title: string;
  done: boolean;
  phase: string;
  line: number;
}

export interface PhaseGroup {
  id: string;
  name: string;
  tasks: TaskItem[];
}

export interface TaskStats {
  total: number;
  done: number;
}

export interface TasksParseResult {
  stats: TaskStats;
  phases: PhaseGroup[];
  tasks: TaskItem[];
}

export function parseTasks(raw: string): TasksParseResult {
  const taskIdRegex = /^\[ \]\s*\((\d+-\d+)\)\s+(.+)$/gm;
  const doneIdRegex = /^\[[xX]]\s*\((\d+-\d+)\)\s+(.+)$/gm;

  const tasks: TaskItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = taskIdRegex.exec(raw)) !== null) {
    const lineNumber = raw.substring(0, match.index).split("\n").length;
    const [, id = "", title = ""] = match;
    tasks.push({ id, title, done: false, phase: "", line: lineNumber });
  }

  while ((match = doneIdRegex.exec(raw)) !== null) {
    const lineNumber = raw.substring(0, match.index).split("\n").length;
    const [, id = "", title = ""] = match;
    tasks.push({ id, title, done: true, phase: "", line: lineNumber });
  }

  const phases: PhaseGroup[] = [];
  const phaseRegex = /^##\s+(.+)$/gm;
  let phaseMatch: RegExpExecArray | null;
  const phaseNames: string[] = [];

  while ((phaseMatch = phaseRegex.exec(raw)) !== null) {
    if (phaseNames.length > 0) {
      const last = phaseNames[phaseNames.length - 1];
      phases.push({ id: `phase-${phaseNames.length}`, name: last ?? "", tasks: [] });
    }
    const [, name = ""] = phaseMatch;
    phaseNames.push(name);
  }

  if (phaseNames.length > 0) {
    const last = phaseNames[phaseNames.length - 1];
    phases.push({ id: `phase-${phaseNames.length}`, name: last ?? "", tasks: [] });
  }

  return {
    stats: {
      total: tasks.length,
      done: tasks.filter((t) => t.done).length,
    },
    phases,
    tasks,
  };
}
