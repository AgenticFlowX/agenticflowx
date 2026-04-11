// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import * as vscode from "vscode"
import type { FileWatcherFactory } from "@agenticflowx/ignore"

/**
 * VS Code implementation of FileWatcherFactory.
 * Creates a file system watcher using vscode.workspace.createFileSystemWatcher.
 */
export const createVscodeFileWatcher: FileWatcherFactory = (cwd: string, pattern: string) => {
	const relativePattern = new vscode.RelativePattern(cwd, pattern)
	return vscode.workspace.createFileSystemWatcher(relativePattern)
}
