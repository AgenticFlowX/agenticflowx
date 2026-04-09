// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { reactConfig } from "@agenticflowx/config-eslint/react"

/** @type {import("eslint").Linter.Config} */
export default [
	...reactConfig,
	{
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					args: "all",
					ignoreRestSiblings: true,
					varsIgnorePattern: "^_",
					argsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "off",
			"react/prop-types": "off",
			"react/display-name": "off",
		},
	},
]
