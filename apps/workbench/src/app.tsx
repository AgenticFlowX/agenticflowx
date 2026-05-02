/**
 * Workbench root shell — tab layout for all workbench views.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-1] [FR-2]
 * @see docs/specs/220-app-workbench/design.md [DES-ARCH] [DES-UI]
 */
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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@afx/ui/components/tabs";
import { cn } from "@afx/ui/lib/utils";

import { WorkbenchProvider } from "./context/workbench-context";
import { useWorkbench } from "./context/workbench-context";
import { isInVsCodeWebview } from "./lib/bridge";
import { MOCK_WORKBENCH_STATE } from "./lib/mock-data";
import Analytics from "./views/analytics";
import Board from "./views/board";
import Documents from "./views/documents";
import Journal from "./views/journal";
import Notes from "./views/notes";
import Pipeline from "./views/pipeline";
import WorkbenchTab from "./views/workbench";

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

function WorkbenchShell() {
  const { isLoading } = useWorkbench();

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

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <Tabs defaultValue="workbench" className="flex h-full min-h-0 flex-col gap-0">
        <TabsList variant="line" className="h-9 w-full shrink-0 justify-start gap-0 border-b px-1">
          <WorkbenchTabTrigger value="workbench" icon={Layers} label="Workbench" />
          <WorkbenchTabTrigger value="pipeline" icon={GitBranch} label="Pipeline" />
          <WorkbenchTabTrigger value="documents" icon={Files} label="Documents" />
          <WorkbenchTabTrigger value="analytics" icon={BarChart2} label="Analytics" />
          <WorkbenchTabTrigger value="journal" icon={BookOpen} label="Journal" />
          <WorkbenchTabTrigger value="board" icon={LayoutDashboard} label="Board" />
          <WorkbenchTabTrigger value="notes" icon={NotepadText} label="Notes" />
        </TabsList>
        <TabsContent value="workbench" className="flex-1 overflow-hidden">
          <WorkbenchTab />
        </TabsContent>
        <TabsContent value="pipeline" className="flex-1 overflow-hidden">
          <Pipeline />
        </TabsContent>
        <TabsContent value="documents" className="flex-1 overflow-hidden">
          <Documents />
        </TabsContent>
        <TabsContent value="analytics" className="flex-1 overflow-hidden">
          <Analytics />
        </TabsContent>
        <TabsContent value="journal" className="flex-1 overflow-hidden">
          <Journal />
        </TabsContent>
        <TabsContent value="board" className="flex-1 overflow-hidden">
          <Board />
        </TabsContent>
        <TabsContent value="notes" className="flex-1 overflow-hidden">
          <Notes />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WorkbenchTabTrigger({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: typeof Layers;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "group/tab relative h-9 flex-none gap-1.5 rounded-none px-3 text-xs after:hidden",
        "text-muted-foreground data-[state=active]:text-foreground",
      )}
    >
      <Icon
        size={13}
        className="text-muted-foreground/80 group-data-[state=active]/tab:text-afx-brand-soft"
      />
      {label}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 bg-foreground opacity-0 transition-opacity group-data-[state=active]/tab:opacity-100"
      />
    </TabsTrigger>
  );
}
