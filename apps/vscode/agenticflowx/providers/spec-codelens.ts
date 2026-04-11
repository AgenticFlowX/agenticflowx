// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Code lens provider — shows clickable @see spec references above annotated functions.
 *
 * @see docs/specs/18-vscode-agenticflowx-ide-providers/design.md [DES-CODELENS]
 */

import * as vscode from "vscode"
import * as path from "path"
import type { Feature } from "../models/feature"

const SEE_PATTERN = /@see\s+(docs\/specs\/([a-z0-9-]+)\/([a-z]+\.md)(?:#([a-z0-9-]+))?)/gi

export function createSpecCodeLensProvider(
	getFeatures: () => Promise<Feature[]>,
	getRoot: () => string,
): vscode.CodeLensProvider {
	return {
		async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
			const lenses: vscode.CodeLens[] = []
			const features = await getFeatures()
			const featureMap = new Map(features.map((f) => [f.name, f]))
			const root = getRoot()

			for (let i = 0; i < document.lineCount; i++) {
				const line = document.lineAt(i)
				SEE_PATTERN.lastIndex = 0
				let match: RegExpExecArray | null

				while ((match = SEE_PATTERN.exec(line.text)) !== null) {
					const relativePath = match[1]
					const featureName = match[2]
					const docFile = match[3]
					const section = match[4]

					const feature = featureMap.get(featureName)
					const status = getDocStatus(feature, docFile)
					const label = section
						? `Spec: ${featureName}/${docFile}#${section} (${status})`
						: `Spec: ${featureName}/${docFile} (${status})`

					const absPath = path.join(root, relativePath.split("#")[0])

					lenses.push(
						new vscode.CodeLens(line.range, {
							title: label,
							command: "vscode.open",
							arguments: [vscode.Uri.file(absPath)],
						}),
					)
				}
			}

			return lenses
		},
	}
}

function getDocStatus(feature: Feature | undefined, docFile: string): string {
	if (!feature) return "?"
	switch (docFile) {
		case "spec.md":
			return feature.spec?.frontmatter.status ?? "Missing"
		case "design.md":
			return feature.design?.frontmatter.status ?? "Missing"
		case "tasks.md":
			return feature.tasks?.frontmatter.status ?? "Missing"
		case "journal.md":
			return feature.journal?.frontmatter.status ?? "Missing"
		default:
			return "?"
	}
}
