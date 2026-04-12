// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Context Hint Strip — transient, single-line, dismissible strip above the textarea.
 * Shows file detection, spec awareness, or spec capture hints.
 *
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5]
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI]
 */

import React from "react"

import { cn } from "@src/lib/utils"

export type HintSignal =
	| {
			type: "fileDetection"
			feature: string
			artifact?: string
			suggestedMode?: string
	  }
	| { type: "specMatch"; feature: string }
	| { type: "specCapture" }

interface ContextHintStripProps {
	signal: HintSignal
	isAutoMode: boolean
	autoSwitchFired: boolean
	onAction: (action: "switch" | "viewSpec" | "ground" | "capture" | "undo") => void
	onDismiss: () => void
}

export const ContextHintStrip: React.FC<ContextHintStripProps> = ({
	signal,
	isAutoMode,
	autoSwitchFired,
	onAction,
	onDismiss,
}) => {
	const renderContent = () => {
		switch (signal.type) {
			case "fileDetection": {
				const artifactLabel = signal.artifact || "file"
				if (isAutoMode && autoSwitchFired) {
					// Confirmation mode — auto-switch already happened
					return (
						<>
							<span className="flex-1 truncate">
								Switched to Focus: {capitalize(artifactLabel)} &mdash; {signal.feature} /{" "}
								{artifactLabel}.md
							</span>
							<button
								className="ml-1 text-vscode-textLink-foreground hover:underline text-xs flex-shrink-0"
								onClick={() => onAction("undo")}
								title="Undo auto-switch">
								&#8617;
							</button>
						</>
					)
				}
				// Suggestion mode — user decides
				return (
					<>
						<span className="flex-1 truncate">
							{signal.feature} / {artifactLabel}.md detected &mdash;{" "}
							<button
								className="text-vscode-textLink-foreground hover:underline"
								onClick={() => onAction("switch")}>
								Switch to Focus: {capitalize(artifactLabel)}
							</button>
						</span>
					</>
				)
			}
			case "specMatch":
				return (
					<>
						<span className="flex-1 truncate">
							&#x2B21; Relates to {signal.feature} spec &mdash;{" "}
							<button
								className="text-vscode-textLink-foreground hover:underline"
								onClick={() => onAction("viewSpec")}>
								View spec
							</button>
							{" · "}
							<button
								className="text-vscode-textLink-foreground hover:underline"
								onClick={() => onAction("ground")}>
								Ground chat
							</button>
						</span>
					</>
				)
			case "specCapture":
				return (
					<>
						<span className="flex-1 truncate">
							This could be a feature spec &mdash;{" "}
							<button
								className="text-vscode-textLink-foreground hover:underline"
								onClick={() => onAction("capture")}>
								Capture requirements?
							</button>
						</span>
					</>
				)
		}
	}

	return (
		<div
			className={cn(
				"flex items-center gap-1 px-2.5 py-1 text-xs",
				"text-vscode-descriptionForeground",
				"border-b border-vscode-panel-border/50",
				"bg-vscode-editorGroupHeader-tabsBackground/20",
			)}>
			{renderContent()}
			<button
				className="ml-1 text-vscode-descriptionForeground hover:text-vscode-foreground flex-shrink-0 text-xs"
				onClick={onDismiss}
				title="Dismiss">
				&#x2715;
			</button>
		</div>
	)
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1)
}
