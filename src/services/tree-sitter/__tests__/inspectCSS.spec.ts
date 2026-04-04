// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { cssQuery } from "../queries"
import sampleCSSContent from "./fixtures/sample-css"

describe("CSS Tree-sitter Parser", () => {
	const testOptions = {
		language: "css",
		wasmFile: "tree-sitter-css.wasm",
		queryString: cssQuery,
		extKey: "css",
	}

	it("should properly parse CSS structures", async () => {
		// First run inspectTreeStructure to get query structure output
		await inspectTreeStructure(sampleCSSContent, "css")

		// Then run testParseSourceCodeDefinitions to get line numbers
		const result = await testParseSourceCodeDefinitions("test.css", sampleCSSContent, testOptions)
		expect(result).toBeDefined()
		if (!result) {
			throw new Error("No result returned from parser")
		}
		expect(result).toMatch(/\d+--\d+ \|/)
		expect(result.split("\n").length).toBeGreaterThan(1)
	})
})
