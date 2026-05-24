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
  return (
    <ComposerHeaderActionButton
      aria-label="Open AFX Preview"
      title="Open AFX Preview"
      onClick={() => onOpen(path)}
      leadingIcon={<Eye size={11} aria-hidden="true" className="shrink-0" />}
      labelClassName="hidden @[340px]:inline"
    >
      Preview
    </ComposerHeaderActionButton>
  );
}
