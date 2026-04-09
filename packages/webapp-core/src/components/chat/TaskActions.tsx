// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { HistoryItem } from "@agenticflowx/types"

import { vscode } from "@/utils/vscode"
import { useCopyToClipboard } from "@/utils/clipboard"
import { useExtensionState } from "@/context/ExtensionStateContext"

import { DeleteTaskDialog } from "../history/DeleteTaskDialog"
import { IconButton } from "./IconButton"

interface TaskActionsProps {
	item?: HistoryItem
	buttonsDisabled: boolean
}

export const TaskActions = ({ item, buttonsDisabled }: TaskActionsProps) => {
	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const { t } = useTranslation()
	const { copyWithFeedback, showCopyFeedback } = useCopyToClipboard()
	const { debug } = useExtensionState()

	return (
		<div className="flex flex-row items-center -ml-0.5 mt-1 gap-1">
			<IconButton
				iconClass="codicon-cloud-download"
				title={t("chat:task.export")}
				onClick={() => vscode.postMessage({ type: "exportCurrentTask" })}
			/>

			{item?.task && (
				<IconButton
					iconClass={showCopyFeedback ? "codicon-check" : "codicon-copy"}
					title={t("history:copyPrompt")}
					onClick={(e) => copyWithFeedback(item.task, e)}
				/>
			)}
			{!!item?.size && item.size > 0 && (
				<>
					<IconButton
						iconClass="codicon-trash"
						title={t("chat:task.delete")}
						disabled={buttonsDisabled}
						onClick={(e) => {
							e.stopPropagation()
							if (e.shiftKey) {
								vscode.postMessage({ type: "deleteTaskWithId", text: item.id })
							} else {
								setDeleteTaskId(item.id)
							}
						}}
					/>
					{deleteTaskId && (
						<DeleteTaskDialog
							taskId={deleteTaskId}
							onOpenChange={(open) => !open && setDeleteTaskId(null)}
							open
						/>
					)}
				</>
			)}
			{debug && item?.id && (
				<>
					<IconButton
						iconClass="codicon-json"
						title={t("chat:task.openApiHistory")}
						onClick={() => vscode.postMessage({ type: "openDebugApiHistory" })}
					/>
					<IconButton
						iconClass="codicon-comment-discussion"
						title={t("chat:task.openUiHistory")}
						onClick={() => vscode.postMessage({ type: "openDebugUiHistory" })}
					/>
				</>
			)}
		</div>
	)
}
