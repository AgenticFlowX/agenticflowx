/**
 * Tiny "Open in Editor / Open in Preview" affordance shown on markdown preview panes.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-5]
 */
import { Eye, Newspaper, Pencil } from "lucide-react";

import { Button } from "@afx/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@afx/ui/components/tooltip";

import { workbenchSend } from "./bridge";

/**
 * Renders editor/preview buttons for markdown surfaces. When `includeAfxPreview`
 * is set, a third button opens the editor-area AFX Preview panel
 * (`afxOpenFile { mode: "afxPreview" }`); the standalone preview panel itself
 * leaves it off to avoid a recursive self-link.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-5] [FR-11]
 */
export function OpenActions({
  filePath,
  line,
  className = "",
  includeAfxPreview = false,
}: {
  filePath: string;
  line?: number;
  className?: string;
  includeAfxPreview?: boolean;
}) {
  if (!filePath) return null;
  return (
    <div className={`flex shrink-0 items-center gap-0.5 ${className}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Open in editor"
            onClick={() =>
              workbenchSend({ type: "afxOpenFile", path: filePath, mode: "editor", line })
            }
          >
            <Pencil size={11} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Open in editor</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Open in preview"
            onClick={() => workbenchSend({ type: "afxOpenFile", path: filePath, mode: "preview" })}
          >
            <Eye size={11} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Open in native preview</TooltipContent>
      </Tooltip>
      {includeAfxPreview ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Open in AFX Preview"
              onClick={() =>
                workbenchSend({ type: "afxOpenFile", path: filePath, mode: "afxPreview" })
              }
            >
              <Newspaper size={11} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Open in AFX Preview</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
