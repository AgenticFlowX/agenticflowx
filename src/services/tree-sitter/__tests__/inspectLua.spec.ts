// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { inspectTreeStructure, testParseSourceCodeDefinitions, debugLog } from "./helpers"
import { luaQuery } from "../queries"
import sampleLuaContent from "./fixtures/sample-lua"

describe("inspectLua", () => {
	const testOptions = {
		language: "lua",
		wasmFile: "tree-sitter-lua.wasm",
		queryString: luaQuery,
		extKey: "lua",
	}

	it("should inspect Lua tree structure", async () => {
		await inspectTreeStructure(sampleLuaContent, "lua")
	})

	it("should parse Lua definitions", async () => {
		const result = await testParseSourceCodeDefinitions("file.lua", sampleLuaContent, testOptions)
		expect(result).toBeDefined() // Confirm parse succeeded
		debugLog("Lua parse result:", result)
	})
})
