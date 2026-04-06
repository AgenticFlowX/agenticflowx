// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import React from "react"
import { Fzf } from "fzf"

import type { ModeConfig, CustomModePrompts } from "@agenticflowx/types"

import { type Mode, getModesForTrack } from "@afx/modes"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useAfxPortal } from "@/components/ui/hooks/useAfxPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"

import { IconButton } from "./IconButton"

const SEARCH_THRESHOLD = 6

/**
 * Focus Track category grouping for the Focus mode dropdown.
 * Built-in Focus modes are placed by slug match. Custom Focus modes
 * that don't match any built-in category appear under CUSTOM.
 *
 * @see docs/specs/31-vscode-agenticflowx-focus-track/spec.md [FR-2]
 * @see docs/specs/31-vscode-agenticflowx-focus-track/design.md [DES-UI]
 */
const FOCUS_CATEGORIES = [
	{
		label: "REVIEW",
		slugs: ["focus-review-spec", "focus-review-design", "focus-review-tasks"],
	},
	{
		label: "EXPLORE",
		slugs: ["focus-research", "focus-discover", "focus-next"],
	},
	{
		label: "DEVELOP",
		slugs: ["focus-code", "focus-debug", "focus-refactor"],
	},
]

interface FocusCategoryGroup {
	label: string
	modes: ModeConfig[]
}

function groupFocusModes(modes: ModeConfig[]): FocusCategoryGroup[] {
	const groups = FOCUS_CATEGORIES.map((cat) => ({
		label: cat.label,
		modes: modes.filter((m) => cat.slugs.includes(m.slug)),
	}))
	const categorized = new Set(FOCUS_CATEGORIES.flatMap((c) => c.slugs))
	const uncategorized = modes.filter((m) => !categorized.has(m.slug))
	if (uncategorized.length > 0) {
		groups.push({ label: "CUSTOM", modes: uncategorized })
	}
	return groups.filter((g) => g.modes.length > 0)
}

/**
 * File context hint from the file context detector.
 * @see docs/specs/31-vscode-agenticflowx-focus-track/design.md [DES-FILEDETECT]
 */
export interface FileContextHint {
	feature?: string
	artifact?: string
	suggestedMode?: string
}

interface ModeSelectorProps {
	value: Mode
	onChange: (value: Mode) => void
	disabled?: boolean
	title: string
	triggerClassName?: string
	modeShortcutText: string
	customModes?: ModeConfig[]
	customModePrompts?: CustomModePrompts
	disableSearch?: boolean
	// ── Focus Track props ──
	track?: "general" | "focus"
	onTrackChange?: (track: "general" | "focus") => void
	fileContextHint?: FileContextHint
}

export const ModeSelector = ({
	value,
	onChange,
	disabled = false,
	title,
	triggerClassName = "",
	modeShortcutText,
	customModes,
	customModePrompts,
	disableSearch = false,
	track = "general",
	onTrackChange,
	fileContextHint,
}: ModeSelectorProps) => {
	const [open, setOpen] = React.useState(false)
	const [searchValue, setSearchValue] = React.useState("")
	const searchInputRef = React.useRef<HTMLInputElement>(null)
	const selectedItemRef = React.useRef<HTMLDivElement>(null)
	const scrollContainerRef = React.useRef<HTMLDivElement>(null)
	const lastNotifiedInvalidModeRef = React.useRef<string | null>(null)
	const portalContainer = useAfxPortal("afx-portal")
	const { hasOpenedModeSelector, setHasOpenedModeSelector } = useExtensionState()
	const { t } = useAppTranslation()

	const trackModeSelectorOpened = React.useCallback(() => {
		// Track first-time usage for UI purposes.
		if (!hasOpenedModeSelector) {
			setHasOpenedModeSelector(true)
			vscode.postMessage({ type: "hasOpenedModeSelector", bool: true })
		}
	}, [hasOpenedModeSelector, setHasOpenedModeSelector])

	// Get modes for the current track, including custom modes, with merged prompt descriptions.
	const modes = React.useMemo(() => {
		const trackModes = getModesForTrack(track, customModes)

		return trackModes.map((mode) => ({
			...mode,
			description: customModePrompts?.[mode.slug]?.description ?? mode.description,
		}))
	}, [track, customModes, customModePrompts])

	// Group Focus modes into categories (only used when track === "focus").
	const focusCategories = React.useMemo(() => {
		if (track !== "focus") return []
		return groupFocusModes(modes)
	}, [track, modes])

	// Find the selected mode, falling back to the first mode of the current track if needed.
	// Using modes[0] instead of defaultModeSlug so focus track always has a displayable selection.
	const selectedMode = React.useMemo(() => {
		return modes.find((mode) => mode.slug === value) ?? modes[0]
	}, [modes, value])

	// Notify parent when current mode is invalid so it can update its state.
	// For general track: if value is a valid focus mode, it's just a track switch — don't auto-correct.
	// For focus track: always auto-correct to first focus mode so icon is never blank.
	React.useEffect(() => {
		const isValidMode = modes.some((mode) => mode.slug === value)

		if (isValidMode) {
			lastNotifiedInvalidModeRef.current = null
			return
		}

		if (lastNotifiedInvalidModeRef.current === value) {
			return
		}

		// On general track: skip auto-correct if the value belongs to focus track (track switch in progress)
		if (track === "general") {
			const focusModes = getModesForTrack("focus", customModes)
			if (focusModes.some((m) => m.slug === value)) {
				return
			}
		}

		const fallbackMode = modes[0]
		if (fallbackMode) {
			lastNotifiedInvalidModeRef.current = value
			onChange(fallbackMode.slug as Mode)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- onChange omitted to prevent loops when parent doesn't memoize
	}, [modes, value, track, customModes])

	// Memoize searchable items for fuzzy search with separate name and
	// description search.
	const nameSearchItems = React.useMemo(() => {
		return modes.map((mode) => ({
			original: mode,
			searchStr: [mode.name, mode.slug].filter(Boolean).join(" "),
		}))
	}, [modes])

	const descriptionSearchItems = React.useMemo(() => {
		return modes.map((mode) => ({
			original: mode,
			searchStr: mode.description || "",
		}))
	}, [modes])

	// Create memoized Fzf instances for name and description searches.
	const nameFzfInstance = React.useMemo(
		() => new Fzf(nameSearchItems, { selector: (item) => item.searchStr }),
		[nameSearchItems],
	)

	const descriptionFzfInstance = React.useMemo(
		() => new Fzf(descriptionSearchItems, { selector: (item) => item.searchStr }),
		[descriptionSearchItems],
	)

	// Filter modes based on search value using fuzzy search with priority.
	const filteredModes = React.useMemo(() => {
		if (!searchValue) return modes

		// First search in names/slugs.
		const nameMatches = nameFzfInstance.find(searchValue)
		const nameMatchedModes = new Set(nameMatches.map((result) => result.item.original.slug))

		// Then search in descriptions.
		const descriptionMatches = descriptionFzfInstance.find(searchValue)

		// Combine results: name matches first, then description matches.
		const combinedResults = [
			...nameMatches.map((result) => result.item.original),
			...descriptionMatches
				.filter((result) => !nameMatchedModes.has(result.item.original.slug))
				.map((result) => result.item.original),
		]

		return combinedResults
	}, [modes, searchValue, nameFzfInstance, descriptionFzfInstance])

	const onClearSearch = React.useCallback(() => {
		setSearchValue("")
		searchInputRef.current?.focus()
	}, [])

	const handleSelect = React.useCallback(
		(modeSlug: string) => {
			onChange(modeSlug as Mode)
			setOpen(false)
			// Clear search after selection.
			setSearchValue("")
		},
		[onChange],
	)

	const onOpenChange = React.useCallback(
		(isOpen: boolean) => {
			if (isOpen) trackModeSelectorOpened()
			setOpen(isOpen)

			// Clear search when closing.
			if (!isOpen) {
				setSearchValue("")
			}
		},
		[trackModeSelectorOpened],
	)

	// Auto-focus search input and scroll to selected item when popover opens.
	React.useEffect(() => {
		if (open) {
			// Focus search input
			if (searchInputRef.current) {
				searchInputRef.current.focus()
			}

			requestAnimationFrame(() => {
				if (selectedItemRef.current && scrollContainerRef.current) {
					const container = scrollContainerRef.current
					const item = selectedItemRef.current

					// Calculate positions
					const containerHeight = container.clientHeight
					const itemTop = item.offsetTop
					const itemHeight = item.offsetHeight

					// Center the item in the container
					const scrollPosition = itemTop - containerHeight / 2 + itemHeight / 2

					// Ensure we don't scroll past boundaries
					const maxScroll = container.scrollHeight - containerHeight
					const finalScrollPosition = Math.min(Math.max(0, scrollPosition), maxScroll)

					container.scrollTo({
						top: finalScrollPosition,
						behavior: "instant",
					})
				}
			})
		}
	}, [open])

	// Determine if search should be shown.
	const showSearch = !disableSearch && modes.length > SEARCH_THRESHOLD

	// Combine instruction text for tooltip.
	const instructionText = `${t("chat:modeSelector.description")} ${modeShortcutText}`

	return (
		<Popover open={open} onOpenChange={onOpenChange} data-testid="mode-selector-root">
			<StandardTooltip content={title}>
				<PopoverTrigger
					disabled={disabled}
					data-testid="mode-selector-trigger"
					className={cn(
						"inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						disabled
							? "opacity-50 cursor-not-allowed"
							: "opacity-90 hover:opacity-100 hover:bg-[rgba(128,128,128,0.15)] hover:border-[rgba(255,255,255,0.25)] cursor-pointer",
						triggerClassName,
						!disabled && !hasOpenedModeSelector
							? "bg-primary opacity-90 hover:bg-primary-hover text-vscode-button-foreground"
							: null,
					)}>
					<span className="truncate flex items-center gap-1.5">
						{selectedMode?.icon && (
							<span className={`codicon codicon-${selectedMode.icon} flex-shrink-0`} />
						)}
						{onTrackChange && (
							<span className="text-vscode-descriptionForeground">
								{track === "focus" ? "Focus" : "General"}:{" "}
							</span>
						)}
						{selectedMode?.name || ""}
					</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden min-w-80 max-w-9/10">
				<div className="flex flex-col w-full">
					{/* Focus Track: segmented toggle */}
					{onTrackChange && (
						<div className="flex border-b border-vscode-dropdown-border">
							<button
								className={cn(
									"flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
									track === "general"
										? "bg-vscode-button-background text-vscode-button-foreground"
										: "text-vscode-foreground hover:bg-vscode-list-hoverBackground",
								)}
								onClick={() => onTrackChange("general")}
								data-testid="track-toggle-general">
								General
							</button>
							<button
								className={cn(
									"flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
									track === "focus"
										? "bg-vscode-button-background text-vscode-button-foreground"
										: "text-vscode-foreground hover:bg-vscode-list-hoverBackground",
								)}
								onClick={() => onTrackChange("focus")}
								data-testid="track-toggle-focus">
								Focus
							</button>
						</div>
					)}

					{/* Focus Track: file context hint */}
					{track === "focus" && fileContextHint?.feature && (
						<div className="flex items-center gap-2 px-3 py-1.5 border-b border-vscode-dropdown-border bg-[rgba(255,255,255,0.02)]">
							<span className="codicon codicon-file text-vscode-descriptionForeground opacity-70 flex-shrink-0" />
							<div className="flex flex-col min-w-0">
								<span className="text-xs text-vscode-foreground truncate">
									{fileContextHint.feature}/{fileContextHint.artifact ?? "spec"}.md
								</span>
								<span className="text-[10px] text-vscode-descriptionForeground">
									Detected from active editor
								</span>
							</div>
						</div>
					)}

					{/* Show search bar only when there are more than SEARCH_THRESHOLD items, otherwise show info blurb */}
					{showSearch ? (
						<div className="relative p-2 border-b border-vscode-dropdown-border">
							<input
								aria-label="Search modes"
								ref={searchInputRef}
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								placeholder={t("chat:modeSelector.searchPlaceholder")}
								className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
								data-testid="mode-search-input"
							/>
							{searchValue.length > 0 && (
								<div className="absolute right-4 top-0 bottom-0 flex items-center justify-center">
									<span
										className="codicon codicon-close text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
										onClick={onClearSearch}
									/>
								</div>
							)}
						</div>
					) : (
						<div className="p-3 border-b border-vscode-dropdown-border">
							<p className="m-0 text-xs text-vscode-descriptionForeground">{instructionText}</p>
						</div>
					)}

					{/* Mode List */}
					<div ref={scrollContainerRef} className="max-h-[300px] overflow-y-auto">
						{filteredModes.length === 0 && searchValue ? (
							<div className="py-2 px-3 text-sm text-vscode-foreground/70">
								{t("chat:modeSelector.noResults")}
							</div>
						) : (
							<div className="py-1">
								{track === "focus" && !searchValue
									? // Focus track: grouped by category
										focusCategories.map((category) => (
											<div key={category.label}>
												<div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-vscode-descriptionForeground">
													{category.label}
												</div>
												{category.modes.map((mode) => {
													const isSelected = mode.slug === value
													return (
														<div
															key={mode.slug}
															ref={isSelected ? selectedItemRef : null}
															onClick={() => handleSelect(mode.slug)}
															className={cn(
																"px-3 py-1.5 text-sm cursor-pointer flex items-center",
																"hover:bg-vscode-list-hoverBackground",
																isSelected
																	? "bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
																	: "",
															)}
															data-testid="mode-selector-item">
															<div className="flex-1 min-w-0">
																<div className="font-bold truncate flex items-center gap-1.5">
																	{mode.icon && (
																		<span
																			className={`codicon codicon-${mode.icon}`}
																		/>
																	)}
																	{mode.name}
																</div>
																{mode.description && (
																	<div className="text-xs text-vscode-descriptionForeground truncate">
																		{mode.description}
																	</div>
																)}
															</div>
															{isSelected && (
																<span className="codicon codicon-check ml-auto size-4 p-0.5" />
															)}
														</div>
													)
												})}
											</div>
										))
									: // General track (or Focus with search active): flat list
										filteredModes.map((mode) => {
											const isSelected = mode.slug === value
											return (
												<div
													key={mode.slug}
													ref={isSelected ? selectedItemRef : null}
													onClick={() => handleSelect(mode.slug)}
													className={cn(
														"px-3 py-1.5 text-sm cursor-pointer flex items-center",
														"hover:bg-vscode-list-hoverBackground",
														isSelected
															? "bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
															: "",
													)}
													data-testid="mode-selector-item">
													<div className="flex-1 min-w-0">
														<div className="font-bold truncate flex items-center gap-1.5">
															{mode.icon && (
																<span className={`codicon codicon-${mode.icon}`} />
															)}
															{mode.name}
														</div>
														{mode.description && (
															<div className="text-xs text-vscode-descriptionForeground truncate">
																{mode.description}
															</div>
														)}
													</div>
													{isSelected && (
														<span className="codicon codicon-check ml-auto size-4 p-0.5" />
													)}
												</div>
											)
										})}
							</div>
						)}
					</div>

					{/* Bottom bar with buttons on left and title on right */}
					<div className="flex flex-row items-center justify-between px-2 py-2 border-t border-vscode-dropdown-border">
						<div className="flex flex-row gap-1">
							<IconButton
								iconClass="codicon-extensions"
								title={t("chat:modeSelector.marketplace")}
								onClick={() => {
									window.postMessage(
										{
											type: "action",
											action: "marketplaceButtonClicked",
											values: { marketplaceTab: "mode" },
										},
										"*",
									)
									setOpen(false)
								}}
							/>
							<IconButton
								iconClass="codicon-settings-gear"
								title={t("chat:modeSelector.settings")}
								onClick={() => {
									vscode.postMessage({
										type: "switchTab",
										tab: "settings",
										values: { section: "modes" },
									})
									setOpen(false)
								}}
							/>
						</div>

						{/* Info icon and title on the right - only show info icon when search bar is visible */}
						<div className="flex items-center gap-1 pr-1">
							{showSearch && (
								<StandardTooltip content={instructionText}>
									<span className="codicon codicon-info text-xs text-vscode-descriptionForeground opacity-70 hover:opacity-100 cursor-help" />
								</StandardTooltip>
							)}
							<h4 className="m-0 font-medium text-sm text-vscode-descriptionForeground">
								{t("chat:modeSelector.title")}
							</h4>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
