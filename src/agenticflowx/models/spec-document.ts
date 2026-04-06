// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Spec document types used across AgenticFlowX.
 *
 * @see docs/specs/16-vscode-agenticflowx-core/design.md#models
 */

export interface Frontmatter {
	afx?: boolean
	type?: string
	status?: string
	owner?: string
	tags?: string[]
	version?: string | number
	description?: string
	last_verified?: string
}

export type DocType = "SPEC" | "DESIGN" | "TASKS" | "JOURNAL"

export interface SpecDocument {
	path: string
	type: DocType
	frontmatter: Frontmatter
	taskStats?: TaskStats
	discussions?: Discussion[]
	sections?: Section[]
}

export interface WorkSession {
	date: string
	task: string
	action: string
	filesModified: string
	agent: boolean
	human: boolean
}

export interface TaskStats {
	total: number
	completed: number
	phases: Phase[]
	workSessions?: WorkSession[]
}

export interface TaskItem {
	text: string
	completed: boolean
	line: number
}

export interface Phase {
	number: number
	name: string
	total: number
	completed: number
	line: number
	items?: TaskItem[]
}

export interface Discussion {
	id: string
	date: string
	title: string
	status: "active" | "blocked" | "closed"
	line: number
	context?: string
	summary?: string
	decisions?: string[]
}

export interface Section {
	title: string
	level: number
	line: number
}
