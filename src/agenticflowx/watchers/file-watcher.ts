// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * File watchers for AgenticFlowX spec/config changes.
 * All watchers use 500ms debounce to avoid rapid re-scans.
 *
 * @see docs/specs/16-vscode-agenticflowx-core/design.md [DES-FILE-WATCHERS]
 */

import * as path from "path"
import * as vscode from "vscode"
import type { AfxConfig } from "../models/config"

const DEBOUNCE_MS = 500
const SUPPRESS_MS = 1500

const writingPaths = new Set<string>()

export function suppressPath(filePath: string): void {
	writingPaths.add(filePath)
	setTimeout(() => writingPaths.delete(filePath), SUPPRESS_MS)
}

export interface RefreshTargets {
	refreshAll: () => void
	refreshSpecs: () => void
	refreshAdrs: () => void
	refreshResources: () => void
}

export function createFileWatchers(
	config: AfxConfig,
	workspaceRoot: string,
	targets: RefreshTargets,
): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = []
	let debounceTimer: ReturnType<typeof setTimeout> | undefined

	function debounced(fn: () => void, uri?: vscode.Uri) {
		if (uri && writingPaths.has(uri.fsPath)) return
		if (debounceTimer) clearTimeout(debounceTimer)
		debounceTimer = setTimeout(fn, DEBOUNCE_MS)
	}

	// Watch user config
	const configWatcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(workspaceRoot, ".afx.yaml"),
	)
	configWatcher.onDidChange(() => debounced(targets.refreshAll))
	configWatcher.onDidCreate(() => debounced(targets.refreshAll))
	configWatcher.onDidDelete(() => debounced(targets.refreshAll))
	disposables.push(configWatcher)

	// Watch managed config
	const managedConfigWatcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(workspaceRoot, ".afx/.afx.yaml"),
	)
	managedConfigWatcher.onDidChange(() => debounced(targets.refreshAll))
	managedConfigWatcher.onDidCreate(() => debounced(targets.refreshAll))
	disposables.push(managedConfigWatcher)

	// Watch specs
	const specsWatcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(workspaceRoot, path.join(config.paths.specs, "**/*.md")),
	)
	specsWatcher.onDidChange((uri) => debounced(targets.refreshSpecs, uri))
	specsWatcher.onDidCreate((uri) => debounced(targets.refreshSpecs, uri))
	specsWatcher.onDidDelete((uri) => debounced(targets.refreshSpecs, uri))
	disposables.push(specsWatcher)

	// Watch ADRs
	const adrWatcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(workspaceRoot, path.join(config.paths.adr, "ADR-*.md")),
	)
	adrWatcher.onDidChange(() => debounced(targets.refreshAdrs))
	adrWatcher.onDidCreate(() => debounced(targets.refreshAdrs))
	adrWatcher.onDidDelete(() => debounced(targets.refreshAdrs))
	disposables.push(adrWatcher)

	// Watch kanban boards
	const kanbanWatcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(workspaceRoot, ".afx/kanban/*.md"),
	)
	kanbanWatcher.onDidChange(() => debounced(targets.refreshAll))
	kanbanWatcher.onDidCreate(() => debounced(targets.refreshAll))
	kanbanWatcher.onDidDelete(() => debounced(targets.refreshAll))
	disposables.push(kanbanWatcher)

	// Watch quick notes
	const notesWatcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(workspaceRoot, ".afx/notes.md"),
	)
	notesWatcher.onDidChange(() => debounced(targets.refreshAll))
	notesWatcher.onDidCreate(() => debounced(targets.refreshAll))
	notesWatcher.onDidDelete(() => debounced(targets.refreshAll))
	disposables.push(notesWatcher)

	// Watch library paths
	if (config.library) {
		for (const dir of Object.values(config.library)) {
			const resWatcher = vscode.workspace.createFileSystemWatcher(
				new vscode.RelativePattern(workspaceRoot, path.join(dir, "**/*")),
			)
			resWatcher.onDidChange(() => debounced(targets.refreshResources))
			resWatcher.onDidCreate(() => debounced(targets.refreshResources))
			resWatcher.onDidDelete(() => debounced(targets.refreshResources))
			disposables.push(resWatcher)
		}
	}

	return disposables
}
