// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { javascriptQuery } from "../queries"
import sampleJsonContent from "./fixtures/sample-json"

describe("inspectJson", () => {
	const testOptions = {
		language: "javascript",
		wasmFile: "tree-sitter-javascript.wasm",
		queryString: javascriptQuery,
		extKey: "json",
	}

	it("should inspect JSON tree structure", async () => {
		await inspectTreeStructure(sampleJsonContent, "json")
	})

	it("should parse JSON definitions", async () => {
		await testParseSourceCodeDefinitions("test.json", sampleJsonContent, testOptions)
	})
})
