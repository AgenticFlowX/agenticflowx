// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * AfxManager — main AgenticFlowX service, owned by AfxProvider.
 * Follows agenticflowx's service pattern (like McpHub, SkillsManager).
 *
 * Class is required here: implements vscode.Disposable, held by AfxProvider.
 * All other agenticflowx code uses plain functions.
 *
 * @see docs/specs/vscode-agenticflowx-core/design.md#architecture
 */

import * as path from "path"
import { access } from "fs/promises"
import * as vscode from "vscode"
import type { AfxConfig, ParsedAfxConfig } from "./models/config"
import { loadEffectiveConfig } from "./config/config-parser"
import { autoDiscoverSpecsDir } from "./models/feature"
import type { Feature } from "./models/feature"
import { createSpecsDataProvider, type SpecsDataProvider } from "./services/data-provider"
import { createAfxPanelProvider, type AfxPanelProvider } from "./panel/panel-provider"
import { createFileWatchers } from "./watchers/file-watcher"
import { createStatusBar, type AfxStatusBar } from "./views/status-bar"
import { createFileDecorationProvider, type AfxFileDecorationProvider } from "./providers/file-decorations"
import { createSpecCodeLensProvider } from "./providers/spec-codelens"
import { createSpecHoverProvider } from "./providers/spec-hover"
import { createHookEngine, type HookEngine } from "./services/hook-engine"
// Global AFX registry — allows agenticflowx integration points to resolve
// AfxManager via dynamic import without param threading or circular deps.
let globalAfxManager: AfxManager | undefined

export function getGlobalAfxManager(): AfxManager | undefined {
	return globalAfxManager
}

export function setGlobalAfxManager(manager: AfxManager | undefined): void {
	globalAfxManager = manager
}

interface AfxState {
	root: string
	configPath: string
	config: AfxConfig
	rawText: string
}

export class AfxManager implements vscode.Disposable {
	private state: AfxState | undefined
	private specsData: SpecsDataProvider | undefined
	private panelProvider: AfxPanelProvider | undefined
	private fileDecorations: AfxFileDecorationProvider | undefined
	private statusBar: AfxStatusBar
	private watchers: vscode.Disposable[] = []
	hookEngine: HookEngine | undefined
	private readonly log: vscode.OutputChannel
	private specContextCache: { value: string | undefined; expiresAt: number } | undefined

	constructor(
		private readonly context: vscode.ExtensionContext,
		log: vscode.OutputChannel,
	) {
		this.statusBar = createStatusBar()
		this.log = log
	}

	async initialize(): Promise<void> {
		this.log.appendLine("[AFX] Initializing AgenticFlowX...")

		const root = await this.findAfxRoot()
		if (!root) {
			this.log.appendLine("[AFX] No AFX project found — staying dormant")
			return
		}
		this.log.appendLine(`[AFX] Found AFX root: ${root}`)

		const parsed = await loadEffectiveConfig(root)
		this.log.appendLine(
			`[AFX] Config loaded — specs dir: ${parsed.config.paths.specs}, features: [${parsed.config.features.join(", ")}]`,
		)

		this.state = {
			root,
			configPath: path.join(root, ".afx.yaml"),
			config: parsed.config,
			rawText: parsed.rawText,
		}

		// Data layer
		this.specsData = createSpecsDataProvider(
			() => this.state?.config,
			() => this.state?.root ?? "",
			this.log,
		)

		// Hook engine (write infrastructure)
		this.hookEngine = createHookEngine({
			getHookConfig: () => this.state?.config.hooks,
			getRoot: () => this.state?.root ?? "",
			getActiveFeature: async () => {
				const features = (await this.specsData?.getFeatures()) ?? []
				return this.detectActiveFeature(features)
			},
			refreshPanel: () => this.panelProvider?.refresh(),
			refreshSpecs: () => {
				this.specContextCache = undefined
				this.specsData?.refresh()
			},
			log: (msg: string) => this.log.appendLine(msg),
		})
		this.log.appendLine("[AFX] Hook engine created")

		// Panel provider
		this.panelProvider = createAfxPanelProvider(
			() => this.state?.config,
			() => this.state?.root ?? "",
			this.specsData,
			this.context.extensionUri,
			this.context.extensionMode,
			() => (this.context.globalState.get("telemetrySetting") as string) || "unset",
			this.log,
			(stats) => {
				this.statusBar.update(stats)
			},
		)

		// Register panel view
		this.context.subscriptions.push(
			vscode.window.registerWebviewViewProvider("agenticflowx.panel", this.panelProvider, {
				webviewOptions: { retainContextWhenHidden: true },
			}),
		)
		this.log.appendLine("[AFX] Panel provider registered")

		// File watchers
		this.watchers = createFileWatchers(parsed.config, root, {
			refreshAll: () => this.refreshAll(),
			refreshSpecs: () => {
				this.specContextCache = undefined
				this.specsData?.refresh()
				this.panelProvider?.refresh()
				this.fileDecorations?.refresh()
			},
			refreshAdrs: () => {
				this.panelProvider?.refresh()
			},
			refreshResources: () => {
				this.panelProvider?.refresh()
			},
		})
		for (const w of this.watchers) {
			this.context.subscriptions.push(w)
		}
		this.log.appendLine(`[AFX] File watchers created: ${this.watchers.length}`)

		// File decorations (explorer badges)
		this.fileDecorations = createFileDecorationProvider(() => this.specsData?.getFeatures() ?? Promise.resolve([]))
		this.context.subscriptions.push(vscode.window.registerFileDecorationProvider(this.fileDecorations))
		this.log.appendLine("[AFX] File decoration provider registered")

		// Code lens (@see links above functions)
		const codeLensProvider = createSpecCodeLensProvider(
			() => this.specsData?.getFeatures() ?? Promise.resolve([]),
			() => this.state?.root ?? "",
		)
		const codeLensLanguages = ["typescript", "javascript", "typescriptreact", "javascriptreact", "python", "go"]
		this.context.subscriptions.push(
			vscode.languages.registerCodeLensProvider(
				codeLensLanguages.map((lang) => ({ language: lang })),
				codeLensProvider,
			),
		)
		this.log.appendLine("[AFX] Code lens provider registered")

		// Hover provider (@see spec preview)
		const hoverProvider = createSpecHoverProvider(
			() => this.specsData?.getFeatures() ?? Promise.resolve([]),
			() => this.state?.root ?? "",
		)
		this.context.subscriptions.push(
			vscode.languages.registerHoverProvider(
				codeLensLanguages.map((lang) => ({ language: lang })),
				hoverProvider,
			),
		)
		this.log.appendLine("[AFX] Hover provider registered")

		// Definition provider (Cmd+click @see → navigate to spec heading)
		const { createSpecDefinitionProvider } = await import("./providers/spec-definition")
		const definitionProvider = createSpecDefinitionProvider(() => this.state?.root ?? "")
		this.context.subscriptions.push(
			vscode.languages.registerDefinitionProvider(
				codeLensLanguages.map((lang) => ({ language: lang })),
				definitionProvider,
			),
		)
		this.log.appendLine("[AFX] Definition provider registered")

		// Diagnostics provider (orphan + ghost warnings in Problems panel)
		const { createSpecDiagnosticsProvider } = await import("./providers/spec-diagnostics")
		const { disposables: diagDisposables } = createSpecDiagnosticsProvider(
			() => this.state?.root ?? "",
			codeLensLanguages,
		)
		for (const d of diagDisposables) {
			this.context.subscriptions.push(d)
		}
		this.log.appendLine("[AFX] Diagnostics provider registered")

		// @see autocomplete (editor — CompletionItemProvider)
		const { createSeeCompletionProvider } = await import("./providers/see-completion")
		const seeCompletionProvider = createSeeCompletionProvider(() => this.state?.root ?? "")
		this.context.subscriptions.push(
			vscode.languages.registerCompletionItemProvider(
				codeLensLanguages.map((lang) => ({ language: lang })),
				seeCompletionProvider,
				"/",
				"#",
			),
		)
		this.log.appendLine("[AFX] @see completion provider registered")

		// @see/@trace document links (clickable paths in editor)
		const { createSeeDocumentLinkProvider } = await import("./providers/see-document-links")
		const docLinkProvider = createSeeDocumentLinkProvider(() => this.state?.root ?? "")
		this.context.subscriptions.push(
			vscode.languages.registerDocumentLinkProvider(
				codeLensLanguages.map((lang) => ({ language: lang })),
				docLinkProvider,
			),
		)
		this.log.appendLine("[AFX] Document link provider registered")

		// Register agent tools (read_spec, list_tasks, update_task, log_session, log_discussion, check_traceability)
		try {
			const { customToolRegistry } = await import("@agenticflowx/core")
			const { createReadSpecTool } = await import("./tools/read-spec")
			const { createListTasksTool } = await import("./tools/list-tasks")
			const { createCheckTraceabilityTool } = await import("./tools/check-traceability")
			const { createUpdateTaskTool } = await import("./tools/update-task")
			const { createLogSessionTool } = await import("./tools/log-session")
			const { createLogDiscussionTool } = await import("./tools/log-discussion")

			const getRoot = () => this.state?.root ?? ""
			const wc = this.hookEngine!.writeCoordinator

			const tools = [
				createReadSpecTool(getRoot),
				createListTasksTool(getRoot),
				createCheckTraceabilityTool(getRoot),
				createUpdateTaskTool(getRoot, wc),
				createLogSessionTool(getRoot, wc),
				createLogDiscussionTool(getRoot, wc),
			]

			for (const tool of tools) {
				customToolRegistry.register(tool, "agenticflowx")
			}
			this.log.appendLine(`[AFX] Registered ${tools.length} agent tools`)
		} catch (err) {
			this.log.appendLine(`[AFX] Agent tools not registered: ${err instanceof Error ? err.message : String(err)}`)
		}

		// Status bar
		this.statusBar.show()
		this.context.subscriptions.push(this.statusBar)

		// Set context for when-clause visibility
		vscode.commands.executeCommand("setContext", "agenticflowx.loaded", true)

		// Register AFX code actions (separate provider — no agenticflowx core modification)
		const { createAfxCodeActionProvider } = await import("./providers/afx-code-actions")
		const { disposables: codeActionDisposables } = createAfxCodeActionProvider(this.context, this.log)
		for (const d of codeActionDisposables) {
			this.context.subscriptions.push(d)
		}
		this.log.appendLine(`[AFX] Code action provider registered (${codeActionDisposables.length} commands)`)

		// Register @afx chat participant for Copilot Chat (runtime detection — graceful if unavailable)
		try {
			const { registerAfxChatParticipant } = await import("./chat/afx-chat-participant")
			const chatDisposable = registerAfxChatParticipant(this.context, this.log)
			if (chatDisposable) {
				this.context.subscriptions.push(chatDisposable)
			}
		} catch (err) {
			this.log.appendLine(
				`[AFX] Chat participant not registered: ${err instanceof Error ? err.message : String(err)}`,
			)
		}

		this.log.appendLine("[AFX] Initialization complete ✓")
	}

	/**
	 * Returns active spec context for system prompt injection.
	 * Auto-detects active feature from editor or panel selection.
	 * Cached for 5s to avoid re-parsing on every API call.
	 */
	async getSpecContext(): Promise<string | undefined> {
		if (!this.state || !this.specsData) return undefined

		const now = Date.now()
		if (this.specContextCache && now < this.specContextCache.expiresAt) {
			return this.specContextCache.value
		}

		try {
			const features = await this.specsData.getFeatures()
			if (features.length === 0) return undefined

			const active = await this.detectActiveFeature(features)
			const value = active ? this.formatSpecContext(active, features) : this.formatOverview(features)

			this.specContextCache = { value, expiresAt: now + 5000 }
			return value
		} catch {
			return undefined
		}
	}

	/**
	 * Returns the active feature for Decision Replay injection.
	 * Public so afx-inject.ts can access it.
	 */
	async getActiveFeatureForReplay(): Promise<Feature | undefined> {
		if (!this.specsData) return undefined
		const features = await this.specsData.getFeatures()
		return this.detectActiveFeature(features)
	}

	private async detectActiveFeature(features: Feature[]): Promise<Feature | undefined> {
		const editor = vscode.window.activeTextEditor
		if (!editor) return undefined

		const filePath = editor.document.fileName

		// Check if file is under docs/specs/<feature>/
		for (const f of features) {
			if (filePath.startsWith(f.dirPath)) return f
		}

		// Check first 30 lines for @see docs/specs/<feature>/
		const lineCount = Math.min(editor.document.lineCount, 30)
		for (let i = 0; i < lineCount; i++) {
			const line = editor.document.lineAt(i).text
			const match = /@see\s+docs\/specs\/([a-z0-9-]+)\//i.exec(line)
			if (match) {
				return features.find((f) => f.name === match[1])
			}
		}

		return undefined
	}

	private formatSpecContext(feature: Feature, allFeatures: Feature[]): string {
		const lines: string[] = [
			`Active feature: ${feature.name}`,
			`Spec: ${feature.spec?.frontmatter.status ?? "Missing"} | Design: ${feature.design?.frontmatter.status ?? "Missing"} | Tasks: ${feature.taskStats.completed}/${feature.taskStats.total} (${feature.taskStats.total > 0 ? Math.round((feature.taskStats.completed / feature.taskStats.total) * 100) : 0}%)`,
		]

		// Active phase
		const activePhase = feature.taskStats.phases.find((p) => p.completed < p.total)
		if (activePhase) {
			lines.push(
				`Active phase: Phase ${activePhase.number} — ${activePhase.name} (${activePhase.completed}/${activePhase.total})`,
			)
			const nextTask = activePhase.items?.find((item) => !item.completed)
			if (nextTask) {
				lines.push(`Next unchecked: ${nextTask.text}`)
			}
		}

		// Recent journal decisions
		if (feature.discussions.length > 0) {
			const recent = feature.discussions.slice(0, 3)
			lines.push(`Recent discussions: ${recent.map((d) => `${d.id} (${d.status})`).join(", ")}`)
		}

		lines.push("")
		lines.push(`Project: ${allFeatures.length} features total`)
		lines.push("Available commands: /afx-work, /afx-dev, /afx-check, /afx-task")
		lines.push("Use @spec in chat to pull full spec context.")

		return lines.join("\n")
	}

	private formatOverview(features: Feature[]): string {
		const totalTasks = features.reduce((sum, f) => sum + f.taskStats.total, 0)
		const completedTasks = features.reduce((sum, f) => sum + f.taskStats.completed, 0)

		const lines: string[] = [
			`AgenticFlowX project: ${features.length} features, ${completedTasks}/${totalTasks} tasks complete`,
			`Features: ${features.map((f) => `${f.name} (${f.status})`).join(", ")}`,
			"",
			"Available commands: /afx-work, /afx-dev, /afx-check, /afx-task",
			"Use @spec in chat to pull full spec context.",
		]

		return lines.join("\n")
	}

	private async refreshAll(): Promise<void> {
		if (!this.state) return

		const parsed = await loadEffectiveConfig(this.state.root)
		this.state.config = parsed.config
		this.state.rawText = parsed.rawText

		this.specContextCache = undefined
		this.specsData?.refresh()
		this.panelProvider?.refresh()
		this.fileDecorations?.refresh()
	}

	private async findAfxRoot(): Promise<string | undefined> {
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		this.log.appendLine(`[AFX] findAfxRoot: workspaceRoot = ${workspaceRoot ?? "undefined"}`)
		if (!workspaceRoot) return undefined

		// Check for .afx.yaml or .afx/.afx.yaml
		const candidates = [path.join(workspaceRoot, ".afx.yaml"), path.join(workspaceRoot, ".afx", ".afx.yaml")]

		for (const candidate of candidates) {
			try {
				this.log.appendLine(`[AFX] findAfxRoot: checking ${candidate}`)
				await access(candidate)
				this.log.appendLine(`[AFX] findAfxRoot: found ${candidate}`)
				return workspaceRoot
			} catch (err) {
				this.log.appendLine(
					`[AFX] findAfxRoot: not found — ${candidate} (${err instanceof Error ? err.message : String(err)})`,
				)
				// not found
			}
		}

		// Check for docs/specs with afx content
		const discovered = await autoDiscoverSpecsDir(workspaceRoot)
		if (discovered) return workspaceRoot

		return undefined
	}

	dispose(): void {
		for (const w of this.watchers) {
			w.dispose()
		}
		this.panelProvider?.dispose()
		this.statusBar.dispose()
		vscode.commands.executeCommand("setContext", "agenticflowx.loaded", false)
		setGlobalAfxManager(undefined)
	}
}
