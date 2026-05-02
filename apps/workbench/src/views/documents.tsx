/**
 * Documents view — browse & preview spec/design/tasks/journal markdown files.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-8] [FR-11]
 * @see docs/specs/220-app-workbench/design.md [DES-DOCS]
 */
import { useEffect, useMemo, useState } from "react";

import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  Files,
  Folder,
  Library,
} from "lucide-react";

import type { DocumentRow, WorkbenchInbound } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@afx/ui/components/empty";
import { Input } from "@afx/ui/components/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@afx/ui/components/resizable";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@afx/ui/components/select";
import { Separator } from "@afx/ui/components/separator";
import { cn } from "@afx/ui/lib/utils";

import { useWorkbench } from "../context/workbench-context";
import { workbenchOn } from "../lib/bridge";
import { extractOutline } from "../lib/document-outline";
import { isRenderable } from "../lib/documents";
import { extractMetaChips, parseSimpleFrontmatter } from "../lib/frontmatter";
import { MinimalMarkdown } from "../lib/markdown-render";
import { OpenActions } from "../lib/open-actions";

const TYPE_OPTIONS = ["all", "SPEC", "DESIGN", "TASKS", "JOURNAL", "ADR", "RES"];

interface TypeChip {
  type: string;
  label: string;
  className: string;
}

const TYPE_CHIPS: TypeChip[] = [
  { type: "SPEC", label: "Spec", className: "text-afx-brand" },
  { type: "DESIGN", label: "Design", className: "text-purple-400" },
  { type: "TASKS", label: "Tasks", className: "text-afx-success" },
  { type: "JOURNAL", label: "Journal", className: "text-amber-400" },
  { type: "ADR", label: "ADR", className: "text-blue-400" },
  { type: "RES", label: "Research", className: "text-muted-foreground" },
];
const OUTLINE_INDENT_CLASS: Record<number, string> = {
  1: "pl-0",
  2: "pl-2",
  3: "pl-4",
  4: "pl-6",
  5: "pl-8",
  6: "pl-10",
};
const TREE_INDENT_CLASS: Record<number, string> = {
  0: "pl-2",
  1: "pl-5",
  2: "pl-8",
  3: "pl-11",
  4: "pl-14",
  5: "pl-16",
};

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  doc?: DocumentRow;
}

function buildDocumentTree(docs: DocumentRow[]): TreeNode {
  const root: TreeNode = { name: "docs", path: "docs", children: new Map() };
  for (const doc of docs) {
    const parts = doc.filePath.replace(/^docs\//, "").split("/");
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? "";
      const path = `${cursor.path}/${part}`;
      let next = cursor.children.get(part);
      if (!next) {
        next = { name: part, path, children: new Map() };
        cursor.children.set(part, next);
      }
      if (i === parts.length - 1) next.doc = doc;
      cursor = next;
    }
  }
  return root;
}

export default function Documents() {
  const { documents, send } = useWorkbench();
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ docs: true });

  useEffect(() => {
    const off = workbenchOn("afxDocContent", (msg) => {
      setContent((prev) => ({ ...prev, [msg.filePath]: msg.content }));
    });
    return off;
  }, []);

  useEffect(() => {
    if (selected && !content[selected.filePath]) {
      send({ type: "afxFetchDocContent", filePath: selected.filePath });
    }
  }, [selected, content, send]);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.filePath.toLowerCase().includes(q) ||
        (d.excerpt?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [documents, query, typeFilter]);
  const tree = useMemo(() => buildDocumentTree(filtered), [filtered]);

  if (documents.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Files />
          </EmptyMedia>
          <EmptyTitle>No documents found</EmptyTitle>
          <EmptyDescription>
            AFX documents live in docs/specs/. Create one with /afx-scaffold spec my-feature.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 overflow-hidden">
      <ResizablePanel defaultSize="32%" minSize="20%">
        <div className="afx-surface-subtle flex h-full min-h-0 flex-col border-r border-border">
          <div className="afx-surface-toolbar flex flex-col gap-2 border-b border-border p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents…"
              className="afx-field-surface h-8 text-sm"
              aria-label="Search documents"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === "all" ? "All types" : t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <DocumentTree
              node={tree}
              selectedPath={selected?.filePath}
              expanded={expanded}
              onToggle={(path) => setExpanded((prev) => ({ ...prev, [path]: !prev[path] }))}
              onSelect={(doc) =>
                isRenderable(doc)
                  ? setSelected(doc)
                  : send({ type: "afxOpenFile", path: doc.filePath, mode: "editor" })
              }
            />
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize="68%" minSize="40%">
        {selected ? (
          <DocReader
            doc={selected}
            content={content[selected.filePath]}
            onBack={() => setSelected(null)}
          />
        ) : (
          <DocumentsHome
            documents={documents}
            onSelect={setSelected}
            onTypeFilter={setTypeFilter}
          />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function DocumentsHome({
  documents,
  onSelect,
  onTypeFilter,
}: {
  documents: DocumentRow[];
  onSelect: (doc: DocumentRow) => void;
  onTypeFilter: (type: string) => void;
}) {
  const stats = useMemo(() => computeStats(documents), [documents]);
  const recent = useMemo(() => recentDocs(documents, 6), [documents]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="afx-surface-toolbar flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-afx-brand/10 text-afx-brand">
            <Library size={14} />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium leading-tight">Knowledge base</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {stats.total} {stats.total === 1 ? "document" : "documents"} · {stats.features}{" "}
              {stats.features === 1 ? "feature" : "features"}
              {stats.lastActivity ? ` · last activity ${stats.lastActivity}` : ""}
            </span>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          Library mode
        </Badge>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          {/* Type chip strip */}
          <div className="flex flex-wrap gap-1.5">
            {TYPE_CHIPS.map((chip) => {
              const count = stats.byType[chip.type] ?? 0;
              const disabled = count === 0;
              return (
                <button
                  key={chip.type}
                  type="button"
                  disabled={disabled}
                  onClick={() => onTypeFilter(chip.type)}
                  className={cn(
                    "afx-surface-card flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs transition-colors",
                    disabled ? "opacity-50" : "hover:border-afx-brand/40 hover:bg-accent/40",
                  )}
                  aria-label={`Filter by ${chip.label}`}
                >
                  <span className={cn("size-1.5 rounded-full bg-current", chip.className)} />
                  <span>{chip.label}</span>
                  <span className="font-mono text-foreground">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Recently updated */}
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Recently updated
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {recent.length}/{stats.total}
              </span>
            </div>
            {recent.length === 0 ? (
              <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                No activity yet — pick a doc on the left to start reading.
              </p>
            ) : (
              <ul className="afx-surface-card flex flex-col divide-y divide-border/60 overflow-hidden rounded-md border border-border">
                {recent.map((doc) => (
                  <li key={doc.filePath}>
                    <button
                      type="button"
                      onClick={() => onSelect(doc)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {docDisplayName(doc)}
                        </span>
                        {doc.excerpt ? (
                          <span className="truncate text-[11px] text-muted-foreground">
                            {doc.excerpt}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-muted-foreground/70">
                            {doc.filePath}
                          </span>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 px-1.5 text-[10px]",
                          chipForType(doc.type)?.className,
                        )}
                      >
                        {doc.type}
                      </Badge>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {formatShortDate(doc.updatedAt) ?? "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Stats footer */}
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile label="AFX docs" value={stats.afxCount} />
            <StatTile label="External" value={stats.total - stats.afxCount} />
            <StatTile label="Features" value={stats.features} />
            <StatTile
              label="Drafts"
              value={stats.drafts}
              accent={stats.drafts > 0 ? "text-amber-400" : undefined}
            />
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="afx-surface-card rounded-md border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn("font-mono text-sm font-semibold leading-tight", accent ?? "text-foreground")}
      >
        {value}
      </div>
    </div>
  );
}

function chipForType(type: string): TypeChip | undefined {
  return TYPE_CHIPS.find((c) => c.type === type);
}

function computeStats(docs: DocumentRow[]): {
  total: number;
  afxCount: number;
  drafts: number;
  features: number;
  byType: Record<string, number>;
  lastActivity: string | null;
} {
  const byType: Record<string, number> = {};
  let drafts = 0;
  let afxCount = 0;
  const featureSet = new Set<string>();
  let newestMs = 0;
  for (const d of docs) {
    byType[d.type] = (byType[d.type] ?? 0) + 1;
    if (d.isAfx) afxCount += 1;
    if (d.status?.toLowerCase() === "draft") drafts += 1;
    const feature = featureFromPath(d.filePath);
    if (feature) featureSet.add(feature);
    if (d.updatedAt) {
      const t = Date.parse(d.updatedAt);
      if (Number.isFinite(t) && t > newestMs) newestMs = t;
    }
  }
  return {
    total: docs.length,
    afxCount,
    drafts,
    features: featureSet.size,
    byType,
    lastActivity: newestMs > 0 ? formatRelative(newestMs) : null,
  };
}

function recentDocs(docs: DocumentRow[], n: number): DocumentRow[] {
  return [...docs]
    .filter((d) => !!d.updatedAt)
    .sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!))
    .slice(0, n);
}

function featureFromPath(filePath: string): string | null {
  const m = filePath.match(/^docs\/specs\/([^/]+)\//);
  return m?.[1] ?? null;
}

function docDisplayName(doc: DocumentRow): string {
  const parts = doc.name.split("/");
  if (parts.length <= 1) return doc.name;
  if (parts[0] === "docs" && parts[1] === "specs" && parts.length >= 4) {
    return `${parts[2]} / ${parts[parts.length - 1]}`;
  }
  return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
}

function formatShortDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  const hr = Math.floor(diff / 3_600_000);
  const day = Math.floor(diff / 86_400_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function DocumentTree({
  node,
  selectedPath,
  expanded,
  onToggle,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  selectedPath?: string;
  expanded: Record<string, boolean>;
  onToggle: (path: string) => void;
  onSelect: (doc: DocumentRow) => void;
  depth?: number;
}) {
  const children = [...node.children.values()].sort((a, b) => {
    if (!!a.doc !== !!b.doc) return a.doc ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  const isOpen = expanded[node.path] ?? depth < 1;

  if (node.doc) {
    const selected = selectedPath === node.doc.filePath;
    return (
      <button
        type="button"
        onClick={() => onSelect(node.doc!)}
        className={`flex w-full cursor-pointer items-center gap-1.5 px-2 py-1 text-left text-xs transition-colors hover:bg-accent/40 ${
          selected ? "border-l-2 border-l-afx-brand bg-accent/60 pl-1.5 text-foreground" : ""
        } ${TREE_INDENT_CLASS[depth] ?? "pl-16"}`}
      >
        <FileText size={13} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <Badge variant="outline" className="shrink-0 px-1 py-0 font-mono text-[9px]">
          {node.doc.type}
        </Badge>
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.path)}
        className={`flex w-full cursor-pointer items-center gap-1.5 px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground ${TREE_INDENT_CLASS[depth] ?? "pl-16"}`}
      >
        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Folder size={13} className="text-afx-brand-soft" />
        <span className="truncate font-medium">{node.name}</span>
      </button>
      {isOpen ? (
        <div>
          {children.map((child) => (
            <DocumentTree
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DocReader({
  doc,
  content,
  onBack,
}: {
  doc: DocumentRow;
  content: string | undefined;
  onBack?: () => void;
}) {
  const frontmatter = useMemo(() => (content ? parseSimpleFrontmatter(content) : {}), [content]);
  const chips = extractMetaChips(frontmatter);
  const outline = useMemo(() => (content ? extractOutline(content) : []), [content]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="afx-surface-toolbar flex flex-col gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onBack}
              className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              aria-label="Back to library"
            >
              <ArrowLeft size={12} />
              Library
            </Button>
          )}
          <h2 className="text-sm font-medium text-foreground">{doc.name}</h2>
          <span className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {doc.filePath}
          </span>
          <OpenActions filePath={doc.filePath} className="ml-auto" />
        </div>
        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {chips.map((c, i) => (
              <Badge key={`${c.kind}-${i}`} variant="outline" className="text-[10px]">
                {c.label}: {c.value}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_180px] overflow-hidden">
        <ScrollArea className="h-full min-h-0">
          <article className="mx-auto w-full max-w-4xl px-5 py-6">
            {content ? (
              <MinimalMarkdown content={content} />
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </article>
        </ScrollArea>
        <div className="afx-surface-subtle flex min-h-0 flex-col gap-2 border-l border-border p-3">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Outline
          </h3>
          <Separator />
          <ScrollArea className="flex-1">
            <ul className="flex flex-col gap-1">
              {outline.map((o) => (
                <li
                  key={`${o.line}-${o.slug}`}
                  className={`text-xs ${OUTLINE_INDENT_CLASS[o.level] ?? "pl-10"}`}
                >
                  {o.text}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// Re-export type so other files don't need the long import
export type { WorkbenchInbound };
