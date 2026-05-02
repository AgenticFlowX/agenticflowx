/**
 * Workbench context — single source of state for all views.
 * Subscribes to bridge "afxUpdate" and merges partial updates into state.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-3]
 * @see docs/specs/220-app-workbench/design.md [DES-API]
 */
import { type ReactNode, createContext, useContext, useEffect, useMemo, useReducer } from "react";

import type {
  DocumentRow,
  FeatureTasksData,
  GhostTaskResult,
  JournalEntry,
  KanbanData,
  PipelineRow,
  QuickNote,
  WorkbenchInbound,
  WorkbenchOutbound,
} from "@afx/shared";

import { workbenchOn, workbenchSend } from "../lib/bridge";

export interface WorkbenchState {
  pipeline: PipelineRow[];
  featureTasks: FeatureTasksData[];
  documents: DocumentRow[];
  journal: JournalEntry[];
  kanban: KanbanData | null;
  notes: QuickNote[];
  notesRaw: string;
  notesFilePath: string;
  ghostTasks: GhostTaskResult;
  selectedFeature: string | null;
  isLoading: boolean;
}

const EMPTY_GHOST: GhostTaskResult = { count: 0, items: [] };

const INITIAL_STATE: WorkbenchState = {
  pipeline: [],
  featureTasks: [],
  documents: [],
  journal: [],
  kanban: null,
  notes: [],
  notesRaw: "",
  notesFilePath: "",
  ghostTasks: EMPTY_GHOST,
  selectedFeature: null,
  isLoading: true,
};

type Action =
  | { type: "merge"; payload: Extract<WorkbenchInbound, { type: "afxUpdate" }> }
  | { type: "selectFeature"; name: string | null };

function reducer(state: WorkbenchState, action: Action): WorkbenchState {
  switch (action.type) {
    case "merge": {
      const p = action.payload;
      const pipeline = p.pipeline ?? state.pipeline;
      const selectedFeature = pipeline.some((row) => row.name === state.selectedFeature)
        ? state.selectedFeature
        : (pipeline[0]?.name ?? null);
      return {
        ...state,
        pipeline,
        featureTasks: p.featureTasks ?? state.featureTasks,
        documents: p.documents ?? state.documents,
        journal: p.journal ?? state.journal,
        kanban: p.kanban !== undefined ? p.kanban : state.kanban,
        notes: p.notes ?? state.notes,
        notesRaw: p.notesRaw ?? state.notesRaw,
        notesFilePath: p.notesFilePath ?? state.notesFilePath,
        ghostTasks: p.ghostTasks ?? state.ghostTasks,
        selectedFeature,
        isLoading: false,
      };
    }
    case "selectFeature":
      return { ...state, selectedFeature: action.name };
  }
}

interface WorkbenchContextValue extends WorkbenchState {
  send: (msg: WorkbenchOutbound) => void;
  selectFeature: (name: string | null) => void;
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  initialState?: Partial<WorkbenchState>;
}

export function WorkbenchProvider({ children, initialState }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL_STATE, ...initialState });

  useEffect(() => {
    return workbenchOn("afxUpdate", (msg) => {
      dispatch({ type: "merge", payload: msg });
    });
  }, []);

  const value = useMemo<WorkbenchContextValue>(
    () => ({
      ...state,
      send: workbenchSend,
      selectFeature: (name) => {
        dispatch({ type: "selectFeature", name });
        if (name) workbenchSend({ type: "afxSelectFeature", name });
      },
    }),
    [state],
  );

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench(): WorkbenchContextValue {
  const ctx = useContext(WorkbenchContext);
  if (!ctx) throw new Error("useWorkbench must be used inside <WorkbenchProvider>");
  return ctx;
}
