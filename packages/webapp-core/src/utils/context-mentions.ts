// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { Fzf } from "fzf"

import type { ModeConfig, Command } from "@agenticflowx/types"

import { mentionRegex } from "@afx/context-mentions"

import { escapeSpaces } from "./path-mentions"

/**
 * Gets the description for a mode, prioritizing description > whenToUse > roleDefinition
 * and taking only the first line
 */
function getModeDescription(mode: ModeConfig): string {
	return (mode.description || mode.whenToUse || mode.roleDefinition).split("\n")[0]
}

export interface SearchResult {
	path: string
	type: "file" | "folder"
	label?: string
}

function getBasename(filepath: string): string {
	return filepath.split("/").pop() || filepath
}

export function insertMention(
	text: string,
	position: number,
	value: string,
	isSlashCommand: boolean = false,
): { newValue: string; mentionIndex: number } {
	// Handle slash command selection (only when explicitly selecting a slash command)
	if (isSlashCommand) {
		return {
			newValue: value,
			mentionIndex: 0,
		}
	}

	const beforeCursor = text.slice(0, position)
	const afterCursor = text.slice(position)

	// Find the position of the last '@' symbol before the cursor
	const lastAtIndex = beforeCursor.lastIndexOf("@")

	// Process the value - escape spaces if it's a file path
	let processedValue = value
	if (value && value.startsWith("/")) {
		// Only escape if the path contains spaces that aren't already escaped
		if (value.includes(" ") && !value.includes("\\ ")) {
			processedValue = escapeSpaces(value)
		}
	}

	let newValue: string
	let mentionIndex: number

	if (lastAtIndex !== -1) {
		// If there's an '@' symbol, replace everything after it with the new mention
		const beforeMention = text.slice(0, lastAtIndex)
		// Only replace if afterCursor is all alphanumerical
		// This is required to handle languages that don't use space as a word separator (chinese, japanese, korean, etc)
		const afterCursorContent = /^[a-zA-Z0-9\s]*$/.test(afterCursor)
			? afterCursor.replace(/^[^\s]*/, "")
			: afterCursor
		newValue = beforeMention + "@" + processedValue + " " + afterCursorContent
		mentionIndex = lastAtIndex
	} else {
		// If there's no '@' symbol, insert the mention at the cursor position
		newValue = beforeCursor + "@" + processedValue + " " + afterCursor
		mentionIndex = position
	}

	return { newValue, mentionIndex }
}

export function removeMention(text: string, position: number): { newText: string; newPosition: number } {
	const beforeCursor = text.slice(0, position)
	const afterCursor = text.slice(position)

	// Check if we're at the end of a mention
	const matchEnd = beforeCursor.match(new RegExp(mentionRegex.source + "$"))

	if (matchEnd) {
		// If we're at the end of a mention, remove it
		// Remove the mention and the first space that follows it
		const mentionLength = matchEnd[0].length
		// Remove the mention and one space after it if it exists
		const newText = text.slice(0, position - mentionLength) + afterCursor.replace(/^\s/, "")
		const newPosition = position - mentionLength
		return { newText, newPosition }
	}

	// If we're not at the end of a mention, just return the original text and position
	return { newText: text, newPosition: position }
}

export enum ContextMenuOptionType {
	OpenedFile = "openedFile",
	File = "file",
	Folder = "folder",
	Problems = "problems",
	Terminal = "terminal",
	URL = "url",
	Git = "git",
	NoResults = "noResults",
	Mode = "mode", // Add mode type
	Command = "command", // Add command type
	SectionHeader = "sectionHeader", // Add section header type
	Parameter = "parameter", // [AFX] Slash command parameter autocomplete
}

export interface ContextMenuQueryItem {
	type: ContextMenuOptionType
	value?: string
	label?: string
	description?: string
	icon?: string
	slashCommand?: string
	secondaryText?: string
	argumentHint?: string
}

export function getContextMenuOptions(
	query: string,
	selectedType: ContextMenuOptionType | null = null,
	queryItems: ContextMenuQueryItem[],
	dynamicSearchResults: SearchResult[] = [],
	modes?: ModeConfig[],
	commands?: Command[],
): ContextMenuQueryItem[] {
	// Handle slash commands for modes and commands
	// Only process as slash command if the query itself starts with "/" (meaning we're typing a slash command)
	if (query.startsWith("/")) {
		const slashQuery = query.slice(1)
		const results: ContextMenuQueryItem[] = []

		// [AFX-START] Parameter autocomplete for /afx-* commands after space
		if (slashQuery.startsWith("afx-") && slashQuery.includes(" ")) {
			const afxParams = getAfxParameterOptions(slashQuery, commands)
			if (afxParams.length > 0) return afxParams
		}
		// [AFX-END]

		// Add command suggestions first (prioritize commands at the top)
		if (commands?.length) {
			// Create searchable strings array for fzf (filter hidden AFX commands)
			const searchableCommands = commands
				.filter((command) => !command.name.startsWith("__")) // [AFX] Hide internal commands
				.map((command) => ({
					original: command,
					searchStr: command.name,
				}))

			// Initialize fzf instance for fuzzy search
			const fzf = new Fzf(searchableCommands, {
				selector: (item) => item.searchStr,
			})

			// Get fuzzy matching commands
			const matchingCommands = slashQuery
				? fzf.find(slashQuery).map((result) => ({
						type: ContextMenuOptionType.Command,
						value: result.item.original.name,
						slashCommand: `/${result.item.original.name}`,
						description: result.item.original.description,
						argumentHint: result.item.original.argumentHint,
					}))
				: commands
						.filter((cmd) => !cmd.name.startsWith("__")) // [AFX] Hide internal commands
						.map((command) => ({
							type: ContextMenuOptionType.Command,
							value: command.name,
							slashCommand: `/${command.name}`,
							description: command.description,
							argumentHint: command.argumentHint,
						}))

			if (matchingCommands.length > 0) {
				results.push({
					type: ContextMenuOptionType.SectionHeader,
					label: "Commands",
				})
				results.push(...matchingCommands)
			}
		}

		// Add mode suggestions second
		if (modes?.length) {
			// Create searchable strings array for fzf
			const searchableItems = modes.map((mode) => ({
				original: mode,
				searchStr: mode.name,
			}))

			// Initialize fzf instance for fuzzy search
			const fzf = new Fzf(searchableItems, {
				selector: (item) => item.searchStr,
			})

			// Get fuzzy matching items
			const matchingModes = slashQuery
				? fzf.find(slashQuery).map((result) => ({
						type: ContextMenuOptionType.Mode,
						value: result.item.original.slug,
						slashCommand: `/${result.item.original.slug}`,
						description: getModeDescription(result.item.original),
					}))
				: modes.map((mode) => ({
						type: ContextMenuOptionType.Mode,
						value: mode.slug,
						slashCommand: `/${mode.slug}`,
						description: getModeDescription(mode),
					}))

			if (matchingModes.length > 0) {
				results.push({
					type: ContextMenuOptionType.SectionHeader,
					label: "Modes",
				})
				results.push(...matchingModes)
			}
		}

		return results.length > 0 ? results : [{ type: ContextMenuOptionType.NoResults }]
	}

	const workingChanges: ContextMenuQueryItem = {
		type: ContextMenuOptionType.Git,
		value: "git-changes",
		label: "Working changes",
		description: "Current uncommitted changes",
		icon: "$(git-commit)",
	}

	if (query === "") {
		if (selectedType === ContextMenuOptionType.File) {
			const files = queryItems
				.filter(
					(item) =>
						item.type === ContextMenuOptionType.File || item.type === ContextMenuOptionType.OpenedFile,
				)
				.map((item) => ({
					type: item.type,
					value: item.value,
				}))
			return files.length > 0 ? files : [{ type: ContextMenuOptionType.NoResults }]
		}

		if (selectedType === ContextMenuOptionType.Folder) {
			const folders = queryItems
				.filter((item) => item.type === ContextMenuOptionType.Folder)
				.map((item) => ({ type: ContextMenuOptionType.Folder, value: item.value }))
			return folders.length > 0 ? folders : [{ type: ContextMenuOptionType.NoResults }]
		}

		if (selectedType === ContextMenuOptionType.Git) {
			const commits = queryItems.filter((item) => item.type === ContextMenuOptionType.Git)
			return commits.length > 0 ? [workingChanges, ...commits] : [workingChanges]
		}

		return [
			{ type: ContextMenuOptionType.Problems },
			{ type: ContextMenuOptionType.Terminal },
			{ type: ContextMenuOptionType.URL },
			{ type: ContextMenuOptionType.Folder },
			{ type: ContextMenuOptionType.File },
			{ type: ContextMenuOptionType.Git },
		]
	}

	const lowerQuery = query.toLowerCase()
	const suggestions: ContextMenuQueryItem[] = []

	// [AFX-START] Handle @afx-specs# drill-down autocomplete
	if (lowerQuery.startsWith("afx-specs#")) {
		const afxDrillDown = getAfxDrillDownOptions(lowerQuery, commands)
		if (afxDrillDown.length > 0) return afxDrillDown
	}
	// [AFX-END]

	// Check for top-level option matches
	if ("git".startsWith(lowerQuery)) {
		suggestions.push({
			type: ContextMenuOptionType.Git,
			label: "Git Commits",
			description: "Search repository history",
			icon: "$(git-commit)",
		})
	} else if ("git-changes".startsWith(lowerQuery)) {
		suggestions.push(workingChanges)
	}
	if ("problems".startsWith(lowerQuery)) {
		suggestions.push({ type: ContextMenuOptionType.Problems })
	}
	if ("terminal".startsWith(lowerQuery)) {
		suggestions.push({ type: ContextMenuOptionType.Terminal })
	}
	if (query.startsWith("http")) {
		suggestions.push({ type: ContextMenuOptionType.URL, value: query })
	}

	// Add exact SHA matches to suggestions
	if (/^[a-f0-9]{7,40}$/i.test(lowerQuery)) {
		const exactMatches = queryItems.filter(
			(item) => item.type === ContextMenuOptionType.Git && item.value?.toLowerCase() === lowerQuery,
		)
		if (exactMatches.length > 0) {
			suggestions.push(...exactMatches)
		} else {
			// If no exact match but valid SHA format, add as option
			suggestions.push({
				type: ContextMenuOptionType.Git,
				value: lowerQuery,
				label: `Commit ${lowerQuery}`,
				description: "Git commit hash",
				icon: "$(git-commit)",
			})
		}
	}

	const searchableItems = queryItems.map((item) => ({
		original: item,
		searchStr: [item.value, item.label, item.description].filter(Boolean).join(" "),
	}))

	// Initialize fzf instance for fuzzy search
	const fzf = new Fzf(searchableItems, {
		selector: (item) => item.searchStr,
	})

	// Get fuzzy matching items
	const matchingItems = query ? fzf.find(query).map((result) => result.item.original) : []

	// Separate matches by type
	const openedFileMatches = matchingItems.filter((item) => item.type === ContextMenuOptionType.OpenedFile)

	const gitMatches = matchingItems.filter((item) => item.type === ContextMenuOptionType.Git)

	// Convert search results to queryItems format
	const searchResultItems = dynamicSearchResults.map((result) => {
		// Ensure paths start with / for consistency
		const formattedPath = result.path.startsWith("/") ? result.path : `/${result.path}`

		// For display purposes, we don't escape spaces in the label or description
		const displayPath = formattedPath
		const displayName = result.label || getBasename(result.path)

		// We don't need to escape spaces here because the insertMention function
		// will handle that when the user selects a suggestion

		return {
			type: result.type === "folder" ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
			value: formattedPath,
			label: displayName,
			description: displayPath,
		}
	})

	const allItems = [...suggestions, ...openedFileMatches, ...searchResultItems, ...gitMatches]

	// Remove duplicates - normalize paths by ensuring all have leading slashes
	const seen = new Set()
	const deduped = allItems.filter((item) => {
		// Normalize paths for deduplication by ensuring leading slashes
		const normalizedValue = item.value
		let key = ""
		if (
			item.type === ContextMenuOptionType.File ||
			item.type === ContextMenuOptionType.Folder ||
			item.type === ContextMenuOptionType.OpenedFile
		) {
			key = normalizedValue!
		} else {
			key = `${item.type}-${normalizedValue}`
		}
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})

	return deduped.length > 0 ? deduped : [{ type: ContextMenuOptionType.NoResults }]
}

export function shouldShowContextMenu(text: string, position: number): boolean {
	const beforeCursor = text.slice(0, position)

	// Check if we're in a slash command context (at the beginning and no space yet)
	if (text.startsWith("/") && !text.includes(" ") && position <= text.length) {
		return true
	}

	// [AFX-START] Keep dropdown open for parameter autocomplete after /afx-* commands
	// Cap at 3 space-separated parts max (command + subcommand + feature + doc)
	if (text.startsWith("/afx-") && text.includes(" ")) {
		const parts = text.trim().split(/\s+/)
		if (parts.length <= 4) return true // /afx-spec review user-auth design = 4 parts max
	}
	// [AFX-END]

	// Check for @ mention context
	const atIndex = beforeCursor.lastIndexOf("@")

	if (atIndex === -1) {
		return false
	}

	const textAfterAt = beforeCursor.slice(atIndex + 1)

	// Check if there's any unescaped whitespace after the '@'
	// We need to check for whitespace that isn't preceded by a backslash
	// Using a negative lookbehind to ensure the space isn't escaped
	const hasUnescapedSpace = /(?<!\\)\s/.test(textAfterAt)
	if (hasUnescapedSpace) return false

	// Don't show the menu if it's clearly a URL
	if (textAfterAt.toLowerCase().startsWith("http")) {
		return false
	}

	// Show menu in all other cases
	return true
}

// [AFX-START] Parameter autocomplete for /afx-* slash commands
// Provides two-level autocomplete: subcommand → feature name

const AFX_SKILL_SUBCOMMANDS: Record<string, string[]> = {
	"afx-spec": ["validate", "gaps", "discuss", "review", "design", "tasks", "approve", "create"],
	"afx-work": ["status", "pick", "resume", "sync", "plan", "complete", "reopen", "close"],
	"afx-dev": ["code", "debug", "refactor", "review", "test", "optimize"],
	"afx-task": ["verify", "brief"],
	"afx-check": ["path", "trace", "links", "schema", "all"],
	"afx-session": ["note", "log", "recap", "promote"],
	"afx-context": ["save", "load", "history", "impact"],
	"afx-init": ["feature", "adr", "template", "prefix", "config"],
	"afx-report": ["orphans", "coverage", "stale"],
	"afx-discover": ["infra", "scripts", "tools", "capabilities"],
	"afx-research": ["explore", "compare", "summarize", "finalize"],
	"afx-update": ["check", "apply"],
}

// Subcommands that accept a feature name as next parameter
const FEATURE_ACCEPTING_SUBCOMMANDS = new Set([
	"validate",
	"gaps",
	"discuss",
	"review",
	"design",
	"tasks",
	"approve",
	"pick",
	"resume",
	"sync",
	"complete",
	"reopen",
	"close",
	"code",
	"debug",
	"refactor",
	"test",
	"optimize",
	"verify",
	"brief",
	"path",
	"trace",
	"links",
	"schema",
	"all",
	"recap",
	"promote",
	"save",
	"history",
	"impact",
	"coverage",
	"stale",
	"explore",
	"compare",
	"summarize",
	"finalize",
])

function getAfxParameterOptions(slashQuery: string, commands?: Command[]): ContextMenuQueryItem[] {
	// Parse: "afx-spec review u" → command="afx-spec", parts=["review", "u"]
	const spaceIndex = slashQuery.indexOf(" ")
	const commandName = slashQuery.substring(0, spaceIndex)
	const afterCommand = slashQuery.substring(spaceIndex + 1)
	const parts = afterCommand.split(" ").filter(Boolean)

	const subcommands = AFX_SKILL_SUBCOMMANDS[commandName]
	if (!subcommands) return []

	// Level 1: No subcommand yet or partial subcommand → show subcommands
	if (parts.length === 0 || (parts.length === 1 && !subcommands.includes(parts[0]))) {
		const partial = parts[0]?.toLowerCase() ?? ""
		const filtered = subcommands.filter((s) => s.startsWith(partial) || s.includes(partial))

		return filtered.slice(0, 10).map((sub) => ({
			type: ContextMenuOptionType.Parameter,
			value: sub,
			label: sub,
			description: `/${commandName} ${sub}`,
		}))
	}

	// Level 2: Subcommand selected, show feature names
	if (parts.length >= 1 && parts.length < 3 && subcommands.includes(parts[0])) {
		const subcommand = parts[0]
		if (!FEATURE_ACCEPTING_SUBCOMMANDS.has(subcommand)) return []

		const featureHints = getFeatureNamesFromCommands(commands)
		if (featureHints.length === 0) return []

		const partial = parts[1]?.toLowerCase() ?? ""

		// If feature is fully typed and matches, move to Level 3
		if (parts.length === 2 && featureHints.includes(parts[1])) {
			return getAfxLevel3Options(commandName, subcommand, parts[1], commands)
		}

		const filtered = featureHints.filter((f) => f.startsWith(partial) || f.includes(partial))

		return filtered.slice(0, 10).map((feature) => ({
			type: ContextMenuOptionType.Parameter,
			value: feature,
			label: feature,
			description: `/${commandName} ${subcommand} ${feature}`,
		}))
	}

	// Level 3: Subcommand + feature selected, show context-specific options
	if (parts.length >= 2 && subcommands.includes(parts[0])) {
		const subcommand = parts[0]
		const feature = parts[1]
		const partial = parts[2]?.toLowerCase() ?? ""

		const level3 = getAfxLevel3Options(commandName, subcommand, feature, commands)
		if (level3.length === 0) return []

		if (partial) {
			return level3
				.filter(
					(item) =>
						item.value?.toLowerCase().includes(partial) || item.label?.toLowerCase().includes(partial),
				)
				.slice(0, 10)
		}
		return level3.slice(0, 10)
	}

	return []
}

// Level 3 options based on command + subcommand context
function getAfxLevel3Options(
	commandName: string,
	subcommand: string,
	feature: string,
	commands?: Command[],
): ContextMenuQueryItem[] {
	// Get real section data from __afx-sections
	const sections = getAfxSectionsData(commands)
	const featureSections = sections[feature]

	// /afx-spec → show documents, then drill to sections
	if (
		commandName === "afx-spec" &&
		["review", "validate", "gaps", "discuss", "design", "approve"].includes(subcommand)
	) {
		return getDocOrSectionOptions(commandName, subcommand, feature, featureSections)
	}

	// /afx-dev → show documents or task IDs
	if (commandName === "afx-dev") {
		return getDocOrSectionOptions(commandName, subcommand, feature, featureSections)
	}

	// /afx-task verify|brief → show task IDs from tasks.md
	if (commandName === "afx-task") {
		const taskItems = featureSections?.tasks?.filter((t) => t.includes("|")) ?? []
		if (taskItems.length > 0) {
			return taskItems
				.map((t) => {
					const [idPart, ...rest] = t.split("|")
					const label = rest.join("|")
					return {
						type: ContextMenuOptionType.Parameter,
						value: `${feature}#${idPart}`,
						label: label || idPart,
						description: `/${commandName} ${subcommand} ${feature}#${idPart}`,
					}
				})
				.slice(0, 10)
		}
		return [
			{
				type: ContextMenuOptionType.Parameter,
				value: "",
				label: "Enter task ID (e.g., 2.3)",
				description: `/${commandName} ${subcommand} ${feature}#<task-id>`,
			},
		]
	}

	// /afx-check → scope options
	if (commandName === "afx-check") {
		return ["src/", `docs/specs/${feature}/`].map((p) => ({
			type: ContextMenuOptionType.Parameter,
			value: p,
			label: p,
			description: `/${commandName} ${subcommand} ${p}`,
		}))
	}

	return []
}

function getDocOrSectionOptions(
	commandName: string,
	subcommand: string,
	feature: string,
	featureSections?: Record<string, string[]>,
): ContextMenuQueryItem[] {
	const docs = ["spec", "design", "tasks", "journal"]
	const results: ContextMenuQueryItem[] = []

	for (const doc of docs) {
		const sections = featureSections?.[doc] ?? []
		if (sections.length > 0) {
			// Show doc with section count hint
			results.push({
				type: ContextMenuOptionType.Parameter,
				value: `${doc}`,
				label: `${doc}.md`,
				description: `${sections.length} sections — /${commandName} ${subcommand} ${feature} ${doc}`,
			})
		} else {
			results.push({
				type: ContextMenuOptionType.Parameter,
				value: `${doc}`,
				label: `${doc}.md`,
				description: `/${commandName} ${subcommand} ${feature} ${doc}`,
			})
		}
	}

	return results
}

function getAfxSectionsData(commands?: Command[]): Record<string, Record<string, string[]>> {
	const sectionsCmd = commands?.find((c) => c.name === "__afx-sections")
	if (sectionsCmd?.description) {
		try {
			return JSON.parse(sectionsCmd.description)
		} catch {
			return {}
		}
	}
	return {}
}

function getFeatureNamesFromCommands(commands?: Command[]): string[] {
	// Look for the special __afx-features command injected by AfxManager
	const featuresCmd = commands?.find((c) => c.name === "__afx-features")
	if (featuresCmd?.argumentHint) {
		return featuresCmd.argumentHint
			.split(",")
			.map((f) => f.trim())
			.filter(Boolean)
	}
	return []
}

/**
 * Drill-down autocomplete for @afx-specs#feature#doc#section mentions.
 * Level 1: @afx-specs# → feature names
 * Level 2: @afx-specs#auth# → doc names (spec, design, tasks, journal)
 * Level 3: @afx-specs#auth#design# → section headings (fetched from __afx-features)
 */
function getAfxDrillDownOptions(query: string, commands?: Command[]): ContextMenuQueryItem[] {
	// Parse: "afx-specs#auth#design#jwt" → parts = ["auth", "design", "jwt"]
	const afterPrefix = query.substring("afx-specs#".length)
	const parts = afterPrefix.split("#")

	const featureNames = getFeatureNamesFromCommands(commands)

	// Level 1: After "afx-specs#" → show feature names
	if (parts.length <= 1) {
		const partial = parts[0]?.toLowerCase() ?? ""
		const filtered = featureNames.filter((f) => f.startsWith(partial) || f.includes(partial))
		if (filtered.length === 0 && featureNames.length === 0) {
			return [{ type: ContextMenuOptionType.NoResults, label: "No AFX features found" }]
		}
		return filtered.map((f) => ({
			type: ContextMenuOptionType.Parameter,
			value: `afx-specs#${f}`,
			label: f,
			description: "Feature",
		}))
	}

	// Level 2: After "afx-specs#auth#" → show document types
	if (parts.length <= 2) {
		const feature = parts[0]
		const partial = parts[1]?.toLowerCase() ?? ""
		const docs = ["spec", "design", "tasks", "journal"]
		const filtered = docs.filter((d) => d.startsWith(partial) || d.includes(partial))
		return filtered.map((d) => ({
			type: ContextMenuOptionType.Parameter,
			value: `afx-specs#${feature}#${d}`,
			label: `${d}.md`,
			description: `${feature} / ${d}`,
		}))
	}

	// Level 3: After "afx-specs#auth#design#" → show real section headings
	if (parts.length <= 3) {
		const feature = parts[0]
		const doc = parts[1]
		const partial = parts[2]?.toLowerCase() ?? ""

		// Get real sections from __afx-sections
		const sectionsData = getAfxSectionsData(commands)
		const docSections = sectionsData[feature]?.[doc] ?? []

		if (docSections.length > 0) {
			const filtered = docSections
				.filter((s) => {
					const slug = s.split("|")[0] // Handle task format "2.1|○ Widget API"
					return slug.startsWith(partial) || slug.includes(partial)
				})
				.slice(0, 10)

			return filtered.map((s) => {
				const [slug, label] = s.includes("|") ? [s.split("|")[0], s.split("|").slice(1).join("|")] : [s, s]
				return {
					type: ContextMenuOptionType.Parameter,
					value: `afx-specs#${feature}#${doc}#${slug}`,
					label: label || slug,
					description: `${feature}/${doc}.md#${slug}`,
				}
			})
		}

		// Fallback: no section data, show send hint (non-selectable)
		return [
			{
				type: ContextMenuOptionType.NoResults,
				label: `Load ${feature}/${doc}.md content`,
				description: "Section headings resolved on send",
			},
		]
	}

	return []
}
// [AFX-END]
