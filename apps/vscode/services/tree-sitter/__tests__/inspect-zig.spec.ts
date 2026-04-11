// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { testParseSourceCodeDefinitions, inspectTreeStructure } from "./helpers"
import { sampleZig } from "./fixtures/sample-zig"
import { zigQuery } from "../queries"

describe("Zig Tree-sitter Parser", () => {
	it("should inspect tree structure", async () => {
		await inspectTreeStructure(sampleZig, "zig")
	})

	it("should parse source code definitions", async () => {
		const result = await testParseSourceCodeDefinitions("file.zig", sampleZig, {
			language: "zig",
			wasmFile: "tree-sitter-zig.wasm",
			queryString: zigQuery,
			extKey: "zig",
		})
		expect(result).toBeDefined()
	})
})
