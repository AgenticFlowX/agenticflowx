/**
 * Static command-context presets for composer menus.
 *
 * Presets are bounded, draft-first command variants layered on top of the
 * verified command catalog. Unknown base commands fail closed.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { type SupportedAfxCommand, classifyAfxCommand } from "./command-catalog";
import type { ActiveDocCtx } from "./doc-actions";

export type ContextPresetPlaceholder =
  | "feature"
  | "featurePath"
  | "filePath"
  | "WBS"
  | "desId"
  | "topic"
  | "change";

export type ContextPresetCtx = Partial<ActiveDocCtx> &
  Partial<Record<ContextPresetPlaceholder, string | null>>;

export type ContextPreset = Readonly<{
  label: string;
  suffix: string;
  description: string;
  verifiedAgainst: string;
  autoSendWhenNoOpenArgs?: boolean;
}>;

export type ResolvedContextPreset = Readonly<{
  label: string;
  description: string;
  command: string;
  autoSend: boolean;
  preset: ContextPreset;
}>;

const NO_OPEN_ARG_USAGE = /^[^[<]+$/;

function preset(
  label: string,
  suffix: string,
  description: string,
  verifiedAgainst: string,
  autoSendWhenNoOpenArgs = false,
): ContextPreset {
  return Object.freeze({ label, suffix, description, verifiedAgainst, autoSendWhenNoOpenArgs });
}

function freezePresets(entries: ContextPreset[]): readonly ContextPreset[] {
  return Object.freeze(entries);
}

export const COMMAND_CONTEXT_PRESETS: Readonly<Record<string, readonly ContextPreset[]>> =
  Object.freeze({
    "/afx-spec refine": freezePresets([
      preset(
        "Tighten Requirements",
        "{feature} requirements",
        "Focus refinement on requirement clarity.",
        "afx-spec refine Usage",
      ),
      preset(
        "Acceptance Criteria",
        "{feature} acceptance criteria",
        "Draft tighter acceptance criteria.",
        "afx-spec refine Usage",
      ),
      preset(
        "Edge Cases",
        "{feature} edge cases",
        "Add missing boundary and failure cases.",
        "afx-spec refine Usage",
      ),
      preset(
        "Open Questions",
        "{feature} open questions",
        "Prepare discussion points before editing.",
        "afx-spec refine Usage",
      ),
    ]),
    "/afx-design refine": freezePresets([
      preset(
        "Section ID",
        "{feature} {desId}",
        "Refine one design section by canonical ID.",
        "afx-design refine Usage",
      ),
      preset(
        "Data Flow",
        "{feature} data flow",
        "Focus on state and data movement.",
        "afx-design refine Usage",
      ),
      preset(
        "Error Paths",
        "{feature} error handling",
        "Tighten error and fallback behavior.",
        "afx-design refine Usage",
      ),
      preset(
        "Review Risks",
        "{feature} risk areas",
        "Prepare the design for review.",
        "afx-design refine Usage",
      ),
    ]),
    "/afx-task code": freezePresets([
      preset("Task ID", "{WBS}", "Insert the selected task ID.", "afx-task code Usage"),
      preset(
        "Tests First",
        "{WBS} tests first",
        "Bias implementation toward tests first.",
        "afx-task code Usage",
      ),
    ]),
    "/afx-task verify": freezePresets([
      preset("Verify Task", "{WBS}", "Verify the selected task ID.", "afx-task verify Usage"),
    ]),
    "/afx-task review": freezePresets([
      preset(
        "Review Feature",
        "{feature}",
        "Review task coverage for this feature.",
        "afx-task review Usage",
      ),
    ]),
    "/afx-check path": freezePresets([
      preset(
        "Feature Path",
        "{featurePath}",
        "Trace the detected feature path.",
        "afx-check path Usage",
      ),
      preset("Active File", "{filePath}", "Trace the active file path.", "afx-check path Usage"),
    ]),
    "/afx-check links": freezePresets([
      preset(
        "Spec Folder",
        "{featurePath}",
        "Check links for the feature spec folder.",
        "afx-check links Usage",
      ),
    ]),
    "/afx-check all": freezePresets([
      preset(
        "All Checks",
        "{featurePath}",
        "Run all checks for the feature path.",
        "afx-check all Usage",
      ),
    ]),
    "/afx-context load": freezePresets([
      preset(
        "Load Context",
        "",
        "Load the current handoff context.",
        "afx-context load Usage",
        true,
      ),
    ]),
    "/afx-context history": freezePresets([
      preset(
        "Feature History",
        "{feature}",
        "Inspect context history for this feature.",
        "afx-context history Usage",
      ),
    ]),
    "/afx-context save": freezePresets([
      preset(
        "Save Feature",
        "{feature}",
        "Save a handoff bundle for this feature.",
        "afx-context save Usage",
      ),
    ]),
    "/afx-context impact": freezePresets([
      preset(
        "Impact Change",
        "{change}",
        "Analyze the supplied change description.",
        "afx-context impact Usage",
      ),
    ]),
    "/afx-session note": freezePresets([
      preset(
        "Note Topic",
        "{topic}",
        "Draft a session note about the current topic.",
        "afx-session note Usage",
      ),
    ]),
    "/afx-session log": freezePresets([
      preset(
        "Log Feature",
        "{feature}",
        "Draft a journal entry for this feature.",
        "afx-session log Usage",
      ),
    ]),
    "/afx-session recap": freezePresets([
      preset(
        "Recap Feature",
        "{feature}",
        "Recap the session for this feature.",
        "afx-session recap Usage",
      ),
      preset("Recap All", "all", "Recap all recent session notes.", "afx-session recap Usage"),
    ]),
    "/afx-adr review": freezePresets([
      preset("Review ADR", "{filePath}", "Review the active ADR file.", "afx-adr review Usage"),
    ]),
    "/afx-adr supersede": freezePresets([
      preset(
        "Supersede ADR",
        "{filePath}",
        "Draft a supersession command for this ADR.",
        "afx-adr supersede Usage",
      ),
    ]),
    "/afx-adr list": freezePresets([
      preset("List ADRs", "", "List existing ADRs.", "afx-adr list Usage", true),
    ]),
    "/afx-research explore": freezePresets([
      preset(
        "Explore Topic",
        "{topic}",
        "Explore the current research topic.",
        "afx-research explore Usage",
      ),
    ]),
    "/afx-research compare": freezePresets([
      preset(
        "Compare Topic",
        "{topic}",
        "Compare options for the current topic.",
        "afx-research compare Usage",
      ),
    ]),
    "/afx-research summarize": freezePresets([
      preset(
        "Summarize Topic",
        "{topic}",
        "Summarize findings for the current topic.",
        "afx-research summarize Usage",
      ),
    ]),
    "/afx-research finalize": freezePresets([
      preset(
        "Promote To ADR",
        "{topic} --to adr --feature {feature}",
        "Finalize research into an ADR.",
        "afx-research finalize Usage",
      ),
    ]),
    "/afx-sprint refine": freezePresets([
      preset(
        "Refine Spec",
        "{feature} spec",
        "Refine the sprint spec section.",
        "afx-sprint refine Usage",
      ),
      preset(
        "Refine Design",
        "{feature} design",
        "Refine the sprint design section.",
        "afx-sprint refine Usage",
      ),
      preset(
        "Refine Task",
        "{feature} task",
        "Refine the sprint task section.",
        "afx-sprint refine Usage",
      ),
    ]),
    "/afx-sprint code": freezePresets([
      preset(
        "Sprint Task",
        "{feature} {WBS}",
        "Code the selected sprint task.",
        "afx-sprint code Usage",
      ),
    ]),
    "/afx-next": freezePresets([
      preset("Next", "", "Ask for the next recommended action.", "afx-next Usage", true),
    ]),
  } satisfies Record<string, readonly ContextPreset[]>);

export function getContextPresets(baseCommand: string): readonly ContextPreset[] {
  if (classifyAfxCommand(baseCommand).kind !== "supported") {
    return [];
  }

  return COMMAND_CONTEXT_PRESETS[normalizeCommand(baseCommand)] ?? [];
}

export function resolveContextPreset(
  baseCommand: string,
  presetEntry: ContextPreset,
  ctx: ContextPresetCtx,
): ResolvedContextPreset | null {
  const normalizedBase = normalizeCommand(baseCommand);
  const classification = classifyAfxCommand(normalizedBase);
  if (classification.kind !== "supported") {
    return null;
  }

  const suffix = resolveSuffix(presetEntry.suffix, ctx);
  if (suffix === null) {
    return null;
  }

  const command = [normalizedBase, suffix].filter(Boolean).join(" ");
  if (classifyAfxCommand(command).kind !== "supported") {
    return null;
  }

  return Object.freeze({
    label: presetEntry.label,
    description: presetEntry.description,
    command,
    autoSend: shouldAutoSendPreset(command, presetEntry, classification.entry),
    preset: presetEntry,
  });
}

export function resolveContextPresets(
  baseCommand: string,
  ctx: ContextPresetCtx,
): readonly ResolvedContextPreset[] {
  return Object.freeze(
    getContextPresets(baseCommand)
      .map((presetEntry) => resolveContextPreset(baseCommand, presetEntry, ctx))
      .filter((entry): entry is ResolvedContextPreset => entry !== null),
  );
}

function resolveSuffix(suffix: string, ctx: ContextPresetCtx): string | null {
  const resolved = suffix.replace(
    /\{(feature|featurePath|filePath|WBS|desId|topic|change)\}/g,
    (_match, key: ContextPresetPlaceholder) => {
      const value = placeholderValue(key, ctx);
      return value === null ? "\0" : value;
    },
  );

  if (resolved.includes("\0")) {
    return null;
  }

  return normalizeWhitespace(resolved);
}

function placeholderValue(key: ContextPresetPlaceholder, ctx: ContextPresetCtx): string | null {
  const explicit = normalizeWhitespace(ctx[key] ?? "");
  if (explicit) {
    return explicit;
  }

  if (key === "topic") {
    return normalizeWhitespace(ctx.feature ?? "");
  }

  return null;
}

function shouldAutoSendPreset(
  command: string,
  presetEntry: ContextPreset,
  entry: SupportedAfxCommand,
): boolean {
  return Boolean(
    presetEntry.autoSendWhenNoOpenArgs &&
    entry.autoSend &&
    NO_OPEN_ARG_USAGE.test(entry.usage) &&
    command === entry.command,
  );
}

function normalizeCommand(command: string): string {
  return normalizeWhitespace(command).toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
