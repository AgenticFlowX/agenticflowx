import { config } from "@agenticflowx/config-eslint/base"

export default [
	...config,
	{
		rules: {
			"no-regex-spaces": "off",
			"no-useless-escape": "off",
			"no-empty": "off",
			"prefer-const": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-require-imports": "off",
			"@typescript-eslint/ban-ts-comment": "off",
		},
	},
]
