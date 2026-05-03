/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-SLASH-POPUP] [DES-COMPOSER-HELPERS]
 */
import type { AgentCommand } from "@afx/shared";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@afx/ui/components/command";
import { Popover, PopoverAnchor, PopoverContent } from "@afx/ui/components/popover";

/**
 * Bridge messages dispatched by the popup's "Actions" group (`/new`, `/abort`)
 * — distinct from skill insertions, which only update the textarea.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-SLASH-POPUP] [DES-COMPOSER-FLOW]
 */
export type SlashAction = "chat/newSession" | "chat/abort";

/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-SLASH-POPUP]
 */
export interface SlashPopupProps {
  open: boolean;
  commands: readonly AgentCommand[];
  onOpenChange: (open: boolean) => void;
  onSelect: (commandText: string) => void;
  onAction: (action: SlashAction) => void;
}

/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-SLASH-POPUP] [DES-COMPOSER-HELPERS]
 */
export function SlashPopup({ open, commands, onOpenChange, onSelect, onAction }: SlashPopupProps) {
  const afxCommands = commands.filter(
    (cmd) => cmd.source === "skill" && cmd.name.startsWith("skill:afx-"),
  );
  const otherCommands = commands.filter((cmd) => !afxCommands.includes(cmd));

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <span className="block h-0 w-0" aria-hidden />
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        className="w-[calc(100vw-1rem)] max-w-[360px] cursor-default border border-border p-0 shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command className="cursor-default">
          <CommandInput placeholder="Filter commands..." />
          <CommandList className="max-h-72 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60">
            <CommandEmpty>No commands available.</CommandEmpty>
            {afxCommands.length > 0 && (
              <CommandGroup heading="AFX skills">
                {afxCommands.map((cmd) => (
                  <CommandRow key={cmd.name} command={cmd} onSelect={onSelect} />
                ))}
              </CommandGroup>
            )}
            {otherCommands.length > 0 && (
              <CommandGroup heading="Other commands">
                {otherCommands.map((cmd) => (
                  <CommandRow key={`${cmd.source}:${cmd.name}`} command={cmd} onSelect={onSelect} />
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Actions">
              <CommandItem value="/new" onSelect={() => onAction("chat/newSession")}>
                <div className="min-w-0">
                  <p className="font-mono text-[11px]">/new</p>
                  <p className="truncate text-[10px] text-muted-foreground">Start a new session</p>
                </div>
              </CommandItem>
              <CommandItem value="/abort" onSelect={() => onAction("chat/abort")}>
                <div className="min-w-0">
                  <p className="font-mono text-[11px]">/abort</p>
                  <p className="truncate text-[10px] text-muted-foreground">Abort the active run</p>
                </div>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CommandRow({
  command,
  onSelect,
}: {
  command: AgentCommand;
  onSelect: (commandText: string) => void;
}) {
  const display = displayCommandName(command);
  return (
    <CommandItem value={display} onSelect={() => onSelect(display)}>
      <div className="min-w-0">
        <p className="font-mono text-[11px]">{display}</p>
        {command.description ? (
          <p className="truncate text-[10px] text-muted-foreground">{command.description}</p>
        ) : null}
      </div>
    </CommandItem>
  );
}

/**
 * Render an AgentCommand `name` as the user-facing slash form.
 * AFX skills (`skill:afx-task`) → `/afx-task`; plain names get a leading slash.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-SLASH-POPUP]
 */
export function displayCommandName(command: Pick<AgentCommand, "name">): string {
  if (command.name.startsWith("skill:afx-")) return `/${command.name.slice("skill:".length)}`;
  return command.name.startsWith("/") ? command.name : `/${command.name}`;
}
