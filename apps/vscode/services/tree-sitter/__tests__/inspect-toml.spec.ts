// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { inspectTreeStructure, testParseSourceCodeDefinitions } from "./helpers"
import { tomlQuery } from "../queries"
import { sampleToml } from "./fixtures/sample-toml"

describe("inspectTOML", () => {
	const testOptions = {
		language: "toml",
		wasmFile: "tree-sitter-toml.wasm",
		queryString: tomlQuery,
		extKey: "toml",
	}

	it("should inspect TOML tree structure", async () => {
		await inspectTreeStructure(sampleToml, "toml")
	})

	it("should parse TOML definitions", async () => {
		await testParseSourceCodeDefinitions("test.toml", sampleToml, testOptions)
	})
})
