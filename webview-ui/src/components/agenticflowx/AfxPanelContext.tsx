// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { vscode as vscodeApi } from "@/utils/vscode"
import type {
	PipelineRow,
	FeatureTasksData,
	DocumentRow,
	JournalEntry,
	KanbanData,
	QuickNote,
	GhostTaskResult,
} from "./types"

interface AfxPanelState {
	pipeline: PipelineRow[]
	featureTasks: FeatureTasksData[]
	documents: DocumentRow[]
	journal: JournalEntry[]
	kanban: KanbanData | null
	notes: QuickNote[]
	ghostTasks: GhostTaskResult
	selectedFeature: string | null
	isLoading: boolean
}

interface AfxPanelContextValue extends AfxPanelState {
	postMessage(message: unknown): void
	selectFeature(name: string): void
}

const AfxPanelCtx = createContext<AfxPanelContextValue | null>(null)

export function useAfxPanel(): AfxPanelContextValue {
	const ctx = useContext(AfxPanelCtx)
	if (!ctx) throw new Error("useAfxPanel must be used within AfxPanelProvider")
	return ctx
}

export function AfxPanelProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AfxPanelState>({
		pipeline: [],
		featureTasks: [],
		documents: [],
		journal: [],
		kanban: null,
		notes: [],
		ghostTasks: { count: 0, items: [] },
		selectedFeature: null,
		isLoading: true,
	})

	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			const msg = event.data
			if (msg.type === "afxUpdate") {
				setState((prev) => ({
					...prev,
					pipeline: msg.pipeline ?? prev.pipeline,
					featureTasks: msg.featureTasks ?? prev.featureTasks,
					documents: msg.documents ?? prev.documents,
					journal: msg.journal ?? prev.journal,
					kanban: msg.kanban ?? prev.kanban,
					notes: msg.notes ?? prev.notes,
					ghostTasks: msg.ghostTasks ?? prev.ghostTasks,
					isLoading: false,
				}))
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const postMessage = useCallback((message: unknown) => {
		vscodeApi.postMessage(message as any)
	}, [])

	const selectFeature = useCallback((name: string) => {
		setState((prev) => ({ ...prev, selectedFeature: name }))
		vscodeApi.postMessage({ type: "afxSelectFeature", name } as any)
	}, [])

	return <AfxPanelCtx.Provider value={{ ...state, postMessage, selectFeature }}>{children}</AfxPanelCtx.Provider>
}
