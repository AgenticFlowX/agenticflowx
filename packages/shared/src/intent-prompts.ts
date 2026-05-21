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
        "read-only answers. May read files, list folders, search source, and browse pages.",
      prefix:
        "Mode: Ask. Answer from read-only investigation. You may request read-only file, folder, source-search, web-page, or simple read-only shell reads when needed. Do not edit files, run mutating shell commands, write patches, or change state.",
      estimatedTokens: 48,
      parents: ["code", "explore"],
      icon: "?",
    },
    3: {
      id: "architect",
      slot: 3,
      label: "Architect",
      description:
        "read-only architecture. May read, list, search, and browse; no writes or mutating shell.",
      prefix:
        "Mode: Architect. Analyze architecture and tradeoffs using read-only context, file, folder, source-search, web-page, or simple read-only shell reads when useful. Propose designs and risks. Do not edit files, run mutating shell commands, write patches, or change state.",
      estimatedTokens: 50,
      parents: ["code", "explore"],
      icon: "⌂",
    },
    4: {
      id: "prd",
      slot: 4,
      label: "PRD",
      description: "draft a PRD from discussion plus read-only repo/web context.",
      prefix:
        "Mode: PRD. Draft a PRD in chat from the discussion and read-only repo/web context. Use AFX spec sections: Problem, User Stories, FR/NFR, Acceptance, Non-Goals, Open Questions, Dependencies. Do not write files.",
      estimatedTokens: 48,
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
