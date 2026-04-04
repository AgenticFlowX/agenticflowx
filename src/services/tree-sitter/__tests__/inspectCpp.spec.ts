// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { cppQuery } from "../queries"
import sampleCppContent from "./fixtures/sample-cpp"

describe("C++ Tree-sitter Parser", () => {
	const testOptions = {
		language: "cpp",
		wasmFile: "tree-sitter-cpp.wasm",
		queryString: cppQuery,
		extKey: "cpp",
	}

	it("should properly parse structures", async () => {
		// First run inspectTreeStructure to get query structure output
		await inspectTreeStructure(sampleCppContent, "cpp")

		// Then run testParseSourceCodeDefinitions to get line numbers
		const result = await testParseSourceCodeDefinitions("test.cpp", sampleCppContent, testOptions)
		expect(result).toBeDefined()
		expect(result).toMatch(/\d+--\d+ \|/)
	})
})
