// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import EventEmitter from "events"

export type AfxTerminalProvider = "vscode" | "execa"

export interface AfxTerminal {
	provider: AfxTerminalProvider
	id: number
	busy: boolean
	running: boolean
	taskId?: string
	process?: AfxTerminalProcess
	getCurrentWorkingDirectory(): string
	isClosed: () => boolean
	runCommand: (command: string, callbacks: AfxTerminalCallbacks) => AfxTerminalProcessResultPromise
	setActiveStream(stream: AsyncIterable<string> | undefined, pid?: number): void
	shellExecutionComplete(exitDetails: ExitCodeDetails): void
	getProcessesWithOutput(): AfxTerminalProcess[]
	getUnretrievedOutput(): string
	getLastCommand(): string
	cleanCompletedProcessQueue(): void
}

export interface AfxTerminalCallbacks {
	onLine: (line: string, process: AfxTerminalProcess) => void
	onCompleted: (output: string | undefined, process: AfxTerminalProcess) => void | Promise<void>
	onShellExecutionStarted: (pid: number | undefined, process: AfxTerminalProcess) => void
	onShellExecutionComplete: (details: ExitCodeDetails, process: AfxTerminalProcess) => void
	onNoShellIntegration?: (message: string, process: AfxTerminalProcess) => void
}

export interface AfxTerminalProcess extends EventEmitter<AfxTerminalProcessEvents> {
	command: string
	isHot: boolean
	run: (command: string) => Promise<void>
	continue: () => void
	abort: () => void
	hasUnretrievedOutput: () => boolean
	getUnretrievedOutput: () => string
	trimRetrievedOutput: () => void
}

export type AfxTerminalProcessResultPromise = AfxTerminalProcess & Promise<void>

export interface AfxTerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: [output?: string]
	stream_available: [stream: AsyncIterable<string>]
	shell_execution_started: [pid: number | undefined]
	shell_execution_complete: [exitDetails: ExitCodeDetails]
	error: [error: Error]
	no_shell_integration: [message: string]
}

export interface ExitCodeDetails {
	exitCode: number | undefined
	signal?: number | undefined
	signalName?: string
	coreDumpPossible?: boolean
}
