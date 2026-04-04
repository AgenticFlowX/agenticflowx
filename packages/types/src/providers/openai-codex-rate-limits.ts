// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * OpenAI Codex usage/rate limit information (ChatGPT subscription)
 */
export interface OpenAiCodexRateLimitInfo {
	primary?: {
		/** Used percent in 0–100 */
		usedPercent: number
		/** Window length in minutes, when provided */
		windowMinutes?: number
		/** Reset time (unix ms since epoch), when provided */
		resetsAt?: number
	}
	secondary?: {
		/** Used percent in 0–100 */
		usedPercent: number
		/** Window length in minutes, when provided */
		windowMinutes?: number
		/** Reset time (unix ms since epoch), when provided */
		resetsAt?: number
	}
	credits?: {
		hasCredits: boolean
		unlimited: boolean
		balance?: string
	}
	planType?: string
	/** Timestamp when this was fetched (unix ms since epoch) */
	fetchedAt: number
}
