/**
 * Tiny "Open in Editor / Open in Preview" affordance shown on markdown preview panes.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-5]
 */
import { Eye, Pencil } from "lucide-react";

import { Button } from "@afx/ui/components/button";

import { workbenchSend } from "./bridge";

/**
 * Renders editor/preview buttons for markdown surfaces.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-5]
 */
export function OpenActions({
  filePath,
  line,
  className = "",
}: {
  filePath: string;
  line?: number;
  className?: string;
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
    </div>
  );
}
