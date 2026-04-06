// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * @spec mention resolver — reads spec files directly from filesystem.
 * Does NOT depend on AfxManager (parseMentions doesn't have access to AfxProvider).
 *
 * @see docs/specs/15-vscode-agenticflowx-copilot-chat/design.md [DES-MENTION]
 */

import * as path from "path"
import { readdir, readFile, access, constants } from "fs/promises"

interface SpecSummary {
	name: string
	status: string
	designStatus: string
	tasksCompleted: number
	tasksTotal: number
	activePhase: string
}

/**
 * Main entry point for @afx-specs mention content.
 * Supports plain overview and action subcommands (discuss, review, create, validate, diff).
 */
export async function getAfxMentionContent(cwd: string, mentionText?: string): Promise<string> {
	const specsDir = await findSpecsDir(cwd)
	if (!specsDir) return "No AFX specs found in this workspace."

	const features = await scanFeatures(specsDir)
	if (features.length === 0) return "No features found in specs directory."

	// Check for action subcommand: "@afx-specs review auth" → action="review", args="auth"
	if (mentionText) {
		const actionMatch = mentionText.match(
			/^afx-specs\s+(discuss|review|create|validate|diff|gaps|approve|coverage|orphans|stale|status|next|tasks|verify)\s*(.*)$/i,
		)
		if (actionMatch) {
			const [, action, actionArgs] = actionMatch
			return formatActionContext(action.toLowerCase(), actionArgs.trim(), features, specsDir, cwd)
		}
	}

	// Plain overview
	return formatOverview(features)
}

function formatOverview(features: SpecSummary[]): string {
	const totalTasks = features.reduce((sum, f) => sum + f.tasksTotal, 0)
	const completedTasks = features.reduce((sum, f) => sum + f.tasksCompleted, 0)
	const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

	const lines: string[] = [
		`AgenticFlowX Project Overview (${features.length} features, ${completedTasks}/${totalTasks} tasks — ${pct}%)`,
		"",
	]

	for (const f of features) {
		const taskPct = f.tasksTotal > 0 ? Math.round((f.tasksCompleted / f.tasksTotal) * 100) : 0
		lines.push(
			`- **${f.name}**: Spec ${f.status} | Design ${f.designStatus} | Tasks ${f.tasksCompleted}/${f.tasksTotal} (${taskPct}%)${f.activePhase ? ` | Active: ${f.activePhase}` : ""}`,
		)
	}

	const featureNames = features.map((f) => f.name).join(" | ")

	lines.push("")
	lines.push("**Available actions** (type in next message):")
	lines.push("")
	lines.push("Spec Lifecycle:")
	lines.push(`  @afx-specs review <${featureNames}>`)
	lines.push(`  @afx-specs validate <${featureNames}>`)
	lines.push(`  @afx-specs gaps <${featureNames}>`)
	lines.push(`  @afx-specs discuss <${featureNames}>`)
	lines.push(`  @afx-specs approve <${featureNames}>`)
	lines.push(`  @afx-specs create <name>`)
	lines.push(`  @afx-specs design <${featureNames}>`)
	lines.push(`  @afx-specs diff <${featureNames}>`)
	lines.push("")
	lines.push("Work & Tasks:")
	lines.push("  @afx-specs status")
	lines.push("  @afx-specs next")
	lines.push(`  @afx-specs tasks <${featureNames}>`)
	lines.push(`  @afx-specs verify <feature>#<task-id>`)
	lines.push(`  @afx-specs pick <${featureNames}>`)
	lines.push("")
	lines.push("Quality:")
	lines.push(`  @afx-specs coverage <${featureNames}>`)
	lines.push("  @afx-specs orphans [path]")
	lines.push("  @afx-specs stale [days]")
	lines.push("  @afx-specs trace [path]")
	lines.push("")
	lines.push("Session:")
	lines.push(`  @afx-specs recap <${featureNames}>`)
	lines.push('  @afx-specs note "content"')
	lines.push("")
	lines.push("Slash commands: /afx-spec, /afx-work, /afx-dev, /afx-task, /afx-check, /afx-session")

	return lines.join("\n")
}

async function formatActionContext(
	action: string,
	args: string,
	features: SpecSummary[],
	specsDir: string,
	cwd: string,
): Promise<string> {
	// Parse args: "user-auth design#jwt-tokens" → feature="user-auth", docSection="design#jwt-tokens"
	const argParts = args.split(/\s+/)
	const featureName = argParts[0] || features[0]?.name || ""
	const featureDir = path.join(specsDir, featureName)
	// Remaining args may contain doc#section references
	const docSectionRefs = argParts
		.slice(1)
		.filter((a) => a.includes("#") || ["spec", "design", "tasks", "journal"].includes(a))

	// If doc#section references provided, load only those sections
	let targetedContent = ""
	if (docSectionRefs.length > 0) {
		const sections: string[] = []
		for (const ref of docSectionRefs) {
			const [doc, section] = ref.split("#")
			const docPath = path.join(featureDir, `${doc}.md`)
			const content = await safeReadFile(docPath)
			if (section) {
				const extracted = extractSectionContent(content, section)
				sections.push(`--- ${doc}.md#${section} ---\n${extracted?.content || "(section not found)"}`)
			} else {
				sections.push(`--- ${doc}.md ---\n${content}`)
			}
		}
		targetedContent = sections.join("\n\n")
	}

	switch (action) {
		case "discuss": {
			const context = targetedContent || formatOverview(features)
			const topic = docSectionRefs.length > 0 ? docSectionRefs.join(", ") : args || "this topic"
			return `${context}\n\n---\nACTION: Start a discussion about "${topic}" for feature ${featureName}\n\nInstructions:\n1. Discuss the topic in the context of the specs above\n2. Log the discussion to docs/specs/${featureName}/journal.md\n3. Use auto-generated discussion ID format: {PREFIX}-D{NNN}\n4. Set status to "active" unless a conclusion is reached\n5. Include rationale, alternatives considered, and decision (if any)`
		}
		case "review": {
			const content =
				targetedContent ||
				[
					`--- spec.md ---\n${await safeReadFile(path.join(featureDir, "spec.md"))}`,
					`--- design.md ---\n${await safeReadFile(path.join(featureDir, "design.md"))}`,
					`--- tasks.md ---\n${await safeReadFile(path.join(featureDir, "tasks.md"))}`,
				].join("\n\n")
			const scope = docSectionRefs.length > 0 ? docSectionRefs.join(", ") : "full spec"
			return `AFX SPEC REVIEW: ${featureName} (${scope})\n\n${content}\n\n---\nACTION: Review this feature's specs\n\nChecklist:\n- [ ] Frontmatter complete (afx, type, status, owner, version)\n- [ ] Required sections present\n- [ ] Acceptance criteria clear and testable\n- [ ] Design aligns with spec requirements\n- [ ] Tasks cover all spec requirements\n- [ ] Cross-references valid (@see links)\n- [ ] No stale or contradictory content`
		}
		case "create": {
			const overview = formatOverview(features)
			return `${overview}\n\n---\nACTION: Create a new feature spec for "${featureName}"\n\nInstructions:\n1. Create directory: docs/specs/${featureName}/\n2. Create spec.md with frontmatter (afx: true, type: SPEC, status: Draft, owner: @rix)\n3. Create design.md with frontmatter (type: DESIGN, status: Draft)\n4. Create tasks.md with frontmatter (type: TASKS, status: Living)\n5. Add user stories and acceptance criteria to spec.md\n6. Leave design.md and tasks.md as stubs for later refinement`
		}
		case "validate": {
			const specContent = await safeReadFile(path.join(featureDir, "spec.md"))
			const designContent = await safeReadFile(path.join(featureDir, "design.md"))
			const tasksContent = await safeReadFile(path.join(featureDir, "tasks.md"))
			return `AFX SPEC VALIDATION: ${featureName}\n\n--- spec.md ---\n${specContent}\n\n--- design.md ---\n${designContent}\n\n--- tasks.md ---\n${tasksContent}\n\n---\nACTION: Validate spec structure\n\nRules:\n- Frontmatter must have: afx: true, type, status, owner\n- spec.md requires: Overview, User Stories (with acceptance criteria)\n- design.md requires: Architecture section\n- tasks.md requires: At least one phase with checkbox tasks\n- Task format: "- [ ] X.Y Description"\n- All @see links must point to existing files/sections\n\nReport: PASS/FAIL per rule, with specific fixes for failures.`
		}
		case "diff": {
			return `AFX SPEC DIFF: ${featureName}\n\n---\nACTION: Show what changed in specs since last review\n\nInstructions:\n1. Run: git diff -- docs/specs/${featureName}/\n2. If no git changes, check last_verified timestamp in frontmatter\n3. Summarize: what sections changed, what's new, what was removed\n4. Flag any changes that may need design review`
		}
		default:
			return formatOverview(features)
	}
}

async function safeReadFile(filePath: string): Promise<string> {
	try {
		return await readFile(filePath, "utf-8")
	} catch {
		return "(file not found)"
	}
}

async function findSpecsDir(cwd: string): Promise<string | undefined> {
	for (const candidate of ["docs/specs", "specs", "docs/features"]) {
		const abs = path.join(cwd, candidate)
		try {
			await access(abs, constants.R_OK)
			return abs
		} catch {
			// not found
		}
	}
	return undefined
}

async function scanFeatures(specsDir: string): Promise<SpecSummary[]> {
	const entries = await readdir(specsDir, { withFileTypes: true })
	const dirs = entries.filter((e) => e.isDirectory())

	const results: SpecSummary[] = []

	for (const dir of dirs) {
		const dirPath = path.join(specsDir, dir.name)
		const summary: SpecSummary = {
			name: dir.name,
			status: "Missing",
			designStatus: "Missing",
			tasksCompleted: 0,
			tasksTotal: 0,
			activePhase: "",
		}

		// Read spec.md frontmatter
		summary.status = await readFrontmatterStatus(path.join(dirPath, "spec.md"))
		summary.designStatus = await readFrontmatterStatus(path.join(dirPath, "design.md"))

		// Count tasks from tasks.md
		const taskStats = await countTasks(path.join(dirPath, "tasks.md"))
		summary.tasksCompleted = taskStats.completed
		summary.tasksTotal = taskStats.total
		summary.activePhase = taskStats.activePhase

		results.push(summary)
	}

	return results
}

async function readFrontmatterStatus(filePath: string): Promise<string> {
	try {
		const content = await readFile(filePath, "utf-8")
		const lines = content.split("\n")
		if (lines[0]?.trim() !== "---") return "No frontmatter"

		for (let i = 1; i < Math.min(lines.length, 20); i++) {
			if (lines[i].trim() === "---") break
			const match = /^status:\s*(.+)$/i.exec(lines[i])
			if (match) return match[1].trim()
		}
		return "Draft"
	} catch {
		return "Missing"
	}
}

async function countTasks(filePath: string): Promise<{ completed: number; total: number; activePhase: string }> {
	try {
		const content = await readFile(filePath, "utf-8")
		const lines = content.split("\n")
		let total = 0
		let completed = 0
		let currentPhase = ""
		let activePhase = ""

		for (const line of lines) {
			const phaseMatch = /^##\s+Phase\s+(\d+):?\s+(.*)$/i.exec(line)
			if (phaseMatch) {
				currentPhase = `Phase ${phaseMatch[1]}: ${phaseMatch[2]}`
			}

			const taskMatch = /^\s*-\s+\[([ xX])\]/.exec(line)
			if (taskMatch) {
				total++
				if (taskMatch[1] !== " ") {
					completed++
				} else if (!activePhase && currentPhase) {
					activePhase = currentPhase
				}
			}
		}

		return { completed, total, activePhase }
	} catch {
		return { completed: 0, total: 0, activePhase: "" }
	}
}

/**
 * Resolve @afx-specs#feature#doc#section drill-down to structured content.
 * Returns the targeted content with surrounding context (status, related tasks, decisions).
 */
export async function getAfxDrillDownContent(cwd: string, drillPath: string): Promise<string> {
	const parts = drillPath.split("#").filter(Boolean)
	const specsDir = await findSpecsDir(cwd)
	if (!specsDir) return "No AFX specs found in this workspace."

	const featureName = parts[0]
	if (!featureName) return "Specify a feature: @afx-specs#<feature>"

	const featureDir = path.join(specsDir, featureName)

	// Level 1: @afx-specs#auth → feature overview
	if (parts.length === 1) {
		const summary = await scanFeatureSummary(featureDir, featureName)
		return summary
	}

	const docName = parts[1]
	const docFile = `${docName}.md`
	const docPath = path.join(featureDir, docFile)

	let content: string
	try {
		content = await readFile(docPath, "utf-8")
	} catch {
		return `Error: ${featureName}/${docFile} not found.`
	}

	// Level 2: @afx-specs#auth#design → full document with metadata
	if (parts.length === 2) {
		const status = await readFrontmatterStatus(docPath)
		const truncated = content.length > 4000 ? content.substring(0, 4000) + "\n\n[truncated]" : content
		return `Feature: ${featureName} | Document: ${docFile} | Status: ${status}\n\n${truncated}`
	}

	// Level 3: @afx-specs#auth#design#jwt-tokens → specific section with context
	const sectionSlug = parts.slice(2).join("#")
	const section = extractSectionContent(content, sectionSlug)

	if (!section) {
		return `Section "${sectionSlug}" not found in ${featureName}/${docFile}.\n\nAvailable sections:\n${listSectionHeadings(content)}`
	}

	const status = await readFrontmatterStatus(docPath)

	// Build structured context
	const lines = [
		`Feature: ${featureName} | Document: ${docFile} | Status: ${status}`,
		`Section: ${section.heading}`,
		"",
		section.content,
	]

	// Add related tasks if available
	const tasksPath = path.join(featureDir, "tasks.md")
	try {
		const tasksContent = await readFile(tasksPath, "utf-8")
		const relatedTasks = findRelatedTasks(tasksContent, sectionSlug)
		if (relatedTasks.length > 0) {
			lines.push("", "Related tasks:")
			for (const task of relatedTasks) lines.push(`  ${task}`)
		}
	} catch {}

	// Add related decisions if available
	const journalPath = path.join(featureDir, "journal.md")
	try {
		const journalContent = await readFile(journalPath, "utf-8")
		const relatedDecisions = findRelatedDecisions(journalContent, sectionSlug)
		if (relatedDecisions.length > 0) {
			lines.push("", "Related decisions:")
			for (const decision of relatedDecisions) lines.push(`  ${decision}`)
		}
	} catch {}

	return lines.join("\n")
}

async function scanFeatureSummary(featureDir: string, featureName: string): Promise<string> {
	const specStatus = await readFrontmatterStatus(path.join(featureDir, "spec.md"))
	const designStatus = await readFrontmatterStatus(path.join(featureDir, "design.md"))
	const taskStats = await countTasks(path.join(featureDir, "tasks.md"))
	const pct = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0

	const lines = [
		`Feature: ${featureName}`,
		`Spec: ${specStatus} | Design: ${designStatus} | Tasks: ${taskStats.completed}/${taskStats.total} (${pct}%)`,
	]
	if (taskStats.activePhase) lines.push(`Active: ${taskStats.activePhase}`)

	// List available documents
	lines.push("", "Documents:")
	for (const doc of ["spec.md", "design.md", "tasks.md", "journal.md"]) {
		const status = await readFrontmatterStatus(path.join(featureDir, doc))
		lines.push(`  ${doc} — ${status}`)
	}

	lines.push("", `Drill deeper: @afx-specs#${featureName}#design, @afx-specs#${featureName}#tasks`)

	return lines.join("\n")
}

function extractSectionContent(content: string, sectionSlug: string): { heading: string; content: string } | undefined {
	const slug = sectionSlug.toLowerCase().replace(/[^\w-]/g, "")
	const lines = content.split("\n")
	let capturing = false
	let capturedLevel = 0
	let heading = ""
	const result: string[] = []

	for (const line of lines) {
		const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line)
		if (headingMatch) {
			const level = headingMatch[1].length
			const headingSlug = headingMatch[2]
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, "-")

			if (capturing && level <= capturedLevel) break
			if (headingSlug.includes(slug)) {
				capturing = true
				capturedLevel = level
				heading = headingMatch[2]
			}
		}
		if (capturing) result.push(line)
	}

	return result.length > 0 ? { heading, content: result.join("\n") } : undefined
}

function listSectionHeadings(content: string): string {
	const headings: string[] = []
	for (const line of content.split("\n")) {
		const match = /^(#{1,6})\s+(.+)$/.exec(line)
		if (match) {
			const slug = match[2]
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, "-")
			headings.push(`  ${"  ".repeat(match[1].length - 1)}${match[2]} → #${slug}`)
		}
	}
	return headings.join("\n")
}

function findRelatedTasks(tasksContent: string, sectionSlug: string): string[] {
	const results: string[] = []
	for (const line of tasksContent.split("\n")) {
		const taskMatch = /^\s*-\s*\[([ xX])\]\s*(.+)$/.exec(line)
		if (taskMatch && taskMatch[2].toLowerCase().includes(sectionSlug.replace(/-/g, " ").substring(0, 10))) {
			const status = taskMatch[1].toLowerCase() === "x" ? "✓" : "○"
			results.push(`${status} ${taskMatch[2]}`)
		}
	}
	return results.slice(0, 5)
}

function findRelatedDecisions(journalContent: string, sectionSlug: string): string[] {
	const results: string[] = []
	const searchTerm = sectionSlug.replace(/-/g, " ").substring(0, 10).toLowerCase()
	const discussionRegex = /^###\s+([\w-]+-D\d+)\s*-\s*[\d-]+\s*-\s*(.+)$/gm

	for (const match of journalContent.matchAll(discussionRegex)) {
		const id = match[1]
		const title = match[2]
		if (title.toLowerCase().includes(searchTerm)) {
			results.push(`${id}: ${title}`)
		}
	}
	return results.slice(0, 3)
}
