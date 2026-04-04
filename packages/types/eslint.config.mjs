// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { config } from "@agenticflowx/config-eslint/base"
import globals from "globals"

/** @type {import("eslint").Linter.Config} */
export default [
	...config,
	{
		files: ["**/*.cjs"],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.commonjs,
			},
			sourceType: "commonjs",
		},
		rules: {
			"@typescript-eslint/no-require-imports": "off",
		},
	},
]
