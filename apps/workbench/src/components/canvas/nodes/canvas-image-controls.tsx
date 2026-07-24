/**
 * Accessible authoring for inert, namespaced image presentation metadata.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [FR-23] [FR-36]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-INTERACTIONS] [DES-SEC]
 */
import { useState } from "react";

import { ImageIcon } from "lucide-react";

import type { CanvasFileNode } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";

type CanvasImageFit = "contain" | "cover";

interface CanvasImagePresentation {
  version: 1;
  fit: CanvasImageFit;
  alt?: string;
  caption?: string;
}

const DEFAULT_PRESENTATION: CanvasImagePresentation = { version: 1, fit: "contain" };
const ALT_TEXT_LIMIT = 240;
const CAPTION_LIMIT = 500;

/**
 * Read only the supported v1 image presentation contract; malformed extensions remain inert.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [FR-36]
 */
export function readCanvasImagePresentation(node: CanvasFileNode): CanvasImagePresentation {
  const media = recordValue(node.afxMedia);
  if (media?.version !== 1 || (media.fit !== "contain" && media.fit !== "cover")) {
    return DEFAULT_PRESENTATION;
  }
  const alt = safeText(media.alt, ALT_TEXT_LIMIT, false);
  const caption = safeText(media.caption, CAPTION_LIMIT, true);
  return {
    version: 1,
    fit: media.fit,
    ...(alt ? { alt } : {}),
    ...(caption ? { caption } : {}),
  };
}

/**
 * Selected-node popover for authoring portable image presentation metadata.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-23] [FR-36]
 */
export function CanvasImageControls({
  node,
  onUpdate,
}: {
  node: CanvasFileNode;
  onUpdate: (patch: Partial<CanvasFileNode>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fit, setFit] = useState<CanvasImageFit>("contain");
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");

  const changeOpen = (nextOpen: boolean): void => {
    if (nextOpen) {
      const presentation = readCanvasImagePresentation(node);
      setFit(presentation.fit);
      setAlt(presentation.alt ?? "");
      setCaption(presentation.caption ?? "");
    }
    setOpen(nextOpen);
  };

  const apply = (): void => {
    const source = recordValue(node.afxMedia);
    const nextMedia: Record<string, unknown> = { ...(source ?? {}), version: 1, fit };
    const nextAlt = safeText(alt, ALT_TEXT_LIMIT, false);
    const nextCaption = safeText(caption, CAPTION_LIMIT, true);
    if (nextAlt) nextMedia.alt = nextAlt;
    else delete nextMedia.alt;
    if (nextCaption) nextMedia.caption = nextCaption;
    else delete nextMedia.caption;
    onUpdate({ afxMedia: nextMedia });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Edit image presentation"
          title="Edit image presentation"
          className="nodrag rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ImageIcon size={12} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Image presentation"
        className="nodrag nowheel w-[min(20rem,calc(100vw-1rem))] p-2"
      >
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <div>
            <h2 className="text-xs font-medium">Image presentation</h2>
            <p className="text-[10px] leading-4 text-muted-foreground">
              Stored as optional AFX metadata; the file reference remains standard JSON Canvas.
            </p>
          </div>
          <label className="grid gap-0.5 text-[10px] text-muted-foreground">
            Fit
            <select
              aria-label="Image fit"
              value={fit}
              onChange={(event) => setFit(event.target.value as CanvasImageFit)}
              className="rounded-sm border bg-background px-1.5 py-1 text-xs text-foreground"
            >
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
            </select>
          </label>
          <label className="grid gap-0.5 text-[10px] text-muted-foreground">
            Alt text
            <input
              aria-label="Image alt text"
              value={alt}
              maxLength={ALT_TEXT_LIMIT}
              onChange={(event) => setAlt(event.target.value)}
              className="rounded-sm border bg-background px-1.5 py-1 text-xs text-foreground"
            />
          </label>
          <label className="grid gap-0.5 text-[10px] text-muted-foreground">
            Caption
            <textarea
              aria-label="Image caption"
              value={caption}
              maxLength={CAPTION_LIMIT}
              rows={3}
              onChange={(event) => setCaption(event.target.value)}
              className="resize-y rounded-sm border bg-background px-1.5 py-1 text-xs text-foreground"
            />
          </label>
          <div className="flex justify-end">
            <Button type="submit" size="xs" variant="outline">
              Apply image presentation
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeText(value: unknown, limit: number, multiline: boolean): string | undefined {
  if (typeof value !== "string") return undefined;
  const withoutControls = [...value].filter((char) => !isBlockedControlChar(char)).join("");
  const normalized = multiline
    ? withoutControls.replace(/\r\n?/g, "\n").trim()
    : withoutControls.replace(/\s+/g, " ").trim();
  return normalized.slice(0, limit) || undefined;
}

function isBlockedControlChar(value: string): boolean {
  const code = value.charCodeAt(0);
  return (
    (code >= 0x00 && code <= 0x08) ||
    code === 0x0b ||
    code === 0x0c ||
    (code >= 0x0e && code <= 0x1f) ||
    code === 0x7f
  );
}
