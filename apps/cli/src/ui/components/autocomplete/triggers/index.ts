// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

export { type FileResult, type FileTriggerConfig, createFileTrigger, toFileResult } from "./FileTrigger.js"

export {
	type SlashCommandResult,
	type SlashCommandTriggerConfig,
	createSlashCommandTrigger,
	toSlashCommandResult,
} from "./SlashCommandTrigger.js"

export { type ModeResult, type ModeTriggerConfig, createModeTrigger, toModeResult } from "./ModeTrigger.js"

export { type HelpShortcutResult, createHelpTrigger } from "./HelpTrigger.js"

export {
	type HistoryResult,
	type HistoryTriggerConfig,
	createHistoryTrigger,
	toHistoryResult,
} from "./HistoryTrigger.js"
