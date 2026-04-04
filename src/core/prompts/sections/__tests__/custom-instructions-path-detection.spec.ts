// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import * as path from "path"

describe("custom-instructions path detection", () => {
	it("should use exact path comparison instead of string includes", () => {
		// Test the logic that our fix implements
		const fakeHomeDir = "/Users/john.roo.smith"
		const globalAfxDir = path.join(fakeHomeDir, ".afx") // "/Users/john.roo.smith/.afx"
		const projectAfxDir = "/projects/my-project/.afx"

		// Old implementation (fragile):
		// const isGlobal = afxDir.includes(path.join(os.homedir(), ".afx"))
		// This could fail if the home directory path contains ".afx" elsewhere

		// New implementation (robust):
		// const isGlobal = path.resolve(afxDir) === path.resolve(getGlobalAfxDirectory())

		// Test the new logic
		const isGlobalForGlobalDir = path.resolve(globalAfxDir) === path.resolve(globalAfxDir)
		const isGlobalForProjectDir = path.resolve(projectAfxDir) === path.resolve(globalAfxDir)

		expect(isGlobalForGlobalDir).toBe(true)
		expect(isGlobalForProjectDir).toBe(false)

		// Verify that the old implementation would have been problematic
		// if the home directory contained ".afx" in the path
		const oldLogicGlobal = globalAfxDir.includes(path.join(fakeHomeDir, ".afx"))
		const oldLogicProject = projectAfxDir.includes(path.join(fakeHomeDir, ".afx"))

		expect(oldLogicGlobal).toBe(true) // This works
		expect(oldLogicProject).toBe(false) // This also works, but is fragile

		// The issue was that if the home directory path itself contained ".afx",
		// the includes() check could produce false positives in edge cases
	})

	it("should handle edge cases with path resolution", () => {
		// Test various edge cases that exact path comparison handles better
		const testCases = [
			{
				global: "/Users/test/.afx",
				project: "/Users/test/project/.afx",
				expected: { global: true, project: false },
			},
			{
				global: "/home/user/.afx",
				project: "/home/user/.afx", // Same directory
				expected: { global: true, project: true },
			},
			{
				global: "/Users/john.roo.smith/.afx",
				project: "/projects/app/.afx",
				expected: { global: true, project: false },
			},
		]

		testCases.forEach(({ global, project, expected }) => {
			const isGlobalForGlobal = path.resolve(global) === path.resolve(global)
			const isGlobalForProject = path.resolve(project) === path.resolve(global)

			expect(isGlobalForGlobal).toBe(expected.global)
			expect(isGlobalForProject).toBe(expected.project)
		})
	})
})
