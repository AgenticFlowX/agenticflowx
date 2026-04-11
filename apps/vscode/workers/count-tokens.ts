// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import workerpool from "workerpool"

import { Anthropic } from "@anthropic-ai/sdk"

import { tiktoken } from "../utils/tiktoken"

import { type CountTokensResult } from "./types"

async function countTokens(content: Anthropic.Messages.ContentBlockParam[]): Promise<CountTokensResult> {
	try {
		const count = await tiktoken(content)
		return { success: true, count }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		}
	}
}

workerpool.worker({ countTokens })
