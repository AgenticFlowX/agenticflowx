/**
 * Compact progressive-disclosure controls for Canvas profiles and commands.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-43] [FR-44]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-PROFILES]
 */
import { useMemo, useState } from "react";

import { Command, Search } from "lucide-react";

import { Input } from "@afx/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";

import {
  CANVAS_PROFILES,
  type CanvasCapabilities,
  type CanvasCommandCategory,
  type CanvasCommandId,
  type CanvasProfile,
  canvasCommands,
  canvasProfileLabel,
} from "./canvas-command-registry";

const COMMAND_MENU_SHORTCUT = /mac/i.test(globalThis.navigator?.platform ?? "") ? "⌘K" : "Ctrl+K";

export interface CanvasCommandMenuProps {
  profile: CanvasProfile;
  capabilities: CanvasCapabilities;
  onProfileChange: (profile: CanvasProfile) => void;
  onCommand: (command: CanvasCommandId) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CanvasCommandMenu({
  profile,
  capabilities,
  onProfileChange,
  onCommand,
  open: controlledOpen,
  onOpenChange,
}: CanvasCommandMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean): void => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState("");
  const commands = useMemo(
    () => canvasCommands(profile, capabilities, query),
    [capabilities, profile, query],
  );
  const groups = useMemo(() => groupCommands(commands), [commands]);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <label
        className="text-[10px] text-muted-foreground @max-[46rem]/dtb:sr-only"
        htmlFor="canvas-profile"
      >
        Tools
      </label>
      <select
        id="canvas-profile"
        aria-label="Canvas tools profile"
        title="Choose which canvas tools are promoted in the toolbar and command menu. Switching never changes the document."
        value={profile}
        onChange={(event) => onProfileChange(event.target.value as CanvasProfile)}
        className="h-6 max-w-32 shrink-0 rounded-sm border bg-background px-1.5 text-[10px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {CANVAS_PROFILES.map((item) => (
          <option key={item} value={item}>
            {canvasProfileLabel(item)}
          </option>
        ))}
      </select>

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Search Canvas commands"
            title={`Search Canvas commands (${COMMAND_MENU_SHORTCUT})`}
            className="flex shrink-0 items-center gap-1 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Command size={13} />
            <kbd className="rounded-sm border px-1 text-[8px] @max-[46rem]/dtb:hidden">
              {COMMAND_MENU_SHORTCUT}
            </kbd>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(23rem,calc(100vw-1rem))] gap-2 p-2"
          aria-label="Canvas command menu"
        >
          <div className="relative">
            <Search
              aria-hidden="true"
              size={13}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoFocus
              aria-label="Find a Canvas command"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find any Canvas command…"
              className="pl-7"
            />
          </div>
          <p className="px-1 text-[10px] text-muted-foreground">
            {query
              ? "Search includes tools from every profile."
              : `${canvasProfileLabel(profile)} tools — search to find advanced commands.`}
          </p>
          <div className="max-h-[min(45vh,20rem)] overflow-y-auto pr-0.5">
            {groups.length === 0 ? (
              <p className="px-2 py-4 text-center text-muted-foreground">No matching command.</p>
            ) : (
              groups.map(([category, items]) => (
                <section key={category} aria-labelledby={`canvas-command-${category}`}>
                  <h3
                    id={`canvas-command-${category}`}
                    className="sticky top-0 bg-popover px-1 pb-1 pt-2 text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {category}
                  </h3>
                  <div className="space-y-0.5">
                    {items.map((command) => (
                      <button
                        key={command.id}
                        type="button"
                        disabled={!command.available}
                        title={command.unavailableReason}
                        className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
                        onClick={() => {
                          onCommand(command.id);
                          setOpen(false);
                        }}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1 text-[11px] text-foreground">
                            <span className="truncate">{command.label}</span>
                            {!command.promoted ? (
                              <span className="rounded-sm border px-1 text-[8px] uppercase text-muted-foreground">
                                {canvasProfileLabel(command.promotedIn[0] ?? "essentials")}
                              </span>
                            ) : null}
                          </span>
                          <span className="line-clamp-2 text-[9px] leading-4 text-muted-foreground">
                            {command.unavailableReason ?? command.description}
                          </span>
                        </span>
                        {command.shortcut ? (
                          <kbd className="mt-0.5 shrink-0 rounded-sm border px-1 text-[8px] text-muted-foreground">
                            {command.shortcut}
                          </kbd>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function groupCommands<T extends { category: CanvasCommandCategory }>(
  commands: readonly T[],
): Array<[CanvasCommandCategory, T[]]> {
  const grouped = new Map<CanvasCommandCategory, T[]>();
  for (const command of commands) {
    const items = grouped.get(command.category) ?? [];
    items.push(command);
    grouped.set(command.category, items);
  }
  return [...grouped.entries()];
}
