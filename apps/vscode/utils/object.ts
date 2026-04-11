// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * Check if an object is empty (has no own enumerable properties)
 * @param obj The object to check
 * @returns true if the object is empty, false otherwise
 */
export function isEmpty(obj: unknown): boolean {
	if (!obj || typeof obj !== "object") {
		return true
	}

	// Check if it's an array
	if (Array.isArray(obj)) {
		return obj.length === 0
	}

	// Check if it's an object with no own properties
	return Object.keys(obj).length === 0
}
