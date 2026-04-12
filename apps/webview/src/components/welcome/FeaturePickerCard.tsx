// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Feature Picker Card — welcome screen component showing recent features.
 * "Pick up where you left off" — top 3 features by most recent updated_at.
 *
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/spec.md [FR-16] [FR-17] [FR-18]
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI]
 */

import React from "react"

import { cn } from "@src/lib/utils"

export interface FeatureSummary {
	name: string
	updatedAt: string
	artifact?: string
	completed?: number
	total?: number
}

interface FeaturePickerCardProps {
	features: FeatureSummary[]
	onFeatureClick: (feature: string) => void
	onNewFeature: () => void
}

export const FeaturePickerCard: React.FC<FeaturePickerCardProps> = ({ features, onFeatureClick, onNewFeature }) => {
	return (
		<div className="mt-1">
			<div className="text-xs font-medium text-vscode-foreground mb-2.5">
				<span className="@[250px]:hidden">Recent</span>
				<span className="hidden @[250px]:inline">Pick up where you left off</span>
			</div>

			<div className="space-y-1">
				{features.map((feature) => {
					const hasProgress =
						feature.completed !== undefined && feature.total !== undefined && feature.total > 0
					const isDone = hasProgress && feature.completed === feature.total

					return (
						<button
							key={feature.name}
							className={cn(
								"flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-left",
								"hover:bg-vscode-list-hoverBackground",
								"transition-colors",
							)}
							onClick={() => onFeatureClick(feature.name)}>
							<span className="text-vscode-descriptionForeground flex-shrink-0">&#x2B21;</span>
							<span className="font-medium text-vscode-foreground truncate min-w-0 flex-1">
								{feature.name}
							</span>
							<span className="text-vscode-descriptionForeground flex-shrink-0 text-right whitespace-nowrap hidden @[250px]:inline">
								{feature.artifact && <span>{feature.artifact}.md</span>}
								{hasProgress && (
									<span className={cn("ml-1", isDone && "text-vscode-testing-iconPassed")}>
										{"\u00B7 "}
										{feature.completed}/{feature.total}
										{isDone ? " \u2713" : ""}
									</span>
								)}
							</span>
						</button>
					)
				})}
			</div>

			<button
				className={cn(
					"flex items-center gap-1.5 w-full px-2 py-1.5 mt-1 rounded text-xs text-left",
					"text-vscode-textLink-foreground hover:underline",
					"hover:bg-vscode-list-hoverBackground",
					"transition-colors",
				)}
				onClick={onNewFeature}>
				<span>+</span>
				<span className="@[250px]:hidden">New feature</span>
				<span className="hidden @[250px]:inline">Start a new feature</span>
			</button>
		</div>
	)
}
