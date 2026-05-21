/**
 * First-run Workbench launchpad with bridge-backed starter actions.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-9] [FR-10] [FR-11]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LAUNCHPAD]
 */
import {
  ArrowRight,
  BookOpenCheck,
  FilePlus2,
  GitBranch,
  Layers3,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";

import { useWorkbench } from "../context/workbench-context";

type LaunchpadContext = "workbench" | "pipeline" | "documents";

const FULL_SPEC_COMMAND =
  "/afx-spec new Workbench tour Context: Create a complete spec, design, tasks, and journal for a focused onboarding improvement.";
const SPRINT_COMMAND =
  "/afx-sprint new sample-sprint-tour Context: Create a single-file sprint that captures a small Workbench onboarding pass.";

const WORKFLOW_STEPS = [
  ["Spec", "intent"],
  ["Design", "decisions"],
  ["Tasks", "slices"],
  ["Board", "movement"],
] as const;

const CONTEXT_COPY: Record<LaunchpadContext, { eyebrow: string; title: string; body: string }> = {
  workbench: {
    eyebrow: "Mission Control",
    title: "Start the first AFX feature",
    body: "Create a real workflow document or drop in a sample set. The tabs fill themselves from markdown.",
  },
  pipeline: {
    eyebrow: "Pipeline",
    title: "Your first feature will land here",
    body: "Once a spec exists, this view tracks readiness, next work, and delivery health.",
  },
  documents: {
    eyebrow: "Library",
    title: "Build the first planning doc",
    body: "Specs, designs, tasks, journals, ADRs, and research notes appear here as a readable workspace.",
  },
};

/**
 * Reusable empty-state launchpad for first-run Workbench surfaces.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-9] [FR-10] [FR-11]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LAUNCHPAD]
 */
export function WorkbenchLaunchpad({ context = "workbench" }: { context?: LaunchpadContext }) {
  const { send } = useWorkbench();
  const copy = CONTEXT_COPY[context];

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground"
      data-testid="workbench-launchpad"
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
                Live from markdown
              </Badge>
              <p className="hidden max-w-xl truncate text-sm text-muted-foreground md:block">
                {copy.body}
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 px-3 py-2">
          <LaunchAction
            icon={MessagesSquare}
            label="Full spec"
            detail="Draft spec/design/tasks"
            onClick={() =>
              send({ type: "afxOpenChatCommand", command: FULL_SPEC_COMMAND, mode: "insert" })
            }
          />
          <LaunchAction
            icon={GitBranch}
            label="Sprint doc"
            detail="Draft one markdown file"
            onClick={() =>
              send({ type: "afxOpenChatCommand", command: SPRINT_COMMAND, mode: "insert" })
            }
          />
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

function LaunchAction({
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="h-auto min-h-12 justify-start gap-2.5 whitespace-normal rounded-md px-2.5 py-1.5 text-left"
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
