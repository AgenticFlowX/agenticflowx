// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import type { AfxTerminalCallbacks, AfxTerminalProcessResultPromise } from "./types"
import { BaseTerminal } from "./base-terminal"
import { ExecaTerminalProcess } from "./execa-terminal-process"
import { mergePromise } from "./merge-promise"

export class ExecaTerminal extends BaseTerminal {
	constructor(id: number, cwd: string) {
		super("execa", id, cwd)
	}

	/**
	 * Unlike the VSCode terminal, this is never closed.
	 */
	public override isClosed(): boolean {
		return false
	}

	public override runCommand(command: string, callbacks: AfxTerminalCallbacks): AfxTerminalProcessResultPromise {
		this.busy = true

		const process = new ExecaTerminalProcess(this)
		process.command = command
		this.process = process

		process.on("line", (line) => callbacks.onLine(line, process))
		process.once("completed", (output) => callbacks.onCompleted(output, process))
		process.once("shell_execution_started", (pid) => callbacks.onShellExecutionStarted(pid, process))
		process.once("shell_execution_complete", (details) => callbacks.onShellExecutionComplete(details, process))

		const promise = new Promise<void>((resolve, reject) => {
			process.once("continue", () => resolve())
			process.once("error", (error) => reject(error))
			process.run(command)
		})

		return mergePromise(process, promise)
	}
}
