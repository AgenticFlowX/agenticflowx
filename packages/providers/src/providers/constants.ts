// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { Package } from "@agenticflowx/utils"

export const DEFAULT_HEADERS = {
	"HTTP-Referer": "https://github.com/agenticflowx/agenticflowx",
	"X-Title": "AgenticFlowX",
	"User-Agent": `AgenticFlowX/${Package.version}`,
}
