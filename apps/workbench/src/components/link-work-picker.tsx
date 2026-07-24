/**
 * Bounded multi-select picker for linking canonical AFX specs/tasks to a board.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-12] [FR-14] [NFR-7]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-LINK-WORK] [DES-BOARD-PORTABLE-LINK]
 */
import { type RefObject, useMemo, useRef, useState } from "react";

import { Check, Link2, Search } from "lucide-react";

import type { LinkedWorkItemCandidate, LinkedWorkItemRef } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@afx/ui/components/dialog";
import { Input } from "@afx/ui/components/input";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@afx/ui/components/select";

interface LinkWorkPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: LinkedWorkItemCandidate[];
  columns: Array<{ id: string; title: string }>;
  existingKeys: ReadonlySet<string>;
  onLink: (columnId: string, items: Array<{ ref: LinkedWorkItemRef; label: string }>) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Search, group, multi-select, and target-column selection stay inside a
 * viewport-bounded dialog so the footer remains reachable at sidebar widths.
 *
 * @see docs/specs/221-app-workbench-board/tasks.md [4.2]
 */
export function LinkWorkPicker({
  open,
  onOpenChange,
  candidates,
  columns,
  existingKeys,
  onLink,
  returnFocusRef,
}: LinkWorkPickerProps) {
  const [query, setQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [targetColumnId, setTargetColumnId] = useState(columns[0]?.id ?? "");
  const fallbackReturnFocusRef = useRef<HTMLElement | null>(null);

  const effectiveTargetColumnId = columns.some((column) => column.id === targetColumnId)
    ? targetColumnId
    : (columns[0]?.id ?? "");

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const groups = new Map<string, LinkedWorkItemCandidate[]>();
    for (const candidate of candidates) {
      if (
        normalized &&
        !`${candidate.label} ${candidate.group} ${candidate.status ?? ""}`
          .toLocaleLowerCase()
          .includes(normalized)
      ) {
        continue;
      }
      const group = groups.get(candidate.group) ?? [];
      group.push(candidate);
      groups.set(candidate.group, group);
    }
    return [...groups.entries()];
  }, [candidates, query]);

  const selectedItems = candidates.filter((candidate) => selectedKeys.has(candidate.key));

  function toggleCandidate(key: string): void {
    if (existingKeys.has(key)) return;
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function submit(): void {
    if (!effectiveTargetColumnId || selectedItems.length === 0) return;
    onLink(
      effectiveTargetColumnId,
      selectedItems.map(({ ref, label }) => ({ ref, label })),
    );
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setQuery("");
          setSelectedKeys(new Set());
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="flex max-h-[min(86vh,620px)] w-[calc(100vw-24px)] max-w-xl flex-col gap-3 overflow-hidden p-4 sm:w-full"
        onOpenAutoFocus={() => {
          fallbackReturnFocusRef.current =
            returnFocusRef?.current ??
            (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        }}
        onCloseAutoFocus={(event) => {
          const returnTarget = returnFocusRef?.current ?? fallbackReturnFocusRef.current;
          if (!returnTarget?.isConnected) return;
          event.preventDefault();
          returnTarget.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 size={15} className="text-afx-brand" />
            Link AFX work
          </DialogTitle>
          <DialogDescription>
            Add live specs or stable task sections. Their status remains owned by the source file.
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search
            size={13}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search specs and tasks"
            aria-label="Search linked work"
            className="afx-field-surface h-8 pl-8 text-xs"
          />
        </div>

        <ScrollArea
          className="min-h-0 flex-1 rounded-md border border-border"
          data-testid="link-work-results"
        >
          <div
            role="listbox"
            aria-label="Available AFX work"
            aria-multiselectable="true"
            className="p-1.5"
          >
            {filteredGroups.length ? (
              filteredGroups.map(([group, items]) => (
                <section key={group} aria-label={group} className="mb-2 last:mb-0">
                  <h3 className="sticky top-0 z-10 bg-background/95 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground backdrop-blur">
                    {group}
                  </h3>
                  {items.map((candidate) => {
                    const duplicate = existingKeys.has(candidate.key);
                    const checked = selectedKeys.has(candidate.key);
                    return (
                      <button
                        key={candidate.key}
                        type="button"
                        role="option"
                        aria-selected={checked}
                        aria-disabled={duplicate}
                        disabled={duplicate}
                        onClick={() => toggleCandidate(candidate.key)}
                        className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <span
                          aria-hidden
                          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center border ${
                            checked || duplicate
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input"
                          }`}
                        >
                          {checked || duplicate ? <Check size={11} /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-foreground">
                            {candidate.label}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>{candidate.ref.kind === "task" ? "Task" : "Spec"}</span>
                            {candidate.total > 0 ? (
                              <span>
                                {candidate.completed}/{candidate.total}
                              </span>
                            ) : null}
                            {candidate.status ? <span>{candidate.status}</span> : null}
                          </span>
                        </span>
                        {duplicate ? <Badge variant="outline">Linked</Badge> : null}
                      </button>
                    );
                  })}
                </section>
              ))
            ) : (
              <div className="px-3 py-10 text-center text-xs text-muted-foreground">
                No matching AFX work items.
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 gap-2 sm:items-end">
          <div className="mr-auto min-w-0 flex-1">
            <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Target column
            </label>
            <Select value={effectiveTargetColumnId} onValueChange={setTargetColumnId}>
              <SelectTrigger className="h-8 w-full max-w-56 text-xs" aria-label="Target column">
                <SelectValue placeholder="Choose column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    {column.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!effectiveTargetColumnId || selectedItems.length === 0}
          >
            Link {selectedItems.length || "work"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
