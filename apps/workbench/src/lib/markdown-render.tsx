/**
 * Markdown renderer for Workbench previews — react-markdown + remark-gfm so
 * spec/design/tasks tables, task checkboxes, links, numbered lists render
 * correctly. Frontmatter, trace anchors, and AFX control comments are stripped
 * before render.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-6] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN]
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-5]
 */
import {
  Children,
  Fragment,
  type ReactElement,
  type ReactNode,
  createContext,
  isValidElement,
  useContext,
  useMemo,
} from "react";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { slugify } from "./document-outline";
import { cleanMarkdownForReading, removeLeadingH1 } from "./markdown-cleanup";
import {
  type MarkdownTableKind,
  classifyRenderedTableText,
  isMarkdownTableSeparator,
  splitMarkdownTableCells,
} from "./markdown-table";
import { type ReadingSize, readingBodyScaleClass } from "./reading-prefs";

/** Minimal mdast block node shape we inspect (avoids a hard mdast type dep). */
interface MdastBlock {
  type: string;
}

export interface MarkdownCheckboxToggle {
  kind: "task" | "session";
  checked: boolean;
  completed: boolean;
  line?: number;
  checkboxIndex?: number;
  sessionIndex?: number;
  column?: "agent" | "human";
}

export interface MarkdownHeadingInfo {
  level: number;
  text: string;
  slug: string;
}

export type MarkdownHeadingActionRenderer = (heading: MarkdownHeadingInfo) => ReactNode;

interface CheckboxTargets {
  tasks: MarkdownCheckboxToggle[];
  sessionCells: MarkdownCheckboxToggle[];
}

interface DefinitionCalloutRow {
  label: string;
  value: ReactNode[];
}

const TASK_CHECKBOX_RE = /^\s*[-*]\s+\[( |x|X)?\](?=\s)/;

const TABLE_MIN_WIDTH: Record<MarkdownTableKind, string> = {
  requirements: "min-w-full",
  "work-sessions": "min-w-[30rem]",
  decisions: "min-w-[58rem]",
  "file-map": "min-w-[52rem]",
  "cross-reference": "min-w-[48rem]",
  "open-questions": "min-w-full",
  generic: "min-w-full",
};

const MarkdownTableKindContext = createContext<MarkdownTableKind>("generic");

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * remark plugin: drop redundant thematic breaks (`---`) so styled headings own
 * the section rhythm. Generic across any markdown — a `---` adjacent to a
 * heading is decorative (the heading already delimits the section), as are
 * leading/trailing and consecutive breaks. A `---` between real content blocks
 * survives and renders as an actual divider. AST-level, so fenced-code `---`
 * (which never parses as a thematicBreak) is untouched.
 *
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN]
 */
function remarkTidyThematicBreaks() {
  return (tree: { children?: MdastBlock[] }): void => {
    const children = tree.children;
    if (!Array.isArray(children)) return;
    const kept: MdastBlock[] = [];
    children.forEach((node, i) => {
      if (node.type === "thematicBreak") {
        const prev = children[i - 1];
        const next = children[i + 1];
        const adjacentToHeading = prev?.type === "heading" || next?.type === "heading";
        const atEdge = i === 0 || i === children.length - 1;
        const followsKeptBreak = kept[kept.length - 1]?.type === "thematicBreak";
        if (adjacentToHeading || atEdge || followsKeptBreak) return; // drop redundant rule
      }
      kept.push(node);
    });
    tree.children = kept;
  };
}

/**
 * Flatten a React heading child tree to plain text so we can derive the same
 * slug `extractOutline` produces (both run on trace-token-cleaned heading text).
 * Used to stamp a stable `id` on rendered headings for outline scroll-to anchors.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 */
function headingText(children: ReactNode): string {
  let text = "";
  Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      text += String(child);
    } else if (isValidElement<{ children?: ReactNode }>(child)) {
      text += headingText(child.props.children);
    }
  });
  return text;
}

function checkboxMarkerState(text: string): boolean | null {
  const normalized = text.trim().toLowerCase();
  if (normalized === "[x]") return true;
  if (normalized === "[ ]" || normalized === "[]") return false;
  return null;
}

function workSessionsColumns(line: string): { agent: number; human: number } | null {
  const cells = splitMarkdownTableCells(line).map((cell) => cell.toLowerCase());
  const agent = cells.indexOf("agent");
  const human = cells.indexOf("human");
  if (agent < 0 || human < 0) return null;
  return { agent, human };
}

function collectTaskCheckboxTargets(
  content: string,
  sourceLineOffset = 0,
): MarkdownCheckboxToggle[] {
  const tasks: MarkdownCheckboxToggle[] = [];
  const lines = content.split("\n");
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const taskMarker = TASK_CHECKBOX_RE.exec(line);
    if (!taskMarker) continue;
    const checked = (taskMarker[1] ?? "").toLowerCase() === "x";
    tasks.push({
      kind: "task",
      checked,
      completed: !checked,
      line: sourceLineOffset + i + 1,
      checkboxIndex: tasks.length,
    });
  }

  return tasks;
}

function collectWorkSessionCheckboxTargets(
  content: string,
  sourceLineOffset = 0,
): MarkdownCheckboxToggle[] {
  const sessionCells: MarkdownCheckboxToggle[] = [];
  const lines = content.split("\n");
  let inFence = false;
  let inWorkSessions = false;
  let activeWorkSessionColumns: { agent: number; human: number } | null = null;
  let pastHeader = false;
  let sessionIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (/^##\s+(?:\d+\.\s+)?(?:Work\s+Sessions|Sessions)\b/i.test(trimmed)) {
      inWorkSessions = true;
      activeWorkSessionColumns = null;
      pastHeader = false;
      sessionIndex = 0;
      continue;
    }
    if (inWorkSessions && /^##\s+/.test(trimmed)) break;
    if (!inWorkSessions && !workSessionsColumnsForRow(line)) continue;
    if (!trimmed) continue;
    if (!trimmed.startsWith("|")) {
      if (inWorkSessions && pastHeader) break;
      continue;
    }

    const nextWorkSessionsColumns = workSessionsColumnsForRow(line);
    if (!activeWorkSessionColumns && nextWorkSessionsColumns) {
      activeWorkSessionColumns = nextWorkSessionsColumns;
      inWorkSessions = true;
      pastHeader = false;
      sessionIndex = 0;
      continue;
    }
    if (isMarkdownTableSeparator(line)) {
      pastHeader = true;
      continue;
    }
    if (!pastHeader) continue;
    if (!activeWorkSessionColumns) continue;

    const cells = splitMarkdownTableCells(line);
    for (const column of ["agent", "human"] as const) {
      const checked = checkboxMarkerState(cells[activeWorkSessionColumns[column]] ?? "");
      if (checked === null) continue;
      sessionCells.push({
        kind: "session",
        checked,
        completed: !checked,
        line: sourceLineOffset + i + 1,
        sessionIndex,
        column,
      });
    }
    sessionIndex++;
  }

  return sessionCells;
}

function workSessionsColumnsForRow(line: string): { agent: number; human: number } | null {
  return workSessionsColumns(line);
}

function MarkdownTableCell({ children }: { children?: ReactNode }) {
  return (
    <td
      data-afx-md-cell="body"
      className="min-w-0 break-words px-2.5 py-2.5 align-top leading-5 text-foreground/85 [overflow-wrap:anywhere]"
    >
      {children}
    </td>
  );
}

function ReadonlyMarkdownCheckbox({ checked }: { checked: boolean | undefined }) {
  return (
    <input
      type="checkbox"
      checked={checked ?? false}
      readOnly
      className="inline-block size-3 cursor-default accent-afx-success"
    />
  );
}

function tableKindLabel(kind: MarkdownTableKind): string {
  switch (kind) {
    case "requirements":
      return "Requirements table";
    case "work-sessions":
      return "Work Sessions table";
    case "decisions":
      return "Decision table";
    case "file-map":
      return "File map table";
    case "cross-reference":
      return "Cross-reference table";
    case "open-questions":
      return "Open Questions table";
    case "generic":
      return "Markdown table";
  }
}

function containsCheckboxInput(children: ReactNode): boolean {
  let found = false;
  Children.forEach(children, (child) => {
    if (found) return;
    if (!isValidElement<{ children?: ReactNode; type?: string }>(child)) return;
    if (child.type === "input" && child.props.type === "checkbox") {
      found = true;
      return;
    }
    if (child.props.children) {
      found = containsCheckboxInput(child.props.children);
    }
  });
  return found;
}

function textFromReactNode(node: ReactNode): string {
  let text = "";
  Children.forEach(node, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      text += String(child);
      return;
    }
    if (isValidElement<{ children?: ReactNode }>(child)) {
      text += textFromReactNode(child.props.children);
    }
  });
  return text;
}

function isReactWrapperElement(
  node: ReactNode,
): node is ReactElement<{ children?: ReactNode; node?: { tagName?: string } }> {
  if (!isValidElement<{ children?: ReactNode; node?: { tagName?: string } }>(node)) return false;
  return node.type === "p" || node.type === Fragment || node.props.node?.tagName === "p";
}

function isStrongElement(
  node: ReactNode,
): node is ReactElement<{ children?: ReactNode; node?: { tagName?: string } }> {
  if (!isValidElement<{ children?: ReactNode; node?: { tagName?: string } }>(node)) return false;
  return node.type === "strong" || node.props.node?.tagName === "strong";
}

function splitSoftBreakRows(children: ReactNode): ReactNode[][] {
  const rows: ReactNode[][] = [[]];

  function append(node: ReactNode): void {
    if (node === null || node === undefined || typeof node === "boolean") return;
    if (typeof node === "string" || typeof node === "number") {
      const parts = String(node).split(/\r?\n/);
      parts.forEach((part, index) => {
        if (index > 0) rows.push([]);
        const current = rows[rows.length - 1];
        if (part && current) current.push(part);
      });
      return;
    }
    if (isReactWrapperElement(node)) {
      append(node.props.children);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(append);
      return;
    }
    const current = rows[rows.length - 1];
    if (current) current.push(node);
  }

  append(children);
  return rows.map(trimReactRow).filter((row) => row.length > 0);
}

function trimReactRow(row: ReactNode[]): ReactNode[] {
  let start = 0;
  let end = row.length;
  while (start < end && isBlankTextNode(row[start])) start++;
  while (end > start && isBlankTextNode(row[end - 1])) end--;

  const trimmed = row.slice(start, end);

  const first = trimmed[0];
  if (typeof first === "string") {
    trimmed[0] = first.trimStart();
  }

  const lastIndex = trimmed.length - 1;
  const last = trimmed[lastIndex];
  if (typeof last === "string") {
    trimmed[lastIndex] = last.trimEnd();
  }

  return trimmed;
}

function isBlankTextNode(node: ReactNode): boolean {
  return (typeof node === "string" || typeof node === "number") && String(node).trim().length === 0;
}

function stripDefinitionColon(nodes: ReactNode[]): ReactNode[] | null {
  const valueNodes = [...nodes];
  for (let index = 0; index < valueNodes.length; index++) {
    const node = valueNodes[index];
    if (isBlankTextNode(node)) continue;
    if (typeof node !== "string" && typeof node !== "number") return null;

    const withoutColon = String(node).replace(/^\s*:\s*/, "");
    if (withoutColon === String(node)) return null;
    valueNodes[index] = withoutColon;
    return trimReactRow(valueNodes);
  }
  return null;
}

function definitionRowFromSoftBreak(row: ReactNode[]): DefinitionCalloutRow | null {
  const [labelNode, ...rest] = trimReactRow(row);
  if (!isStrongElement(labelNode)) return null;

  const label = textFromReactNode(labelNode.props.children).replace(/:$/, "").trim();
  const value = stripDefinitionColon(rest);
  if (!label || !value || value.length === 0) return null;

  return { label, value };
}

function getDefinitionCalloutRows(children: ReactNode): DefinitionCalloutRow[] | null {
  const rows = splitSoftBreakRows(children);
  if (rows.length === 0) return null;

  const definitionRows = rows.map(definitionRowFromSoftBreak);
  if (definitionRows.some((row) => row === null)) return null;
  return definitionRows as DefinitionCalloutRow[];
}

function renderInlineNodes(nodes: ReactNode[]): ReactNode {
  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);
}

function MarkdownDefinitionCallout({ rows }: { rows: DefinitionCalloutRow[] }) {
  return (
    <aside
      data-afx-md-section="definition-callout"
      data-afx-md-callout="definition"
      className="my-3 min-w-0 max-w-full rounded-r-md border-l-2 border-afx-brand/50 bg-afx-brand/8 px-3 py-2 text-sm text-foreground/85"
    >
      <dl className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-1">
        {rows.map((row, index) => (
          <Fragment key={`${row.label}-${index}`}>
            <dt className="whitespace-nowrap font-semibold leading-6 text-foreground">
              {row.label}
              <span aria-hidden>:</span>
            </dt>
            <dd className="m-0 min-w-0 break-words leading-6 [overflow-wrap:anywhere]">
              {renderInlineNodes(row.value)}
            </dd>
          </Fragment>
        ))}
      </dl>
    </aside>
  );
}

function MarkdownTable({ children }: { children?: ReactNode }) {
  const kind = classifyRenderedTableText(headingText(children));
  return (
    <MarkdownTableKindContext.Provider value={kind}>
      <div
        data-afx-md-section="table"
        data-afx-md-table={kind}
        className="my-4 min-w-0 max-w-full overflow-x-auto rounded-md border border-border bg-background shadow-[0_1px_0_rgba(255,255,255,0.04)]"
      >
        <table
          aria-label={tableKindLabel(kind)}
          className={cx(
            "w-full border-collapse text-left text-xs",
            TABLE_MIN_WIDTH[kind],
            kind === "requirements" &&
              "table-auto [&_td:first-child]:w-20 [&_td:last-child]:w-28 [&_th:first-child]:w-20 [&_th:last-child]:w-28",
            kind === "work-sessions" &&
              "table-fixed [&_td:nth-child(1)]:w-24 [&_td:nth-child(1)]:whitespace-nowrap [&_td:nth-child(2)]:w-12 [&_td:nth-child(2)]:whitespace-nowrap [&_td:nth-child(3)]:w-20 [&_td:nth-child(4)]:w-28 [&_td:nth-child(5)]:sticky [&_td:nth-child(5)]:right-16 [&_td:nth-child(5)]:z-10 [&_td:nth-child(5)]:w-16 [&_td:nth-child(5)]:bg-background [&_td:nth-child(5)]:shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.65)] [&_td:nth-child(6)]:sticky [&_td:nth-child(6)]:right-0 [&_td:nth-child(6)]:z-10 [&_td:nth-child(6)]:w-16 [&_td:nth-child(6)]:bg-background [&_th:nth-child(1)]:w-24 [&_th:nth-child(2)]:w-12 [&_th:nth-child(3)]:w-20 [&_th:nth-child(4)]:w-28 [&_th:nth-child(5)]:sticky [&_th:nth-child(5)]:right-16 [&_th:nth-child(5)]:z-20 [&_th:nth-child(5)]:w-16 [&_th:nth-child(5)]:bg-muted [&_th:nth-child(5)]:shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.65)] [&_th:nth-child(6)]:sticky [&_th:nth-child(6)]:right-0 [&_th:nth-child(6)]:z-20 [&_th:nth-child(6)]:w-16 [&_th:nth-child(6)]:bg-muted",
            kind !== "requirements" && kind !== "work-sessions" && "table-fixed",
          )}
        >
          {children}
        </table>
      </div>
    </MarkdownTableKindContext.Provider>
  );
}

function MarkdownTaskListItem({ children }: { children?: ReactNode }) {
  return (
    <li
      data-afx-md-section="task-item"
      className="relative min-w-0 list-none break-words pl-6 leading-6 [overflow-wrap:anywhere] [&>input:first-child]:absolute [&>input:first-child]:left-0 [&>input:first-child]:top-[0.42rem]"
    >
      {children}
    </li>
  );
}

function MarkdownHeading({
  level,
  children,
  renderAfterHeading,
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
  renderAfterHeading?: MarkdownHeadingActionRenderer;
}) {
  const text = headingText(children);
  const slug = slugify(text);
  const after = renderAfterHeading?.({ level, text, slug }) ?? null;

  switch (level) {
    case 1:
      return (
        <MarkdownHeadingActionAnchor action={after} level={level}>
          <h1
            data-afx-md-section="heading"
            data-afx-md-heading-level="1"
            id={slug}
            className="mb-4 mt-1 min-w-0 max-w-full break-words text-lg font-semibold leading-tight tracking-normal first:mt-0 [overflow-wrap:anywhere]"
          >
            {children}
          </h1>
        </MarkdownHeadingActionAnchor>
      );
    case 2:
      return (
        <MarkdownHeadingActionAnchor action={after} level={level}>
          <h2
            data-afx-md-section="heading"
            data-afx-md-heading-level="2"
            id={slug}
            className="mb-2 mt-7 flex min-w-0 max-w-full items-start gap-2 border-t border-border/70 pt-4 text-[15px] font-semibold leading-tight tracking-normal first:mt-0 first:border-t-0 first:pt-0"
          >
            <span className="h-4 w-1 rounded-full bg-afx-brand/70" aria-hidden />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{children}</span>
          </h2>
        </MarkdownHeadingActionAnchor>
      );
    case 3:
      return (
        <MarkdownHeadingActionAnchor action={after} level={level}>
          <h3
            data-afx-md-section="heading"
            data-afx-md-heading-level="3"
            id={slug}
            className="mb-1.5 mt-5 min-w-0 max-w-full break-words text-sm font-semibold leading-tight text-foreground first:mt-0 [overflow-wrap:anywhere]"
          >
            {children}
          </h3>
        </MarkdownHeadingActionAnchor>
      );
    case 4:
      return (
        <MarkdownHeadingActionAnchor action={after} level={level}>
          <h4
            data-afx-md-section="heading"
            data-afx-md-heading-level="4"
            id={slug}
            className="mb-1 mt-4 min-w-0 max-w-full break-words font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground first:mt-0 [overflow-wrap:anywhere]"
          >
            {children}
          </h4>
        </MarkdownHeadingActionAnchor>
      );
    case 5:
      return (
        <MarkdownHeadingActionAnchor action={after} level={level}>
          <h5
            data-afx-md-section="heading"
            data-afx-md-heading-level="5"
            id={slug}
            className="mb-1 mt-3 min-w-0 max-w-full break-words text-xs font-semibold first:mt-0 [overflow-wrap:anywhere]"
          >
            {children}
          </h5>
        </MarkdownHeadingActionAnchor>
      );
    case 6:
      return (
        <MarkdownHeadingActionAnchor action={after} level={level}>
          <h6
            data-afx-md-section="heading"
            data-afx-md-heading-level="6"
            id={slug}
            className="mb-1 mt-3 min-w-0 max-w-full break-words text-xs font-medium text-muted-foreground first:mt-0 [overflow-wrap:anywhere]"
          >
            {children}
          </h6>
        </MarkdownHeadingActionAnchor>
      );
  }
}

function MarkdownHeadingActionAnchor({
  action,
  level,
  children,
}: {
  action: ReactNode;
  level: number;
  children: ReactNode;
}) {
  if (!action) return <>{children}</>;

  return (
    <div
      data-afx-md-heading-action-anchor
      data-afx-md-heading-action-level={level}
      className="group/afx-heading relative min-w-0"
    >
      {children}
      <div
        data-afx-md-heading-action="floating"
        className="z-10 mt-1 flex max-w-full justify-start md:pointer-events-none md:absolute md:right-0 md:top-0 md:mt-0 md:-translate-y-1 md:justify-end md:opacity-0 md:transition-opacity md:duration-150 md:group-hover/afx-heading:pointer-events-auto md:group-hover/afx-heading:opacity-100 md:group-focus-within/afx-heading:pointer-events-auto md:group-focus-within/afx-heading:opacity-100"
      >
        {action}
      </div>
    </div>
  );
}

function codeBlockLanguage(className: string | undefined): string {
  return className?.match(/language-([A-Za-z0-9_-]+)/)?.[1] ?? "text";
}

const components: Components = {
  h1: ({ children }) => <MarkdownHeading level={1}>{children}</MarkdownHeading>,
  h2: ({ children }) => <MarkdownHeading level={2}>{children}</MarkdownHeading>,
  h3: ({ children }) => <MarkdownHeading level={3}>{children}</MarkdownHeading>,
  h4: ({ children }) => <MarkdownHeading level={4}>{children}</MarkdownHeading>,
  h5: ({ children }) => <MarkdownHeading level={5}>{children}</MarkdownHeading>,
  h6: ({ children }) => <MarkdownHeading level={6}>{children}</MarkdownHeading>,
  p: ({ children }) => (
    <p
      data-afx-md-section="paragraph"
      className="my-2.5 min-w-0 max-w-full break-words leading-6 text-foreground/90 first:mt-0 last:mb-0 [overflow-wrap:anywhere]"
    >
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => {
    const className = typeof props.className === "string" ? props.className : "";
    const isTaskList = className.includes("contains-task-list") || containsCheckboxInput(children);
    return (
      <ul
        data-afx-md-section={isTaskList ? "task-list" : "list"}
        className={
          isTaskList
            ? "my-3 min-w-0 max-w-full list-none space-y-1.5 pl-0 [&>li]:relative [&>li]:list-none [&>li]:pl-6 [&>li>input:first-child]:absolute [&>li>input:first-child]:left-0 [&>li>input:first-child]:top-[0.42rem]"
            : "my-2.5 min-w-0 max-w-full list-disc space-y-1 pl-5 marker:text-afx-brand/70"
        }
      >
        {children}
      </ul>
    );
  },
  ol: ({ children }) => (
    <ol
      data-afx-md-section="ordered-list"
      className="my-2.5 min-w-0 max-w-full list-decimal space-y-1 pl-5 marker:text-muted-foreground/70"
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => {
    // Task-list items get role-based styling: drop bullet, tight row.
    const isTaskListItem =
      (typeof (props as { className?: string }).className === "string" &&
        (props as { className?: string }).className!.includes("task-list-item")) ||
      typeof (props as { node?: { checked?: boolean | null } }).node?.checked === "boolean" ||
      containsCheckboxInput(children);
    if (isTaskListItem) return <MarkdownTaskListItem>{children}</MarkdownTaskListItem>;
    return (
      <li
        data-afx-md-section="list-item"
        className="min-w-0 break-words leading-6 [overflow-wrap:anywhere]"
      >
        {children}
      </li>
    );
  },
  blockquote: ({ children }) => {
    const definitionRows = getDefinitionCalloutRows(children);
    if (definitionRows) return <MarkdownDefinitionCallout rows={definitionRows} />;

    return (
      <blockquote
        data-afx-md-section="blockquote"
        className="my-3 min-w-0 max-w-full overflow-hidden break-words rounded-r-md border-l-2 border-afx-brand/50 bg-afx-brand/8 px-3 py-1.5 text-foreground/80 [overflow-wrap:anywhere] [&_p]:my-0"
      >
        {children}
      </blockquote>
    );
  },
  hr: () => <hr className="my-5 border-border/60" />,
  table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
  thead: ({ children }) => <thead className="bg-muted/70 text-foreground">{children}</thead>,
  tr: ({ children }) => (
    <tr className="border-b border-border/70 last:border-b-0 even:bg-muted/15">{children}</tr>
  ),
  th: ({ children }) => (
    <th
      data-afx-md-cell="header"
      className="min-w-0 whitespace-nowrap px-2.5 py-2 font-semibold uppercase text-muted-foreground"
    >
      {children}
    </th>
  ),
  td: ({ children }) => <MarkdownTableCell>{children}</MarkdownTableCell>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="break-words text-afx-brand underline underline-offset-2 decoration-afx-brand/40 hover:text-afx-brand-soft hover:decoration-afx-brand-soft [overflow-wrap:anywhere]"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  // react-markdown wraps block code in <pre><code>. Pass <pre> through so the
  // <code> override below can paint the surrounding box without nesting.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const raw = typeof children === "string" ? children : "";
    const isBlock = (className ?? "").includes("language-") || raw.includes("\n");
    if (!isBlock) {
      // Skip empty / whitespace-only inline code — react-markdown sometimes
      // emits these for stray backticks and they render as orphan grey pills.
      if (typeof children === "string" && !children.trim()) return null;
      return (
        <code
          data-afx-md-code="inline"
          className="break-words rounded bg-muted/70 px-1 py-0.5 font-mono text-[0.88em] text-foreground [overflow-wrap:anywhere]"
        >
          {children}
        </code>
      );
    }
    return (
      <pre
        data-afx-md-section="code-block"
        data-afx-md-code-language={codeBlockLanguage(className)}
        className="my-3 min-w-0 max-w-full overflow-x-auto rounded-md border border-border bg-muted/45 p-3 font-mono text-[11px] leading-5 text-foreground/90"
      >
        <code className="block w-max min-w-full whitespace-pre">{raw.replace(/\n$/, "")}</code>
      </pre>
    );
  },
  input: ({ checked, type }) => {
    if (type !== "checkbox") return null;
    return <ReadonlyMarkdownCheckbox checked={checked} />;
  },
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => (
    <del className="text-muted-foreground line-through decoration-muted-foreground/40">
      {children}
    </del>
  ),
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt ?? ""}
      className="my-3 max-w-full rounded-md border border-border"
      loading="lazy"
    />
  ),
};

function createComponents(
  targets: CheckboxTargets,
  onCheckboxToggle: ((target: MarkdownCheckboxToggle) => void) | undefined,
  renderAfterHeading: MarkdownHeadingActionRenderer | undefined,
): Components {
  let taskCursor = 0;
  let sessionCheckboxCursor = 0;

  function MarkdownTableDataCell({ children }: { children?: ReactNode }) {
    const checked = checkboxMarkerState(headingText(children));
    const tableKind = useContext(MarkdownTableKindContext);
    if (checked === null || tableKind !== "work-sessions") {
      return <MarkdownTableCell>{children}</MarkdownTableCell>;
    }

    const target = targets.sessionCells[sessionCheckboxCursor++];
    return (
      <MarkdownTableCell>
        <input
          key={
            target
              ? `session-${target.line ?? "row"}-${target.column ?? "cell"}-${String(checked)}`
              : `session-readonly-${String(checked)}`
          }
          type="checkbox"
          defaultChecked={checked}
          readOnly={!onCheckboxToggle || !target}
          aria-label={
            target
              ? `Toggle ${target.column} signoff row ${(target.sessionIndex ?? 0) + 1}`
              : "Work Sessions signoff"
          }
          title={
            target
              ? `${target.column === "human" ? "Human" : "Agent"} signoff`
              : "Work Sessions signoff"
          }
          className={cx(
            "inline-block size-3 accent-afx-success",
            target && onCheckboxToggle ? "cursor-pointer" : "cursor-default",
          )}
          onClick={(event) =>
            target
              ? onCheckboxToggle?.({
                  ...target,
                  completed: event.currentTarget.checked,
                })
              : undefined
          }
        />
      </MarkdownTableCell>
    );
  }

  return {
    ...components,
    h1: ({ children }) => (
      <MarkdownHeading level={1} renderAfterHeading={renderAfterHeading}>
        {children}
      </MarkdownHeading>
    ),
    h2: ({ children }) => (
      <MarkdownHeading level={2} renderAfterHeading={renderAfterHeading}>
        {children}
      </MarkdownHeading>
    ),
    h3: ({ children }) => (
      <MarkdownHeading level={3} renderAfterHeading={renderAfterHeading}>
        {children}
      </MarkdownHeading>
    ),
    h4: ({ children }) => (
      <MarkdownHeading level={4} renderAfterHeading={renderAfterHeading}>
        {children}
      </MarkdownHeading>
    ),
    h5: ({ children }) => (
      <MarkdownHeading level={5} renderAfterHeading={renderAfterHeading}>
        {children}
      </MarkdownHeading>
    ),
    h6: ({ children }) => (
      <MarkdownHeading level={6} renderAfterHeading={renderAfterHeading}>
        {children}
      </MarkdownHeading>
    ),
    td: MarkdownTableDataCell,
    input: ({ checked, type }) => {
      if (type !== "checkbox") return null;
      const target = targets.tasks[taskCursor++];
      if (!target) return <ReadonlyMarkdownCheckbox checked={checked} />;
      return (
        <input
          key={`task-${target.line ?? "line"}-${String(checked ?? false)}`}
          type="checkbox"
          defaultChecked={checked ?? false}
          readOnly={!onCheckboxToggle}
          aria-label={`Toggle task checkbox on line ${target.line}`}
          className="inline-block size-3 cursor-pointer accent-afx-success"
          onClick={(event) =>
            onCheckboxToggle?.({
              ...target,
              completed: event.currentTarget.checked,
            })
          }
        />
      );
    },
  };
}

/**
 * Render markdown for Workbench panes (notes, journal, spec/design/tasks columns).
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-6] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN]
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-5]
 */
export function MinimalMarkdown({
  content,
  hideTitle = false,
  density = "default",
  scale,
  sourceLineOffset = 0,
  onCheckboxToggle,
  renderAfterHeading,
}: {
  content: string;
  hideTitle?: boolean;
  /** `"relaxed"` gives a warmer, paper-like reading rhythm (looser leading). */
  density?: "default" | "relaxed";
  /** Body text size step (reading preview only). Overrides the density base size. */
  scale?: ReadingSize;
  /** Number of source lines before `content` when rendering a sliced section. */
  sourceLineOffset?: number;
  onCheckboxToggle?: (target: MarkdownCheckboxToggle) => void;
  renderAfterHeading?: MarkdownHeadingActionRenderer;
}) {
  const cleaned = useMemo(() => {
    const readable = cleanMarkdownForReading(content);
    return hideTitle ? removeLeadingH1(readable) : readable;
  }, [content, hideTitle]);
  const checkboxTargets = useMemo<CheckboxTargets>(
    () => ({
      tasks: collectTaskCheckboxTargets(content, sourceLineOffset),
      sessionCells: collectWorkSessionCheckboxTargets(content, sourceLineOffset),
    }),
    [content, sourceLineOffset],
  );
  const markdownComponents = createComponents(
    checkboxTargets,
    onCheckboxToggle,
    renderAfterHeading,
  );
  // Leading from density; base size from `scale` when provided (reading preview),
  // else the density default. Both override the per-element classes via descendant
  // selectors only when explicitly opted in.
  const leadingClass =
    density === "relaxed"
      ? "[&_p]:my-4 [&_p]:leading-7 [&_li]:leading-7 [&_blockquote]:leading-7"
      : "";
  const sizeClass = scale
    ? readingBodyScaleClass(scale)
    : density === "relaxed"
      ? "text-[15px]"
      : "text-sm";
  return (
    <div
      className={`min-w-0 max-w-full overflow-hidden text-foreground [overflow-wrap:anywhere] ${sizeClass} ${leadingClass}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkTidyThematicBreaks]}
        components={markdownComponents}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
