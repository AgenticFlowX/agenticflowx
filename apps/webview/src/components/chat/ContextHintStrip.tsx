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
	onDismiss?: () => void
}

export const ContextHintStrip: React.FC<ContextHintStripProps> = ({
	signal,
	isAutoMode,
	autoSwitchFired,
	onAction,
	onDismiss,
}) => {
	// fileDetection hints stay visible — the user may want to act on them later.
	// specMatch / specCapture are informational and can be dismissed.
	const isDismissible = signal.type !== "fileDetection"
	const renderContent = () => {
		switch (signal.type) {
			case "fileDetection": {
				const artifactLabel = signal.artifact || "file"
				if (isAutoMode && autoSwitchFired) {
					// Confirmation mode — auto-switch already happened.
					// Layout mirrors the suggestion so the "Switch/Switched to Focus: X" label
					// stays in the same visual position (right side of the em-dash).
					return (
						<span className="truncate">
							{signal.feature} / {artifactLabel}.md &mdash; Switched to Focus: {capitalize(artifactLabel)}{" "}
							&middot;{" "}
							<button
								className="text-vscode-textLink-foreground hover:underline"
								onClick={() => onAction("undo")}
								title="Revert to General track">
								Undo
							</button>
						</span>
					)
				}
				// Suggestion mode — user decides
				return (
					<span className="truncate">
						{signal.feature} / {artifactLabel}.md detected &mdash;{" "}
						<button
							className="text-vscode-textLink-foreground hover:underline"
							onClick={() => onAction("switch")}>
							Switch to Focus: {capitalize(artifactLabel)}
						</button>
					</span>
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
				"flex items-center gap-2 px-2.5 py-1 text-xs",
				"text-vscode-descriptionForeground",
				"bg-vscode-editorGroupHeader-tabsBackground",
				"rounded-t-lg",
				"border border-b-0 border-vscode-panel-border/50",
			)}>
			<div className="flex-1 min-w-0 flex items-center overflow-hidden">{renderContent()}</div>
			{isDismissible && onDismiss && (
				<button
					className="text-vscode-descriptionForeground hover:text-vscode-foreground flex-shrink-0 text-xs"
					onClick={onDismiss}
					title="Dismiss">
					&#x2715;
				</button>
			)}
		</div>
	)
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1)
}
