// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { useState, type RefObject } from "react"

import { cn } from "@/lib/utils"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Input } from "@/components/ui"

export interface SettingsSearchInputProps {
	value: string
	onChange: (value: string) => void
	onFocus?: () => void
	onBlur?: () => void
	onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
	inputRef?: RefObject<HTMLInputElement>
}

export function SettingsSearchInput({
	value,
	onChange,
	onFocus,
	onBlur,
	onKeyDown,
	inputRef,
}: SettingsSearchInputProps) {
	const { t } = useAppTranslation()
	const [isExpanded, setIsExpanded] = useState(false)

	const handleFocus = () => {
		setIsExpanded(true)
		onFocus?.()
	}

	const handleBlur = () => {
		// Only collapse if there's no value
		if (!value) {
			setIsExpanded(false)
		}
		onBlur?.()
	}

	const isWide = isExpanded || !!value

	return (
		<div className="relative flex items-center justify-end">
			<span className="codicon codicon-search absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-vscode-descriptionForeground pointer-events-none z-10" />
			<Input
				ref={inputRef}
				data-testid="settings-search-input"
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onFocus={handleFocus}
				onBlur={handleBlur}
				onKeyDown={onKeyDown}
				placeholder={isWide ? t("settings:search.placeholder") : ""}
				className={cn(
					"pl-8 h-7 text-sm rounded-full border border-vscode-input-border bg-vscode-input-background focus:border-vscode-focusBorder transition-all duration-200 ease-in-out",
					isWide ? "w-40 pr-2.5" : "w-8 pr-0 cursor-pointer",
					value && "pr-7",
				)}
			/>
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					className="absolute cursor-pointer right-2 top-1/2 -translate-y-1/2 text-vscode-descriptionForeground hover:text-vscode-foreground focus:outline-none"
					aria-label="Clear search">
					<span className="codicon codicon-close size-3.5" />
				</button>
			)}
		</div>
	)
}
