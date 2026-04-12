// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Smart Switch Chip — Auto/Manual toggle in the bottom strip.
 * Controls whether spec file detection auto-switches to Focus track.
 * Popover doubles as onboarding for the dual-track system.
 *
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/spec.md [FR-11] [FR-12] [FR-13] [FR-13a]
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI]
 */

import React from "react"

import { cn } from "@/lib/utils"
import { useAfxPortal } from "@/components/ui/hooks/use-afx-portal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { useExtensionState } from "@/context/ExtensionStateContext"

export type SmartSwitchMode = "auto" | "manual"

interface SmartSwitchChipProps {
	mode: SmartSwitchMode
	onModeChange: (mode: SmartSwitchMode) => void
}

export const SmartSwitchChip: React.FC<SmartSwitchChipProps> = ({ onModeChange }) => {
	const { smartSwitchMode: mode } = useExtensionState()
	const [open, setOpen] = React.useState(false)
	const portalContainer = useAfxPortal("afx-portal")
	const modeLabel = mode === "manual" ? "Manual" : "Auto"
	const tooltipText = `Smart switch: ${modeLabel} — click to change`

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<StandardTooltip content={tooltipText}>
				<PopoverTrigger asChild>
					<button
						className={cn(
							"inline-flex items-center gap-1.5 relative whitespace-nowrap px-1.5 py-0.5 text-xs rounded",
							"text-vscode-descriptionForeground hover:text-vscode-foreground",
							"hover:bg-vscode-toolbar-hoverBackground",
							"transition-colors",
							"min-w-0",
						)}>
						<span className="codicon codicon-layers size-3 flex-shrink-0" />
						<span className="truncate">Smart switch: {modeLabel}</span>
					</button>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent container={portalContainer} side="top" align="end" className="w-72 p-3 text-xs">
				<div className="space-y-2.5">
					<div className="font-medium text-vscode-foreground">Smart switch</div>
					<div className="border-t border-vscode-panel-border/50" />

					<div className="text-vscode-descriptionForeground leading-relaxed">
						AgenticFlowX has two tracks:
					</div>

					<div className="space-y-1.5 text-vscode-descriptionForeground">
						<div>
							<span className="font-medium text-vscode-foreground">General</span> — Full AI coding
							assistant. All tools, all skills, any task.
						</div>
						<div>
							<span className="font-medium text-vscode-foreground">Focus</span> — Spec-driven workflow.
							Lean prompts tuned for review, authoring, and task execution against your specs.
						</div>
					</div>

					<div className="border-t border-vscode-panel-border/50" />

					<div className="text-vscode-descriptionForeground mb-1">When a spec file is detected:</div>

					<label className="flex items-start gap-2 cursor-pointer group">
						<input
							type="radio"
							name="smartSwitch"
							checked={mode === "auto"}
							onChange={() => onModeChange("auto")}
							className="mt-0.5 accent-vscode-focusBorder"
						/>
						<div>
							<div className="font-medium text-vscode-foreground group-hover:underline">Auto</div>
							<div className="text-vscode-descriptionForeground">
								Switch to Focus automatically. A confirmation shows what changed.
							</div>
						</div>
					</label>

					<label className="flex items-start gap-2 cursor-pointer group">
						<input
							type="radio"
							name="smartSwitch"
							checked={mode === "manual"}
							onChange={() => onModeChange("manual")}
							className="mt-0.5 accent-vscode-focusBorder"
						/>
						<div>
							<div className="font-medium text-vscode-foreground group-hover:underline">Manual</div>
							<div className="text-vscode-descriptionForeground">
								Stay in your current track. A suggestion appears — you decide.
							</div>
						</div>
					</label>
				</div>
			</PopoverContent>
		</Popover>
	)
}
