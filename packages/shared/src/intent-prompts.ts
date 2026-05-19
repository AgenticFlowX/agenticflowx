/**
 * Static Composer Intent prompt registry.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3] [FR-4] [FR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW] [DES-COMPOSER-RUNTIME]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
 */
import type { ComposerIntentId, IntentParentMode, IntentPromptEntry, IntentSlot } from "./intent";
import { normalizeIntentSlot } from "./intent";

const DEFAULT_DESCRIPTION = "what you type is what you send. Zero injection, zero extra tokens.";

const REGISTRY: Record<IntentParentMode, Record<IntentSlot, IntentPromptEntry>> = {
  code: {
    1: {
      id: "default",
      slot: 1,
      label: "Default",
      description: DEFAULT_DESCRIPTION,
      prefix: "",
      estimatedTokens: 0,
      parents: ["code", "explore"],
      icon: "●",
    },
    2: {
      id: "ask",
      slot: 2,
      label: "Ask",
      description: "direct, concise answers. Explanation, examples, trade-offs.",
      prefix:
        "Mode: Ask. Answer concisely. Explain concepts, trade-offs, and examples. Do not implement or edit files unless the user explicitly asks for code changes.",
      estimatedTokens: 26,
      parents: ["code", "explore"],
      icon: "?",
    },
    3: {
      id: "architect",
      slot: 3,
      label: "Architect",
      description: "design and tradeoffs first. Confirms decisions that constrain work.",
      prefix:
        "Mode: Architect. Focus on design and tradeoffs first. Discuss alternatives and load-bearing assumptions before writing or recommending code.",
      estimatedTokens: 30,
      parents: ["code", "explore"],
      icon: "⌂",
    },
    4: {
      id: "code",
      slot: 4,
      label: "Code",
      description: "smallest viable change. Edit over add, no speculative refactors.",
      prefix:
        "Mode: Code. Make the smallest viable change. Edit over add. No speculative refactors, no error handling for hypothetical future needs.",
      estimatedTokens: 30,
      parents: ["code"],
      icon: "</>",
    },
  },
  explore: {
    1: {
      id: "default",
      slot: 1,
      label: "Default",
      description: DEFAULT_DESCRIPTION,
      prefix: "",
      estimatedTokens: 0,
      parents: ["code", "explore"],
      icon: "●",
    },
    2: {
      id: "ask",
      slot: 2,
      label: "Ask",
      description:
        "read-only answers. Explain findings, examples, and trade-offs; no host actions.",
      prefix:
        "Mode: Ask. Answer from read-only analysis. Explain findings, examples, and tradeoffs. Do not request tools, file reads, file writes, commands, or patches.",
      estimatedTokens: 33,
      parents: ["code", "explore"],
      icon: "?",
    },
    3: {
      id: "architect",
      slot: 3,
      label: "Architect",
      description: "read-only architecture. Propose designs and risks; no host actions.",
      prefix:
        "Mode: Architect. Analyze architecture and tradeoffs from provided context only. Propose designs and risks. Do not request tools, file reads, file writes, commands, or patches.",
      estimatedTokens: 38,
      parents: ["code", "explore"],
      icon: "⌂",
    },
    4: {
      id: "prd",
      slot: 4,
      label: "PRD",
      description: "turn the discussion into a PRD draft using the AFX template.",
      prefix:
        "Mode: PRD. Convert the discussion into a PRD draft in chat using the AFX spec template: Problem, User Stories, FR/NFR, Acceptance, Non-Goals, Open Questions, Dependencies.",
      estimatedTokens: 40,
      parents: ["explore"],
      icon: "§",
    },
  },
};

export function getIntentPrompt(parentMode: IntentParentMode, slot: IntentSlot): IntentPromptEntry {
  return REGISTRY[parentMode][normalizeIntentSlot(slot)];
}

export function getIntentPrompts(parentMode: IntentParentMode): readonly IntentPromptEntry[] {
  return [
    REGISTRY[parentMode][1],
    REGISTRY[parentMode][2],
    REGISTRY[parentMode][3],
    REGISTRY[parentMode][4],
  ];
}

export function getIntentId(parentMode: IntentParentMode, slot: IntentSlot): ComposerIntentId {
  return getIntentPrompt(parentMode, slot).id;
}

export function composeIntentControlBlock(
  parentMode: IntentParentMode,
  slot: IntentSlot,
): string | null {
  const entry = getIntentPrompt(parentMode, slot);
  return entry.prefix.length > 0 ? entry.prefix : null;
}
