// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { testParseSourceCodeDefinitions, inspectTreeStructure } from "./helpers"
import { phpQuery } from "../queries"
import samplePhpContent from "./fixtures/sample-php"

describe("parseSourceCodeDefinitionsForFile with PHP", () => {
	// PHP test options
	const phpOptions = {
		language: "php",
		wasmFile: "tree-sitter-php.wasm",
		queryString: phpQuery,
		extKey: "php",
	}

	it("should inspect PHP tree structure", async () => {
		await inspectTreeStructure(samplePhpContent, "php")
	})

	it("should parse PHP definitions", async () => {
		await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)
	})
})
