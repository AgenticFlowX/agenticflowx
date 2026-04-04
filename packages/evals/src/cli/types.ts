// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on AgenticFlowX (https://github.com/AgenticFlowX/agenticflowx)
// Original work by Saoud Rizwan (Claude Dev)

import { type TaskEvent } from "@agenticflowx/types"

import type { Run, Task } from "../db/index"
import { Logger } from "./utils"

export class SubprocessTimeoutError extends Error {
	constructor(timeout: number) {
		super(`Subprocess timeout after ${timeout}ms`)
		this.name = "SubprocessTimeoutError"
	}
}

export type RunTaskOptions = {
	run: Run
	task: Task
	jobToken: string | null
	publish: (taskEvent: TaskEvent) => Promise<void>
	logger: Logger
}
