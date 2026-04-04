// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Shared types for the AgenticFlowX panel webview.
 * Mirrors src/agenticflowx/models/panel-types.ts for the browser context.
 */

export interface PipelineRow {
	name: string
	specStatus: string
	designStatus: string
	tasksStatus: string
	completed: number
	total: number
	featureStatus: string
	specPath?: string
	designPath?: string
	tasksPath?: string
	specLastVerified?: string
	designLastVerified?: string
	tasksLastVerified?: string
}

export interface DocumentRow {
	type: string
	name: string
	status: string
	owner: string
	filePath: string
	isAfx?: boolean
	kind?: string
	size?: number
}

export interface TaskItemRow {
	text: string
	completed: boolean
	line: number
}

export interface PhaseRow {
	number: number
	name: string
	completed: number
	total: number
	line: number
	items: TaskItemRow[]
}

export interface WorkSessionRow {
	date: string
	task: string
	action: string
	filesModified: string
	agent: boolean
	human: boolean
}

export interface FeatureTasksData {
	name: string
	tasksPath?: string
	completed: number
	total: number
	phases: PhaseRow[]
	workSessions: WorkSessionRow[]
}

export interface KanbanCard {
	text: string
}

export interface KanbanColumn {
	title: string
	cards: KanbanCard[]
}

export interface KanbanMeta {
	title?: string
	description?: string
	status?: string
	tags?: string[]
	created?: string
	updated?: string
}

export interface KanbanBoard {
	name: string
	filePath: string
	columns: KanbanColumn[]
	rawContent?: string
	meta?: KanbanMeta
}

export interface KanbanData {
	boards: KanbanBoard[]
	dirPath: string
}

export interface JournalEntry {
	id: string
	date: string
	title: string
	status: "active" | "blocked" | "closed"
	feature: string
	filePath: string
	line: number
	context?: string
	summary?: string
	decisions?: string[]
}

export interface QuickNote {
	timestamp: string
	time: string
	displayTime: string
	date: string
	text: string
}

export interface GhostTaskResult {
	count: number
	items: Array<{ feature: string; task: string; target: string }>
}
