// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import pluginNext from "@next/eslint-plugin-next"

import { reactConfig } from "./react.js"

/**
 * @type {import("eslint").Linter.Config[]}
 */
export const nextJsConfig = [
	...reactConfig,
	{
		plugins: {
			"@next/next": pluginNext,
		},
		rules: {
			...pluginNext.configs.recommended.rules,
			...pluginNext.configs["core-web-vitals"].rules,
		},
	},
]
