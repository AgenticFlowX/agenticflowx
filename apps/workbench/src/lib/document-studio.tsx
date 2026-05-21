/**
 * Shared document studio reader for AFX markdown surfaces.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-4] [FR-7] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-READER] [DES-DOCS-STUDIO] [DES-DOCS-MARKDOWN]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-12]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 */
import { useMemo } from "react";

import { CircleAlert, ListChecks, Target, WandSparkles } from "lucide-react";

import type { DocumentRow } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { cn } from "@afx/ui/lib/utils";

import { extractOutline } from "./document-outline";
import { parseSimpleFrontmatter } from "./frontmatter";
import { cleanInlineTraceTokens, cleanMarkdownForReading } from "./markdown-cleanup";
import { MinimalMarkdown } from "./markdown-render";

export interface DocumentStudioAction {
  label: string;
  command: string;
  description?: string;
}

interface DocumentStudioProps {
  doc: DocumentRow;
  content: string | undefined;
  variant?: "full" | "column";
  actions?: DocumentStudioAction[];
  onCommand?: (command: string) => void;
  className?: string;
}

export function DocumentStudio({
  doc,
  content,
  variant = "full",
  actions = [],
  onCommand,
  className,
}: DocumentStudioProps) {
  const compact = variant === "column";
  const frontmatter = useMemo(() => (content ? parseSimpleFrontmatter(content) : {}), [content]);
  const outline = useMemo(() => (content ? extractOutline(content) : []), [content]);
  const quality = useMemo(
    () => summarizeDocumentQuality(doc, content, frontmatter, outline),
    [content, doc, frontmatter, outline],
  );
  const studioSections = useMemo(() => extractStudioSections(content), [content]);
  const title = documentTitle(doc, content);

  if (!content) {
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <article
      className={cn(
        "mx-auto flex w-full min-w-0 max-w-full flex-col overflow-hidden",
        compact ? "max-w-[76ch] gap-3 px-3 py-3" : "max-w-5xl gap-4 px-5 py-5",
        className,
      )}
    >
      <section
        className={cn(
          "grid min-w-0 max-w-full gap-3 overflow-hidden border-b border-border",
          compact ? "pb-3" : "pb-4 xl:grid-cols-[minmax(0,1fr)_260px]",
        )}
      >
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-afx-brand-soft">
            PRD Studio
          </p>
          <h1
            className={cn(
              "mt-1 max-w-full break-words font-semibold leading-tight tracking-normal text-foreground [overflow-wrap:anywhere]",
              compact ? "text-lg" : "text-2xl",
            )}
          >
            {title}
          </h1>
          {quality.summary ? (
            <p
              className={cn(
                "mt-3 max-w-full break-words leading-6 text-muted-foreground [overflow-wrap:anywhere]",
                compact ? "text-sm" : "text-sm",
              )}
            >
              {quality.summary}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "grid min-w-0 max-w-full gap-2",
            compact
              ? "grid-cols-[repeat(3,minmax(0,1fr))]"
              : "sm:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-1",
          )}
        >
          <StudioMetric icon={Target} label="Sections" value={`${outline.length}`} />
          <StudioMetric icon={ListChecks} label="Readiness" value={quality.scoreLabel} />
          <StudioMetric
            icon={CircleAlert}
            label="Needs eyes"
            value={`${quality.issues.length}`}
            accent={quality.issues.length > 0 ? "text-amber-400" : "text-afx-success"}
          />
        </div>
      </section>

      {actions.length > 0 ? (
        <DocumentActionRail actions={actions} onCommand={onCommand} compact={compact} />
      ) : null}

      {studioSections.length > 0 ? (
        <section
          className={cn(
            "grid min-w-0 max-w-full gap-2 overflow-hidden",
            compact ? "grid-cols-1" : "md:grid-cols-2",
          )}
          aria-label="PRD section highlights"
        >
          {studioSections.map((section) => (
            <div
              key={`${section.heading}-${section.excerpt}`}
              className="min-w-0 overflow-hidden rounded-md border border-border bg-muted/15 p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={`size-1.5 shrink-0 rounded-full ${section.tone}`} aria-hidden />
                <p className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {section.heading}
                </p>
              </div>
              <p className="mt-2 break-words text-sm leading-6 text-foreground/90 [overflow-wrap:anywhere]">
                {section.excerpt}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="min-w-0 max-w-full overflow-hidden rounded-md border border-border/90 bg-background shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_28px_rgba(0,0,0,0.05)]">
        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border bg-muted/20 px-4 py-2">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Source document
          </span>
          <span className="min-w-0 flex-1 truncate text-right font-mono text-[10px] text-muted-foreground/70">
            {doc.filePath}
          </span>
        </div>
        <div
          className={cn("min-w-0 max-w-full overflow-hidden", compact ? "px-3 py-3" : "px-4 py-4")}
        >
          <MinimalMarkdown content={content} hideTitle />
        </div>
      </section>
    </article>
  );
}

function DocumentActionRail({
  actions,
  onCommand,
  compact,
}: {
  actions: DocumentStudioAction[];
  onCommand: ((command: string) => void) | undefined;
  compact: boolean;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-afx-brand/20 bg-afx-brand/5 px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className={cn("min-w-0", compact ? "w-full" : "mr-auto")}>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-afx-brand-soft">
            Next move
          </p>
          <p className="break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
            Send a focused AFX command to chat and shape the document from here.
          </p>
        </div>
        {actions.map((action) => (
          <Button
            key={action.command}
            type="button"
            variant="outline"
            size="xs"
            className="h-7 min-w-0 shrink-0 gap-1 text-[10px]"
            title={action.description ?? action.command}
            onClick={() => onCommand?.(action.command)}
          >
            <WandSparkles size={11} aria-hidden />
            <span className="truncate">{action.label}</span>
          </Button>
        ))}
      </div>
    </section>
  );
}

function StudioMetric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <Icon size={11} className="shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 truncate break-words text-sm font-semibold [overflow-wrap:anywhere]",
          accent ?? "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function documentTitle(doc: DocumentRow, content: string | undefined): string {
  if (content) {
    const heading = /^#\s+(.+)$/m.exec(content)?.[1]?.trim();
    if (heading) return cleanInlineTraceTokens(heading).trim();
  }
  return docDisplayName(doc).replace(/\.md$/i, "");
}

export function refineCommandFor(doc: DocumentRow): string {
  const target = featureFromPath(doc.filePath) ?? doc.filePath;
  if (doc.type === "DESIGN") return `/afx-design refine ${target}`;
  if (doc.type === "TASKS") return `/afx-task status ${target}`;
  if (doc.type === "JOURNAL") return `/afx-session recap ${target}`;
  return `/afx-spec refine ${target}`;
}

export function featureFromPath(filePath: string): string | null {
  const m = filePath.match(/^docs\/specs\/([^/]+)\//);
  return m?.[1] ?? null;
}

export function docDisplayName(doc: DocumentRow): string {
  const parts = doc.name.split("/");
  if (parts.length <= 1) return doc.name;
  if (parts[0] === "docs" && parts[1] === "specs" && parts.length >= 4) {
    return `${parts[2]} / ${parts[parts.length - 1]}`;
  }
  return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
}

export function formatShortDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function stringMeta(frontmatter: Record<string, unknown>, key: string): string | undefined {
  const value = frontmatter[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function summarizeDocumentQuality(
  doc: DocumentRow,
  content: string | undefined,
  frontmatter: Record<string, unknown>,
  outline: Array<{ text: string }>,
): { issues: string[]; scoreLabel: string; summary: string | null } {
  const issues: string[] = [];
  if (!stringMeta(frontmatter, "owner")) issues.push("Owner missing");
  if (!doc.status && !stringMeta(frontmatter, "status")) issues.push("Status missing");
  if (outline.length < 3) issues.push("Needs more sections");
  const lowered = content?.toLowerCase() ?? "";
  if ((doc.type === "SPEC" || doc.type === "DESIGN") && !lowered.includes("success")) {
    issues.push("Success metrics missing");
  }
  const summary = extractFirstParagraph(content);
  return {
    issues,
    scoreLabel: issues.length === 0 ? "Strong" : issues.length <= 2 ? "Needs pass" : "Drafty",
    summary,
  };
}

function extractFirstParagraph(content: string | undefined): string | null {
  if (!content) return null;
  const body = cleanMarkdownForReading(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("#") &&
        !line.startsWith("- ") &&
        !line.startsWith("|") &&
        !line.startsWith(">"),
    );
  return body[0] ? plainReaderLine(body[0]) : null;
}

export function extractStudioSections(
  content: string | undefined,
): Array<{ heading: string; excerpt: string; tone: string }> {
  if (!content) return [];
  const withoutFrontmatter = cleanMarkdownForReading(content);
  const matches = [
    ...withoutFrontmatter.matchAll(/^##\s+(.+)\n([\s\S]*?)(?=^##\s+|$(?![\s\S]))/gm),
  ];
  return matches
    .map((match) => {
      const heading = cleanInlineTraceTokens(match[1]?.trim() ?? "Section").trim();
      return {
        heading,
        excerpt: excerptFromMarkdownBlock(match[2] ?? ""),
        tone: sectionToneForHeading(heading),
      };
    })
    .filter((section) => section.excerpt.length > 0)
    .slice(0, 4);
}

function excerptFromMarkdownBlock(block: string): string {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith("#")) return false;
      if (/^\|?[\s:-]+\|[\s|:-]+$/.test(line)) return false;
      if (line.startsWith("|")) return false;
      return true;
    })
    .map((line) => plainReaderLine(line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "")))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 220);
}

export function plainReaderLine(line: string): string {
  return line
    .replace(/\*\*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function sectionToneForHeading(heading: string): string {
  const key = heading.toLowerCase();
  if (key.includes("problem") || key.includes("risk")) return "bg-amber-400";
  if (key.includes("requirement") || key.includes("acceptance")) return "bg-afx-brand";
  if (key.includes("goal") || key.includes("success")) return "bg-afx-success";
  if (key.includes("user") || key.includes("scope")) return "bg-purple-400";
  return "bg-muted-foreground/70";
}
