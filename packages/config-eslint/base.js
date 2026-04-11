// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import turboPlugin from "eslint-plugin-turbo"
import tseslint from "typescript-eslint"
import onlyWarn from "eslint-plugin-only-warn"
import checkFile from "eslint-plugin-check-file"

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
	js.configs.recommended,
	eslintConfigPrettier,
	...tseslint.configs.recommended,
	{
		plugins: {
			turbo: turboPlugin,
		},
		rules: {
			"turbo/no-undeclared-env-vars": "off",
		},
	},
	{
		plugins: {
			onlyWarn,
		},
	},
	{
		ignores: ["dist/**"],
	},
	{
		plugins: {
			"check-file": checkFile,
		},
		rules: {
			"check-file/filename-naming-convention": [
				"error",
				{
					// .ts files: kebab-case or snake_case (both lowercase)
					"**/*.ts": "+([a-z0-9])*([_-]+([a-z0-9]))",
					// .tsx files: PascalCase (React components) or kebab-case
					"**/*.tsx": "+([A-Z]*([a-zA-Z0-9])|+([a-z0-9])*(-+([a-z0-9])))",
				},
				{
					ignoreMiddleExtensions: true, // allow file.spec.ts, file.test.ts, etc.
				},
			],
		},
	},
	{
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
		},
	},
]
