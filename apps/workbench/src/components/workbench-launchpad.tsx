/**
 * First-run Workbench launchpad with bridge-backed starter actions.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-9] [FR-10] [FR-11]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LAUNCHPAD]
 */
import { useMemo, useState } from "react";

import {
  ArrowRight,
  BookOpenCheck,
  Bug,
  CheckSquare2,
  ClipboardList,
  FilePlus2,
  GitBranch,
  Layers3,
  MessagesSquare,
  PenLine,
  SearchCheck,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { classifySddDocumentPath, sddPrimaryActionForPath } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Progress } from "@afx/ui/components/progress";
import { cn } from "@afx/ui/lib/utils";

import { useWorkbench } from "../context/workbench-context";
import { docDisplayName, formatShortDate } from "../lib/document-studio";
import { getNextAction } from "../lib/pipeline";

type LaunchpadContext = "workbench" | "pipeline" | "documents";
type GuidedLaunchMode = "spec" | "sprint" | "bugfix" | "research" | "import" | "refine";

const FULL_SPEC_COMMAND = "/afx-spec new ";
const SPRINT_COMMAND = "/afx-sprint new ";
const BUGFIX_COMMAND = "/afx-sprint new bugfix-";
const RESEARCH_COMMAND = "/afx-research explore ";
const IMPORT_NOTES_COMMAND = "/afx-research summarize ";

const WORKFLOW_STEPS = [
  ["Spec", "intent"],
  ["Design", "decisions"],
  ["Tasks", "slices"],
  ["Board", "movement"],
] as const;

const CONTEXT_COPY: Record<LaunchpadContext, { eyebrow: string; title: string; body: string }> = {
  workbench: {
    eyebrow: "SDD Studio",
    title: "Refine product work",
    body: "Start, refine, preview, and ship from markdown-backed AFX docs.",
  },
  pipeline: {
    eyebrow: "Pipeline",
    title: "Refine delivery blockers",
    body: "Track readiness, next work, and lifecycle health across active features.",
  },
  documents: {
    eyebrow: "Library",
    title: "Refine SDD documents",
    body: "Browse specs, designs, tasks, journals, ADRs, and research notes.",
  },
};

const GUIDED_LAUNCH_MODES: Array<{
  mode: GuidedLaunchMode;
  icon: LucideIcon;
  label: string;
  detail: string;
}> = [
  {
    mode: "spec",
    icon: MessagesSquare,
    label: "Full spec",
    detail: "Spec -> design -> tasks",
  },
  { mode: "sprint", icon: GitBranch, label: "Fast sprint", detail: "Single-file SDD" },
  { mode: "bugfix", icon: Bug, label: "Bugfix", detail: "Repro -> fix -> proof" },
  { mode: "research", icon: SearchCheck, label: "Research", detail: "Compare and decide" },
  { mode: "import", icon: ClipboardList, label: "Import notes", detail: "Turn notes into SDD" },
  { mode: "refine", icon: CheckSquare2, label: "Refine existing", detail: "Continue active work" },
];

/**
 * Reusable empty-state launchpad for first-run Workbench surfaces.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-9] [FR-10] [FR-11]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LAUNCHPAD]
 */
export function WorkbenchLaunchpad({ context = "workbench" }: { context?: LaunchpadContext }) {
  const { documents, featureTasks, pipeline, send } = useWorkbench();
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [guidedMode, setGuidedMode] = useState<GuidedLaunchMode>("spec");
  const [guidedPrompt, setGuidedPrompt] = useState("");
  const [includeRecentDocs, setIncludeRecentDocs] = useState(true);
  const [includeOpenQuestions, setIncludeOpenQuestions] = useState(true);
  const copy = CONTEXT_COPY[context];
  const summary = summarizeStudioState(pipeline, documents.length);
  const activeRows = pipeline.filter((row) => row.featureStatus !== "Complete").slice(0, 4);
  const recentSddDocs = documents
    .filter((doc) => classifySddDocumentPath(doc.filePath))
    .sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""))
    .slice(0, 4);
  const openTaskCount = featureTasks.reduce(
    (count, feature) => count + Math.max(0, feature.total - feature.completed),
    0,
  );
  const selectedGuidedMode =
    GUIDED_LAUNCH_MODES.find((mode) => mode.mode === guidedMode) ?? GUIDED_LAUNCH_MODES[0];
  const guidedCommand = useMemo(
    () =>
      buildGuidedCommand(guidedMode, guidedPrompt, recentSddDocs, {
        includeRecentDocs,
        includeOpenQuestions,
      }),
    [guidedMode, guidedPrompt, includeOpenQuestions, includeRecentDocs, recentSddDocs],
  );
  const openGuidedStart = (mode: GuidedLaunchMode) => {
    setGuidedMode(mode);
    setGuidedOpen(true);
  };
  const submitGuidedCommand = (mode: "insert" | "send") => {
    send({ type: "afxOpenChatCommand", command: guidedCommand, mode });
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground"
      data-testid="workbench-launchpad"
      data-afx-sdd-studio="home"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <section className="border-b border-border px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-afx-brand/25 bg-afx-brand/10 text-afx-brand">
                <Layers3 size={16} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-afx-brand-soft">
                  {copy.eyebrow}
                </p>
                <h2 className="truncate text-base font-semibold leading-tight">{copy.title}</h2>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {summary.label}
              </Badge>
              <p className="hidden max-w-xl truncate text-sm text-muted-foreground md:block">
                {copy.body}
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-[repeat(auto-fit,minmax(154px,1fr))] gap-2 px-3 py-2">
          {GUIDED_LAUNCH_MODES.map((action) => (
            <LaunchAction
              key={action.mode}
              icon={action.icon}
              label={action.label}
              detail={action.detail}
              selected={guidedOpen && guidedMode === action.mode}
              onClick={() => openGuidedStart(action.mode)}
            />
          ))}
          <LaunchAction
            icon={FilePlus2}
            label="Sample SDD set"
            detail="Create full doc set"
            onClick={() => send({ type: "afxCreateSampleDocs", kind: "full-spec" })}
          />
          <LaunchAction
            icon={BookOpenCheck}
            label="Sample sprint"
            detail="Create one sprint doc"
            onClick={() => send({ type: "afxCreateSampleDocs", kind: "sprint" })}
          />
        </section>

        {guidedOpen ? (
          <GuidedStartDrawer
            mode={selectedGuidedMode}
            allModes={GUIDED_LAUNCH_MODES}
            command={guidedCommand}
            prompt={guidedPrompt}
            includeRecentDocs={includeRecentDocs}
            includeOpenQuestions={includeOpenQuestions}
            recentDocPath={recentSddDocs[0]?.filePath ?? null}
            onModeChange={setGuidedMode}
            onPromptChange={setGuidedPrompt}
            onIncludeRecentDocsChange={setIncludeRecentDocs}
            onIncludeOpenQuestionsChange={setIncludeOpenQuestions}
            onPreviewRecentDoc={() => {
              const recent = recentSddDocs[0];
              if (recent) {
                send({ type: "afxOpenFile", path: recent.filePath, mode: "afxPreview" });
              }
            }}
            onDraft={() => submitGuidedCommand("insert")}
            onStart={() => submitGuidedCommand("send")}
            onClose={() => setGuidedOpen(false)}
          />
        ) : null}

        <section className="grid min-h-0 grid-cols-1 gap-2 px-3 pb-2 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-md border border-border/70 bg-muted/10">
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border/60 px-2.5 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Active refinement
              </span>
              <Badge variant="outline" className="text-[10px]">
                {openTaskCount} open
              </Badge>
            </div>
            {activeRows.length > 0 ? (
              <ul className="divide-y divide-border/50">
                {activeRows.map((row) => {
                  const progress =
                    row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
                  const next = getNextAction(row);
                  const nextCommand = next.path ? sddPrimaryActionForPath(next.path) : null;
                  return (
                    <li key={row.name} className="px-2.5 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            row.featureStatus === "Blocked"
                              ? "bg-amber-400"
                              : row.featureStatus === "Complete"
                                ? "bg-afx-success"
                                : "bg-afx-brand",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {row.name}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {row.completed}/{row.total}
                        </span>
                      </div>
                      <div className="mt-1.5 flex min-w-0 items-center gap-2">
                        <Progress value={progress} className="h-1 flex-1" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="h-6 shrink-0 gap-1 px-1.5 text-[10px]"
                          onClick={() => {
                            if (nextCommand) {
                              send({
                                type: "afxOpenChatCommand",
                                command: nextCommand.command,
                                mode: nextCommand.mode,
                              });
                              return;
                            }
                            if (next.path) {
                              send({ type: "afxOpenFile", path: next.path, mode: "afxPreview" });
                            }
                          }}
                        >
                          <PenLine size={11} aria-hidden />
                          {nextCommand?.label ?? next.label}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                No active SDD work is loaded.
              </p>
            )}
          </div>

          <div className="rounded-md border border-border/70 bg-muted/10">
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border/60 px-2.5 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Changed docs
              </span>
              <Badge variant="outline" className="text-[10px]">
                {recentSddDocs.length}
              </Badge>
            </div>
            {recentSddDocs.length > 0 ? (
              <ul className="divide-y divide-border/50">
                {recentSddDocs.map((doc) => {
                  const info = classifySddDocumentPath(doc.filePath);
                  const primary = sddPrimaryActionForPath(doc.filePath);
                  return (
                    <li key={doc.filePath} className="px-2.5 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className="shrink-0 px-1.5 text-[10px]">
                          {info?.label ?? doc.type}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {docDisplayName(doc)}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {formatShortDate(doc.updatedAt) ?? "—"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex min-w-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="h-6 gap-1 px-1.5 text-[10px]"
                          onClick={() =>
                            send({ type: "afxOpenFile", path: doc.filePath, mode: "afxPreview" })
                          }
                        >
                          <BookOpenCheck size={11} aria-hidden />
                          Preview
                        </Button>
                        {primary ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="h-6 min-w-0 gap-1 px-1.5 text-[10px]"
                            onClick={() =>
                              send({
                                type: "afxOpenChatCommand",
                                command: primary.command,
                                mode: primary.mode,
                              })
                            }
                          >
                            <PenLine size={11} aria-hidden />
                            <span className="truncate">{primary.label}</span>
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                New or changed SDD docs appear here.
              </p>
            )}
          </div>
        </section>

        <section className="px-3 pb-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5">
            <div className="flex items-center gap-2 pr-1">
              <Sparkles size={14} className="text-afx-brand" aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Workflow map
              </span>
            </div>
            {WORKFLOW_STEPS.map(([label, detail], index) => (
              <span key={label} className="flex min-w-0 items-center gap-2">
                {index > 0 ? (
                  <ArrowRight size={13} className="shrink-0 text-muted-foreground/70" aria-hidden />
                ) : null}
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="text-sm font-medium leading-none">{label}</span>
                  <span className="text-xs leading-none text-muted-foreground">{detail}</span>
                </span>
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function summarizeStudioState(
  pipeline: Array<{ featureStatus: string; completed: number; total: number }>,
  documentCount: number,
): { label: string } {
  if (pipeline.length === 0 && documentCount === 0) return { label: "Ready" };
  const complete = pipeline.filter((row) => row.featureStatus === "Complete").length;
  const active = pipeline.length - complete;
  const openTasks = pipeline.reduce((sum, row) => sum + Math.max(0, row.total - row.completed), 0);
  if (active > 0) return { label: `${active} active · ${openTasks} open` };
  if (documentCount > 0) return { label: `${documentCount} docs` };
  return { label: "Ready" };
}

function buildGuidedCommand(
  mode: GuidedLaunchMode,
  prompt: string,
  recentSddDocs: readonly { filePath: string }[],
  options: { includeRecentDocs: boolean; includeOpenQuestions: boolean },
): string {
  const topic = topicSlug(prompt);
  const constraints = guidedCommandConstraints(options, recentSddDocs.length > 0);
  const withConstraints = (base: string) =>
    constraints.length > 0 ? `${base} ${constraints.join("; ")}` : base;

  if (mode === "refine") {
    const recentPrimary =
      options.includeRecentDocs && recentSddDocs[0]
        ? sddPrimaryActionForPath(recentSddDocs[0].filePath)
        : null;
    return withConstraints(recentPrimary?.command ?? `/afx-spec refine ${topic}`);
  }
  if (mode === "sprint") return withConstraints(`${SPRINT_COMMAND}${topic}`);
  if (mode === "bugfix") return withConstraints(`${BUGFIX_COMMAND}${topic}`);
  if (mode === "research") return withConstraints(`${RESEARCH_COMMAND}${topic}`);
  if (mode === "import")
    return withConstraints(`${IMPORT_NOTES_COMMAND}${topic || "active-notes"}`);
  return withConstraints(`${FULL_SPEC_COMMAND}${topic}`);
}

function guidedCommandConstraints(
  options: { includeRecentDocs: boolean; includeOpenQuestions: boolean },
  hasRecentSddDocs: boolean,
): string[] {
  return [
    options.includeRecentDocs && hasRecentSddDocs ? "using recent SDD context" : null,
    options.includeOpenQuestions ? "ask open questions first" : null,
  ].filter((constraint): constraint is string => Boolean(constraint));
}

function topicSlug(prompt: string): string {
  const normalized = prompt
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "new-feature";
}

function GuidedStartDrawer({
  mode,
  allModes,
  command,
  prompt,
  includeRecentDocs,
  includeOpenQuestions,
  recentDocPath,
  onModeChange,
  onPromptChange,
  onIncludeRecentDocsChange,
  onIncludeOpenQuestionsChange,
  onPreviewRecentDoc,
  onDraft,
  onStart,
  onClose,
}: {
  mode: (typeof GUIDED_LAUNCH_MODES)[number];
  allModes: typeof GUIDED_LAUNCH_MODES;
  command: string;
  prompt: string;
  includeRecentDocs: boolean;
  includeOpenQuestions: boolean;
  recentDocPath: string | null;
  onModeChange: (mode: GuidedLaunchMode) => void;
  onPromptChange: (value: string) => void;
  onIncludeRecentDocsChange: (value: boolean) => void;
  onIncludeOpenQuestionsChange: (value: boolean) => void;
  onPreviewRecentDoc: () => void;
  onDraft: () => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const Icon = mode.icon;
  // Refine targets an existing document. Without a recent doc in context or a
  // typed outcome the command would be `/afx-spec refine new-feature` — a
  // dead-end against a feature that does not exist.
  const refineLacksTarget =
    mode.mode === "refine" && !(includeRecentDocs && recentDocPath) && prompt.trim().length === 0;
  return (
    <section
      data-testid="sdd-guided-start-drawer"
      aria-label="New SDD guided start"
      className="mx-3 mb-2 rounded-md border border-afx-brand/30 bg-afx-brand/[0.04] shadow-sm"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-afx-brand/20 px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-afx-brand/10 text-afx-brand">
            <Icon size={15} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-afx-brand-soft">
              Guided start
            </p>
            <h3 className="truncate text-sm font-semibold">{mode.label}</h3>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7 px-2"
          aria-label="Close guided start"
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      <div className="grid gap-2 px-2.5 py-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 flex-wrap gap-1">
            {allModes.map((item) => {
              const ModeIcon = item.icon;
              return (
                <Button
                  key={item.mode}
                  type="button"
                  variant={item.mode === mode.mode ? "secondary" : "outline"}
                  size="xs"
                  className="h-7 gap-1 px-2 text-[10px]"
                  aria-pressed={item.mode === mode.mode}
                  onClick={() => onModeChange(item.mode)}
                >
                  <ModeIcon size={11} aria-hidden />
                  {item.label}
                </Button>
              );
            })}
          </div>

          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Outcome
            </span>
            <textarea
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              aria-label="Describe the SDD outcome"
              placeholder="Example: checkout redesign, warranty claims API, importer bug"
              className="min-h-16 w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 text-sm leading-relaxed outline-none focus:border-afx-brand focus:ring-2 focus:ring-afx-brand/20"
            />
          </label>

          <div className="flex min-w-0 flex-wrap gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={includeRecentDocs}
                onChange={(event) => onIncludeRecentDocsChange(event.target.checked)}
              />
              Include recent SDD context
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={includeOpenQuestions}
                onChange={(event) => onIncludeOpenQuestionsChange(event.target.checked)}
              />
              Ask open questions first
            </label>
          </div>
        </div>

        <div className="min-w-0 rounded-md border border-border/70 bg-background/80 p-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Next command
          </p>
          <code className="mt-1 block min-w-0 whitespace-pre-wrap break-words rounded-sm bg-muted/45 px-2 py-1.5 font-mono text-[11px] leading-4 text-foreground">
            {command}
          </code>
          <div className="mt-2 flex min-w-0 flex-wrap gap-1">
            <Button
              type="button"
              variant="default"
              size="xs"
              className="h-7"
              onClick={onDraft}
              disabled={refineLacksTarget}
            >
              Draft command
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="h-7"
              onClick={onStart}
              disabled={refineLacksTarget}
            >
              Start now
            </Button>
            {recentDocPath ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-7 min-w-0"
                onClick={onPreviewRecentDoc}
              >
                <BookOpenCheck size={11} aria-hidden />
                <span className="truncate">Preview recent</span>
              </Button>
            ) : null}
          </div>
          {refineLacksTarget ? (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-500">
              Refine needs an existing target — enable recent SDD context, describe what to refine,
              or pick Full spec to start something new.
            </p>
          ) : (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {includeRecentDocs
                ? "Recent SDD docs stay in context; the command remains editable in chat."
                : "Starts with a clean prompt and no recent SDD context hint."}{" "}
              {includeOpenQuestions ? "AFX will refine unresolved questions first." : ""}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function LaunchAction({
  icon: Icon,
  label,
  detail,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "h-auto min-h-12 justify-start gap-2.5 whitespace-normal rounded-md px-2.5 py-1.5 text-left",
        selected ? "border-afx-brand/45 bg-afx-brand/10 shadow-sm" : "",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-afx-brand/10 text-afx-brand">
        <Icon size={15} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-normal text-sm font-medium leading-tight">{label}</span>
        <span className="block whitespace-normal text-xs leading-4 text-muted-foreground">
          {detail}
        </span>
      </span>
    </Button>
  );
}
