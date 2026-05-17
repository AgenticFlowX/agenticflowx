/**
 * Reserved attachment tray for selected file/image chips.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-FILES]
 */
import type { ComposerAttachmentItem } from "./chat.types";

export interface ComposerAttachmentTrayProps {
  attachments: ComposerAttachmentItem[];
  onRemove?: (id: string) => void;
}

export function ComposerAttachmentTray({ attachments, onRemove }: ComposerAttachmentTrayProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-1" aria-label="Selected attachments">
      {attachments.map((item) => (
        <span
          key={item.id}
          className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs"
        >
          <span className="truncate">{item.name}</span>
          {onRemove ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${item.name}`}
              onClick={() => onRemove(item.id)}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}
