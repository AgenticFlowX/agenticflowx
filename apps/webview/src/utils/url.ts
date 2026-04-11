// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

export const isValidUrl = (urlString: string): boolean => {
	try {
		new URL(urlString)
		return true
	} catch {
		return false
	}
}
