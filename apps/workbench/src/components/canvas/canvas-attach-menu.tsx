/**
 * Progressive attachment menu for portable files/URLs and AFX live sources.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-36] [FR-37]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-UI]
 */
import { useState } from "react";

import {
  FileImage,
  FileText,
  Files,
  LayoutDashboard,
  Link2,
  NotebookPen,
  Paperclip,
} from "lucide-react";

import type { WorkbenchSourceIdentity } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Input } from "@afx/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";

import type { CanvasProfile } from "./canvas-command-registry";

export interface CanvasAttachSource {
  id: string;
  label: string;
  kind: "note" | "board";
  source: WorkbenchSourceIdentity;
}

export interface CanvasAttachMenuProps {
  profile: CanvasProfile;
  sources?: readonly CanvasAttachSource[];
  onPickFiles: (kind: "any" | "image" | "markdown") => void;
  onAddUrl: (url: string) => void;
  onAttachSource: (source: CanvasAttachSource) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CanvasAttachMenu({
  profile,
  sources = [],
  onPickFiles,
  onAddUrl,
  onAttachSource,
  open: controlledOpen,
  onOpenChange,
}: CanvasAttachMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean): void => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string>();
  const visibleSources = profile === "afx" ? sources : [];

  const submitUrl = (): void => {
    const normalized = normalizeCanvasUrl(url);
    if (!normalized.ok) {
      setUrlError(normalized.message);
      return;
    }
    onAddUrl(normalized.url);
    setUrl("");
    setUrlError(undefined);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setUrlError(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Attach to canvas"
          title="Attach files, images, or URLs"
          className="shrink-0 rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Paperclip size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Canvas attachments"
        className="w-[min(24rem,calc(100vw-1rem))] space-y-2 p-2"
      >
        <div>
          <h2 className="text-xs font-medium">Attach a reference</h2>
          <p className="text-[10px] leading-4 text-muted-foreground">
            Files stay linked to the workspace. URLs remain standard JSON Canvas link cards.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <AttachmentButton
            icon={Files}
            label="Workspace files"
            onClick={() => {
              onPickFiles("any");
              setOpen(false);
            }}
          />
          <AttachmentButton
            icon={FileText}
            label="Markdown & specs"
            onClick={() => {
              onPickFiles("markdown");
              setOpen(false);
            }}
          />
          <AttachmentButton
            icon={FileImage}
            label="Images"
            onClick={() => {
              onPickFiles("image");
              setOpen(false);
            }}
          />
        </div>

        <form
          className="flex min-w-0 gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            submitUrl();
          }}
        >
          <div className="min-w-0 flex-1">
            <Input
              aria-label="URL to attach"
              placeholder="https://…"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setUrlError(undefined);
              }}
              aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? "canvas-url-error" : undefined}
            />
          </div>
          <Button type="submit" size="xs" variant="outline">
            <Link2 size={12} /> Add URL
          </Button>
        </form>
        {urlError ? (
          <p id="canvas-url-error" role="alert" className="text-[10px] text-destructive">
            {urlError}
          </p>
        ) : null}

        {visibleSources.length > 0 ? (
          <section className="border-t pt-2" aria-labelledby="canvas-afx-attachments">
            <h3
              id="canvas-afx-attachments"
              className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              Live AFX sources
            </h3>
            <div className="max-h-[min(35vh,14rem)] space-y-0.5 overflow-y-auto">
              {visibleSources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className="flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[11px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    onAttachSource(source);
                    setOpen(false);
                  }}
                >
                  {source.kind === "note" ? (
                    <NotebookPen size={12} className="shrink-0 text-afx-brand-soft" />
                  ) : (
                    <LayoutDashboard size={12} className="shrink-0 text-afx-brand-soft" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{source.label}</span>
                  <span className="shrink-0 text-[9px] uppercase text-muted-foreground">
                    {source.kind}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : profile === "afx" ? (
          <p className="border-t pt-2 text-[10px] text-muted-foreground">
            No AFX Notes or Boards are available in this workspace yet.
          </p>
        ) : sources.length > 0 ? (
          <p className="border-t pt-2 text-[10px] text-muted-foreground">
            {sources.length} live AFX {sources.length === 1 ? "source is" : "sources are"} available
            — switch Tools to “AFX integrations” to attach them.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export type NormalizedCanvasUrl = { ok: true; url: string } | { ok: false; message: string };

export function normalizeCanvasUrl(value: string): NormalizedCanvasUrl {
  const input = value.trim();
  if (!input) return { ok: false, message: "Enter a URL." };
  if (input.length > 2_048) return { ok: false, message: "The URL is too long." };
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, message: "Enter a complete http or https URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: "Only http and https URLs can be attached." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: "Remove credentials from the URL before attaching it." };
  }
  return { ok: true, url: parsed.toString() };
}

function AttachmentButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Files;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-sm border px-2 py-2 text-left text-[11px] hover:border-afx-brand/60 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      <Icon size={13} className="text-afx-brand-soft" />
      {label}
    </button>
  );
}
