// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * AgenticFlowX panel WebviewViewProvider.
 * Serves the bottom panel webview and handles data collection + message routing.
 *
 * @see docs/specs/19-vscode-agenticflowx-panel/design.md [DES-PANEL-PROVIDER]
 */

import * as path from "path"
import * as vscode from "vscode"
import { readFile, writeFile } from "fs/promises"
import type { AfxConfig } from "../models/config"
import type { Feature } from "../models/feature"
import type { SpecsDataProvider } from "../services/data-provider"
import {
	featureToPipelineRow,
	featureToTasksData,
	featureToJournalEntries,
	scanAllDocs,
	countGhostTasks,
} from "../services/data-provider"
import { scanKanbanDir } from "../services/data-provider/kanban-parser"
import { readNotes, appendNote, deleteNote, getNotesFilePath } from "../services/data-provider/notes-storage"
import { suppressPath } from "../watchers/file-watcher"
import type { AfxPanelToExtensionMessage, AfxUpdateMessage } from "../models/messages"
import { getAfxPanelHtml, getAfxPanelHMRHtml } from "./panel-html"

export interface AfxPanelProvider extends vscode.WebviewViewProvider, vscode.Disposable {
	refresh(): void
}

export function createAfxPanelProvider(
	getConfig: () => AfxConfig | undefined,
	getRoot: () => string,
	specsProvider: SpecsDataProvider,
	extensionUri: vscode.Uri,
	extensionMode: vscode.ExtensionMode,
	getTelemetrySetting: () => string,
	log: vscode.OutputChannel,
	onStatsUpdate?: (data: {
		featureCount: number
		completedTasks: number
		totalTasks: number
		inProgressCount: number
		docsCount: number
	}) => void,
): AfxPanelProvider {
	let webviewView: vscode.WebviewView | undefined
	const disposables: vscode.Disposable[] = []

	async function collectData(): Promise<AfxUpdateMessage> {
		const root = getRoot()
		const features = await specsProvider.getFeatures()

		const pipeline = features.map(featureToPipelineRow)
		const featureTasks = features.map(featureToTasksData)
		const documents = await scanAllDocs(root).catch(() => [])
		const journal = features.flatMap(featureToJournalEntries).sort((a, b) => b.date.localeCompare(a.date))
		const kanban = await scanKanbanDir(root)
		const notes = await readNotes(root).catch(() => [])
		const ghostTasks = await countGhostTasks(root, features).catch(() => ({ count: 0, items: [] }))

		if (onStatsUpdate) {
			const inProgressCount = features.filter((f) => f.status === "In Progress").length
			onStatsUpdate({
				featureCount: features.length,
				completedTasks: pipeline.reduce((sum, r) => sum + r.completed, 0),
				totalTasks: pipeline.reduce((sum, r) => sum + r.total, 0),
				inProgressCount,
				docsCount: documents.length,
			})
		}

		return {
			type: "afxUpdate",
			pipeline,
			featureTasks,
			documents,
			journal,
			kanban,
			notes,
			ghostTasks,
			notesFilePath: getNotesFilePath(root),
		}
	}

	async function postUpdate() {
		if (!webviewView) {
			log.appendLine("[AFX] postUpdate: no webview view yet")
			return
		}
		try {
			log.appendLine("[AFX] Collecting panel data...")
			const data = await collectData()
			log.appendLine(
				`[AFX] Panel data collected — pipeline: ${data.pipeline.length}, docs: ${data.documents.length}, journal: ${data.journal.length}`,
			)
			webviewView.webview.postMessage(data)
			log.appendLine("[AFX] Panel data posted to webview")
		} catch (err) {
			log.appendLine(`[AFX] ERROR in postUpdate: ${err instanceof Error ? err.stack : String(err)}`)
		}
	}

	async function handleMessage(msg: AfxPanelToExtensionMessage) {
		const root = getRoot()

		switch (msg.type) {
			case "afxOpenFile": {
				const uri = vscode.Uri.file(msg.path)
				const doc = await vscode.workspace.openTextDocument(uri)
				const editor = await vscode.window.showTextDocument(doc, { preview: false })
				if (msg.line !== undefined) {
					const pos = new vscode.Position(msg.line, 0)
					editor.selection = new vscode.Selection(pos, pos)
					editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter)
				}
				break
			}

			case "afxToggleTask": {
				try {
					const content = await readFile(msg.path, "utf-8")
					const lines = content.split("\n")
					const lineIdx = msg.line - 1
					if (lineIdx >= 0 && lineIdx < lines.length) {
						if (msg.completed) {
							lines[lineIdx] = lines[lineIdx].replace(/\[ \]/, "[x]")
						} else {
							lines[lineIdx] = lines[lineIdx].replace(/\[x\]/i, "[ ]")
						}
						suppressPath(msg.path)
						await writeFile(msg.path, lines.join("\n"), "utf-8")
						postUpdate()
					}
				} catch {
					// ignore
				}
				break
			}

			case "afxSaveFile": {
				try {
					suppressPath(msg.path)
					await writeFile(msg.path, msg.content, "utf-8")
					webviewView?.webview.postMessage({
						type: "afxSaveFileResult",
						path: msg.path,
						ok: true,
					})
				} catch (err) {
					webviewView?.webview.postMessage({
						type: "afxSaveFileResult",
						path: msg.path,
						ok: false,
						error: String(err),
					})
				}
				break
			}

			case "afxAppendNote": {
				if (msg.text) {
					await appendNote(root, msg.text)
					postUpdate()
				}
				break
			}

			case "afxDeleteNote": {
				if (msg.timestamp) {
					await deleteNote(root, msg.timestamp)
					postUpdate()
				}
				break
			}

			case "afxFetchDocContent": {
				try {
					const content = await readFile(msg.filePath, "utf-8")
					const ext = path.extname(msg.filePath).replace(".", "")
					webviewView?.webview.postMessage({
						type: "afxDocContent",
						filePath: msg.filePath,
						content,
						language: ext,
					})
				} catch {
					webviewView?.webview.postMessage({
						type: "afxDocContent",
						filePath: msg.filePath,
						content: "",
						language: "text",
					})
				}
				break
			}

			case "afxChangeStatus": {
				try {
					const content = await readFile(msg.filePath, "utf-8")
					const updated = content.replace(/^(---\n[\s\S]*?)(status:\s*)\S+/m, `$1$2${msg.status}`)
					if (updated !== content) {
						suppressPath(msg.filePath)
						await writeFile(msg.filePath, updated, "utf-8")
						postUpdate()
					}
				} catch {
					// ignore
				}
				break
			}

			case "afxToggleSession": {
				try {
					const content = await readFile(msg.filePath, "utf-8")
					const lines = content.split("\n")
					// Find ## Work Sessions table, skip header rows, navigate to sessionIndex
					let tableStart = -1
					for (let i = 0; i < lines.length; i++) {
						if (/^##\s+Work\s+Sessions/i.test(lines[i])) {
							tableStart = i
							break
						}
					}
					if (tableStart >= 0) {
						// Skip heading, header row, separator row
						let dataRowStart = tableStart + 1
						while (
							dataRowStart < lines.length &&
							(lines[dataRowStart].startsWith("|--") ||
								lines[dataRowStart].startsWith("| Date") ||
								!lines[dataRowStart].startsWith("|"))
						) {
							dataRowStart++
						}
						const rowIdx = dataRowStart + msg.sessionIndex
						if (rowIdx < lines.length && lines[rowIdx].startsWith("|")) {
							const cells = lines[rowIdx].split("|").map((c) => c.trim())
							// Table: | Date | Task | Action | Files | Agent | Human |
							// cells[0] = "", cells[5] = Agent, cells[6] = Human
							const colIdx = msg.column === "agent" ? 5 : 6
							if (colIdx < cells.length) {
								cells[colIdx] = msg.completed ? "[x]" : "[ ]"
								lines[rowIdx] = "| " + cells.slice(1, -1).join(" | ") + " |"
								suppressPath(msg.filePath)
								await writeFile(msg.filePath, lines.join("\n"), "utf-8")
								postUpdate()
							}
						}
					}
				} catch {
					// ignore
				}
				break
			}

			case "afxSelectFeature": {
				// Will be used for workbench tab feature selection
				break
			}
		}
	}

	return {
		resolveWebviewView(view: vscode.WebviewView) {
			log.appendLine("[AFX] resolveWebviewView called — panel is visible")
			log.appendLine(`[AFX] extensionUri: ${extensionUri.fsPath}`)
			log.appendLine(`[AFX] build dir: ${vscode.Uri.joinPath(extensionUri, "webview", "build").fsPath}`)
			webviewView = view

			view.webview.options = {
				enableScripts: true,
				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, "webview", "build"),
					vscode.Uri.joinPath(extensionUri, "assets"),
					vscode.Uri.file(getRoot()),
				],
			}

			if (extensionMode === vscode.ExtensionMode.Development) {
				try {
					const fs = require("fs")
					const portFile = path.join(extensionUri.fsPath, "webview", ".vite-port")
					log.appendLine(`[AFX] Dev mode — looking for HMR port file: ${portFile}`)
					const port = parseInt(fs.readFileSync(portFile, "utf-8").trim(), 10)
					log.appendLine(`[AFX] Using HMR on port ${port}`)
					view.webview.html = getAfxPanelHMRHtml(view.webview, port)
				} catch {
					log.appendLine("[AFX] No HMR port file — using production HTML fallback")
					view.webview.html = getAfxPanelHtml(view.webview, extensionUri, getTelemetrySetting())
				}
			} else {
				log.appendLine("[AFX] Production mode — using built HTML")
				view.webview.html = getAfxPanelHtml(view.webview, extensionUri, getTelemetrySetting())
			}

			const messageDisposable = view.webview.onDidReceiveMessage((msg: AfxPanelToExtensionMessage) =>
				handleMessage(msg),
			)
			disposables.push(messageDisposable)

			// Initial data load
			postUpdate()
		},

		refresh() {
			postUpdate()
		},

		dispose() {
			for (const d of disposables) d.dispose()
		},
	}
}
