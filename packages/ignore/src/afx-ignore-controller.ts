// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import path from "path"
import fs from "fs/promises"
import fsSync from "fs"
import ignore, { Ignore } from "ignore"

import type { FileWatcherFactory, Disposable } from "./types.js"

export const LOCK_TEXT_SYMBOL = "\u{1F512}"

/**
 * Check if a path exists.
 */
async function fileExistsAtPath(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath)
		return true
	} catch {
		return false
	}
}

/**
 * Convert a path to POSIX separators.
 */
function toPosix(p: string): string {
	return p.split(path.sep).join("/")
}

/**
 * Controls LLM access to files by enforcing ignore patterns.
 * Designed to be instantiated once in Task.ts and passed to file manipulation services.
 * Uses the 'ignore' library to support standard .gitignore syntax in .afxignore files.
 *
 * @see docs/research/res-monorepo-plugin-migration.md
 */
export class AfxIgnoreController {
	private cwd: string
	private ignoreInstance: Ignore
	private disposables: Disposable[] = []
	afxIgnoreContent: string | undefined

	constructor(cwd: string, createWatcher?: FileWatcherFactory) {
		this.cwd = cwd
		this.ignoreInstance = ignore()
		this.afxIgnoreContent = undefined
		if (createWatcher) {
			this.setupFileWatcher(createWatcher)
		}
	}

	/**
	 * Initialize the controller by loading custom patterns.
	 * Must be called after construction and before using the controller.
	 */
	async initialize(): Promise<void> {
		await this.loadAfxIgnore()
	}

	/**
	 * Set up the file watcher for .afxignore changes.
	 */
	private setupFileWatcher(createWatcher: FileWatcherFactory): void {
		const fileWatcher = createWatcher(this.cwd, ".afxignore")

		this.disposables.push(
			fileWatcher.onDidChange(() => {
				this.loadAfxIgnore()
			}),
			fileWatcher.onDidCreate(() => {
				this.loadAfxIgnore()
			}),
			fileWatcher.onDidDelete(() => {
				this.loadAfxIgnore()
			}),
		)

		this.disposables.push(fileWatcher)
	}

	/**
	 * Load custom patterns from .afxignore if it exists.
	 */
	private async loadAfxIgnore(): Promise<void> {
		try {
			this.ignoreInstance = ignore()
			const ignorePath = path.join(this.cwd, ".afxignore")
			if (await fileExistsAtPath(ignorePath)) {
				const content = await fs.readFile(ignorePath, "utf8")
				this.afxIgnoreContent = content
				this.ignoreInstance.add(content)
				this.ignoreInstance.add(".afxignore")
			} else {
				this.afxIgnoreContent = undefined
			}
		} catch (_error) {
			console.error("Unexpected error loading .afxignore:", _error)
		}
	}

	/**
	 * Check if a file should be accessible to the LLM.
	 * Automatically resolves symlinks.
	 */
	validateAccess(filePath: string): boolean {
		if (!this.afxIgnoreContent) {
			return true
		}
		try {
			const absolutePath = path.resolve(this.cwd, filePath)

			let realPath: string
			try {
				realPath = fsSync.realpathSync(absolutePath)
			} catch {
				realPath = absolutePath
			}

			const relativePath = toPosix(path.relative(this.cwd, realPath))

			return !this.ignoreInstance.ignores(relativePath)
		} catch (_error) {
			return true
		}
	}

	/**
	 * Check if a terminal command should be allowed to execute based on file access patterns.
	 * @returns Path of file being accessed if blocked, undefined if allowed.
	 */
	validateCommand(command: string): string | undefined {
		if (!this.afxIgnoreContent) {
			return undefined
		}

		const parts = command.trim().split(/\s+/)
		const baseCommand = parts[0]
		if (!baseCommand) {
			return undefined
		}

		const fileReadingCommands = [
			"cat",
			"less",
			"more",
			"head",
			"tail",
			"grep",
			"awk",
			"sed",
			"get-content",
			"gc",
			"type",
			"select-string",
			"sls",
		]

		if (fileReadingCommands.includes(baseCommand.toLowerCase())) {
			for (let i = 1; i < parts.length; i++) {
				const arg = parts[i]!
				if (arg.startsWith("-") || arg.startsWith("/")) {
					continue
				}
				if (arg.includes(":")) {
					continue
				}
				if (!this.validateAccess(arg)) {
					return arg
				}
			}
		}

		return undefined
	}

	/**
	 * Filter an array of paths, removing those that should be ignored.
	 */
	filterPaths(paths: string[]): string[] {
		try {
			return paths
				.map((p) => ({
					path: p,
					allowed: this.validateAccess(p),
				}))
				.filter((x) => x.allowed)
				.map((x) => x.path)
		} catch (_error) {
			console.error("Error filtering paths:", _error)
			return []
		}
	}

	/**
	 * Clean up resources when the controller is no longer needed.
	 */
	dispose(): void {
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}

	/**
	 * Get formatted instructions about the .afxignore file for the LLM.
	 */
	getInstructions(): string | undefined {
		if (!this.afxIgnoreContent) {
			return undefined
		}

		return `# .afxignore\n\n(The following is provided by a root-level .afxignore file where the user has specified files and directories that should not be accessed. When using list_files, you'll notice a ${LOCK_TEXT_SYMBOL} next to files that are blocked. Attempting to access the file's contents e.g. through read_file will result in an error.)\n\n${this.afxIgnoreContent}\n.afxignore`
	}
}
