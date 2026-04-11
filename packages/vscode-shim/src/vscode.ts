// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * VSCode API Mock - Barrel Export File
 *
 * This file re-exports all components from the modular files for backwards compatibility.
 * All imports from this file will continue to work as before.
 */

// ============================================================================
// Classes from ./classes/
// ============================================================================
export { Position } from "./classes/position.js"
export { Range } from "./classes/range.js"
export { Selection } from "./classes/selection.js"
export { Uri } from "./classes/uri.js"
export { EventEmitter } from "./classes/event-emitter.js"
export { TextEdit, WorkspaceEdit } from "./classes/text-edit.js"
export {
	Location,
	Diagnostic,
	DiagnosticRelatedInformation,
	ThemeColor,
	ThemeIcon,
	CodeActionKind,
	CodeLens,
	LanguageModelTextPart,
	LanguageModelToolCallPart,
	LanguageModelToolResultPart,
	FileSystemError,
} from "./classes/additional.js"
export { CancellationTokenSource, type CancellationToken } from "./classes/cancellation-token.js"
export { OutputChannel } from "./classes/output-channel.js"
export { StatusBarItem } from "./classes/status-bar-item.js"
export { TextEditorDecorationType } from "./classes/text-editor-decoration-type.js"

// ============================================================================
// Context
// ============================================================================
export { ExtensionContextImpl as ExtensionContext } from "./context/extension-context.js"

// ============================================================================
// API Classes from ./api/
// ============================================================================
export { FileSystemAPI } from "./api/file-system-api.js"
export {
	MockWorkspaceConfiguration,
	setRuntimeConfig,
	setRuntimeConfigValues,
	clearRuntimeConfig,
	getRuntimeConfig,
} from "./api/workspace-configuration.js"
export { WorkspaceAPI } from "./api/workspace-api.js"
export { TabGroupsAPI, type Tab, type TabInputText, type TabGroup } from "./api/tab-groups-api.js"
export { WindowAPI } from "./api/window-api.js"
export { CommandsAPI } from "./api/commands-api.js"
export { createVSCodeAPIMock } from "./api/create-vscode-api-mock.js"

// ============================================================================
// Enums from ./types.ts
// ============================================================================
export {
	ConfigurationTarget,
	ViewColumn,
	TextEditorRevealType,
	StatusBarAlignment,
	DiagnosticSeverity,
	DiagnosticTag,
	EndOfLine,
	UIKind,
	ExtensionMode,
	ExtensionKind,
	FileType,
	DecorationRangeBehavior,
	OverviewRulerLane,
} from "./types.js"

// ============================================================================
// Types from ./types.ts
// ============================================================================
export type { Thenable, Memento, FileStat, TextEditorOptions, ConfigurationInspect } from "./types.js"

// ============================================================================
// Interfaces from ./interfaces/
// ============================================================================

// Document interfaces
export type {
	TextDocument,
	TextLine,
	WorkspaceFoldersChangeEvent,
	WorkspaceFolder,
	TextDocumentChangeEvent,
	TextDocumentContentChangeEvent,
	ConfigurationChangeEvent,
	TextDocumentContentProvider,
	FileSystemWatcher,
	RelativePattern,
} from "./interfaces/document.js"

// Editor interfaces
export type {
	TextEditor,
	TextEditorEdit,
	TextEditorSelectionChangeEvent,
	TextDocumentShowOptions,
	DecorationRenderOptions,
} from "./interfaces/editor.js"

// Terminal interfaces
export type {
	Terminal,
	TerminalOptions,
	TerminalExitStatus,
	TerminalState,
	TerminalDimensionsChangeEvent,
	TerminalDimensions,
	TerminalDataWriteEvent,
} from "./interfaces/terminal.js"

// Webview interfaces
export type {
	WebviewViewProvider,
	WebviewView,
	Webview,
	WebviewOptions,
	WebviewPortMapping,
	ViewBadge,
	WebviewViewResolveContext,
	WebviewViewProviderOptions,
	UriHandler,
} from "./interfaces/webview.js"

// Extension host interface
export type { IExtensionHost, ExtensionHostEventMap, ExtensionHostEventName } from "./interfaces/extension-host.js"

// Workspace interfaces
export type {
	WorkspaceConfiguration,
	QuickPickOptions,
	InputBoxOptions,
	OpenDialogOptions,
	Disposable,
	DiagnosticCollection,
	IdentityInfo,
} from "./interfaces/workspace.js"

// ============================================================================
// Secret Storage interface (backwards compatibility)
// ============================================================================
export interface SecretStorage {
	get(key: string): Thenable<string | undefined>
	store(key: string, value: string): Thenable<void>
	delete(key: string): Thenable<void>
}

// Import Thenable for SecretStorage interface
import type { Thenable } from "./types.js"
