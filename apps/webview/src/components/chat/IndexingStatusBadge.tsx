// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import React, { useState, useEffect, useMemo } from "react"

import type { IndexingStatus, IndexingStatusUpdateMessage } from "@agenticflowx/types"

import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { PopoverTrigger, StandardTooltip, Button } from "@src/components/ui"

import { CodeIndexPopover } from "./CodeIndexPopover"

interface IndexingStatusBadgeProps {
	className?: string
}

export const IndexingStatusBadge: React.FC<IndexingStatusBadgeProps> = ({ className }) => {
	const { t } = useAppTranslation()
	const { cwd } = useExtensionState()

	const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>({
		systemStatus: "Standby",
		processedItems: 0,
		totalItems: 0,
		currentItemUnit: "items",
	})

	useEffect(() => {
		// Request initial indexing status.
		vscode.postMessage({ type: "requestIndexingStatus" })

		// Set up message listener for status updates.
		const handleMessage = (event: MessageEvent<IndexingStatusUpdateMessage>) => {
			if (event.data.type === "indexingStatusUpdate") {
				const status = event.data.values
				if (!status.workspacePath || status.workspacePath === cwd) {
					setIndexingStatus(status)
				}
			}
		}

		window.addEventListener("message", handleMessage)

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [cwd])

	const progressPercentage = useMemo(
		() =>
			indexingStatus.totalItems > 0
				? Math.round((indexingStatus.processedItems / indexingStatus.totalItems) * 100)
				: 0,
		[indexingStatus.processedItems, indexingStatus.totalItems],
	)

	const tooltipText = useMemo(() => {
		switch (indexingStatus.systemStatus) {
			case "Standby":
				return t("chat:indexingStatus.ready")
			case "Indexing":
				return t("chat:indexingStatus.indexing", { percentage: progressPercentage })
			case "Indexed":
				return t("chat:indexingStatus.indexed")
			case "Stopping":
				return t("chat:indexingStatus.stopping")
			case "Error":
				return t("chat:indexingStatus.error")
			default:
				return t("chat:indexingStatus.status")
		}
	}, [indexingStatus.systemStatus, progressPercentage, t])

	const statusColorClass = useMemo(() => {
		const statusColors = {
			Standby: "bg-vscode-descriptionForeground/60",
			Indexing: "bg-yellow-500 animate-pulse",
			Indexed: "bg-green-500",
			Stopping: "bg-amber-500 animate-pulse",
			Error: "bg-red-500",
		}

		return statusColors[indexingStatus.systemStatus as keyof typeof statusColors] || statusColors.Standby
	}, [indexingStatus.systemStatus])

	return (
		<CodeIndexPopover indexingStatus={indexingStatus}>
			<StandardTooltip content={tooltipText}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						aria-label={tooltipText}
						className={cn(
							"relative h-5 w-5 p-0",
							"text-vscode-foreground opacity-85",
							"hover:opacity-100 hover:bg-[rgba(128,128,128,0.15)]",
							"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
							className,
						)}>
						<span className="codicon codicon-database w-4 h-4" />
						<span
							className={cn(
								"absolute top-0 right-0 w-1.5 h-1.5 rounded-full transition-colors duration-200",
								statusColorClass,
							)}
						/>
					</Button>
				</PopoverTrigger>
			</StandardTooltip>
		</CodeIndexPopover>
	)
}
