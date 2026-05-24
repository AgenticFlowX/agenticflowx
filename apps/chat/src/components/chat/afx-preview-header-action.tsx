/**
 * Flat composer-panel header action for opening the active markdown document
 * in the editor-area AFX Preview.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-6]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-PREVIEW-ENTRYPOINTS]
 */
import { Eye } from "lucide-react";

import { ComposerHeaderActionButton } from "./composer-header-action-button";

export interface AfxPreviewHeaderActionProps {
  path: string;
  onOpen: (path: string) => void;
}

export function AfxPreviewHeaderAction({ path, onOpen }: AfxPreviewHeaderActionProps) {
  const fileName = previewFileName(path);
  const actionLabel = `Open ${fileName} in AFX Preview`;

  return (
    <ComposerHeaderActionButton
      aria-label={actionLabel}
      className="max-w-[11rem] @[520px]:max-w-[14rem]"
      onClick={() => onOpen(path)}
      leadingIcon={<Eye size={11} aria-hidden="true" className="shrink-0" />}
      labelClassName="hidden @[340px]:inline"
      tooltip={
        <span className="flex flex-col gap-1">
          <span className="font-medium">{actionLabel}</span>
          <span className="text-muted-foreground">
            Open this file in the AFX Markdown Previewer, with polished rendering for frontmatter,
            sections, tables, task lists, and code blocks.
          </span>
        </span>
      }
    >
      Preview {fileName}
    </ComposerHeaderActionButton>
  );
}

function previewFileName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
