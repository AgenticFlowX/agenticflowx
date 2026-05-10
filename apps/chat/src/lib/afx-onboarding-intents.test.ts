import { describe, expect, it } from "vitest";

import {
  ONBOARDING_INTENTS,
  ONBOARDING_SAMPLES,
  buildImproveExistingReceipt,
  buildPlanNewReceipt,
  buildResumeReceipt,
  buildSampleReceipt,
  buildSpecIdeaCommand,
  detectAfxIntent,
  resolveOnboardingIntent,
  sanitizeSpecIdea,
} from "./afx-onboarding-intents";
import { type ActiveDocCtx, EMPTY_DOC_CTX } from "./doc-actions";

function ctx(overrides: Partial<ActiveDocCtx>): ActiveDocCtx {
  return { ...EMPTY_DOC_CTX, ...overrides };
}

describe("onboarding intent catalog", () => {
  it("exposes the required human-first starter intents", () => {
    expect(ONBOARDING_INTENTS.map((intent) => [intent.id, intent.label])).toEqual([
      ["plan-new", "Plan a new feature"],
      ["improve-existing", "Improve an existing spec"],
      ["resume", "Resume workflow"],
      ["try-sample", "Try a sample"],
    ]);
  });

  it("keeps sample prompts static and mapped to safe AFX commands", () => {
    expect(ONBOARDING_SAMPLES.map((sample) => sample.label)).toEqual([
      "Tiny UI polish",
      "Risky backend change",
      "Refactor",
      "Turn notes into work",
    ]);
    expect(ONBOARDING_SAMPLES.every((sample) => sample.receipt.command.startsWith("/afx-"))).toBe(
      true,
    );
  });
});

describe("command receipt builders", () => {
  it("sanitizes freeform ideas before building /afx-spec new", () => {
    expect(buildSpecIdeaCommand("  /Add   compact\nempty state  ")).toBe(
      "/afx-spec new Add compact empty state",
    );
    expect(buildSpecIdeaCommand("   ")).toBeNull();
    expect(sanitizeSpecIdea(`/${"x".repeat(250)}`)).toHaveLength(200);
  });

  it("builds lean sprint and full spec receipts from the same idea", () => {
    expect(buildPlanNewReceipt("sprint", "Add compact empty state")?.command).toBe(
      "/afx-sprint new add-compact-empty-state Context: Add compact empty state",
    );
    expect(buildPlanNewReceipt("full-spec", "Audit logging for account deletion")?.command).toBe(
      "/afx-spec create audit-logging-for-account-deletion Context: Audit logging for account deletion",
    );
  });

  it("uses active doc context for improve-existing receipts", () => {
    expect(
      buildImproveExistingReceipt(
        ctx({ docKind: "spec", format: "standard", feature: "chat-foundation" }),
      ),
    ).toMatchObject({
      label: "Improve existing spec",
      command: "/afx-spec refine chat-foundation",
      defaultMode: "insert",
    });

    expect(
      buildImproveExistingReceipt(ctx({ docKind: "spec", format: "sprint", feature: "quick-fix" }))
        ?.command,
    ).toBe("/afx-sprint refine quick-fix");
  });

  it("resolves intents that need follow-up instead of inventing missing context", () => {
    expect(resolveOnboardingIntent("plan-new", EMPTY_DOC_CTX)).toEqual({
      kind: "scope-follow-up",
      intent: "plan-new",
    });
    expect(resolveOnboardingIntent("improve-existing", EMPTY_DOC_CTX)).toEqual({
      kind: "target-follow-up",
      intent: "improve-existing",
    });
    expect(resolveOnboardingIntent("try-sample", EMPTY_DOC_CTX)).toEqual({
      kind: "sample-grid",
      intent: "try-sample",
    });
  });

  it("builds resume and sample receipts", () => {
    expect(buildResumeReceipt()).toMatchObject({
      command: "/afx-next",
      defaultMode: "run",
    });
    expect(buildSampleReceipt("risky-backend-change")).toMatchObject({
      command:
        "/afx-spec create audit-logging Context: Add audit logging to account deletion with compliance and rollback considerations.",
    });
  });
});

describe("detectAfxIntent", () => {
  it("recognizes resume prose", () => {
    expect(detectAfxIntent("I'm stuck, what next?", EMPTY_DOC_CTX)).toMatchObject({
      intent: "resume",
      command: "/afx-next",
      defaultMode: "run",
    });
  });

  it("recognizes review, validate, approve, and refine for active specs", () => {
    const activeSpec = ctx({ docKind: "spec", format: "standard", feature: "onboarding" });

    expect(detectAfxIntent("review quality and risks", activeSpec)?.command).toBe(
      "/afx-spec review onboarding",
    );
    expect(detectAfxIntent("validate this gate", activeSpec)?.command).toBe(
      "/afx-spec validate onboarding",
    );
    expect(detectAfxIntent("approve this please", activeSpec)?.command).toBe(
      "/afx-spec approve onboarding",
    );
    expect(detectAfxIntent("refine with new notes", activeSpec)).toMatchObject({
      command: "/afx-spec refine onboarding",
      defaultMode: "insert",
    });
  });

  it("maps sprint review and validation prose to verify", () => {
    const sprintSpec = ctx({ docKind: "spec", format: "sprint", feature: "quick-polish" });

    expect(detectAfxIntent("review the risk", sprintSpec)?.command).toBe(
      "/afx-sprint verify quick-polish",
    );
    expect(detectAfxIntent("validate the sprint", sprintSpec)?.command).toBe(
      "/afx-sprint verify quick-polish",
    );
  });

  it("recognizes new-feature prose as a visible command preview", () => {
    expect(detectAfxIntent("Build a dashboard for audit logs", EMPTY_DOC_CTX)).toMatchObject({
      intent: "new-feature",
      label: "Plan a new feature",
      command: "/afx-spec new Build a dashboard for audit logs",
      defaultMode: "run",
    });
  });

  it("ignores low-confidence prose so the caller can fall back normally", () => {
    expect(detectAfxIntent("maybe later after lunch", EMPTY_DOC_CTX)).toBeNull();
  });
});
