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
import { useMemo } from "react";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cleanMarkdownForReading, removeLeadingH1 } from "./markdown-cleanup";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 mt-1 min-w-0 max-w-full break-words text-lg font-semibold leading-tight tracking-normal first:mt-0 [overflow-wrap:anywhere]">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-7 flex min-w-0 max-w-full items-start gap-2 border-t border-border/70 pt-4 text-[15px] font-semibold leading-tight tracking-normal first:mt-0 first:border-t-0 first:pt-0">
      <span className="h-4 w-1 rounded-full bg-afx-brand/70" aria-hidden />
      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{children}</span>
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-5 min-w-0 max-w-full break-words text-sm font-semibold leading-tight text-foreground first:mt-0 [overflow-wrap:anywhere]">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-4 min-w-0 max-w-full break-words font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground first:mt-0 [overflow-wrap:anywhere]">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className="mb-1 mt-3 min-w-0 max-w-full break-words text-xs font-semibold first:mt-0 [overflow-wrap:anywhere]">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className="mb-1 mt-3 min-w-0 max-w-full break-words text-xs font-medium text-muted-foreground first:mt-0 [overflow-wrap:anywhere]">
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className="my-2.5 min-w-0 max-w-full break-words leading-6 text-foreground/90 first:mt-0 last:mb-0 [overflow-wrap:anywhere]">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2.5 min-w-0 max-w-full list-disc space-y-1 pl-5 marker:text-afx-brand/70">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2.5 min-w-0 max-w-full list-decimal space-y-1 pl-5 marker:text-muted-foreground/70">
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => {
    // Task-list items get role-based styling: drop bullet, tight row.
    const isTaskListItem =
      typeof (props as { className?: string }).className === "string" &&
      (props as { className?: string }).className!.includes("task-list-item");
    return (
      <li
        className={
          isTaskListItem
            ? "list-none -ml-5 flex min-w-0 items-start gap-2 break-words leading-6 [overflow-wrap:anywhere]"
            : "min-w-0 break-words leading-6 [overflow-wrap:anywhere]"
        }
      >
        {children}
      </li>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="my-3 min-w-0 max-w-full overflow-hidden break-words rounded-r-md border-l-2 border-afx-brand/50 bg-afx-brand/8 px-3 py-1.5 text-foreground/80 [overflow-wrap:anywhere]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-border/60" />,
  table: ({ children }) => (
    <div className="my-4 min-w-0 max-w-full overflow-x-auto rounded-md border border-border bg-background shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/70 text-foreground">{children}</thead>,
  tr: ({ children }) => (
    <tr className="border-b border-border/70 last:border-b-0 even:bg-muted/15">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="min-w-28 break-words px-3 py-2.5 align-top leading-5 text-foreground/85 [overflow-wrap:anywhere]">
      {children}
    </td>
  ),
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
        <code className="break-words rounded bg-muted/70 px-1 py-0.5 font-mono text-[0.88em] text-foreground [overflow-wrap:anywhere]">
          {children}
        </code>
      );
    }
    return (
      <pre className="my-3 min-w-0 max-w-full overflow-x-auto rounded-md border border-border bg-muted/45 p-3 font-mono text-[11px] leading-5 text-foreground/90">
        <code>{raw.replace(/\n$/, "")}</code>
      </pre>
    );
  },
  input: ({ checked, type }) => {
    if (type !== "checkbox") return null;
    return (
      <input
        type="checkbox"
        checked={checked ?? false}
        readOnly
        className="mt-1 size-3 shrink-0 cursor-default accent-afx-success"
      />
    );
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
}: {
  content: string;
  hideTitle?: boolean;
}) {
  const cleaned = useMemo(() => {
    const readable = cleanMarkdownForReading(content);
    return hideTitle ? removeLeadingH1(readable) : readable;
  }, [content, hideTitle]);
  return (
    <div className="min-w-0 max-w-full overflow-hidden text-sm text-foreground [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
