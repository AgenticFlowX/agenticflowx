/**
 * Markdown renderer for Workbench previews — react-markdown + remark-gfm so
 * spec/design/tasks tables, task checkboxes, links, numbered lists render
 * correctly. Frontmatter is stripped before render.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-4] [FR-8] [FR-10]
 * @see docs/specs/220-app-workbench/design.md [DES-DOCS] [DES-NOTES]
 */
import { useMemo } from "react";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---[\s\S]*?---\s*/m, "");
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-1 text-[15px] font-semibold leading-tight tracking-tight first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-6 border-b border-border pb-1.5 text-sm font-semibold leading-tight tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-5 text-[13px] font-semibold leading-tight first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground first:mt-0">
      {children}
    </h4>
  ),
  h5: ({ children }) => <h5 className="mb-1 mt-3 text-xs font-semibold first:mt-0">{children}</h5>,
  h6: ({ children }) => (
    <h6 className="mb-1 mt-3 text-xs font-medium text-muted-foreground first:mt-0">{children}</h6>
  ),
  p: ({ children }) => <p className="my-2.5 leading-6 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2.5 list-disc space-y-1 pl-5 marker:text-muted-foreground/60">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2.5 list-decimal space-y-1 pl-5 marker:text-muted-foreground/60">
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
          isTaskListItem ? "list-none -ml-5 flex items-start gap-2 leading-6" : "leading-6"
        }
      >
        {children}
      </li>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-afx-brand/40 bg-muted/30 px-3 py-1.5 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-border/60" />,
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-2 py-1.5 font-medium">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-2 py-1.5 align-top">{children}</td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-afx-brand underline underline-offset-2 decoration-afx-brand/40 hover:text-afx-brand-soft hover:decoration-afx-brand-soft"
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
        <code className="rounded bg-muted/70 px-1 py-0.5 font-mono text-[0.88em] text-foreground">
          {children}
        </code>
      );
    }
    return (
      <pre className="my-3 max-w-full overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-5 text-foreground/90">
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
 * @see docs/specs/220-app-workbench/spec.md [FR-4] [FR-8] [FR-10]
 * @see docs/specs/220-app-workbench/design.md [DES-DOCS] [DES-NOTES]
 */
export function MinimalMarkdown({ content }: { content: string }) {
  const stripped = useMemo(() => stripFrontmatter(content), [content]);
  return (
    <div className="max-w-none text-sm text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {stripped}
      </ReactMarkdown>
    </div>
  );
}
