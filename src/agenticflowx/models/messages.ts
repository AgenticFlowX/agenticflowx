// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Message types for AgenticFlowX panel ↔ extension communication.
 * Kept local until stable — will move to packages/types/ later.
 *
 * @see docs/specs/16-vscode-agenticflowx-core/design.md#models
 */

import type {
	PipelineRow,
	FeatureTasksData,
	DocumentRow,
	JournalEntry,
	KanbanData,
	QuickNote,
	GhostTaskResult,
} from "./panel-types"

// Extension → Panel

export interface AfxUpdateMessage {
	type: "afxUpdate"
	pipeline: PipelineRow[]
	featureTasks: FeatureTasksData[]
	documents: DocumentRow[]
	journal: JournalEntry[]
	kanban: KanbanData
	notes: QuickNote[]
	ghostTasks: GhostTaskResult
	notesFilePath: string
}

export interface AfxDocContentMessage {
	type: "afxDocContent"
	filePath: string
	content: string
	language: string
}

// Panel → Extension

export interface AfxOpenFileMessage {
	type: "afxOpenFile"
	path: string
	line?: number
}

export interface AfxToggleTaskMessage {
	type: "afxToggleTask"
	path: string
	line: number
	completed: boolean
}

export interface AfxSaveFileMessage {
	type: "afxSaveFile"
	path: string
	content: string
}

export interface AfxNoteMessage {
	type: "afxAppendNote" | "afxDeleteNote"
	text?: string
	timestamp?: string
}

export interface AfxSelectFeatureMessage {
	type: "afxSelectFeature"
	name: string
}

export interface AfxFetchDocContentMessage {
	type: "afxFetchDocContent"
	filePath: string
}

export interface AfxChangeStatusMessage {
	type: "afxChangeStatus"
	filePath: string
	status: string
}

export interface AfxToggleSessionMessage {
	type: "afxToggleSession"
	filePath: string
	sessionIndex: number
	column: "agent" | "human"
	completed: boolean
}

export type AfxPanelToExtensionMessage =
	| AfxOpenFileMessage
	| AfxToggleTaskMessage
	| AfxSaveFileMessage
	| AfxNoteMessage
	| AfxSelectFeatureMessage
	| AfxFetchDocContentMessage
	| AfxChangeStatusMessage
	| AfxToggleSessionMessage

export type AfxExtensionToPanelMessage = AfxUpdateMessage | AfxDocContentMessage
