/**
 * Conversation empty/loading/onboarding states.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-UI]
 * @see docs/specs/212-app-chat-messages/spec.md [FR-10] [FR-11]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-WELCOME-SPEC]
 */
import { memo, useState } from "react";

import {
  AlertTriangle,
  BookOpen,
  Boxes,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Lightbulb,
  LoaderCircle,
  MessageSquarePlus,
  StickyNote,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { WorkspaceMode } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { cn } from "@afx/ui/lib/utils";

import {
  ONBOARDING_INTENTS,
  ONBOARDING_SAMPLES,
  type CommandReceipt as OnboardingCommandReceipt,
  buildImproveExistingReceipt,
  buildPlanNewReceipt,
  buildResumeReceipt,
  buildSpecIdeaCommand,
  createCommandReceipt,
  detectAfxIntent,
  sanitizeSpecIdea,
} from "../../lib/afx-onboarding-intents";
import { bridgeSend } from "../../lib/bridge";
import { type ActiveDocCtx, describeDoc, resolveDocActions } from "../../lib/doc-actions";
import { AfxLogoIcon, AfxLogoMark } from "../afx-logo";
import { docKindVisual } from "../chat-doc-kind-visual";
import { CommandReceipt } from "../command-receipt";

// ---------------------------------------------------------------------------
// AgentSetupState — brief spinner shown during the initial host handshake.
// Persistent runtime issues now surface via the Pi pill in FooterStrip and the
// recovery controls in StatusBar — no full-screen takeover.
// ---------------------------------------------------------------------------

export const AgentSetupState = memo(function AgentSetupState() {
  return (
    <div
      className="mx-auto flex h-full w-full max-w-md flex-col justify-center px-3 py-8"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AfxLogoIcon size={14} className="text-afx-brand-soft" />
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
          <LoaderCircle size={11} className="animate-spin text-afx-brand-soft" />
          Connecting to agent…
        </div>
        <p className="text-[11px] text-muted-foreground/40">Loading workspace state</p>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// EmptyState — shown when there are no messages.
// ---------------------------------------------------------------------------

/** Groups of quick-command buttons shown when the chat is empty. */
const QUICK_COMMANDS: ReadonlyArray<{ label: string; commands: string[] }> = [
  { label: "Scaffold", commands: ["/afx-scaffold", "/afx-adr"] },
  { label: "Plan", commands: ["/afx-task", "/afx-spec", "/afx-sprint"] },
  { label: "Quality", commands: ["/afx-check", "/afx-report"] },
  { label: "Session", commands: ["/afx-next", "/afx-session", "/afx-context"] },
];

type LandingCardAction = "chat" | "workflow" | "spec";

const LANDING_CARDS: ReadonlyArray<{
  title: string;
  body: string;
  actionLabel: string;
  action: LandingCardAction;
  icon: LucideIcon;
}> = [
  {
    title: "Chat",
    body: "Ask about the repo or steer a turn.",
    actionLabel: "Ask",
    action: "chat",
    icon: MessageSquarePlus,
  },
  {
    title: "Workflow",
    body: "Open repo-backed docs, boards, notes.",
    actionLabel: "Open",
    action: "workflow",
    icon: BookOpen,
  },
  {
    title: "Spec",
    body: "Start traceable planning.",
    actionLabel: "Plan",
    action: "spec",
    icon: GitBranch,
  },
];

const EXPLORE_CARDS: ReadonlyArray<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "Inspect",
    body: "Read-only questions over provided context.",
    icon: BookOpen,
  },
  {
    title: "Trace",
    body: "Map behavior, risks, and dependencies.",
    icon: GitBranch,
  },
  {
    title: "Plan",
    body: "Shape the next move before Code mode.",
    icon: Lightbulb,
  },
];

const LANDING_STARTERS: ReadonlyArray<{ label: string; prompt: string }> = [
  {
    label: "Plan a new feature",
    prompt: "/afx-spec new ",
  },
  {
    label: "Ask about this repo",
    prompt:
      "Give me a concise orientation to this workspace: what it is, where the main app surfaces are, and what I should inspect first.",
  },
  {
    label: "Start a sprint",
    prompt:
      "I want to start a small piece of work in AFX sprint mode. Help me shape the feature name, scope, risks, and smallest useful v1 before creating anything.",
  },
  { label: "What do I do next?", prompt: "/afx-next" },
];

const EXPLORE_STARTERS: ReadonlyArray<{ label: string; prompt: string }> = [
  {
    label: "Orient me",
    prompt:
      "Explore mode: inspect this workspace read-only. Read files, list folders, and summarize what this project contains, what is uncertain, and what would require switching to Code mode.",
  },
  {
    label: "Find risks",
    prompt:
      "Explore mode: review the current context for likely risks, missing requirements, and follow-up questions. Keep it read-only and do not propose code edits.",
  },
  {
    label: "Plan next step",
    prompt:
      "Explore mode: help me plan the next useful step. Separate what can be answered from current context from what requires Code mode.",
  },
];

const SPEC_ONBOARDING_PROMPTS: ReadonlyArray<{
  label: string;
  description: string;
  prompt: string;
}> = [
  {
    label: "Create first spec",
    description: "Pick an example or bring your own idea, then choose spec or sprint.",
    prompt:
      "I want to create my first AFX spec. Guide me step by step. First offer me a few starting options I can pick from or replace: 1. a landing page for <product or project> aimed at <audience>, 2. a workflow/tooling feature for <user task>, 3. a bugfix or refactor around <problem area>, or 4. my own idea: <describe it>. After I choose, help me clarify the goal, users, scope, requirements, non-goals, risks, and smallest useful v1. At the end, recommend whether this should become an /afx-spec or an /afx-sprint, and explain why before creating anything.",
  },
  {
    label: "Explore an idea",
    description: "Shape a rough feature idea before creating docs. Ask clarifying questions first.",
    prompt:
      "I have a rough feature idea: <describe it>. Help me explore the problem, users, constraints, and possible approaches. Don't create a spec yet; ask the next useful questions.",
  },
  {
    label: "Start lean",
    description: "Use sprint mode for small work: one document, same discipline, less ceremony.",
    prompt:
      "Help me turn this into an AFX sprint candidate: <rough notes>. Keep it lean: one document, same discipline, less ceremony. First check what decisions are missing.",
  },
  {
    label: "Resume workflow",
    description: "Check current state, open questions, and the next useful action.",
    prompt: "/afx-next",
  },
];

const SPEC_GUIDE_CARDS: ReadonlyArray<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "Living specs",
    body: "Spec and design stay current; journal carries the history.",
    icon: StickyNote,
  },
  {
    title: "Traceability",
    body: "Code links back to requirements with @see anchors.",
    icon: GitBranch,
  },
  {
    title: "Sprint mode",
    body: "One document for small work; graduate when scope grows.",
    icon: Boxes,
  },
];

const SPEC_WORKFLOW_STEPS = ["Describe", "Spec", "Design", "Tasks", "Code"] as const;
const SPEC_QUICK_COMMANDS = ["/afx-next", "/afx-sprint new", "/afx-context load"] as const;

function suggestedDocPrompt(docContext: ActiveDocCtx): string {
  switch (docContext.docKind) {
    case "spec":
      return "Help me refine this spec. Look for unclear requirements, hidden assumptions, missing NFRs, open questions, and places where v1 scope can be smaller.";
    case "design":
      return "Review this design against the spec. Look for missing decisions, risky dependencies, unclear data flow, and places where implementation could drift.";
    case "tasks":
      return "Help me review these tasks. Check whether each task is atomic, traceable to spec/design, and ordered so implementation can start safely.";
    case "journal":
      return "Summarize this journal into current decisions, open questions, and anything that should be promoted into spec, design, tasks, or ADRs.";
    case "adr":
      return "Review this ADR. Help me clarify context, decision, consequences, tradeoffs, and whether anything should supersede or link to it.";
    case "research":
      return "Summarize this research into decisions, risks, alternatives, and conclusions that are ready to promote into AFX docs.";
    case "context":
      return "Use this context bundle to recap current state, blockers, open questions, and the next best action.";
    case null:
    default:
      return "/afx-next";
  }
}

function createLocalRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `workbench-${Date.now()}`;
}

/** Props for EmptyState — receives the insert callback to populate the composer. */
export interface EmptyStateProps {
  /** Called with command text when a quick-command button is clicked. */
  onInsert: (text: string) => void;
  onSwitchToSpec?: () => void;
  workspaceMode: WorkspaceMode;
  runtimeUnconfigured?: boolean;
  rpcEnabled?: boolean;
  onOpenSettings?: () => void;
}

/**
 * Shown when the chat has no messages and the agent is ready.
 * Displays the product onboarding surface, starter prompts, and demoted quick
 * commands while preserving the runtime setup and early-access affordances.
 */
export const EmptyState = memo(function EmptyState({
  onInsert,
  onSwitchToSpec,
  workspaceMode,
  runtimeUnconfigured = false,
  rpcEnabled = false,
  onOpenSettings,
}: EmptyStateProps) {
  const isExplore = workspaceMode === "explore";
  const starters = isExplore ? EXPLORE_STARTERS : LANDING_STARTERS;
  const intro = isExplore
    ? "Read-only. Use it to inspect code, trace behavior, and plan changes."
    : "Chat-first by default. Repo-backed notes, tasks, and docs you can actually see.";
  const detail = isExplore
    ? "Experimental. Explore can read files, list folders, search source, and read web pages. It blocks writes, mutating shell commands, and workspace changes."
    : "Most coding stays in chat. Use the workflow when work needs traceability between intent, design, tasks, and code.";

  function openWorkbench() {
    bridgeSend({ type: "chat/openWorkbench", requestId: createLocalRequestId() });
  }

  function runLandingCard(action: LandingCardAction): void {
    if (action === "chat") {
      onInsert(LANDING_STARTERS[1]?.prompt ?? "");
      return;
    }
    if (action === "workflow") {
      openWorkbench();
      return;
    }
    onSwitchToSpec?.();
    onInsert("/afx-spec new ");
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col gap-3 px-1 py-6">
      <div className="flex shrink-0 flex-col items-center gap-2 border-b border-border/70 pb-4 pt-1 text-center">
        <AfxLogoMark width={168} className="h-auto max-w-full text-foreground" />
        <p className="max-w-prose text-[12px] leading-relaxed text-foreground">{intro}</p>
        <p className="max-w-prose text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
      </div>

      {runtimeUnconfigured ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-foreground">No active runtime</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {rpcEnabled
                  ? "Add an API provider key, configure Ollama, or fix Pi CLI settings."
                  : "Add an API provider key, configure Ollama, or enable Pi RPC from Settings."}
              </p>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="mt-2"
                onClick={onOpenSettings}
                disabled={!onOpenSettings}
              >
                Open Settings
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-1.5">
        {isExplore
          ? EXPLORE_CARDS.map(({ title, body, icon: Icon }) => (
              <div
                key={title}
                className="afx-field-surface min-w-0 rounded-md border px-2 py-2 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={12} className="shrink-0 text-afx-brand-soft" aria-hidden />
                  <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground">
                    {title}
                  </p>
                </div>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{body}</p>
              </div>
            ))
          : LANDING_CARDS.map(({ title, body, icon: Icon, action, actionLabel }) => (
              <button
                key={title}
                type="button"
                onClick={() => runLandingCard(action)}
                aria-label={`${title}: ${actionLabel}`}
                className="afx-field-surface min-w-0 rounded-md border px-2 py-2 text-left transition-colors hover:border-afx-brand-soft/40 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={12} className="shrink-0 text-afx-brand-soft" aria-hidden />
                  <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground">
                    {title}
                  </p>
                </div>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{body}</p>
                <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-afx-brand-soft">
                  {actionLabel}
                  <ChevronRight size={10} aria-hidden />
                </span>
              </button>
            ))}
      </div>

      {!runtimeUnconfigured ? (
        <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Start here
          </p>
          <div className="flex flex-wrap gap-1.5">
            {starters.map((starter) => (
              <button
                key={starter.label}
                type="button"
                onClick={() => onInsert(starter.prompt)}
                className="rounded-sm border border-border bg-muted/20 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              >
                {starter.label}
              </button>
            ))}
          </div>
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Quick commands
          </p>
          <div className="flex flex-wrap gap-1.5 px-1">
            {QUICK_COMMANDS.flatMap((group) => group.commands).map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => onInsert(cmd)}
                className="inline-flex max-w-full min-w-0 items-center gap-1 break-all rounded-sm border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80 transition-colors hover:border-afx-brand-soft/40 hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-1 border-t border-border/50 pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
          Early access
        </p>
        <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground/60">
          <p>
            {rpcEnabled
              ? "Pi CLI and API provider models can run side by side; the model picker decides which one handles a turn."
              : "Add provider keys in Settings, then use the model picker to choose which model handles a turn."}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {rpcEnabled ? (
              <a
                href="https://pi.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-afx-brand-soft/70 hover:text-afx-brand-soft"
              >
                pi.dev
                <ExternalLink size={9} />
              </a>
            ) : null}
            <a
              href="https://github.com/AgenticFlowX/agenticflowx/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground/50 hover:text-muted-foreground"
            >
              GitHub Issues
              <ExternalLink size={9} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Logo-only loading shell — bridges the gap between the chat snapshot arriving
 * (which can have an empty thread) and the host settings snapshot arriving
 * (which carries the workspace mode). Without this gate the surface flashes
 * the default Code welcome card and then snaps to the Spec welcome a frame
 * later, which reads as a layout glitch.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-8]
 */
export const WelcomeShell = memo(function WelcomeShell() {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col items-center justify-center gap-3 px-1 py-6">
      <AfxLogoMark width={168} className="h-auto max-w-full text-foreground opacity-80" />
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-afx-brand-soft/60">
        Loading workspace…
      </p>
    </div>
  );
});

/**
 * Spec mode empty state — orient the user toward planning intents instead of
 * generic quick commands. Idle actions when no AFX doc is active; refine actions
 * when a sprint/standard doc is active.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-8]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-WELCOME-SPEC]
 */
export const SpecModeWelcome = memo(function SpecModeWelcome({
  docContext,
  onInsert,
  onAutoSend,
}: {
  docContext: ActiveDocCtx;
  /** Insert the slash command into the composer draft (default for dialogic verbs). */
  onInsert: (text: string) => void;
  /** Send the slash command immediately, bypassing the draft (deterministic verbs). */
  onAutoSend: (text: string) => void;
}) {
  const hasActiveDoc = docContext.docKind !== null;
  const [vibeText, setVibeText] = useState("");
  const [commandReceipt, setCommandReceipt] = useState<OnboardingCommandReceipt | null>(null);
  const [scopeChooserOpen, setScopeChooserOpen] = useState(false);
  const [sampleGridOpen, setSampleGridOpen] = useState(false);
  const [improveTargetOpen, setImproveTargetOpen] = useState(false);
  const [improveTargetText, setImproveTargetText] = useState("");

  // Doc-aware actions reuse the same routing table as the composer strip — up
  // to 5 actions per doc kind. @see docs/specs/212-app-chat-messages/spec.md [FR-8]
  const docActions = hasActiveDoc ? resolveDocActions(docContext).slice(0, 5) : [];

  // Per-doc subtext picks up the file kind so the welcome reads like the
  // assistant actually noticed what you opened.
  const subtext = hasActiveDoc
    ? docContext.docKind === "spec"
      ? "I'll help you sharpen the spec. We'll refine requirements, validate structure, and gate approval — without touching production code."
      : docContext.docKind === "design"
        ? "I'll help you evolve the design. We'll trace decisions, validate against the spec, and surface risks before code lands."
        : docContext.docKind === "tasks"
          ? "I'll help you slice the work. Pick the next task, scaffold its implementation, and verify it against spec + design."
          : docContext.docKind === "journal"
            ? "I'll help you capture decisions as you make them. Notes here promote into ADRs when a discussion crystallizes."
            : docContext.docKind === "adr"
              ? "I'll help you reason about this architecture decision. Review tradeoffs, supersede when context shifts, or list related ADRs."
              : docContext.docKind === "context"
                ? "I'll help you resume work from this handoff bundle. Load it to absorb state, save to regenerate, or analyze impact across features."
                : "I'll help you turn research into shippable specs. Compare alternatives, summarize findings, and promote conclusions when ready."
    : null;

  if (!hasActiveDoc) {
    const idea = sanitizeSpecIdea(vibeText);
    const intentPreview = detectAfxIntent(vibeText, docContext);

    function showReceipt(receipt: OnboardingCommandReceipt | null) {
      if (!receipt) return;
      setCommandReceipt(receipt);
      setScopeChooserOpen(false);
      setImproveTargetOpen(false);
    }

    function runReceipt(command: string) {
      setCommandReceipt(null);
      onAutoSend(command);
    }

    function insertReceipt(command: string) {
      setCommandReceipt(null);
      onInsert(command);
    }

    function submitIdea() {
      if (intentPreview) {
        setCommandReceipt(intentPreview);
        return;
      }
      const command = buildSpecIdeaCommand(vibeText);
      if (command) onAutoSend(command);
    }

    function openWorkbench() {
      bridgeSend({ type: "chat/openWorkbench", requestId: createLocalRequestId() });
    }

    return (
      <div className="mx-auto flex h-full w-full max-w-md flex-col gap-3 px-1 py-6">
        <div className="flex shrink-0 flex-col items-center gap-2 border-b border-border/70 pb-4 pt-1 text-center">
          <AfxLogoMark width={168} className="h-auto max-w-full text-foreground" />
          <h2 className="font-serif text-lg italic leading-snug text-foreground">
            Plan before you code.
          </h2>
          <p className="max-w-prose text-[12px] leading-relaxed text-foreground">
            Describe what you&apos;re building. AFX shapes it into specs, tasks, and traceable code
            — without you having to know SDD first.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
            What are you building?
          </p>
          <div className="rounded-md border border-border bg-background/70 p-2">
            <textarea
              value={vibeText}
              onChange={(event) => setVibeText(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitIdea();
                }
              }}
              placeholder="Short description - rough is fine..."
              className="min-h-16 w-full resize-y bg-transparent text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none"
              aria-label="What are you building?"
            />
            <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-1.5">
              <span className="font-mono text-[10px] text-muted-foreground/60">
                enter to start - agent asks what it needs
              </span>
              <button
                type="button"
                onClick={submitIdea}
                disabled={!idea}
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-afx-brand-soft disabled:cursor-not-allowed disabled:text-muted-foreground/40"
              >
                Start
              </button>
            </div>
          </div>
          {intentPreview ? (
            <div className="rounded-sm border border-afx-brand-soft/30 bg-afx-brand-soft/[0.04] px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Looks like: </span>
              {intentPreview.label}
              <code className="ml-1 font-mono text-[10px] text-afx-brand-soft">
                {intentPreview.command}
              </code>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Or choose a move
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {ONBOARDING_INTENTS.map((intent) => (
              <button
                key={intent.id}
                type="button"
                onClick={() => {
                  if (intent.id === "plan-new") {
                    setScopeChooserOpen((open) => !open);
                    setSampleGridOpen(false);
                    setImproveTargetOpen(false);
                    return;
                  }
                  if (intent.id === "try-sample") {
                    setSampleGridOpen((open) => !open);
                    setScopeChooserOpen(false);
                    setImproveTargetOpen(false);
                    return;
                  }
                  if (intent.id === "resume") {
                    showReceipt(buildResumeReceipt());
                    return;
                  }
                  const existingDocReceipt = buildImproveExistingReceipt(docContext);
                  if (existingDocReceipt) {
                    showReceipt(existingDocReceipt);
                    return;
                  }
                  setImproveTargetOpen((open) => !open);
                  setScopeChooserOpen(false);
                  setSampleGridOpen(false);
                }}
                className="rounded-md border border-border bg-muted/20 px-2 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              >
                <span className="block text-[11px] font-medium text-foreground">
                  {intent.label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                  {intent.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={openWorkbench}
          className="flex items-center gap-2 rounded-md border border-afx-brand-soft/25 bg-afx-brand-soft/[0.05] px-3 py-2 text-left transition-colors hover:border-afx-brand-soft/50 hover:bg-afx-brand-soft/[0.08] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-afx-brand-soft/10 text-afx-brand-soft">
            <Boxes size={15} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-medium text-foreground">Open Workbench</span>
            <span className="block text-[10px] leading-snug text-muted-foreground">
              See specs, tasks, documents, notes, and boards in the bottom panel.
            </span>
          </span>
        </button>

        {scopeChooserOpen ? (
          <div className="rounded-md border border-border/70 bg-muted/20 p-2">
            <p className="text-[12px] font-medium text-foreground">How big does this feel?</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => showReceipt(buildPlanNewReceipt("sprint", idea || "new feature"))}
                className="rounded-sm border border-border bg-background/70 px-2 py-1.5 text-left text-[11px] hover:bg-muted/40"
              >
                Small
              </button>
              <button
                type="button"
                onClick={() => showReceipt(buildPlanNewReceipt("full-spec", idea || "new feature"))}
                className="rounded-sm border border-border bg-background/70 px-2 py-1.5 text-left text-[11px] hover:bg-muted/40"
              >
                Full feature
              </button>
              <button
                type="button"
                onClick={() => showReceipt(buildResumeReceipt())}
                className="rounded-sm border border-border bg-background/70 px-2 py-1.5 text-left text-[11px] hover:bg-muted/40"
              >
                Not sure
              </button>
            </div>
          </div>
        ) : null}

        {improveTargetOpen ? (
          <div className="rounded-md border border-border/70 bg-muted/20 p-2">
            <p className="text-[12px] font-medium text-foreground">What should we improve?</p>
            <div className="mt-2 flex gap-1.5">
              <input
                value={improveTargetText}
                onChange={(event) => setImproveTargetText(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && improveTargetText.trim()) {
                    event.preventDefault();
                    showReceipt(
                      createCommandReceipt({
                        label: "Improve existing spec",
                        command: `/afx-spec refine ${improveTargetText.trim()}`,
                        originalText: improveTargetText.trim(),
                        vocabularyHint:
                          "Refine = update a living document with clearer facts, risks, or decisions.",
                        defaultMode: "insert",
                      }),
                    );
                  }
                }}
                placeholder="feature slug, spec path, or rough target"
                aria-label="Spec or sprint target"
                className="min-w-0 flex-1 rounded-sm border border-border bg-background/70 px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              />
              <button
                type="button"
                disabled={!improveTargetText.trim()}
                onClick={() =>
                  showReceipt(
                    createCommandReceipt({
                      label: "Improve existing spec",
                      command: `/afx-spec refine ${improveTargetText.trim()}`,
                      originalText: improveTargetText.trim(),
                      vocabularyHint:
                        "Refine = update a living document with clearer facts, risks, or decisions.",
                      defaultMode: "insert",
                    }),
                  )
                }
                className="rounded-sm border border-border bg-background/70 px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-afx-brand-soft hover:bg-muted/40 disabled:cursor-not-allowed disabled:text-muted-foreground/40"
              >
                Create
              </button>
            </div>
          </div>
        ) : null}

        {sampleGridOpen ? (
          <div className="grid grid-cols-2 gap-1.5">
            {ONBOARDING_SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => showReceipt(sample.receipt)}
                className="rounded-md border border-border bg-muted/20 px-2 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              >
                <span className="block text-[11px] font-medium text-foreground">
                  {sample.label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                  {sample.hint}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {commandReceipt ? (
          <CommandReceipt
            receipt={commandReceipt}
            onRun={runReceipt}
            onInsert={insertReceipt}
            onSendAsChat={(text) => {
              setCommandReceipt(null);
              onAutoSend(text);
            }}
          />
        ) : null}

        <div className="flex flex-col gap-2">
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50">
            Or jump straight in
          </p>
          {SPEC_ONBOARDING_PROMPTS.filter((item) => item.label !== "Create first spec").map(
            (item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onInsert(item.prompt)}
                className="afx-field-surface group rounded-md border px-3 py-2 text-left transition-colors hover:border-afx-brand-soft/40 hover:bg-muted/20 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              >
                <span className="block text-[12px] font-medium text-foreground">{item.label}</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
              </button>
            ),
          )}
        </div>

        <div className="border-t border-border/50 pt-3">
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            {SPEC_WORKFLOW_STEPS.map((step, index) => (
              <div key={step} className="flex items-center gap-1.5">
                <span className="rounded-sm border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
                  {step}
                </span>
                {index < SPEC_WORKFLOW_STEPS.length - 1 ? (
                  <ChevronRight size={10} className="text-muted-foreground/50" aria-hidden />
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-1 px-1 font-mono text-[10px] leading-relaxed text-muted-foreground/50">
            same discipline as SDD, lower friction to start
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {SPEC_GUIDE_CARDS.map(({ title, body, icon: Icon }) => (
            <div
              key={title}
              className="afx-field-surface min-w-0 rounded-md border px-2 py-2 text-left"
            >
              <div className="flex items-center gap-1.5">
                <Icon size={12} className="shrink-0 text-afx-brand-soft" aria-hidden />
                <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground">
                  {title}
                </p>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-border/50 pt-3">
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Quick commands
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 px-1">
            {SPEC_QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => onInsert(cmd)}
                className="inline-flex max-w-full min-w-0 items-center gap-1 break-all rounded-sm border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80 transition-colors hover:border-afx-brand-soft/40 hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>

        <p className="border-t border-border/50 pt-3 text-center text-[10px] leading-relaxed text-muted-foreground/70">
          Same skills. Same files. Same rules.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col gap-3 px-1 py-6">
      <div className="flex shrink-0 flex-col items-center gap-2 border-b border-border/70 pb-4 pt-1 text-center">
        <AfxLogoMark width={168} className="h-auto max-w-full text-foreground" />
        <h2 className="font-serif text-lg italic leading-snug text-foreground">
          Working on {describeDoc(docContext)}
        </h2>
        <p className="max-w-prose text-[11px] leading-relaxed text-muted-foreground">{subtext}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
          {(() => {
            const { icon: DocIcon, accent } = docKindVisual(docContext.docKind);
            return <DocIcon size={11} className={cn("shrink-0", accent)} aria-hidden />;
          })()}
          <span>Actions for {describeDoc(docContext)}</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {docActions.map((action) => (
            <button
              key={action.label}
              type="button"
              title={action.autoSend ? "Sends immediately" : "Insert into composer draft"}
              onClick={() =>
                action.autoSend ? onAutoSend(action.command) : onInsert(action.command)
              }
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-muted/20 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-muted/40"
            >
              {action.autoSend ? (
                <Zap size={11} className="shrink-0 text-amber-500" aria-hidden />
              ) : null}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-border/50 pt-3">
        <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
          Suggested prompt
        </p>
        <button
          type="button"
          onClick={() => onInsert(suggestedDocPrompt(docContext))}
          className="mt-2 w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-left text-[11px] leading-relaxed text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
        >
          {suggestedDocPrompt(docContext)}
        </button>
      </div>
      <p className="border-t border-border/50 pt-3 text-center text-[10px] leading-relaxed text-muted-foreground/70">
        Same skills. Same files. Same rules.
      </p>
    </div>
  );
});
