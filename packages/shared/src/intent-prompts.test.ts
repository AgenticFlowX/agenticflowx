import { describe, expect, it } from "vitest";

import { isIntentParentMode, normalizeIntentSlot } from "./intent";
import {
  formatIntentPromptBadge,
  formatIntentPromptDetail,
  formatIntentPromptTitle,
  formatIntentTokenEstimate,
} from "./intent-copy";
import {
  composeIntentControlBlock,
  getIntentId,
  getIntentPrompt,
  getIntentPrompts,
} from "./intent-prompts";

/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3] [FR-4] [FR-5]
 * @see docs/specs/100-package-shared/spec.md [FR-1]
 */
describe("Composer Intent prompt registry", () => {
  it("exposes four slots per parent with zero-injection defaults", () => {
    for (const parentMode of ["code", "explore"] as const) {
      const entries = getIntentPrompts(parentMode);
      expect(entries).toHaveLength(4);
      expect(entries[0]).toMatchObject({ id: "default", slot: 1, prefix: "", estimatedTokens: 0 });
      expect(composeIntentControlBlock(parentMode, 1)).toBeNull();
    }
  });

  it("remaps slot 4 by parent mode", () => {
    expect(getIntentPrompt("code", 4).id).toBe("code");
    expect(getIntentId("explore", 4)).toBe("prd");
  });

  it("normalizes slot and parent-mode inputs", () => {
    expect(normalizeIntentSlot(2)).toBe(2);
    expect(normalizeIntentSlot(99)).toBe(1);
    expect(isIntentParentMode("code")).toBe(true);
    expect(isIntentParentMode("explore")).toBe(true);
    expect(isIntentParentMode("spec")).toBe(false);
  });

  it("keeps non-default prefixes within the 50 token budget", () => {
    for (const parentMode of ["code", "explore"] as const) {
      for (const entry of getIntentPrompts(parentMode).slice(1)) {
        expect(entry.estimatedTokens).toBeLessThanOrEqual(50);
        expect(entry.prefix).toMatch(/^Mode: /);
      }
    }
  });

  it("matches the sprint's verbatim static prompt registry", () => {
    expect(
      getIntentPrompts("code").map(({ label, prefix, estimatedTokens }) => ({
        label,
        prefix,
        estimatedTokens,
      })),
    ).toEqual([
      { label: "Default", prefix: "", estimatedTokens: 0 },
      {
        label: "Ask",
        prefix:
          "Mode: Ask. Answer concisely. Explain concepts, trade-offs, and examples. Do not implement or edit files unless the user explicitly asks for code changes.",
        estimatedTokens: 26,
      },
      {
        label: "Architect",
        prefix:
          "Mode: Architect. Focus on design and tradeoffs first. Discuss alternatives and load-bearing assumptions before writing or recommending code.",
        estimatedTokens: 30,
      },
      {
        label: "Code",
        prefix:
          "Mode: Code. Make the smallest viable change. Edit over add. No speculative refactors, no error handling for hypothetical future needs.",
        estimatedTokens: 30,
      },
    ]);

    expect(
      getIntentPrompts("explore").map(({ label, prefix, estimatedTokens }) => ({
        label,
        prefix,
        estimatedTokens,
      })),
    ).toEqual([
      { label: "Default", prefix: "", estimatedTokens: 0 },
      {
        label: "Ask",
        prefix:
          "Mode: Ask. Answer from read-only investigation. You may request read-only file, folder, source-search, web-page, or simple read-only shell reads when needed. Do not edit files, run mutating shell commands, write patches, or change state.",
        estimatedTokens: 48,
      },
      {
        label: "Architect",
        prefix:
          "Mode: Architect. Analyze architecture and tradeoffs using read-only context, file, folder, source-search, web-page, or simple read-only shell reads when useful. Propose designs and risks. Do not edit files, run mutating shell commands, write patches, or change state.",
        estimatedTokens: 50,
      },
      {
        label: "PRD",
        prefix:
          "Mode: PRD. Draft a PRD in chat from the discussion and read-only repo/web context. Use AFX spec sections: Problem, User Stories, FR/NFR, Acceptance, Non-Goals, Open Questions, Dependencies. Do not write files.",
        estimatedTokens: 48,
      },
    ]);
  });

  it("keeps Explore non-default prompts within read-only parent-mode boundaries", () => {
    for (const entry of getIntentPrompts("explore").slice(1)) {
      expect(entry.prefix).toMatch(/read-only/i);
    }
    expect(getIntentPrompt("explore", 2).prefix).toContain("read-only file");
    expect(getIntentPrompt("explore", 3).prefix).toContain("web-page");
    expect(getIntentPrompt("explore", 4).prefix).toContain("Do not write files");
  });

  it("formats prompt overhead with human-facing copy instead of token shorthand", () => {
    expect(formatIntentPromptBadge(30)).toBe("Intent guide");
    expect(formatIntentPromptBadge(0)).toBeNull();
    expect(formatIntentTokenEstimate(30)).toBe("About 30 tokens");
    expect(formatIntentTokenEstimate(0)).toBe("No intent guidance");
    expect(formatIntentPromptDetail(30)).toBe("Short intent guidance - about 30 tokens");
    expect(formatIntentPromptTitle(30)).toBe(
      "Adds short intent guidance before your message. About 30 tokens.",
    );
  });
});
