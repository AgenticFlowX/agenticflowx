// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

// Deprecated: Tests for the old SearchAndReplaceTool.
// Full edit tool tests are in editTool.spec.ts.
// This file only verifies the backward-compatible re-export.

import { searchAndReplaceTool } from "../search-and-replace-tool"
import { editTool } from "../edit-tool"

describe("SearchAndReplaceTool re-export", () => {
	it("exports searchAndReplaceTool as an alias for editTool", () => {
		expect(searchAndReplaceTool).toBeDefined()
		expect(searchAndReplaceTool).toBe(editTool)
	})
})
