// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * General error handler for OpenAI client errors
 * Transforms technical errors into user-friendly messages
 *
 * @deprecated Use handleProviderError from './error-handler' instead
 * This file is kept for backward compatibility
 */

import { handleProviderError } from "./error-handler"

/**
 * Handles OpenAI client errors and transforms them into user-friendly messages
 * @param error - The error to handle
 * @param providerName - The name of the provider for context in error messages
 * @returns The original error or a transformed user-friendly error
 */
export function handleOpenAIError(error: unknown, providerName: string): Error {
	return handleProviderError(error, providerName, { messagePrefix: "completion" })
}
