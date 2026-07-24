/**
 * Workbench root shell — tab layout for all workbench views.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-1] [FR-5] [FR-8] [FR-11]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-MOCKUP] [DES-SHELL-TABS]
 */
import { Suspense, lazy, useState } from "react";
import type { ComponentType } from "react";

import {
  BarChart2,
  BookOpen,
  Files,
  GitBranch,
  Layers,
  LayoutDashboard,
  Loader2,
  NotepadText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { WorkbenchViewId } from "@afx/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@afx/ui/components/tabs";
import { cn } from "@afx/ui/lib/utils";

import { WorkbenchProvider } from "./context/workbench-context";
import { useWorkbench } from "./context/workbench-context";
import { isInVsCodeWebview } from "./lib/bridge";
import { MOCK_WORKBENCH_STATE } from "./lib/mock-data";
import { nextWorkbenchView, visibleWorkbenchViews } from "./lib/workbench-views";
import Analytics from "./views/analytics";
import Board from "./views/board";
import Documents from "./views/documents";
import Journal from "./views/journal";
import Notes from "./views/notes";
import Pipeline from "./views/pipeline";
import WorkbenchTab from "./views/workbench";

const Canvas = lazy(() => import("./views/canvas"));

const VIEW_DEFINITIONS: ReadonlyArray<{
  id: WorkbenchViewId;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
}> = [
  { id: "workbench", label: "SDD Studio", icon: Layers, component: WorkbenchTab },
  { id: "pipeline", label: "Pipeline", icon: GitBranch, component: Pipeline },
  { id: "documents", label: "Documents", icon: Files, component: Documents },
  { id: "analytics", label: "Analytics", icon: BarChart2, component: Analytics },
  { id: "journal", label: "Journal", icon: BookOpen, component: Journal },
  { id: "board", label: "Board", icon: LayoutDashboard, component: Board },
  { id: "notes", label: "Notes", icon: NotepadText, component: Notes },
  { id: "canvas", label: "Canvas", icon: LayoutDashboard, component: Canvas },
];

/**
 * Wraps the bottom-panel shell in the Workbench state provider and injects
 * browser-dev fixture data only when the VSCode host bridge is unavailable.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-1] [FR-3]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-STATE] [DES-SHELL-BRIDGE]
 */
export default function App() {
  // Mock data only when the bridge isn't talking to a real VSCode host —
  // i.e., browser dev mode. Inside the extension, mock paths would 404.
  const initialState =
    import.meta.env.DEV && !isInVsCodeWebview() ? MOCK_WORKBENCH_STATE : undefined;

  return (
    <WorkbenchProvider initialState={initialState}>
      <WorkbenchShell />
    </WorkbenchProvider>
  );
}

/**
 * Renders the [Workbench.Shell] tab router and loading card.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-2] [FR-5] [FR-8] [FR-11]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-MOCKUP] [DES-SHELL-TABS]
 */
function WorkbenchShell() {
  const { canvasEnabled, hiddenViews, isLoading, send } = useWorkbench();
  const visibleIds = visibleWorkbenchViews(hiddenViews, canvasEnabled);
  const [activeView, setActiveView] = useState<WorkbenchViewId>("workbench");
  const resolvedActiveView = nextWorkbenchView(activeView, visibleIds) ?? activeView;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6 text-foreground">
        <div className="afx-surface-card w-full max-w-md rounded-md border border-border px-6 py-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Loader2 size={15} className="animate-spin text-afx-brand" />
            Loading AgenticFlowX workspace…
          </div>
          <p className="text-xs text-muted-foreground">
            Parsing docs/specs, journal, notes, and board files before rendering tabs.
          </p>
        </div>
      </div>
    );
  }

  if (visibleIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-4 text-foreground">
        <div className="afx-surface-card max-w-sm rounded-md border border-border p-4 text-center">
          <Layers className="mx-auto mb-2 text-afx-brand" size={20} />
          <h2 className="text-sm font-semibold">All Workbench views are hidden</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Your files are unchanged. Show one or more views from Chat Settings → Experimental.
          </p>
          <button
            type="button"
            className="mt-3 rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() =>
              send({ type: "afxOpenSettings", setting: "afx.experimental.workbenchHiddenViews" })
            }
          >
            Open visibility settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <Tabs
        value={resolvedActiveView}
        onValueChange={(value) => setActiveView(value as WorkbenchViewId)}
        className="flex h-full min-h-0 flex-col gap-0"
      >
        {/*
          Surface: Workbench.Shell.Tabs
          @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-TABS]
        */}
        <TabsList
          variant="line"
          className="!h-8 !py-0 w-full shrink-0 justify-start gap-0 overflow-x-auto overflow-y-hidden border-b px-1 min-[520px]:!h-9"
        >
          {VIEW_DEFINITIONS.filter((view) => visibleIds.includes(view.id)).map((view) => (
            <WorkbenchTabTrigger
              key={view.id}
              value={view.id}
              icon={view.icon}
              label={view.label}
            />
          ))}
        </TabsList>
        {VIEW_DEFINITIONS.filter((view) => visibleIds.includes(view.id)).map((view) => {
          const Component = view.component;
          return (
            <TabsContent key={view.id} value={view.id} className="flex-1 overflow-hidden">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Loading {view.label}…
                  </div>
                }
              >
                <Component />
              </Suspense>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

/**
 * Renders one top-level Workbench tab trigger in [Workbench.Tabs].
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-2] [FR-11]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-TABS]
 */
function WorkbenchTabTrigger({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      aria-label={label}
      className={cn(
        "group/tab relative !h-8 flex-none gap-1 rounded-none px-2 !py-0 text-xs leading-none after:hidden min-[520px]:!h-9 min-[520px]:gap-1.5 min-[520px]:px-3",
        "text-muted-foreground data-[state=active]:text-foreground",
      )}
    >
      <Icon
        size={13}
        className="text-muted-foreground/80 group-data-[state=active]/tab:text-afx-brand-soft"
      />
      <span className="hidden min-[520px]:inline">{label}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 bg-foreground opacity-0 transition-opacity group-data-[state=active]/tab:opacity-100"
      />
    </TabsTrigger>
  );
}
