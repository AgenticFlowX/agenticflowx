/**
 * Progressive Canvas starters for first-time planning through advanced maps.
 * Every starter is standard JSON Canvas text/edge content.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-27] [FR-38] [FR-44]
 */
import {
  Boxes,
  DraftingCompass,
  GitBranch,
  Lightbulb,
  type LucideIcon,
  Map,
  PanelsTopLeft,
  Presentation,
  SquareDashed,
} from "lucide-react";

import type { CanvasTemplateId } from "@afx/canvas-engine";

interface CanvasStarter {
  id: CanvasTemplateId;
  label: string;
  description: string;
  level: "Start here" | "Planning" | "Architecture";
  icon: LucideIcon;
}

const STARTERS: readonly CanvasStarter[] = [
  {
    id: "blank",
    label: "Blank canvas",
    description: "Start with an open space and add only what you need.",
    level: "Start here",
    icon: SquareDashed,
  },
  {
    id: "ideas",
    label: "Explore an idea",
    description: "Question, evidence, possibilities, and the next experiment.",
    level: "Start here",
    icon: Lightbulb,
  },
  {
    id: "feature",
    label: "Plan a feature",
    description: "Outcome, user problem, constraints, acceptance, and handoff.",
    level: "Planning",
    icon: PanelsTopLeft,
  },
  {
    id: "roadmap",
    label: "Build a roadmap",
    description: "Map now, next, later, and risks without a rigid process.",
    level: "Planning",
    icon: Map,
  },
  {
    id: "next-spec",
    label: "Shape the next spec",
    description: "Clarify intent, scope, dependencies, and open questions.",
    level: "Planning",
    icon: GitBranch,
  },
  {
    id: "low-fidelity",
    label: "Low-fidelity workshop",
    description: "Rough flows, sketches, alternatives, and questions to test.",
    level: "Planning",
    icon: Boxes,
  },
  {
    id: "architecture",
    label: "Architecture map",
    description: "Actors, services, data, runtime boundaries, quality, and risk.",
    level: "Architecture",
    icon: DraftingCompass,
  },
  {
    id: "high-fidelity",
    label: "Presentation map",
    description: "A structured, review-ready architecture narrative and legend.",
    level: "Architecture",
    icon: Presentation,
  },
];

export interface CanvasStarterGalleryProps {
  onApply: (template: CanvasTemplateId) => void;
  compact?: boolean;
}

export function CanvasStarterGallery({ onApply, compact = false }: CanvasStarterGalleryProps) {
  return (
    <section aria-label="Canvas starters" className="min-w-0">
      {!compact ? (
        <div className="mb-3 text-center">
          <h2 className="text-sm font-medium">What are you mapping?</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Pick a starting shape. Everything remains editable and portable.
          </p>
        </div>
      ) : null}
      <div
        className={
          compact
            ? "flex max-w-full gap-1 overflow-x-auto pb-0.5"
            : "grid max-h-[min(54vh,28rem)] grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2"
        }
      >
        {STARTERS.map((starter) => {
          const Icon = starter.icon;
          return (
            <button
              key={starter.id}
              type="button"
              className={`group flex text-left hover:border-afx-brand/60 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                compact
                  ? "w-36 shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1.5"
                  : "min-h-20 items-start gap-2 rounded-md border p-2.5"
              }`}
              onClick={() => onApply(starter.id)}
            >
              <Icon size={compact ? 13 : 16} className="mt-0.5 shrink-0 text-afx-brand-soft" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium">{starter.label}</span>
                {!compact ? (
                  <>
                    <span className="mt-0.5 line-clamp-2 block text-[10px] leading-4 text-muted-foreground">
                      {starter.description}
                    </span>
                    <span className="mt-1 inline-block rounded-sm border px-1 text-[8px] uppercase tracking-wide text-muted-foreground">
                      {starter.level}
                    </span>
                  </>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function canvasStarterLabel(template: CanvasTemplateId): string {
  return STARTERS.find((starter) => starter.id === template)?.label ?? "Canvas starter";
}
