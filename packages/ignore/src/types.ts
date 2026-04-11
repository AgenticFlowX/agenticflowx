// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

export interface Disposable {
	dispose(): void
}

export interface FileWatcher extends Disposable {
	onDidChange(cb: () => void): Disposable
	onDidCreate(cb: () => void): Disposable
	onDidDelete(cb: () => void): Disposable
}

/**
 * Factory that creates a file watcher for a given directory and glob pattern.
 * VS Code extension provides `vscode.workspace.createFileSystemWatcher`-based implementation.
 * Tests provide a no-op implementation.
 */
export interface FileWatcherFactory {
	(cwd: string, pattern: string): FileWatcher
}
