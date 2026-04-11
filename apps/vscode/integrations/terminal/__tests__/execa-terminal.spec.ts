// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

// npx vitest run src/integrations/terminal/__tests__/ExecaTerminal.spec.ts

import { AfxTerminalCallbacks } from "../types"
import { ExecaTerminal } from "../execa-terminal"

describe("ExecaTerminal", () => {
	it("should run terminal commands and collect output", async () => {
		// TODO: Run the equivalent test for Windows.
		if (process.platform === "win32") {
			return
		}

		const terminal = new ExecaTerminal(1, "/tmp")
		let result

		const callbacks: AfxTerminalCallbacks = {
			onLine: vi.fn(),
			onCompleted: (output) => {
				result = output
			},
			onShellExecutionStarted: vi.fn(),
			onShellExecutionComplete: vi.fn(),
		}

		const subprocess = terminal.runCommand("ls -al", callbacks)
		await subprocess

		expect(callbacks.onLine).toHaveBeenCalled()
		expect(callbacks.onShellExecutionStarted).toHaveBeenCalled()
		expect(callbacks.onShellExecutionComplete).toHaveBeenCalled()

		expect(result).toBeTypeOf("string")
		expect(result).toContain("total")
	})
})
