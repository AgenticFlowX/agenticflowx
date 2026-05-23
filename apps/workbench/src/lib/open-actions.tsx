/**
 * Tiny "Open in Editor / Open in Preview" affordance shown on markdown preview panes.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-5]
 */
import { Columns2, Eye, Pencil } from "lucide-react";

import { Button } from "@afx/ui/components/button";

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
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        title="Open in editor"
        aria-label="Open in editor"
        onClick={() => workbenchSend({ type: "afxOpenFile", path: filePath, mode: "editor", line })}
      >
        <Pencil size={11} />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        title="Open in preview"
        aria-label="Open in preview"
        onClick={() => workbenchSend({ type: "afxOpenFile", path: filePath, mode: "preview" })}
      >
        <Eye size={11} />
      </Button>
      {includeAfxPreview ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          title="Open in AFX Preview"
          aria-label="Open in AFX Preview"
          onClick={() => workbenchSend({ type: "afxOpenFile", path: filePath, mode: "afxPreview" })}
        >
          <Columns2 size={11} />
        </Button>
      ) : null}
    </div>
  );
}
