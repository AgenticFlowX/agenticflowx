// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import * as path from "path"
import * as os from "os"
import fs from "fs/promises"

/**
 * Gets the global .afx directory path based on the current platform
 *
 * @returns The absolute path to the global .afx directory
 *
 * @example Platform-specific paths:
 * ```
 * // macOS/Linux: ~/.afx/
 * // Example: /Users/john/.afx
 *
 * // Windows: %USERPROFILE%\.afx\
 * // Example: C:\Users\john\.afx
 * ```
 *
 * @example Usage:
 * ```typescript
 * const globalDir = getGlobalAfxDirectory()
 * // Returns: "/Users/john/.afx" (on macOS/Linux)
 * // Returns: "C:\\Users\\john\\.afx" (on Windows)
 * ```
 */
export function getGlobalAfxDirectory(): string {
	const homeDir = os.homedir()
	return path.join(homeDir, ".afx")
}

/**
 * Gets the global .agents directory path based on the current platform.
 * This is a shared directory for agent skills across different AI coding tools.
 *
 * @returns The absolute path to the global .agents directory
 *
 * @example Platform-specific paths:
 * ```
 * // macOS/Linux: ~/.agents/
 * // Example: /Users/john/.agents
 *
 * // Windows: %USERPROFILE%\.agents\
 * // Example: C:\Users\john\.agents
 * ```
 *
 * @example Usage:
 * ```typescript
 * const globalAgentsDir = getGlobalAgentsDirectory()
 * // Returns: "/Users/john/.agents" (on macOS/Linux)
 * // Returns: "C:\\Users\\john\\.agents" (on Windows)
 * ```
 */
export function getGlobalAgentsDirectory(): string {
	const homeDir = os.homedir()
	return path.join(homeDir, ".agents")
}

/**
 * Gets the project-local .agents directory path for a given cwd.
 * This is a shared directory for agent skills across different AI coding tools.
 *
 * @param cwd - Current working directory (project path)
 * @returns The absolute path to the project-local .agents directory
 *
 * @example
 * ```typescript
 * const projectAgentsDir = getProjectAgentsDirectoryForCwd('/Users/john/my-project')
 * // Returns: "/Users/john/my-project/.agents"
 * ```
 */
export function getProjectAgentsDirectoryForCwd(cwd: string): string {
	return path.join(cwd, ".agents")
}

/**
 * Gets the project-local .afx directory path for a given cwd
 *
 * @param cwd - Current working directory (project path)
 * @returns The absolute path to the project-local .afx directory
 *
 * @example
 * ```typescript
 * const projectDir = getProjectAfxDirectoryForCwd('/Users/john/my-project')
 * // Returns: "/Users/john/my-project/.afx"
 *
 * const windowsProjectDir = getProjectAfxDirectoryForCwd('C:\\Users\\john\\my-project')
 * // Returns: "C:\\Users\\john\\my-project\\.afx"
 * ```
 *
 * @example Directory structure:
 * ```
 * /Users/john/my-project/
 * ├── .afx/                    # Project-local configuration directory
 * │   ├── rules/
 * │   │   └── rules.md
 * │   ├── custom-instructions.md
 * │   └── config/
 * │       └── settings.json
 * ├── src/
 * │   └── index.ts
 * └── package.json
 * ```
 */
export function getProjectAfxDirectoryForCwd(cwd: string): string {
	return path.join(cwd, ".afx")
}

/**
 * Checks if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
	try {
		const stat = await fs.stat(dirPath)
		return stat.isDirectory()
	} catch (error: any) {
		// Only catch expected "not found" errors
		if (error.code === "ENOENT" || error.code === "ENOTDIR") {
			return false
		}
		// Re-throw unexpected errors (permission, I/O, etc.)
		throw error
	}
}

/**
 * Checks if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
	try {
		const stat = await fs.stat(filePath)
		return stat.isFile()
	} catch (error: any) {
		// Only catch expected "not found" errors
		if (error.code === "ENOENT" || error.code === "ENOTDIR") {
			return false
		}
		// Re-throw unexpected errors (permission, I/O, etc.)
		throw error
	}
}

/**
 * Reads a file safely, returning null if it doesn't exist
 */
export async function readFileIfExists(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, "utf-8")
	} catch (error: any) {
		// Only catch expected "not found" errors
		if (error.code === "ENOENT" || error.code === "ENOTDIR" || error.code === "EISDIR") {
			return null
		}
		// Re-throw unexpected errors (permission, I/O, etc.)
		throw error
	}
}

/**
 * Discovers all .afx directories in subdirectories of the workspace
 *
 * @param cwd - Current working directory (workspace root)
 * @returns Array of absolute paths to .afx directories found in subdirectories,
 *          sorted alphabetically. Does not include the root .afx directory.
 *
 * @example
 * ```typescript
 * const subfolderAfxDirs = await discoverSubfolderAfxDirectories('/Users/john/monorepo')
 * // Returns:
 * // [
 * //   '/Users/john/monorepo/package-a/.afx',
 * //   '/Users/john/monorepo/package-b/.afx',
 * //   '/Users/john/monorepo/packages/shared/.afx'
 * // ]
 * ```
 *
 * @example Directory structure:
 * ```
 * /Users/john/monorepo/
 * ├── .afx/                    # Root .afx (NOT included - use getProjectAfxDirectoryForCwd)
 * ├── package-a/
 * │   └── .afx/                # Included
 * │       └── rules/
 * ├── package-b/
 * │   └── .afx/                # Included
 * │       └── rules-code/
 * └── packages/
 *     └── shared/
 *         └── .afx/            # Included (nested)
 *             └── rules/
 * ```
 */
export async function discoverSubfolderAfxDirectories(cwd: string): Promise<string[]> {
	try {
		// Dynamic import to avoid vscode dependency at module load time
		// This is necessary because file-search.ts imports vscode, which is not
		// available in the webview context
		const { executeRipgrep } = await import("../search/file-search")

		// Use ripgrep to find any file inside any .afx directory
		// This efficiently discovers all .afx folders regardless of their content
		const args = [
			"--files",
			"--hidden",
			"--follow",
			"-g",
			"**/.afx/**",
			"-g",
			"!node_modules/**",
			"-g",
			"!.git/**",
			cwd,
		]

		const results = await executeRipgrep({ args, workspacePath: cwd })

		// Extract unique .afx directory paths
		const afxDirs = new Set<string>()
		const rootAfxDir = path.join(cwd, ".afx")

		for (const result of results) {
			// Match paths like "subfolder/.afx/anything" or "subfolder/nested/.afx/anything"
			// Handle both forward slashes (Unix) and backslashes (Windows)
			const match = result.path.match(/^(.+?)[/\\]\.afx[/\\]/)
			if (match) {
				const afxDir = path.join(cwd, match[1], ".afx")
				// Exclude the root .afx directory (already handled by getProjectAfxDirectoryForCwd)
				if (afxDir !== rootAfxDir) {
					afxDirs.add(afxDir)
				}
			}
		}

		// Return sorted alphabetically
		return Array.from(afxDirs).sort()
	} catch (error) {
		// If discovery fails (e.g., ripgrep not available), return empty array
		return []
	}
}

/**
 * Gets the ordered list of .afx directories to check (global first, then project-local)
 *
 * @param cwd - Current working directory (project path)
 * @returns Array of directory paths to check in order [global, project-local]
 *
 * @example
 * ```typescript
 * // For a project at /Users/john/my-project
 * const directories = getAfxDirectoriesForCwd('/Users/john/my-project')
 * // Returns:
 * // [
 * //   '/Users/john/.afx',           // Global directory
 * //   '/Users/john/my-project/.afx' // Project-local directory
 * // ]
 * ```
 *
 * @example Directory structure:
 * ```
 * /Users/john/
 * ├── .afx/                    # Global configuration
 * │   ├── rules/
 * │   │   └── rules.md
 * │   └── custom-instructions.md
 * └── my-project/
 *     ├── .afx/                # Project-specific configuration
 *     │   ├── rules/
 *     │   │   └── rules.md     # Overrides global rules
 *     │   └── project-notes.md
 *     └── src/
 *         └── index.ts
 * ```
 */
export function getAfxDirectoriesForCwd(cwd: string): string[] {
	const directories: string[] = []

	// Add global directory first
	directories.push(getGlobalAfxDirectory())

	// Add project-local directory second
	directories.push(getProjectAfxDirectoryForCwd(cwd))

	return directories
}

/**
 * Gets the ordered list of all .afx directories including subdirectories
 *
 * @param cwd - Current working directory (project path)
 * @returns Array of directory paths in order: [global, project-local, ...subfolders (alphabetically)]
 *
 * @example
 * ```typescript
 * // For a monorepo at /Users/john/monorepo with .afx in subfolders
 * const directories = await getAllAfxDirectoriesForCwd('/Users/john/monorepo')
 * // Returns:
 * // [
 * //   '/Users/john/.afx',                    // Global directory
 * //   '/Users/john/monorepo/.afx',           // Project-local directory
 * //   '/Users/john/monorepo/package-a/.afx', // Subfolder (alphabetical)
 * //   '/Users/john/monorepo/package-b/.afx'  // Subfolder (alphabetical)
 * // ]
 * ```
 */
export async function getAllAfxDirectoriesForCwd(cwd: string): Promise<string[]> {
	const directories: string[] = []

	// Add global directory first
	directories.push(getGlobalAfxDirectory())

	// Add project-local directory second
	directories.push(getProjectAfxDirectoryForCwd(cwd))

	// Discover and add subfolder .afx directories
	const subfolderDirs = await discoverSubfolderAfxDirectories(cwd)
	directories.push(...subfolderDirs)

	return directories
}

/**
 * Gets parent directories containing .afx folders, in order from root to subfolders
 *
 * @param cwd - Current working directory (project path)
 * @returns Array of parent directory paths (not .afx paths) containing AGENTS.md or .afx
 *
 * @example
 * ```typescript
 * const dirs = await getAgentsDirectoriesForCwd('/Users/john/monorepo')
 * // Returns: ['/Users/john/monorepo', '/Users/john/monorepo/package-a', ...]
 * ```
 */
export async function getAgentsDirectoriesForCwd(cwd: string): Promise<string[]> {
	const directories: string[] = []

	// Always include the root directory
	directories.push(cwd)

	// Get all subfolder .afx directories
	const subfolderAfxDirs = await discoverSubfolderAfxDirectories(cwd)

	// Extract parent directories (remove .afx from path)
	for (const afxDir of subfolderAfxDirs) {
		const parentDir = path.dirname(afxDir)
		directories.push(parentDir)
	}

	return directories
}

/**
 * Loads configuration from multiple .afx directories with project overriding global
 *
 * @param relativePath - The relative path within each .afx directory (e.g., 'rules/rules.md')
 * @param cwd - Current working directory (project path)
 * @returns Object with global and project content, plus merged content
 *
 * @example
 * ```typescript
 * // Load rules configuration for a project
 * const config = await loadConfiguration('rules/rules.md', '/Users/john/my-project')
 *
 * // Returns:
 * // {
 * //   global: "Global rules content...",     // From ~/.afx/rules/rules.md
 * //   project: "Project rules content...",   // From /Users/john/my-project/.afx/rules/rules.md
 * //   merged: "Global rules content...\n\n# Project-specific rules (override global):\n\nProject rules content..."
 * // }
 * ```
 *
 * @example File paths resolved:
 * ```
 * relativePath: 'rules/rules.md'
 * cwd: '/Users/john/my-project'
 *
 * Reads from:
 * - Global: /Users/john/.afx/rules/rules.md
 * - Project: /Users/john/my-project/.afx/rules/rules.md
 *
 * Other common relativePath examples:
 * - 'custom-instructions.md'
 * - 'config/settings.json'
 * - 'templates/component.tsx'
 * ```
 *
 * @example Merging behavior:
 * ```
 * // If only global exists:
 * { global: "content", project: null, merged: "content" }
 *
 * // If only project exists:
 * { global: null, project: "content", merged: "content" }
 *
 * // If both exist:
 * {
 *   global: "global content",
 *   project: "project content",
 *   merged: "global content\n\n# Project-specific rules (override global):\n\nproject content"
 * }
 * ```
 */
export async function loadConfiguration(
	relativePath: string,
	cwd: string,
): Promise<{
	global: string | null
	project: string | null
	merged: string
}> {
	const globalDir = getGlobalAfxDirectory()
	const projectDir = getProjectAfxDirectoryForCwd(cwd)

	const globalFilePath = path.join(globalDir, relativePath)
	const projectFilePath = path.join(projectDir, relativePath)

	// Read global configuration
	const globalContent = await readFileIfExists(globalFilePath)

	// Read project-local configuration
	const projectContent = await readFileIfExists(projectFilePath)

	// Merge configurations - project overrides global
	let merged = ""

	if (globalContent) {
		merged += globalContent
	}

	if (projectContent) {
		if (merged) {
			merged += "\n\n# Project-specific rules (override global):\n\n"
		}
		merged += projectContent
	}

	return {
		global: globalContent,
		project: projectContent,
		merged: merged || "",
	}
}
