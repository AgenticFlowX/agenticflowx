// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import DynamicTextArea from "react-textarea-autosize"

import { mentionRegex, mentionRegexGlobal, commandRegexGlobal, unescapeSpaces } from "@afx/context-mentions"
import { WebviewMessage } from "@afx/webview-message"
import { Mode, getAllModes } from "@afx/modes"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import {
	ContextMenuOptionType,
	getContextMenuOptions,
	insertMention,
	removeMention,
	shouldShowContextMenu,
	SearchResult,
} from "@src/utils/context-mentions"
import { cn } from "@src/lib/utils"
import { convertToMentionPath } from "@src/utils/path-mentions"
import { StandardTooltip } from "@src/components/ui"

import Thumbnails from "../common/Thumbnails"
import { ModeSelector } from "./ModeSelector"
import { ApiConfigSelector } from "./ApiConfigSelector"
import { AutoApproveDropdown } from "./AutoApproveDropdown"
import { MAX_IMAGES_PER_MESSAGE } from "./ChatView"
import ContextMenu from "./ContextMenu"
import { IndexingStatusBadge } from "./IndexingStatusBadge"
import { ContextHintStrip, type HintSignal } from "./ContextHintStrip"
import { FeatureContextBar } from "./FeatureContextBar"
import { SmartSwitchChip } from "./SmartSwitchChip"
import { usePromptHistory } from "./hooks/use-prompt-history"

interface ChatTextAreaProps {
	inputValue: string
	setInputValue: (value: string) => void
	sendingDisabled: boolean
	selectApiConfigDisabled: boolean
	placeholderText: string
	selectedImages: string[]
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
	onSend: () => void
	onSelectImages: () => void
	shouldDisableImages: boolean
	onHeightChange?: (height: number) => void
	mode: Mode
	setMode: (value: Mode) => void
	modeShortcutText: string
	// Edit mode props
	isEditMode?: boolean
	onCancel?: () => void
	// Stop/Queue functionality
	isStreaming?: boolean
	onStop?: () => void
	onEnqueueMessage?: () => void
}

export const ChatTextArea = forwardRef<HTMLTextAreaElement, ChatTextAreaProps>(
	(
		{
			inputValue,
			setInputValue,
			selectApiConfigDisabled,
			placeholderText,
			selectedImages,
			setSelectedImages,
			onSend,
			onSelectImages,
			shouldDisableImages,
			onHeightChange,
			mode,
			setMode,
			modeShortcutText,
			isEditMode = false,
			onCancel,
			isStreaming = false,
			onStop,
			onEnqueueMessage,
		},
		ref,
	) => {
		const { t } = useAppTranslation()
		const {
			filePaths,
			openedTabs,
			currentApiConfigName,
			listApiConfigMeta,
			customModes,
			customModePrompts,
			cwd,
			pinnedApiConfigs,
			togglePinnedApiConfig,
			taskHistory,
			afxMessages,
			commands,
			enterBehavior,
			lockApiConfigAcrossModes,
			groundedFeature,
			setGroundedFeature,
			smartSwitchMode,
			setSmartSwitchMode,
			track,
			setTrack,
		} = useExtensionState()

		// Find the ID and display text for the currently selected API configuration.
		const { currentConfigId, displayName } = useMemo(() => {
			const currentConfig = listApiConfigMeta?.find((config) => config.name === currentApiConfigName)
			return {
				currentConfigId: currentConfig?.id || "",
				displayName: currentApiConfigName || "", // Use the name directly for display.
			}
		}, [listApiConfigMeta, currentApiConfigName])

		const [gitCommits, setGitCommits] = useState<any[]>([])
		const [showDropdown, setShowDropdown] = useState(false)
		const [fileSearchResults, setFileSearchResults] = useState<SearchResult[]>([])
		const [searchLoading, setSearchLoading] = useState(false)
		const [searchRequestId, setSearchRequestId] = useState<string>("")

		// Close dropdown when clicking outside.
		useEffect(() => {
			const handleClickOutside = () => {
				if (showDropdown) {
					setShowDropdown(false)
				}
			}

			document.addEventListener("mousedown", handleClickOutside)
			return () => document.removeEventListener("mousedown", handleClickOutside)
		}, [showDropdown])

		// Handle enhanced prompt response and search results.
		useEffect(() => {
			const messageHandler = (event: MessageEvent) => {
				const message = event.data

				if (message.type === "enhancedPrompt") {
					if (message.text && textAreaRef.current) {
						try {
							// Use execCommand to replace text while preserving undo history
							if (document.execCommand) {
								// Use native browser methods to preserve undo stack
								const textarea = textAreaRef.current

								// Focus the textarea to ensure it's the active element
								textarea.focus()

								// Select all text first
								textarea.select()
								document.execCommand("insertText", false, message.text)
							} else {
								setInputValue(message.text)
							}
						} catch {
							setInputValue(message.text)
						}
					}

					setIsEnhancingPrompt(false)
				} else if (message.type === "insertTextIntoTextarea") {
					if (message.text && textAreaRef.current) {
						// Insert the command text at the current cursor position
						const textarea = textAreaRef.current
						const currentValue = inputValue
						const cursorPos = textarea.selectionStart || 0

						// Check if we need to add a space before the command
						const textBefore = currentValue.slice(0, cursorPos)
						const needsSpaceBefore = textBefore.length > 0 && !textBefore.endsWith(" ")
						const prefix = needsSpaceBefore ? " " : ""

						// Insert the text at cursor position
						const newValue =
							currentValue.slice(0, cursorPos) +
							prefix +
							message.text +
							" " +
							currentValue.slice(cursorPos)
						setInputValue(newValue)

						// Set cursor position after the inserted text
						const newCursorPos = cursorPos + prefix.length + message.text.length + 1
						setTimeout(() => {
							if (textAreaRef.current) {
								textAreaRef.current.focus()
								textAreaRef.current.setSelectionRange(newCursorPos, newCursorPos)
							}
						}, 0)
					}
				} else if (message.type === "commitSearchResults") {
					const commits = message.commits.map((commit: any) => ({
						type: ContextMenuOptionType.Git,
						value: commit.hash,
						label: commit.subject,
						description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
						icon: "$(git-commit)",
					}))

					setGitCommits(commits)
				} else if (message.type === "fileSearchResults") {
					setSearchLoading(false)
					if (message.requestId === searchRequestId) {
						setFileSearchResults(message.results || [])
					}
				}
			}

			window.addEventListener("message", messageHandler)
			return () => window.removeEventListener("message", messageHandler)
		}, [setInputValue, searchRequestId, inputValue])

		const [isDraggingOver, setIsDraggingOver] = useState(false)
		const [textAreaBaseHeight, setTextAreaBaseHeight] = useState<number | undefined>(undefined)
		const [showContextMenu, setShowContextMenu] = useState(false)
		const [cursorPosition, setCursorPosition] = useState(0)
		const [searchQuery, setSearchQuery] = useState("")
		const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
		const [isMouseDownOnMenu, setIsMouseDownOnMenu] = useState(false)
		const highlightLayerRef = useRef<HTMLDivElement>(null)
		const [selectedMenuIndex, setSelectedMenuIndex] = useState(-1)
		const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null)
		const [justDeletedSpaceAfterMention, setJustDeletedSpaceAfterMention] = useState(false)
		const [intendedCursorPosition, setIntendedCursorPosition] = useState<number | null>(null)
		const contextMenuContainerRef = useRef<HTMLDivElement>(null)
		const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false)
		const [isFocused, setIsFocused] = useState(false)

		// Use custom hook for prompt history navigation
		const { handleHistoryNavigation, resetHistoryNavigation, resetOnInputChange } = usePromptHistory({
			afxMessages,
			taskHistory,
			cwd,
			inputValue,
			setInputValue,
		})

		// Fetch git commits when Git is selected or when typing a hash.
		useEffect(() => {
			if (selectedType === ContextMenuOptionType.Git || /^[a-f0-9]+$/i.test(searchQuery)) {
				const message: WebviewMessage = {
					type: "searchCommits",
					query: searchQuery || "",
				} as const
				vscode.postMessage(message)
			}
		}, [selectedType, searchQuery])

		const handleEnhancePrompt = useCallback(() => {
			const trimmedInput = inputValue.trim()

			if (trimmedInput) {
				setIsEnhancingPrompt(true)
				vscode.postMessage({ type: "enhancePrompt" as const, text: trimmedInput })
			} else {
				setInputValue(t("chat:enhancePromptDescription"))
			}
		}, [inputValue, setInputValue, t])

		const allModes = useMemo(() => getAllModes(customModes), [customModes])

		// Memoized check for whether the input has content (text or images)
		const hasInputContent = useMemo(() => {
			return inputValue.trim().length > 0 || selectedImages.length > 0
		}, [inputValue, selectedImages])

		// Compute the key combination text for the send button tooltip based on enterBehavior
		const sendKeyCombination = useMemo(() => {
			if (enterBehavior === "newline") {
				// When Enter = newline, Ctrl/Cmd+Enter sends
				const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
				return isMac ? "⌘+Enter" : "Ctrl+Enter"
			}
			// Default: Enter sends
			return "Enter"
		}, [enterBehavior])

		const queryItems = useMemo(() => {
			return [
				{ type: ContextMenuOptionType.Problems, value: "problems" },
				{ type: ContextMenuOptionType.Terminal, value: "terminal" },
				...gitCommits,
				...openedTabs
					.filter((tab) => tab.path)
					.map((tab) => ({
						type: ContextMenuOptionType.OpenedFile,
						value: "/" + tab.path,
					})),
				...filePaths
					.map((file) => "/" + file)
					.filter((path) => !openedTabs.some((tab) => tab.path && "/" + tab.path === path)) // Filter out paths that are already in openedTabs
					.map((path) => ({
						type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path,
					})),
			]
		}, [filePaths, gitCommits, openedTabs])

		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (
					contextMenuContainerRef.current &&
					!contextMenuContainerRef.current.contains(event.target as Node)
				) {
					setShowContextMenu(false)
				}
			}

			if (showContextMenu) {
				document.addEventListener("mousedown", handleClickOutside)
			}

			return () => {
				document.removeEventListener("mousedown", handleClickOutside)
			}
		}, [showContextMenu, setShowContextMenu])

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (type === ContextMenuOptionType.Mode && value) {
					// Handle mode selection.
					setMode(value)
					setInputValue("")
					setShowContextMenu(false)
					vscode.postMessage({ type: "mode", text: value })
					return
				}

				if (type === ContextMenuOptionType.Command && value) {
					// Handle command selection.
					setSelectedMenuIndex(-1)
					setInputValue("")
					setShowContextMenu(false)

					// Insert the command mention into the textarea
					const commandMention = `/${value}`
					setInputValue(commandMention + " ")
					setCursorPosition(commandMention.length + 1)
					setIntendedCursorPosition(commandMention.length + 1)

					// Focus the textarea
					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.focus()
						}
					}, 0)
					return
				}

				// [AFX-START] Handle parameter selection — append to current input, keep dropdown open
				if (type === ContextMenuOptionType.Parameter && value) {
					setSelectedMenuIndex(-1)

					let newInput: string
					if (value.startsWith("afx-specs#")) {
						// Mention drill-down: replace @afx-specs#... with selected value + #
						const atIndex = inputValue.lastIndexOf("@")
						const prefix = atIndex >= 0 ? inputValue.substring(0, atIndex + 1) : inputValue
						newInput = `${prefix}${value}#`
					} else {
						// Slash command parameter: replace partial after last space
						const lastSpaceIndex = inputValue.lastIndexOf(" ")
						const baseCommand = inputValue.substring(0, lastSpaceIndex + 1)
						newInput = baseCommand + value + " "
					}

					setInputValue(newInput)
					setCursorPosition(newInput.length)
					setIntendedCursorPosition(newInput.length)

					// Focus textarea — dropdown will re-trigger via shouldShowContextMenu
					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.focus()
						}
					}, 0)
					return
				}
				// [AFX-END]

				if (
					type === ContextMenuOptionType.File ||
					type === ContextMenuOptionType.Folder ||
					type === ContextMenuOptionType.Git
				) {
					if (!value) {
						setSelectedType(type)
						setSearchQuery("")
						setSelectedMenuIndex(0)
						return
					}
				}

				setShowContextMenu(false)
				setSelectedType(null)

				if (textAreaRef.current) {
					let insertValue = value || ""

					if (type === ContextMenuOptionType.URL) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.Problems) {
						insertValue = "problems"
					} else if (type === ContextMenuOptionType.Terminal) {
						insertValue = "terminal"
					} else if (type === ContextMenuOptionType.Git) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.Command) {
						insertValue = value ? `/${value}` : ""
					}

					// Determine if this is a slash command selection
					const isSlashCommand = type === ContextMenuOptionType.Mode || type === ContextMenuOptionType.Command

					const { newValue, mentionIndex } = insertMention(
						textAreaRef.current.value,
						cursorPosition,
						insertValue,
						isSlashCommand,
					)

					setInputValue(newValue)
					const newCursorPosition = newValue.indexOf(" ", mentionIndex + insertValue.length) + 1
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)

					// Scroll to cursor.
					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)
				}
			},
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[setInputValue, cursorPosition],
		)

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (showContextMenu) {
					if (event.key === "Escape") {
						setSelectedType(null)
						setSelectedMenuIndex(3) // File by default
						return
					}

					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						setSelectedMenuIndex((prevIndex) => {
							const direction = event.key === "ArrowUp" ? -1 : 1
							const options = getContextMenuOptions(
								searchQuery,
								selectedType,
								queryItems,
								fileSearchResults,
								allModes,
								commands,
							)
							const optionsLength = options.length

							if (optionsLength === 0) return prevIndex

							// Find selectable options (non-URL types)
							const selectableOptions = options.filter(
								(option) =>
									option.type !== ContextMenuOptionType.URL &&
									option.type !== ContextMenuOptionType.NoResults &&
									option.type !== ContextMenuOptionType.SectionHeader,
							)

							if (selectableOptions.length === 0) return -1 // No selectable options

							// Find the index of the next selectable option
							const currentSelectableIndex = selectableOptions.findIndex(
								(option) => option === options[prevIndex],
							)

							const newSelectableIndex =
								(currentSelectableIndex + direction + selectableOptions.length) %
								selectableOptions.length

							// Find the index of the selected option in the original options array
							return options.findIndex((option) => option === selectableOptions[newSelectableIndex])
						})
						return
					}
					if ((event.key === "Enter" || event.key === "Tab") && selectedMenuIndex !== -1) {
						event.preventDefault()
						const selectedOption = getContextMenuOptions(
							searchQuery,
							selectedType,
							queryItems,
							fileSearchResults,
							allModes,
							commands,
						)[selectedMenuIndex]
						if (
							selectedOption &&
							selectedOption.type !== ContextMenuOptionType.URL &&
							selectedOption.type !== ContextMenuOptionType.NoResults &&
							selectedOption.type !== ContextMenuOptionType.SectionHeader
						) {
							handleMentionSelect(selectedOption.type, selectedOption.value)
						}
						return
					}
				}

				const isComposing = event.nativeEvent?.isComposing ?? false

				// Handle prompt history navigation using custom hook
				if (handleHistoryNavigation(event, showContextMenu, isComposing)) {
					return
				}

				// Handle Enter key based on enterBehavior setting
				if (event.key === "Enter" && !isComposing) {
					if (enterBehavior === "newline") {
						// New behavior: Enter = newline, Shift+Enter or Ctrl+Enter = send
						if (event.shiftKey || event.ctrlKey || event.metaKey) {
							event.preventDefault()
							resetHistoryNavigation()
							onSend()
						}
						// Otherwise, let Enter create newline (don't preventDefault)
					} else {
						// Default behavior: Enter = send, Shift+Enter = newline
						if (!event.shiftKey) {
							event.preventDefault()
							resetHistoryNavigation()
							onSend()
						}
					}
				}

				if (event.key === "Backspace" && !isComposing) {
					const charBeforeCursor = inputValue[cursorPosition - 1]
					const charAfterCursor = inputValue[cursorPosition + 1]

					const charBeforeIsWhitespace =
						charBeforeCursor === " " || charBeforeCursor === "\n" || charBeforeCursor === "\r\n"

					const charAfterIsWhitespace =
						charAfterCursor === " " || charAfterCursor === "\n" || charAfterCursor === "\r\n"

					// Checks if char before cursor is whitespace after a mention.
					if (
						charBeforeIsWhitespace &&
						// "$" is added to ensure the match occurs at the end of the string.
						inputValue.slice(0, cursorPosition - 1).match(new RegExp(mentionRegex.source + "$"))
					) {
						const newCursorPosition = cursorPosition - 1
						// If mention is followed by another word, then instead
						// of deleting the space separating them we just move
						// the cursor to the end of the mention.
						if (!charAfterIsWhitespace) {
							event.preventDefault()
							textAreaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition)
							setCursorPosition(newCursorPosition)
						}

						setCursorPosition(newCursorPosition)
						setJustDeletedSpaceAfterMention(true)
					} else if (justDeletedSpaceAfterMention) {
						const { newText, newPosition } = removeMention(inputValue, cursorPosition)

						if (newText !== inputValue) {
							event.preventDefault()
							setInputValue(newText)
							setIntendedCursorPosition(newPosition) // Store the new cursor position in state
						}

						setJustDeletedSpaceAfterMention(false)
						setShowContextMenu(false)
					} else {
						setJustDeletedSpaceAfterMention(false)
					}
				}
			},
			[
				onSend,
				showContextMenu,
				searchQuery,
				selectedMenuIndex,
				handleMentionSelect,
				selectedType,
				inputValue,
				cursorPosition,
				setInputValue,
				justDeletedSpaceAfterMention,
				queryItems,
				allModes,
				fileSearchResults,
				handleHistoryNavigation,
				resetHistoryNavigation,
				commands,
				enterBehavior,
			],
		)

		useLayoutEffect(() => {
			if (intendedCursorPosition !== null && textAreaRef.current) {
				textAreaRef.current.setSelectionRange(intendedCursorPosition, intendedCursorPosition)
				setIntendedCursorPosition(null) // Reset the state.
			}
		}, [inputValue, intendedCursorPosition])

		// Ref to store the search timeout.
		const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				const newValue = e.target.value
				setInputValue(newValue)

				// Reset history navigation when user types
				resetOnInputChange()

				const newCursorPosition = e.target.selectionStart
				setCursorPosition(newCursorPosition)

				const showMenu = shouldShowContextMenu(newValue, newCursorPosition)
				setShowContextMenu(showMenu)

				if (showMenu) {
					if (newValue.startsWith("/") && !newValue.includes(" ")) {
						// Handle slash command - request fresh commands
						const query = newValue
						setSearchQuery(query)
						// Set to first selectable item (skip section headers)
						setSelectedMenuIndex(1) // Section header is at 0, first command is at 1
						// Request commands fresh each time slash menu is shown
						vscode.postMessage({ type: "requestCommands" })
					} else {
						// Existing @ mention handling.
						const lastAtIndex = newValue.lastIndexOf("@", newCursorPosition - 1)
						const query = newValue.slice(lastAtIndex + 1, newCursorPosition)
						setSearchQuery(query)

						// Send file search request if query is not empty.
						if (query.length > 0) {
							setSelectedMenuIndex(0)

							// Don't clear results until we have new ones. This
							// prevents flickering.

							// Clear any existing timeout.
							if (searchTimeoutRef.current) {
								clearTimeout(searchTimeoutRef.current)
							}

							// Set a timeout to debounce the search requests.
							searchTimeoutRef.current = setTimeout(() => {
								// Generate a request ID for this search.
								const reqId = Math.random().toString(36).substring(2, 9)
								setSearchRequestId(reqId)
								setSearchLoading(true)

								// Send message to extension to search files.
								vscode.postMessage({
									type: "searchFiles",
									query: unescapeSpaces(query),
									requestId: reqId,
								})
							}, 200) // 200ms debounce.
						} else {
							setSelectedMenuIndex(3) // Set to "File" option by default.
						}
					}
				} else {
					setSearchQuery("")
					setSelectedMenuIndex(-1)
					setFileSearchResults([]) // Clear file search results.
				}
			},
			[setInputValue, setSearchRequestId, setFileSearchResults, setSearchLoading, resetOnInputChange],
		)

		useEffect(() => {
			if (!showContextMenu) {
				setSelectedType(null)
			}
		}, [showContextMenu])

		const handleBlur = useCallback(() => {
			// Only hide the context menu if the user didn't click on it.
			if (!isMouseDownOnMenu) {
				setShowContextMenu(false)
			}

			setIsFocused(false)
		}, [isMouseDownOnMenu])

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const items = e.clipboardData.items

				const pastedText = e.clipboardData.getData("text")
				// Check if the pasted content is a URL, add space after so user
				// can easily delete if they don't want it.
				const urlRegex = /^\S+:\/\/\S+$/
				if (urlRegex.test(pastedText.trim())) {
					e.preventDefault()
					const trimmedUrl = pastedText.trim()
					const newValue =
						inputValue.slice(0, cursorPosition) + trimmedUrl + " " + inputValue.slice(cursorPosition)
					setInputValue(newValue)
					const newCursorPosition = cursorPosition + trimmedUrl.length + 1
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)
					setShowContextMenu(false)

					// Scroll to new cursor position.
					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)

					return
				}

				const acceptedTypes = ["png", "jpeg", "webp"]

				const imageItems = Array.from(items).filter((item) => {
					const [type, subtype] = item.type.split("/")
					return type === "image" && acceptedTypes.includes(subtype)
				})

				if (!shouldDisableImages && imageItems.length > 0) {
					e.preventDefault()

					const imagePromises = imageItems.map((item) => {
						return new Promise<string | null>((resolve) => {
							const blob = item.getAsFile()

							if (!blob) {
								resolve(null)
								return
							}

							const reader = new FileReader()

							reader.onloadend = () => {
								if (reader.error) {
									console.error(t("chat:errorReadingFile"), reader.error)
									resolve(null)
								} else {
									const result = reader.result
									resolve(typeof result === "string" ? result : null)
								}
							}

							reader.readAsDataURL(blob)
						})
					})

					const imageDataArray = await Promise.all(imagePromises)
					const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)

					if (dataUrls.length > 0) {
						setSelectedImages((prevImages) => [...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
					} else {
						console.warn(t("chat:noValidImages"))
					}
				}
			},
			[shouldDisableImages, setSelectedImages, cursorPosition, setInputValue, inputValue, t],
		)

		const handleMenuMouseDown = useCallback(() => {
			setIsMouseDownOnMenu(true)
		}, [])

		const updateHighlights = useCallback(() => {
			if (!textAreaRef.current || !highlightLayerRef.current) return

			const text = textAreaRef.current.value

			// Helper function to check if a command is valid
			const isValidCommand = (commandName: string): boolean => {
				return commands?.some((cmd) => cmd.name === commandName) || false
			}

			// Process the text to highlight mentions and valid commands
			let processedText = text
				.replace(/\n$/, "\n\n")
				.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] || c)
				.replace(mentionRegexGlobal, '<mark class="mention-context-textarea-highlight">$&</mark>')

			// Custom replacement for commands - only highlight valid ones
			processedText = processedText.replace(commandRegexGlobal, (match, commandName) => {
				// Only highlight if the command exists in the valid commands list
				if (isValidCommand(commandName)) {
					// Check if the match starts with a space
					const startsWithSpace = match.startsWith(" ")
					const commandPart = `/${commandName}`

					if (startsWithSpace) {
						// Keep the space but only highlight the command part
						return ` <mark class="mention-context-textarea-highlight">${commandPart}</mark>`
					} else {
						// Highlight the entire command (starts at beginning of line)
						return `<mark class="mention-context-textarea-highlight">${commandPart}</mark>`
					}
				}
				return match // Return unhighlighted if command is not valid
			})

			highlightLayerRef.current.innerHTML = processedText

			highlightLayerRef.current.scrollTop = textAreaRef.current.scrollTop
			highlightLayerRef.current.scrollLeft = textAreaRef.current.scrollLeft
		}, [commands])

		useLayoutEffect(() => {
			updateHighlights()
		}, [inputValue, updateHighlights])

		const updateCursorPosition = useCallback(() => {
			if (textAreaRef.current) {
				setCursorPosition(textAreaRef.current.selectionStart)
			}
		}, [])

		const handleKeyUp = useCallback(
			(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
					updateCursorPosition()
				}
			},
			[updateCursorPosition],
		)

		const handleDrop = useCallback(
			async (e: React.DragEvent<HTMLDivElement>) => {
				e.preventDefault()
				setIsDraggingOver(false)

				const textFieldList = e.dataTransfer.getData("text")
				const textUriList = e.dataTransfer.getData("application/vnd.code.uri-list")
				// When textFieldList is empty, it may attempt to use textUriList obtained from drag-and-drop tabs; if not empty, it will use textFieldList.
				const text = textFieldList || textUriList
				if (text) {
					// Split text on newlines to handle multiple files
					const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "")

					if (lines.length > 0) {
						// Process each line as a separate file path
						let newValue = inputValue.slice(0, cursorPosition)
						let totalLength = 0

						// Using a standard for loop instead of forEach for potential performance gains.
						for (let i = 0; i < lines.length; i++) {
							const line = lines[i]
							// Convert each path to a mention-friendly format
							const mentionText = convertToMentionPath(line, cwd)
							newValue += mentionText
							totalLength += mentionText.length

							// Add space after each mention except the last one
							if (i < lines.length - 1) {
								newValue += " "
								totalLength += 1
							}
						}

						// Add space after the last mention and append the rest of the input
						newValue += " " + inputValue.slice(cursorPosition)
						totalLength += 1

						setInputValue(newValue)
						const newCursorPosition = cursorPosition + totalLength
						setCursorPosition(newCursorPosition)
						setIntendedCursorPosition(newCursorPosition)
					}

					return
				}

				const files = Array.from(e.dataTransfer.files)

				if (files.length > 0) {
					const acceptedTypes = ["png", "jpeg", "webp"]

					const imageFiles = files.filter((file) => {
						const [type, subtype] = file.type.split("/")
						return type === "image" && acceptedTypes.includes(subtype)
					})

					if (!shouldDisableImages && imageFiles.length > 0) {
						const imagePromises = imageFiles.map((file) => {
							return new Promise<string | null>((resolve) => {
								const reader = new FileReader()

								reader.onloadend = () => {
									if (reader.error) {
										console.error(t("chat:errorReadingFile"), reader.error)
										resolve(null)
									} else {
										const result = reader.result
										resolve(typeof result === "string" ? result : null)
									}
								}

								reader.readAsDataURL(file)
							})
						})

						const imageDataArray = await Promise.all(imagePromises)
						const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)

						if (dataUrls.length > 0) {
							setSelectedImages((prevImages) =>
								[...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE),
							)

							if (typeof vscode !== "undefined") {
								vscode.postMessage({ type: "draggedImages", dataUrls: dataUrls })
							}
						} else {
							console.warn(t("chat:noValidImages"))
						}
					}
				}
			},
			[
				cursorPosition,
				cwd,
				inputValue,
				setInputValue,
				setCursorPosition,
				setIntendedCursorPosition,
				shouldDisableImages,
				setSelectedImages,
				t,
			],
		)

		const defaultHelperText = `(${t("chat:addContext")}${shouldDisableImages ? `, ${t("chat:dragFiles")}` : `, ${t("chat:dragFilesImages")}`})`

		// Context-aware helper text based on active artifact
		// @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/spec.md [FR-31]
		const contextAwareHelperText = useMemo(() => {
			const artifact = groundedFeature?.artifact
			if (!artifact) {
				if (groundedFeature) return "(/afx-dev review against spec, /afx-check trace for compliance)"
				return defaultHelperText
			}
			switch (artifact) {
				case "spec":
					return "(/afx-spec review to check quality, /afx-spec approve when ready)"
				case "design":
					return "(/afx-design review to validate, /afx-design approve to unlock tasks)"
				case "tasks":
					return "(/afx-task pick to start work, /afx-task status for progress)"
				case "journal":
					return "(/afx-session note to capture, /afx-session recap to review)"
				case "research":
					return "(/afx-research compare to analyze, /afx-research finalize --to adr)"
				case "adr":
					return "(/afx-adr review to check, /afx-adr list for all decisions)"
				default:
					return defaultHelperText
			}
		}, [groundedFeature, defaultHelperText])

		const placeholderBottomText = `\n${contextAwareHelperText}`

		// ── Focus Track state ──
		// @see docs/specs/31-vscode-agenticflowx-focus-track/design.md [DES-UI]
		// @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-DATA]
		const [fileContextHint, setFileContextHint] = useState<
			{ feature?: string; artifact?: string; suggestedMode?: string } | undefined
		>(undefined)
		const [hintDismissed, setHintDismissed] = useState(false)
		const [autoSwitchFired, setAutoSwitchFired] = useState(false)
		const [agentHintSignal, setAgentHintSignal] = useState<HintSignal | null>(null)

		// Listen for agent hint signals (specMatch/specCapture from agent response)
		// @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/spec.md [FR-27] [FR-28]
		useEffect(() => {
			const handler = (event: MessageEvent) => {
				const message = event.data
				if (message.type === "hintSignal") {
					if (message.signal?.type === "specMatch") {
						setAgentHintSignal({ type: "specMatch", feature: message.signal.feature })
						setHintDismissed(false)
					} else if (message.signal?.type === "specCapture") {
						setAgentHintSignal({ type: "specCapture" })
						setHintDismissed(false)
					}
				}
			}
			window.addEventListener("message", handler)
			return () => window.removeEventListener("message", handler)
		}, [])

		// Listen for fileContext messages from extension.
		// The extension sends RAW detection (isSpecArtifact, feature, artifact, suggestedMode, progress).
		// The webview is the single source of truth — it decides Auto/Manual behavior based on its own
		// smartSwitchMode + track state, matching the truth tables in design.md §3.5.0.1, §3.5.0.2, §3.6.
		// @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI]
		useEffect(() => {
			const handler = (event: MessageEvent) => {
				const message = event.data
				if (message.type !== "fileContext") return

				// Clear signal: no active editor OR non-AFX file (row 23).
				// NOTE: autoSwitchFired is NOT reset here — it's provenance (user is in Focus
				// because Auto fired), and navigating to a non-spec file doesn't change that.
				// It's only reset when the user actually leaves Focus (undo, revert, manual switch).
				if (message.clear) {
					setFileContextHint(undefined)
					setGroundedFeature(null)
					setHintDismissed(false)
					vscode.postMessage({ type: "persistTrackState", groundedFeature: null })
					return
				}

				const isAuto = smartSwitchMode === "auto"
				const isGeneral = track === "general"
				const isFocus = track === "focus"
				const isSpec = message.isSpecArtifact === true

				// ─── Decision matrix (rows 1-18, F1-F10) ───
				if (isAuto && isGeneral && isSpec) {
					// Rows 1-6 / F1-F4: Auto + General + spec → switch to Focus, show confirmation
					setTrack("focus")
					setAutoSwitchFired(true)
					vscode.postMessage({ type: "track", text: "focus" })
					if (message.suggestedMode) {
						setMode(message.suggestedMode)
						vscode.postMessage({ type: "mode", text: message.suggestedMode })
					}
				} else if (isAuto && isFocus && isSpec) {
					// Rows 7-8 / F5: Auto + already Focus → update mode to match artifact.
					// autoSwitchFired is NOT reset — if true (auto got us here), stay true so
					// confirmation keeps showing as we navigate between spec files. If false
					// (user manually clicked to Focus earlier), stay false so no confirmation shows.
					if (message.suggestedMode) {
						setMode(message.suggestedMode)
						vscode.postMessage({ type: "mode", text: message.suggestedMode })
					}
				} else if (!isAuto && isGeneral && isSpec) {
					// Rows 10-15 / F6-F9: Manual + General + spec → suggestion hint, NO mode change
					setAutoSwitchFired(false)
				} else if (!isAuto && isFocus && isSpec) {
					// Rows 16-17 / F10: Manual + already Focus → update mode, hint hidden.
					// autoSwitchFired stays as-is (provenance preserved).
					if (message.suggestedMode) {
						setMode(message.suggestedMode)
						vscode.postMessage({ type: "mode", text: message.suggestedMode })
					}
				}

				// Always update these (rules 3, 4 in the truth table)
				setFileContextHint({
					feature: message.feature,
					artifact: message.artifact,
					suggestedMode: message.suggestedMode,
				})
				if (message.feature) {
					setGroundedFeature({
						name: message.feature,
						artifact: message.artifact,
						completed: message.completed,
						total: message.total,
					})
				}
				setHintDismissed(false)
			}
			window.addEventListener("message", handler)
			return () => window.removeEventListener("message", handler)
		}, [setMode, setGroundedFeature, setTrack, track, smartSwitchMode])

		// Common mode selector handler
		const handleModeChange = useCallback(
			(value: Mode) => {
				setMode(value)
				vscode.postMessage({ type: "mode", text: value })
			},
			[setMode],
		)

		// Track change handler — switches between General and Focus
		const handleTrackChange = useCallback(
			(newTrack: "general" | "focus") => {
				setTrack(newTrack)
				// Manual track change to General clears auto-switch provenance
				if (newTrack === "general") {
					setAutoSwitchFired(false)
				}
				vscode.postMessage({ type: "track", text: newTrack })
			},
			[setTrack],
		)

		// Compute hint signal from file context or agent hints (priority order)
		const hintSignal: HintSignal | null = useMemo(() => {
			// Priority 1: file detection signal
			if (fileContextHint?.feature && fileContextHint.suggestedMode) {
				return {
					type: "fileDetection" as const,
					feature: fileContextHint.feature,
					artifact: fileContextHint.artifact,
					suggestedMode: fileContextHint.suggestedMode,
				}
			}
			// Priority 2-3: agent hint signals (specMatch > specCapture)
			if (agentHintSignal) return agentHintSignal
			return null
		}, [fileContextHint, agentHintSignal])

		// Visibility logic for hint strip
		// @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI]
		// Show file detection hints only when a track change is relevant:
		//   - user on General → show suggestion (Manual) or pre-switch state
		//   - auto-switch just fired → show confirmation
		// Suppress when user is already on Focus in Manual mode (no switch needed — they're already there).
		// Agent hints (specMatch/specCapture) always show.
		const showHintStrip =
			hintSignal !== null &&
			!hintDismissed &&
			(hintSignal.type !== "fileDetection" || track === "general" || autoSwitchFired)

		// Hint strip action handler
		const handleHintAction = useCallback(
			(action: "switch" | "viewSpec" | "ground" | "capture" | "undo") => {
				switch (action) {
					case "switch":
						if (fileContextHint?.suggestedMode) {
							setTrack("focus")
							setMode(fileContextHint.suggestedMode)
							vscode.postMessage({ type: "mode", text: fileContextHint.suggestedMode })
							vscode.postMessage({ type: "track", text: "focus" })
						}
						break
					case "undo":
						setTrack("general")
						setAutoSwitchFired(false)
						vscode.postMessage({ type: "track", text: "general" })
						break
					case "viewSpec":
						if (hintSignal?.type === "specMatch") {
							vscode.postMessage({
								type: "openFeatureFiles",
								feature: hintSignal.feature,
								filesOnly: ["spec"],
							})
						}
						break
					case "ground":
						if (hintSignal?.type === "specMatch") {
							vscode.postMessage({
								type: "openFeatureFiles",
								feature: hintSignal.feature,
							})
						}
						break
					case "capture":
						vscode.postMessage({
							type: "newTask",
							text: "/afx-scaffold spec help me create my first spec",
						})
						break
				}
				setHintDismissed(true)
			},
			[fileContextHint, hintSignal, setMode, setTrack],
		)

		// Helper function to handle API config change
		const handleApiConfigChange = useCallback((value: string) => {
			vscode.postMessage({ type: "loadApiConfigurationById", text: value })
		}, [])

		const handleToggleLockApiConfig = useCallback(() => {
			const newValue = !lockApiConfigAcrossModes
			vscode.postMessage({ type: "lockApiConfigAcrossModes", bool: newValue })
		}, [lockApiConfigAcrossModes])

		return (
			<div
				className={cn(
					"@container flex flex-col bg-editor-background outline-none border border-none box-border",
					isEditMode ? "p-2 w-full" : "relative px-1.5 pb-1 w-[calc(100%-16px)] ml-auto mr-auto",
				)}>
				<div className={cn(!isEditMode && "relative")}>
					<div
						className={cn("chat-text-area", !isEditMode && "relative", "flex", "flex-col", "outline-none")}
						onDrop={handleDrop}
						onDragOver={(e) => {
							// Only allowed to drop images/files on shift key pressed.
							if (!e.shiftKey) {
								setIsDraggingOver(false)
								return
							}

							e.preventDefault()
							setIsDraggingOver(true)
							e.dataTransfer.dropEffect = "copy"
						}}
						onDragLeave={(e) => {
							e.preventDefault()
							const rect = e.currentTarget.getBoundingClientRect()

							if (
								e.clientX <= rect.left ||
								e.clientX >= rect.right ||
								e.clientY <= rect.top ||
								e.clientY >= rect.bottom
							) {
								setIsDraggingOver(false)
							}
						}}>
						{showContextMenu && (
							<div
								ref={contextMenuContainerRef}
								className={cn(
									"absolute",
									"bottom-full",
									isEditMode ? "left-6" : "left-0",
									"right-0",
									"z-[1000]",
									isEditMode ? "-mb-3" : "mb-2",
									"filter",
									"drop-shadow-md",
								)}>
								<ContextMenu
									onSelect={handleMentionSelect}
									searchQuery={searchQuery}
									inputValue={inputValue}
									onMouseDown={handleMenuMouseDown}
									selectedIndex={selectedMenuIndex}
									setSelectedIndex={setSelectedMenuIndex}
									selectedType={selectedType}
									queryItems={queryItems}
									modes={allModes}
									loading={searchLoading}
									dynamicSearchResults={fileSearchResults}
									commands={commands}
								/>
							</div>
						)}

						{/* @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI] */}
						{/* Fixed-height slot [A]: inset from sides, shifted down to sit on chatbox border edge. */}
						<div className="h-[26px] flex-shrink-0 overflow-visible relative z-10 px-[3px] translate-y-[3px]">
							{showHintStrip && hintSignal && (
								<ContextHintStrip
									signal={hintSignal}
									isAutoMode={smartSwitchMode === "auto"}
									autoSwitchFired={autoSwitchFired}
									onAction={handleHintAction}
									onDismiss={() => setHintDismissed(true)}
								/>
							)}
						</div>

						<div
							className={cn(
								"relative",
								"flex-1",
								"flex",
								"flex-col-reverse",
								"min-h-0",
								"overflow-hidden",
								"rounded-lg",
								isDraggingOver
									? "bg-[color-mix(in_srgb,var(--vscode-input-background)_95%,var(--vscode-focusBorder))]"
									: "bg-vscode-input-background",
							)}
							style={{
								outline: isFocused
									? "1px solid var(--vscode-focusBorder)"
									: isDraggingOver
										? "2px dashed var(--vscode-focusBorder)"
										: "1px solid transparent",
								outlineOffset: "-1px",
							}}>
							{/* @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI] [C] */}
							{/* Absolutely positioned at the bottom — no flex seam, no interior line. */}
							{!inputValue && groundedFeature && (
								<div className="absolute bottom-0 left-0 right-0 h-[20px] z-20">
									<FeatureContextBar
										feature={groundedFeature.name}
										artifact={groundedFeature.artifact}
										completed={groundedFeature.completed}
										total={groundedFeature.total}
									/>
								</div>
							)}
							<div
								ref={highlightLayerRef}
								data-testid="highlight-layer"
								className={cn(
									"absolute",
									"top-0 left-0 right-0 bottom-[20px]",
									"pointer-events-none",
									"whitespace-pre-wrap",
									"break-words",
									"text-transparent",
									"overflow-hidden",
									"font-vscode-font-family",
									"text-vscode-editor-font-size",
									"leading-vscode-editor-line-height",
									"border-none",
									"rounded-lg",
									"pl-2",
									"py-2",
									isEditMode ? "pr-20" : "pr-9",
									"z-10",
									"forced-color-adjust-none",
								)}
								style={{
									color: "transparent",
								}}
							/>
							<DynamicTextArea
								ref={(el) => {
									if (typeof ref === "function") {
										ref(el)
									} else if (ref) {
										ref.current = el
									}
									textAreaRef.current = el
								}}
								value={inputValue}
								onChange={(e) => {
									handleInputChange(e)
									updateHighlights()
								}}
								onFocus={() => setIsFocused(true)}
								onKeyDown={(e) => {
									// Handle ESC to cancel in edit mode
									if (isEditMode && e.key === "Escape" && !e.nativeEvent?.isComposing) {
										e.preventDefault()
										onCancel?.()
										return
									}
									handleKeyDown(e)
								}}
								onKeyUp={handleKeyUp}
								onBlur={handleBlur}
								onPaste={handlePaste}
								onSelect={updateCursorPosition}
								onMouseUp={updateCursorPosition}
								onHeightChange={(height) => {
									if (textAreaBaseHeight === undefined || height < textAreaBaseHeight) {
										setTextAreaBaseHeight(height)
									}

									onHeightChange?.(height)
								}}
								placeholder={placeholderText}
								minRows={3}
								maxRows={15}
								autoFocus={true}
								className={cn(
									"w-full",
									"text-vscode-input-foreground",
									"font-vscode-font-family",
									"text-vscode-editor-font-size",
									"leading-vscode-editor-line-height",
									"cursor-text",
									"pt-2 pl-2",
									groundedFeature ? "pb-[20px]" : "pb-2",
									"border-none",
									"outline-none",
									"bg-transparent",
									"min-h-[94px]",
									"box-border",
									"resize-none",
									"overflow-x-hidden",
									"overflow-y-auto",
									isEditMode ? "pr-20" : "pr-9",
									"flex-none flex-grow",
									"z-[2]",
									"scrollbar-none",
									"scrollbar-hide",
								)}
								onScroll={() => updateHighlights()}
							/>

							<div className="absolute bottom-2 right-1 z-30 flex flex-col items-center gap-0">
								<StandardTooltip content={t("chat:addImages")}>
									<button
										aria-label={t("chat:addImages")}
										disabled={shouldDisableImages}
										onClick={!shouldDisableImages ? onSelectImages : undefined}
										className={cn(
											"relative inline-flex items-center justify-center",
											"bg-transparent border-none p-1.5",
											"rounded-md min-w-[28px] min-h-[28px]",
											"text-vscode-descriptionForeground hover:text-vscode-foreground",
											"transition-all duration-1000",
											"cursor-pointer",
											!shouldDisableImages
												? "opacity-50 hover:opacity-100 delay-750 pointer-events-auto"
												: "opacity-0 pointer-events-none duration-200 delay-0",
											!shouldDisableImages &&
												"hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
											"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
											!shouldDisableImages && "active:bg-[rgba(255,255,255,0.1)]",
											shouldDisableImages &&
												"opacity-40 cursor-not-allowed grayscale-[30%] hover:bg-transparent hover:border-[rgba(255,255,255,0.08)] active:bg-transparent",
										)}>
										<span className="codicon codicon-file-media" style={{ fontSize: 16 }} />
									</button>
								</StandardTooltip>
								{isEditMode ? (
									<StandardTooltip content={t("chat:cancel.title")}>
										<button
											aria-label={t("chat:cancel.title")}
											disabled={false}
											onClick={onCancel}
											className={cn(
												"relative inline-flex items-center justify-center",
												"bg-transparent border-none p-1.5",
												"rounded-md min-w-[28px] min-h-[28px]",
												"opacity-60 hover:opacity-100 text-vscode-descriptionForeground hover:text-vscode-foreground",
												"transition-all duration-150",
												"hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
												"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
												"active:bg-[rgba(255,255,255,0.1)]",
												"cursor-pointer",
											)}>
											<span className="codicon codicon-close" style={{ fontSize: 16 }} />
										</button>
									</StandardTooltip>
								) : hasInputContent ? (
									<StandardTooltip content={t("chat:enhancePrompt")}>
										<button
											aria-label={t("chat:enhancePrompt")}
											disabled={false}
											onClick={handleEnhancePrompt}
											className={cn(
												"relative inline-flex items-center justify-center",
												"bg-transparent border-none p-1.5",
												"rounded-md min-w-[28px] min-h-[28px]",
												"text-vscode-descriptionForeground hover:text-vscode-foreground",
												"transition-all duration-150",
												"opacity-50 hover:opacity-100 pointer-events-auto",
												"hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
												"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
												"active:bg-[rgba(255,255,255,0.1)]",
												"cursor-pointer",
											)}>
											<span
												className={cn(
													"codicon codicon-wand",
													isEnhancingPrompt && "codicon-modifier-spin",
												)}
												style={{ fontSize: 16 }}
											/>
										</button>
									</StandardTooltip>
								) : null}
								{/* Queue button - shown when streaming and user has typed content */}
								{!isEditMode && isStreaming && hasInputContent && onEnqueueMessage && (
									<StandardTooltip content={t("chat:enqueueMessage")}>
										<button
											aria-label={t("chat:enqueueMessage")}
											disabled={false}
											onClick={onEnqueueMessage}
											className={cn(
												"relative inline-flex items-center justify-center",
												"bg-transparent border-none p-1.5",
												"rounded-md min-w-[28px] min-h-[28px]",
												"text-vscode-descriptionForeground hover:text-vscode-foreground",
												"transition-all duration-200",
												"opacity-100 hover:opacity-100 pointer-events-auto",
												"hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
												"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
												"active:bg-[rgba(255,255,255,0.1)]",
												"cursor-pointer",
											)}>
											<span className="codicon codicon-list-ordered" style={{ fontSize: 16 }} />
										</button>
									</StandardTooltip>
								)}
								{/* Send/Stop button - morphs based on streaming state, always visible in edit mode */}
								<StandardTooltip
									content={
										isEditMode
											? t("chat:pressToSend", { keyCombination: sendKeyCombination })
											: isStreaming
												? t("chat:stop.title")
												: t("chat:pressToSend", { keyCombination: sendKeyCombination })
									}>
									<button
										aria-label={
											isEditMode
												? t("chat:pressToSend", { keyCombination: sendKeyCombination })
												: isStreaming
													? t("chat:stop.title")
													: t("chat:pressToSend", { keyCombination: sendKeyCombination })
										}
										disabled={false}
										onClick={isStreaming ? onStop : onSend}
										className={cn(
											"relative inline-flex items-center justify-center",
											"bg-transparent border-none p-1.5",
											"rounded-full min-w-[28px] min-h-[28px]",
											"text-vscode-descriptionForeground hover:text-vscode-foreground",
											"transition-all duration-200",
											isEditMode || isStreaming || hasInputContent
												? "opacity-100 hover:opacity-100 pointer-events-auto"
												: "opacity-0 pointer-events-none",
											(isEditMode || isStreaming || hasInputContent) &&
												"hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
											"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
											(isEditMode || isStreaming || hasInputContent) &&
												"active:bg-[rgba(255,255,255,0.1)]",
											(isEditMode || isStreaming || hasInputContent) && "cursor-pointer",
											isStreaming &&
												"bg-vscode-button-background hover:bg-vscode-button-background text-vscode-button-foreground hover:text-vscode-button-foreground",
										)}>
										{isStreaming ? (
											<span
												className="codicon codicon-primitive-square"
												style={{ fontSize: 16 }}
											/>
										) : (
											<span className="codicon codicon-send" style={{ fontSize: 16 }} />
										)}
									</button>
								</StandardTooltip>
							</div>

							{!inputValue && (
								<div
									className={cn(
										"absolute left-2 z-30 items-center h-8 font-vscode-font-family text-vscode-editor-font-size leading-vscode-editor-line-height",
										"hidden @[200px]:flex",
										isEditMode ? "pr-20" : "pr-9",
									)}
									style={{
										bottom: "0.75rem",
										color: "color-mix(in oklab, var(--vscode-input-foreground) 50%, transparent)",
										userSelect: "none",
										pointerEvents: "none",
									}}>
									{placeholderBottomText}
								</div>
							)}
						</div>
					</div>
				</div>

				{selectedImages.length > 0 && (
					<Thumbnails
						images={selectedImages}
						setImages={setSelectedImages}
						style={{
							left: "16px",
							zIndex: 2,
							marginBottom: 0,
						}}
					/>
				)}

				<div
					className={cn(
						"flex items-center h-8 px-1.5 gap-1",
						"bg-vscode-editorGroupHeader-tabsBackground/30",
					)}>
					<div className="flex items-center min-w-0 flex-1 overflow-hidden gap-1">
						<ModeSelector
							value={mode}
							title={t("chat:selectMode")}
							onChange={handleModeChange}
							triggerClassName="text-ellipsis overflow-hidden flex-shrink-0"
							modeShortcutText={modeShortcutText}
							customModes={customModes}
							customModePrompts={customModePrompts}
							track={track}
							onTrackChange={handleTrackChange}
							fileContextHint={fileContextHint}
						/>
						<div className="w-px h-3.5 bg-vscode-panel-border/60 flex-shrink-0" />
						<ApiConfigSelector
							value={currentConfigId}
							displayName={displayName}
							disabled={selectApiConfigDisabled}
							title={t("chat:selectApiConfig")}
							onChange={handleApiConfigChange}
							triggerClassName="min-w-[28px] text-ellipsis overflow-hidden flex-shrink"
							listApiConfigMeta={listApiConfigMeta || []}
							pinnedApiConfigs={pinnedApiConfigs}
							togglePinnedApiConfig={togglePinnedApiConfig}
							lockApiConfigAcrossModes={!!lockApiConfigAcrossModes}
							onToggleLockApiConfig={handleToggleLockApiConfig}
						/>
						<div className="w-px h-3.5 bg-vscode-panel-border/60 flex-shrink-0" />
						<AutoApproveDropdown triggerClassName="min-w-[28px] text-ellipsis overflow-hidden flex-shrink" />
						<div className="w-px h-3.5 bg-vscode-panel-border/60 flex-shrink-0" />
						<SmartSwitchChip
							mode={smartSwitchMode}
							onModeChange={(newMode) => {
								setSmartSwitchMode(newMode)
								// @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI]
								setHintDismissed(false)

								// Revert a previous auto-switch when toggling away from Auto.
								// If the user is on Focus because Auto fired (autoSwitchFired=true) and
								// they toggle to Manual, revert to General so the re-evaluation surfaces
								// the Manual suggestion for the current file (row T1 → F6). Manual-click
								// flows (autoSwitchFired=false) are NOT reverted — those were an explicit
								// user choice to enter Focus.
								if (newMode === "manual" && autoSwitchFired && track === "focus") {
									setTrack("general")
									vscode.postMessage({ type: "track", text: "general" })
								}
								setAutoSwitchFired(false)

								vscode.postMessage({
									type: "persistTrackState",
									smartSwitchMode: newMode,
								})
								// Ask the extension to re-run file detection against the new mode.
								// The fileContext handler will apply the matching §3.6.1 row.
								vscode.postMessage({ type: "requestFileContext" })
							}}
						/>
					</div>
					<div className="flex flex-shrink-0 items-center gap-1 pl-1 border-l border-vscode-panel-border/40">
						{!isEditMode ? <IndexingStatusBadge /> : null}
					</div>
				</div>
			</div>
		)
	},
)
