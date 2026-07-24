/**
 * Compact search, topology focus, and diagnostics surface for large canvases.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-34]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-ARCHITECTURE-EXPLORER]
 */
import { useMemo, useState } from "react";

import { ExternalLink, Search, ShieldAlert } from "lucide-react";

import {
  analyzeCanvasArchitecture,
  focusCanvasNeighborhood,
  searchCanvasNodes,
} from "@afx/canvas-engine";
import type { CanvasNode, JSONCanvas } from "@afx/shared";
import { Input } from "@afx/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";

export interface CanvasFocusRequest {
  nodeIds: string[];
  edgeIds: string[];
  isolate: boolean;
  sourceNodeId?: string;
}

export interface CanvasArchitectureExplorerProps {
  canvas: JSONCanvas;
  onFocus: (request: CanvasFocusRequest) => void;
  onClearFocus: () => void;
  onOpenSource?: (nodeId: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const NODE_TYPES: readonly { value: "all" | CanvasNode["type"]; label: string }[] = [
  { value: "all", label: "All items" },
  { value: "text", label: "Cards and notes" },
  { value: "file", label: "Files and specs" },
  { value: "link", label: "URLs" },
  { value: "group", label: "Frames" },
];

const VISIBLE_RESULT_LIMIT = 150;
const COMPLETE_RESULT_LIMIT = 10_000;

export function CanvasArchitectureExplorer({
  canvas,
  onFocus,
  onClearFocus,
  onOpenSource,
  open,
  onOpenChange,
}: CanvasArchitectureExplorerProps) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | CanvasNode["type"]>("all");
  const [rootUri, setRootUri] = useState("all");
  const [color, setColor] = useState("all");
  const [status, setStatus] = useState("all");
  const [hops, setHops] = useState<0 | 1 | 2 | 3>(1);
  const [isolate, setIsolate] = useState(false);
  const [tab, setTab] = useState<"find" | "diagnostics">("find");
  const [focusedItem, setFocusedItem] = useState<{ id: string; title: string }>();
  const analysis = useMemo(() => analyzeCanvasArchitecture(canvas), [canvas]);
  const roots = useMemo(() => sourceRoots(canvas), [canvas]);
  const colors = useMemo(
    () =>
      [...new Set((canvas.nodes ?? []).map((node) => node.color).filter(isString))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [canvas],
  );
  const statuses = useMemo(
    () =>
      [
        ...new Set(
          (canvas.nodes ?? [])
            .map((node) => (node.type === "file" ? node.afxSpec?.status : undefined))
            .filter(isString),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [canvas],
  );
  const allResults = useMemo(
    () =>
      searchCanvasNodes(canvas, {
        query,
        ...(type === "all" ? {} : { types: [type] }),
        ...(rootUri === "all" ? {} : { rootUris: [rootUri] }),
        ...(color === "all" ? {} : { colors: [color] }),
        ...(status === "all" ? {} : { statuses: [status] }),
        limit: COMPLETE_RESULT_LIMIT,
      }),
    [canvas, color, query, rootUri, status, type],
  );
  const results = allResults.slice(0, VISIBLE_RESULT_LIMIT);

  const focusNode = (nodeId: string, title = nodeId): void => {
    const neighborhood = focusCanvasNeighborhood(canvas, [nodeId], hops);
    setFocusedItem({ id: nodeId, title });
    onFocus({ ...neighborhood, isolate, sourceNodeId: nodeId });
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Explore canvas architecture"
          title="Explore canvas architecture"
          className="relative rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search size={13} />
          {analysis.diagnostics.some((item) => item.severity === "error") ? (
            <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-destructive" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(24rem,calc(100vw-1rem))] gap-2 p-2"
        aria-label="Canvas architecture explorer"
      >
        <div className="flex items-center gap-1 border-b pb-1">
          <button
            type="button"
            aria-pressed={tab === "find"}
            className={tabButton(tab === "find")}
            onClick={() => setTab("find")}
          >
            Find
          </button>
          <button
            type="button"
            aria-pressed={tab === "diagnostics"}
            className={tabButton(tab === "diagnostics")}
            onClick={() => setTab("diagnostics")}
          >
            Diagnostics ({analysis.diagnostics.length})
          </button>
          <span className="ml-auto text-[9px] text-muted-foreground">
            {analysis.nodes} nodes · {analysis.components} components
          </span>
        </div>

        {tab === "find" ? (
          <>
            <Input
              autoFocus
              aria-label="Search canvas nodes"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, content, paths…"
            />
            <div className="grid grid-cols-2 gap-1">
              <select
                aria-label="Canvas node type"
                value={type}
                onChange={(event) => setType(event.target.value as typeof type)}
                className="rounded-sm border bg-background px-1.5 py-1 text-[10px]"
              >
                {NODE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Relationship depth"
                value={hops}
                onChange={(event) => setHops(Number(event.target.value) as typeof hops)}
                className="rounded-sm border bg-background px-1.5 py-1 text-[10px]"
              >
                <option value={0}>Item only</option>
                <option value={1}>1 hop</option>
                <option value={2}>2 hops</option>
                <option value={3}>3 hops</option>
              </select>
              {roots.length > 0 ? (
                <select
                  aria-label="Workspace source"
                  value={rootUri}
                  onChange={(event) => setRootUri(event.target.value)}
                  className="rounded-sm border bg-background px-1.5 py-1 text-[10px]"
                >
                  <option value="all">All workspace roots</option>
                  {roots.map((root) => (
                    <option key={root.uri} value={root.uri}>
                      {root.label}
                    </option>
                  ))}
                </select>
              ) : null}
              {colors.length > 0 ? (
                <select
                  aria-label="Canvas color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="rounded-sm border bg-background px-1.5 py-1 text-[10px]"
                >
                  <option value="all">All colors</option>
                  {colors.map((value) => (
                    <option key={value} value={value}>
                      Color {value}
                    </option>
                  ))}
                </select>
              ) : null}
              {statuses.length > 0 ? (
                <select
                  aria-label="Spec status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="rounded-sm border bg-background px-1.5 py-1 text-[10px]"
                >
                  <option value="all">All statuses</option>
                  {statuses.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-[10px]">
              <input
                type="checkbox"
                checked={isolate}
                onChange={(event) => setIsolate(event.target.checked)}
              />
              Isolate the focused neighborhood
            </label>
            <div className="flex items-center justify-between gap-2 px-1 text-[9px] text-muted-foreground">
              <span>Current canvas</span>
              <span role="status" aria-live="polite">
                {allResults.length > results.length
                  ? `Showing ${results.length} of ${allResults.length} matches`
                  : `${allResults.length} match${allResults.length === 1 ? "" : "es"}`}
              </span>
            </div>
            <div className="max-h-[min(42vh,19rem)] overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-2 py-5 text-center text-[10px] text-muted-foreground">
                  No matching canvas item.
                </p>
              ) : (
                <ul className="space-y-0.5" aria-label="Canvas search results">
                  {results.map((result) => (
                    <li key={result.nodeId} className="flex items-stretch gap-0.5">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => focusNode(result.nodeId, result.title)}
                      >
                        <span className="mt-0.5 rounded-sm border px-1 text-[8px] uppercase text-muted-foreground">
                          {result.type}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px]">{result.title}</span>
                          <span className="block truncate text-[9px] text-muted-foreground">
                            {result.detail || `${result.degree} relationships`}
                          </span>
                        </span>
                        <span className="text-right text-[8px] text-muted-foreground">
                          {result.status ? <span className="block">{result.status}</span> : null}
                          <span className="block">{result.degree} links</span>
                        </span>
                      </button>
                      {result.type === "file" && onOpenSource ? (
                        <button
                          type="button"
                          aria-label={`Open ${result.title} source`}
                          title={`Open ${result.title} source`}
                          className="shrink-0 self-stretch rounded-sm px-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => onOpenSource(result.nodeId)}
                        >
                          <ExternalLink size={11} />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="max-h-[min(46vh,21rem)] overflow-y-auto">
            {analysis.diagnostics.length === 0 ? (
              <p className="px-2 py-5 text-center text-[10px] text-muted-foreground">
                No structural issues detected.
              </p>
            ) : (
              <ul className="space-y-1" aria-label="Canvas diagnostics">
                {analysis.diagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.code}:${diagnostic.itemIds.join(":")}:${index}`}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 rounded-sm border p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => {
                        const available = new Set((canvas.nodes ?? []).map((node) => node.id));
                        const nodeIds = diagnostic.itemIds.filter((id) => available.has(id));
                        if (nodeIds.length === 0) return;
                        const neighborhood = focusCanvasNeighborhood(canvas, nodeIds, 0);
                        setFocusedItem({ id: nodeIds[0], title: nodeIds[0] });
                        onFocus({ ...neighborhood, isolate: false, sourceNodeId: nodeIds[0] });
                      }}
                    >
                      <ShieldAlert
                        size={12}
                        className={
                          diagnostic.severity === "error"
                            ? "text-destructive"
                            : diagnostic.severity === "warning"
                              ? "text-amber-500"
                              : "text-muted-foreground"
                        }
                      />
                      <span className="text-[10px] leading-4">{diagnostic.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {focusedItem ? (
          <nav
            aria-label="Canvas focus breadcrumb"
            className="flex min-w-0 items-center gap-1 border-t pt-1 text-[9px] text-muted-foreground"
          >
            <button
              type="button"
              className="shrink-0 rounded-sm px-1 py-0.5 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setFocusedItem(undefined);
                onClearFocus();
              }}
            >
              Whole canvas
            </button>
            <span aria-hidden="true">›</span>
            <span className="min-w-0 truncate" title={focusedItem.title}>
              {focusedItem.title}
            </span>
            <span className="ml-auto shrink-0">{hops === 0 ? "item" : `${hops}-hop focus`}</span>
          </nav>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

interface CanvasSourceRoot {
  uri: string;
  label: string;
}

function sourceRoots(canvas: JSONCanvas): CanvasSourceRoot[] {
  const roots = new Map<string, string>();
  for (const node of canvas.nodes ?? []) {
    if (node.type !== "file" || !node.afxSource?.rootUri) continue;
    const existing = roots.get(node.afxSource.rootUri);
    const label = node.afxSource.rootName?.trim() || node.afxSource.rootUri;
    if (!existing || label.localeCompare(existing) < 0) roots.set(node.afxSource.rootUri, label);
  }
  const labelCounts = new Map<string, number>();
  for (const label of roots.values()) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  return [...roots]
    .map(([uri, label]) => ({
      uri,
      label: (labelCounts.get(label) ?? 0) > 1 ? `${label} · ${uri}` : label,
    }))
    .sort(
      (left, right) => left.label.localeCompare(right.label) || left.uri.localeCompare(right.uri),
    );
}

function isString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function tabButton(active: boolean): string {
  return `rounded-sm px-2 py-1 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"}`;
}
