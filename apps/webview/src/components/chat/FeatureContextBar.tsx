// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Feature Context Bar — persistent, read-only one-liner below textarea helper text.
 * Shows grounded feature name, artifact, and task progress.
 * Flush under helper text (no divider above), collapses when user types.
 *
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/spec.md [FR-6] [FR-7] [FR-10] [FR-32]
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI]
 */

import React from "react"

import { cn } from "@src/lib/utils"

interface FeatureContextBarProps {
	feature: string
	artifact?: string
	completed?: number
	total?: number
}

export const FeatureContextBar: React.FC<FeatureContextBarProps> = ({ feature, artifact, completed, total }) => {
	const hasProgress = completed !== undefined && total !== undefined && total > 0

	return (
		<div className={cn("flex items-center gap-1.5 px-2.5 py-0.5 text-xs", "text-vscode-descriptionForeground/70")}>
			<span className="flex-shrink-0">&#x2B21;</span>
			<span className="truncate font-medium">{feature}</span>
			{artifact && (
				<>
					<span className="flex-shrink-0">&middot;</span>
					<span className="truncate">{artifact}.md</span>
				</>
			)}
			{hasProgress && (
				<>
					<span className="flex-shrink-0">&middot;</span>
					<span className={cn("flex-shrink-0", completed === total && "text-vscode-testing-iconPassed")}>
						{completed}/{total} tasks{completed === total ? " \u2713" : ""}
					</span>
				</>
			)}
		</div>
	)
}
