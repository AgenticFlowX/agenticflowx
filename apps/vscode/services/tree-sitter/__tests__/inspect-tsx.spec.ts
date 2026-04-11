// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { inspectTreeStructure, testParseSourceCodeDefinitions, debugLog } from "./helpers"
import sampleTsxContent from "./fixtures/sample-tsx"

describe("inspectTsx", () => {
	const testOptions = {
		language: "tsx",
		wasmFile: "tree-sitter-tsx.wasm",
	}

	it("should inspect TSX tree structure", async () => {
		// This test only validates that the function executes without error
		const result = await inspectTreeStructure(sampleTsxContent, "tsx")
		expect(result).toBeDefined()
		// No expectations - just verifying it runs
	})

	it("should parse TSX definitions and produce line number output", async () => {
		// Execute parsing and capture the result
		const result = await testParseSourceCodeDefinitions("test.tsx", sampleTsxContent, testOptions)

		// Validate that the result is defined
		expect(result).toBeDefined()

		// Validate that the result contains line number output format (N--M | content)
		expect(result).toMatch(/\d+--\d+ \|/)

		// Debug output the result for inspection
		debugLog("TSX Parse Result Sample:", result?.substring(0, 500) + "...")
	})
})
