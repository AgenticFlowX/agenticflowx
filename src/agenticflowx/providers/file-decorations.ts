// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * File decoration provider — shows spec status badges in VS Code explorer.
 * Port from vscode-afx fileDecorationProvider.ts, adapted to plain function style.
 *
 * @see docs/specs/vscode-agenticflowx-ide-providers/design.md#diagnostics-and-decorations
 */

import * as vscode from "vscode"
import type { Feature } from "../models/feature"

const STATUS_COLORS: Record<string, vscode.ThemeColor> = {
	"In Progress": new vscode.ThemeColor("charts.yellow"),
	Complete: new vscode.ThemeColor("charts.green"),
	Draft: new vscode.ThemeColor("disabledForeground"),
	"Not Started": new vscode.ThemeColor("disabledForeground"),
	Approved: new vscode.ThemeColor("disabledForeground"),
}

const STATUS_BADGES: Record<string, string> = {
	"In Progress": "IP",
	Complete: "OK",
	Draft: "DR",
	Approved: "AP",
}

export interface AfxFileDecorationProvider extends vscode.FileDecorationProvider {
	refresh(): void
}

export function createFileDecorationProvider(getFeatures: () => Promise<Feature[]>): AfxFileDecorationProvider {
	const emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>()
	let featureMap: Map<string, Feature> | undefined

	async function getMap(): Promise<Map<string, Feature>> {
		if (featureMap) return featureMap
		const features = await getFeatures()
		featureMap = new Map()
		for (const f of features) {
			featureMap.set(f.dirPath, f)
			for (const docType of ["spec.md", "design.md", "tasks.md", "journal.md"]) {
				const docPath = vscode.Uri.joinPath(vscode.Uri.file(f.dirPath), docType).fsPath
				featureMap.set(docPath, f)
			}
		}
		return featureMap
	}

	return {
		onDidChangeFileDecorations: emitter.event,

		refresh() {
			featureMap = undefined
			emitter.fire(undefined)
		},

		async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
			const map = await getMap()
			const feature = map.get(uri.fsPath)
			if (!feature) return undefined

			const color = STATUS_COLORS[feature.status]
			const badge = STATUS_BADGES[feature.status]
			if (!color && !badge) return undefined

			return {
				badge: badge ?? "",
				color,
				tooltip: `AFX: ${feature.name} — ${feature.status}`,
			}
		},
	}
}
