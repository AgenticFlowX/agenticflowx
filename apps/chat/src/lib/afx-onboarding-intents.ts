/** Static intent catalog and pure helpers for Spec mode onboarding. */
import type { ActiveDocCtx } from "./doc-actions";

export type OnboardingIntentId = "plan-new" | "improve-existing" | "resume" | "try-sample";

export type PlanScope = "sprint" | "full-spec";

export type CommandReceiptMode = "run" | "insert";

export type CommandReceipt = Readonly<{
  label: string;
  command: string;
  originalText?: string;
  vocabularyHint: string;
  defaultMode: CommandReceiptMode;
}>;

export type IntentPreview = CommandReceipt &
  Readonly<{
    intent: "approve" | "new-feature" | "refine" | "resume" | "review" | "validate";
  }>;

export type OnboardingIntent = Readonly<{
  id: OnboardingIntentId;
  label: string;
  hint: string;
  vocabularyHint: string;
  defaultMode: CommandReceiptMode;
}>;

export type OnboardingSampleId =
  | "tiny-ui-polish"
  | "risky-backend-change"
  | "refactor"
  | "turn-notes-into-work";

export type OnboardingSample = Readonly<{
  id: OnboardingSampleId;
  label: string;
  hint: string;
  teachingGoal: string;
  receipt: CommandReceipt;
}>;

export type IntentResolution =
  | Readonly<{ kind: "receipt"; receipt: CommandReceipt }>
  | Readonly<{ kind: "scope-follow-up"; intent: "plan-new" }>
  | Readonly<{ kind: "target-follow-up"; intent: "improve-existing" }>
  | Readonly<{ kind: "sample-grid"; intent: "try-sample" }>;

type ReceiptInput = {
  label: string;
  command: string;
  vocabularyHint: string;
  defaultMode?: CommandReceiptMode;
  originalText?: string;
};

type IntentContext = Pick<ActiveDocCtx, "docKind" | "feature" | "format" | "filePath">;

const MAX_IDEA_LENGTH = 200;
const MAX_SLUG_LENGTH = 48;

export const ONBOARDING_INTENTS = Object.freeze([
  {
    id: "plan-new",
    label: "Plan a new feature",
    hint: "Describe the outcome first; choose lean sprint or full spec when scope is clearer.",
    vocabularyHint: "Plan = turn rough intent into an AFX workflow before coding.",
    defaultMode: "insert",
  },
  {
    id: "improve-existing",
    label: "Improve an existing spec",
    hint: "Refine a living spec or sprint with new facts, risks, or decisions.",
    vocabularyHint: "Refine = update the living document without advancing a lifecycle gate.",
    defaultMode: "insert",
  },
  {
    id: "resume",
    label: "Resume workflow",
    hint: "Ask AFX to inspect context and recommend the next best move.",
    vocabularyHint: "/afx-next reads the repo context and recommends what to do next.",
    defaultMode: "run",
  },
  {
    id: "try-sample",
    label: "Try a sample",
    hint: "Open realistic starter prompts and learn the workflow through editable commands.",
    vocabularyHint: "Samples are local command drafts; nothing changes until you run one.",
    defaultMode: "insert",
  },
] satisfies readonly OnboardingIntent[]);

export const ONBOARDING_SAMPLES = Object.freeze([
  {
    id: "tiny-ui-polish",
    label: "Tiny UI polish",
    hint: "A compact sprint for a visible, low-risk UX improvement.",
    teachingGoal: "Sprint is for small, surgical work.",
    receipt: createCommandReceipt({
      label: "Plan tiny UI polish",
      command:
        "/afx-sprint new compact-empty-state Context: Add a compact empty state for first-time users. Keep v1 small.",
      vocabularyHint: "Sprint = one-file SDD for small, surgical feature work.",
      defaultMode: "insert",
    }),
  },
  {
    id: "risky-backend-change",
    label: "Risky backend change",
    hint: "A fuller spec path for data, compliance, and rollback concerns.",
    teachingGoal: "Full spec path for riskier work.",
    receipt: createCommandReceipt({
      label: "Plan risky backend change",
      command:
        "/afx-spec create audit-logging Context: Add audit logging to account deletion with compliance and rollback considerations.",
      vocabularyHint: "Spec = shape requirements and risks before design and task slicing.",
      defaultMode: "insert",
    }),
  },
  {
    id: "refactor",
    label: "Refactor",
    hint: "Use SDD to protect behavior while changing structure.",
    teachingGoal: "SDD can guide refactors too.",
    receipt: createCommandReceipt({
      label: "Plan composer refactor",
      command:
        "/afx-sprint new composer-refactor Context: Split the chat composer into smaller components without changing behavior.",
      vocabularyHint: "Refactor work still benefits from explicit scope and verification.",
      defaultMode: "insert",
    }),
  },
  {
    id: "turn-notes-into-work",
    label: "Turn notes into work",
    hint: "Start from rough prose and let the workflow extract the useful shape.",
    teachingGoal: "Rough prose is enough to start.",
    receipt: createCommandReceipt({
      label: "Turn notes into work",
      command:
        "/afx-sprint new notes-to-plan Context: Convert rough notes into requirements, risks, and a smallest useful v1.",
      vocabularyHint: "Describe = rough notes are enough for the agent to ask what it needs.",
      defaultMode: "insert",
    }),
  },
] satisfies readonly OnboardingSample[]);

export function createCommandReceipt(input: ReceiptInput): CommandReceipt {
  const command = normalizeCommand(input.command);

  return Object.freeze({
    label: input.label.trim(),
    command,
    ...(input.originalText ? { originalText: input.originalText } : {}),
    vocabularyHint: input.vocabularyHint.trim(),
    defaultMode: input.defaultMode ?? "insert",
  });
}

export function sanitizeSpecIdea(value: string, maxLength = MAX_IDEA_LENGTH): string {
  return value
    .replace(/^\s*\//, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(0, maxLength));
}

export function buildSpecIdeaCommand(value: string): string | null {
  const idea = sanitizeSpecIdea(value);
  return idea ? `/afx-spec new ${idea}` : null;
}

export function buildPlanNewReceipt(scope: PlanScope, idea: string): CommandReceipt | null {
  const sanitizedIdea = sanitizeSpecIdea(idea);
  if (!sanitizedIdea) return null;

  const slug = slugifyFeatureName(sanitizedIdea);
  const command =
    scope === "sprint"
      ? `/afx-sprint new ${slug} Context: ${sanitizedIdea}`
      : `/afx-spec create ${slug} Context: ${sanitizedIdea}`;

  return createCommandReceipt({
    label: scope === "sprint" ? "Start lean sprint" : "Create full feature spec",
    command,
    originalText: sanitizedIdea,
    vocabularyHint:
      scope === "sprint"
        ? "Sprint = one-file SDD for small, surgical feature work."
        : "Spec = shape requirements and risks before design and task slicing.",
    defaultMode: "insert",
  });
}

export function buildImproveExistingReceipt(ctx: IntentContext): CommandReceipt | null {
  const target = getContextTarget(ctx);
  if (!target) return null;

  const isSprint = ctx.format === "sprint";
  return createCommandReceipt({
    label: "Improve existing spec",
    command: isSprint ? `/afx-sprint refine ${target}` : `/afx-spec refine ${target}`,
    vocabularyHint: "Refine = update a living document with clearer facts, risks, or decisions.",
    defaultMode: "insert",
  });
}

export function buildResumeReceipt(): CommandReceipt {
  return createCommandReceipt({
    label: "Find next best move",
    command: "/afx-next",
    vocabularyHint: "/afx-next reads context and recommends what to do next.",
    defaultMode: "run",
  });
}

export function buildSampleReceipt(sampleId: OnboardingSampleId): CommandReceipt | null {
  return ONBOARDING_SAMPLES.find((sample) => sample.id === sampleId)?.receipt ?? null;
}

export function resolveOnboardingIntent(
  intentId: OnboardingIntentId,
  ctx: IntentContext,
): IntentResolution {
  switch (intentId) {
    case "plan-new":
      return { kind: "scope-follow-up", intent: "plan-new" };
    case "improve-existing": {
      const receipt = buildImproveExistingReceipt(ctx);
      return receipt
        ? { kind: "receipt", receipt }
        : { kind: "target-follow-up", intent: "improve-existing" };
    }
    case "resume":
      return { kind: "receipt", receipt: buildResumeReceipt() };
    case "try-sample":
      return { kind: "sample-grid", intent: "try-sample" };
  }
}

export function detectAfxIntent(text: string, ctx: IntentContext): IntentPreview | null {
  const idea = sanitizeSpecIdea(text);
  if (!idea) return null;

  const value = idea.toLowerCase();
  const target = getContextTarget(ctx);

  if (/\b(next|resume|stuck|continue|what now|where next)\b/.test(value)) {
    return toIntentPreview("resume", buildResumeReceipt(), idea);
  }

  if (/\b(approve|sign off|ship it|ready to approve)\b/.test(value)) {
    return toLifecyclePreview("approve", ctx, target, idea);
  }

  if (/\b(validate|validation|check schema|gate check)\b/.test(value)) {
    return toLifecyclePreview("validate", ctx, target, idea);
  }

  if (/\b(review|ready|quality|risk|risks|readiness)\b/.test(value)) {
    return toLifecyclePreview("review", ctx, target, idea);
  }

  if (/\b(refine|improve|tighten|revise|update|clarify)\b/.test(value)) {
    return toLifecyclePreview("refine", ctx, target, idea);
  }

  if (/\b(plan|build|create|new feature|start|implement|add)\b/.test(value)) {
    const command = buildSpecIdeaCommand(idea);
    if (!command) return null;
    return toIntentPreview(
      "new-feature",
      createCommandReceipt({
        label: "Plan a new feature",
        command,
        originalText: idea,
        vocabularyHint: "Describe = rough feature prose becomes an editable spec-start command.",
        defaultMode: "run",
      }),
      idea,
    );
  }

  return null;
}

function toLifecyclePreview(
  intent: "approve" | "refine" | "review" | "validate",
  ctx: IntentContext,
  target: string | null,
  originalText: string,
): IntentPreview | null {
  const command = buildLifecycleCommand(intent, ctx, target);
  if (!command) return null;

  return toIntentPreview(
    intent,
    createCommandReceipt({
      label: lifecycleLabel(intent, ctx.docKind),
      command,
      originalText,
      vocabularyHint: lifecycleVocabulary(intent),
      defaultMode: intent === "refine" ? "insert" : "run",
    }),
    originalText,
  );
}

function toIntentPreview(
  intent: IntentPreview["intent"],
  receipt: CommandReceipt,
  originalText: string,
): IntentPreview {
  return Object.freeze({
    ...receipt,
    originalText,
    intent,
  });
}

function buildLifecycleCommand(
  intent: "approve" | "refine" | "review" | "validate",
  ctx: IntentContext,
  target: string | null,
): string | null {
  const suffix = target ? ` ${target}` : "";

  if (ctx.format === "sprint") {
    if (intent === "validate" || intent === "review") return `/afx-sprint verify${suffix}`;
    if (intent === "approve") return `/afx-sprint ${sprintSection(ctx.docKind)}${suffix} --approve`;
    return `/afx-sprint refine${suffix}`;
  }

  switch (ctx.docKind) {
    case "design":
      return `/afx-design ${intent}${suffix}`;
    case "tasks":
      if (intent === "approve") return null;
      return `/afx-task ${intent === "refine" ? "refine" : intent}${suffix}`;
    case "spec":
      return `/afx-spec ${intent}${suffix}`;
    case "adr":
    case "context":
    case "journal":
    case "research":
    case null:
      if (intent === "refine") return target ? `/afx-spec refine ${target}` : "/afx-spec refine";
      return null;
  }
}

function lifecycleLabel(
  intent: "approve" | "refine" | "review" | "validate",
  docKind: IntentContext["docKind"],
): string {
  const subject = docKind === "design" ? "design" : docKind === "tasks" ? "tasks" : "spec";

  switch (intent) {
    case "approve":
      return `Approve ${subject}`;
    case "refine":
      return `Refine ${subject}`;
    case "review":
      return `Review ${subject} quality`;
    case "validate":
      return `Validate ${subject}`;
  }
}

function lifecycleVocabulary(intent: "approve" | "refine" | "review" | "validate"): string {
  switch (intent) {
    case "approve":
      return "Approve = advance a lifecycle gate after the artifact is ready.";
    case "refine":
      return "Refine = update a living document with clearer facts, risks, or decisions.";
    case "review":
      return "Review = quality judgment for ambiguity, risk, and readiness.";
    case "validate":
      return "Validate = structural and requirement checks before advancing.";
  }
}

function getContextTarget(ctx: IntentContext): string | null {
  return ctx.feature?.trim() || ctx.filePath?.trim() || null;
}

function sprintSection(docKind: IntentContext["docKind"]): "design" | "spec" | "task" {
  if (docKind === "design") return "design";
  if (docKind === "tasks") return "task";
  return "spec";
}

function normalizeCommand(command: string): string {
  return command.replace(/\s+/g, " ").trim();
}

function slugifyFeatureName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug || "new-feature";
}
