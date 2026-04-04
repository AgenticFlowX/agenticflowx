// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * @fileoverview Main entry point for the compact logging system
 * Provides a default logger instance with Jest environment detection
 */

import { CompactLogger } from "./CompactLogger"

/**
 * No-operation logger implementation for production environments
 */
const noopLogger = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
	fatal: () => {},
	child: () => noopLogger,
	close: () => {},
}

/**
 * Default logger instance
 * Uses CompactLogger for normal operation, switches to noop logger in Jest test environment
 */
export const logger = process.env.NODE_ENV === "test" ? new CompactLogger() : noopLogger
