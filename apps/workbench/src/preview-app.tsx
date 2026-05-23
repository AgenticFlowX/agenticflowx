/**
 * PreviewApp — standalone editor-area preview boot mode for the workbench bundle.
 * Subscribes to host-pushed `afxPreviewShow`, parses the pushed content, builds a
 * synthetic DocumentRow, and renders DocPreview in full (AFX) or generic mode.
 * Wrapped in WorkbenchProvider so DocPreview's `send` works.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-15]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-PREVIEW-MODE]
 */
import { useEffect, useMemo, useState } from "react";

import type { DocumentRow } from "@afx/shared";

import { DocPreview } from "./components/doc-preview";
import { WorkbenchProvider } from "./context/workbench-context";
import { workbenchOn } from "./lib/bridge";
import { stringMeta } from "./lib/document-studio";
import { isFullAfxDoc, parseSimpleFrontmatter } from "./lib/frontmatter";

interface PreviewPayload {
  filePath: string;
  content: string;
  isAfxHint?: boolean;
}

function basename(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? filePath;
}

/**
 * Standalone preview surface. Renders a loading state until the first
 * `afxPreviewShow` arrives, then DocPreview in the resolved mode.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-15]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-PREVIEW-MODE]
 */
export function PreviewApp() {
  const [payload, setPayload] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    return workbenchOn("afxPreviewShow", (msg) => {
      setPayload({ filePath: msg.filePath, content: msg.content, isAfxHint: msg.isAfxHint });
    });
  }, []);

  const view = useMemo(() => {
    if (!payload) return null;
    const fm = parseSimpleFrontmatter(payload.content);
    const isAfx = isFullAfxDoc(fm);
    const doc: DocumentRow = {
      type: stringMeta(fm, "type") ?? "DOC",
      name: basename(payload.filePath),
      status: stringMeta(fm, "status") ?? "",
      owner: stringMeta(fm, "owner") ?? "",
      filePath: payload.filePath,
      isAfx,
      updatedAt: stringMeta(fm, "updated_at"),
    };
    return { doc, mode: isAfx ? ("full" as const) : ("generic" as const) };
  }, [payload]);

  return (
    <WorkbenchProvider>
      {payload && view ? (
        <DocPreview
          doc={view.doc}
          content={payload.content}
          mode={view.mode}
          showAfxPreviewAction={false}
        />
      ) : (
        <div className="flex h-full min-h-0 items-center justify-center p-6 text-sm text-muted-foreground">
          Loading preview…
        </div>
      )}
    </WorkbenchProvider>
  );
}
