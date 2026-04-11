// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * WriteCoordinator — sequential write queue for spec files.
 * Prevents concurrent corruption and suppresses file watchers during writes.
 *
 * All spec file writes (from agent tools, hooks, or panel) go through here.
 *
 * @see docs/specs/17-vscode-agenticflowx-hook-engine/design.md [DES-WRITE-INFRA]
 */

import { writeFile, readFile } from "fs/promises"
import { suppressPath } from "../../watchers/file-watcher"

export interface WriteCoordinatorDeps {
	refreshPanel: () => void
	refreshSpecs: () => void
	log?: (msg: string) => void
}

export function createWriteCoordinator(deps: WriteCoordinatorDeps) {
	let queue: Promise<void> = Promise.resolve()

	async function writeSpecFile(filePath: string, content: string): Promise<void> {
		// Chain onto queue — ensures sequential execution
		queue = queue
			.then(async () => {
				suppressPath(filePath)
				await writeFile(filePath, content, "utf-8")
				deps.refreshSpecs()
				deps.refreshPanel()
				deps.log?.(`[AFX] WriteCoordinator: wrote ${filePath}`)
			})
			.catch((err) => {
				deps.log?.(`[AFX] WriteCoordinator error: ${err instanceof Error ? err.message : String(err)}`)
			})
		return queue
	}

	async function readSpecFile(filePath: string): Promise<string> {
		return readFile(filePath, "utf-8")
	}

	return { writeSpecFile, readSpecFile }
}

export type WriteCoordinator = ReturnType<typeof createWriteCoordinator>
