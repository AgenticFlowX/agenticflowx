// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

export const DEFAULT_SUITE_TIMEOUT = 120_000

export function setDefaultSuiteTimeout(context: Mocha.Suite) {
	context.timeout(DEFAULT_SUITE_TIMEOUT)
}
