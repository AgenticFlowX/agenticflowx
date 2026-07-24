/**
 * Live presentation for a Board card linked to an AFX spec or task section.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-13] [FR-15]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-LINK-WORK]
 */
import { useState } from "react";

import { AlertTriangle, ChevronDown, ExternalLink, LayoutDashboard, Newspaper } from "lucide-react";

import type { KanbanCard } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Checkbox } from "@afx/ui/components/checkbox";
import { Progress } from "@afx/ui/components/progress";

interface LinkedWorkItemProps {
  card: KanbanCard;
  disabled?: boolean;
  pendingFingerprints?: ReadonlySet<string>;
  onOpen: (mode: "editor" | "afxPreview") => void;
  onOpenStudio: () => void;
  onToggleTask: (fingerprint: string, completed: boolean) => void;
}

/**
 * Render source-owned status and checklist controls. Board movement remains a
 * separate concern and never changes source completion.
 *
 * @see docs/specs/221-app-workbench-board/tasks.md [4.3]
 */
export function LinkedWorkItem({
  card,
  disabled = false,
  pendingFingerprints = new Set(),
  onOpen,
  onOpenStudio,
  onToggleTask,
}: LinkedWorkItemProps) {
  const [expanded, setExpanded] = useState(false);
  const resolved = card.resolved;
  const link = card.link;
  if (!link) return null;

  if (!resolved || resolved.state === "unresolved") {
    return (
      <div className="space-y-2" data-testid="linked-work-unresolved">
        <div className="flex items-start gap-2 text-xs text-amber-500">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span>{resolved?.message ?? "Linked work has not resolved yet."}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs"
          onClick={() => onOpen("editor")}
        >
          <ExternalLink size={11} /> Open stored source
        </Button>
      </div>
    );
  }

  const progress = resolved.total ? Math.round((resolved.completed / resolved.total) * 100) : 0;
  const checklist = resolved.checklist ?? [];

  return (
    <div className="space-y-2" data-testid="linked-work-resolved">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 text-xs font-medium leading-5 text-foreground">
            {resolved.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[9px] uppercase">
              {link.kind}
            </Badge>
            {resolved.lifecycle ? (
              <span className="text-[10px] text-muted-foreground">{resolved.lifecycle}</span>
            ) : null}
            {resolved.total ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                {resolved.completed}/{resolved.total}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => onOpen("editor")}
            aria-label={`Open ${resolved.title} source`}
            title={`Open ${link.source.rootName}/${link.source.relativePath}`}
          >
            <ExternalLink size={11} />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => onOpen("afxPreview")}
            aria-label={`Preview ${resolved.title}`}
          >
            <Newspaper size={11} />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onOpenStudio}
            aria-label={`Open ${resolved.title} in SDD Studio`}
          >
            <LayoutDashboard size={11} />
          </Button>
        </div>
      </div>

      {resolved.total ? (
        <Progress
          value={progress}
          aria-label={`${resolved.completed} of ${resolved.total} checklist items complete`}
          className="h-1"
        />
      ) : null}

      {link.kind === "task" && checklist.length ? (
        <div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-1 text-[10px] text-muted-foreground"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            <ChevronDown
              size={11}
              className={`transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
            />
            Checklist
          </Button>
          {expanded ? (
            <ul
              className="mt-1 space-y-1.5 border-l border-border pl-2"
              aria-label={`${resolved.title} checklist`}
            >
              {checklist.map((item) => {
                const pending = pendingFingerprints.has(item.fingerprint);
                return (
                  <li key={item.fingerprint} className="flex items-start gap-2">
                    <Checkbox
                      checked={item.completed}
                      disabled={disabled || pending}
                      onCheckedChange={(checked) =>
                        onToggleTask(item.fingerprint, checked === true)
                      }
                      aria-label={`${item.completed ? "Reopen" : "Complete"} ${item.text}`}
                      className="mt-0.5"
                    />
                    <span
                      className={`text-[11px] leading-4 ${item.completed ? "text-muted-foreground line-through" : "text-foreground"}`}
                    >
                      {item.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
