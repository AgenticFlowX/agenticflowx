/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MENTION-POPUP] [DES-COMPOSER-HELPERS]
 */
import { FileCode, FolderOpen } from "lucide-react";

import type { AgentFileView } from "@afx/shared";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@afx/ui/components/command";
import { Popover, PopoverAnchor, PopoverContent } from "@afx/ui/components/popover";

export interface MentionPopupProps {
  open: boolean;
  files: readonly AgentFileView[];
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
}

/**
 * Renders the composer file mention picker and splits recent/workspace candidates.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MENTION-POPUP]
 */
export function MentionPopup({ open, files, onOpenChange, onSelect }: MentionPopupProps) {
  const recent = files.filter((file) => file.recent);
  const workspace = files.filter((file) => !file.recent);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <span className="block h-0 w-0" aria-hidden />
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        className="w-[calc(100vw-1rem)] max-w-[380px] border border-border p-0 shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder="Filter files..." />
          <CommandList className="max-h-72 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60">
            <CommandEmpty>No files found.</CommandEmpty>
            {recent.length > 0 && (
              <CommandGroup heading="Recently opened">
                {recent.map((file) => (
                  <FileRow key={`recent:${file.path}`} file={file} onSelect={onSelect} recent />
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Workspace">
              {workspace.map((file) => (
                <FileRow key={file.path} file={file} onSelect={onSelect} />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Renders one selectable mention candidate.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MENTION-POPUP]
 */
function FileRow({
  file,
  recent,
  onSelect,
}: {
  file: AgentFileView;
  recent?: boolean;
  onSelect: (path: string) => void;
}) {
  const Icon = recent ? FolderOpen : FileCode;
  return (
    <CommandItem value={file.path} onSelect={() => onSelect(file.path)}>
      <Icon size={12} className="text-afx-brand-soft" />
      <span className="min-w-0 truncate font-mono text-[11px]">{file.path}</span>
    </CommandItem>
  );
}
