// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import path from "path"
import { AfxProtectedController } from "../AfxProtectedController"

describe("AfxProtectedController", () => {
	const TEST_CWD = "/test/workspace"
	let controller: AfxProtectedController

	beforeEach(() => {
		controller = new AfxProtectedController(TEST_CWD)
	})

	describe("isWriteProtected", () => {
		it("should protect .afxignore file", () => {
			expect(controller.isWriteProtected(".afxignore")).toBe(true)
		})

		it("should protect files in .afx directory", () => {
			expect(controller.isWriteProtected(".afx/config.json")).toBe(true)
			expect(controller.isWriteProtected(".afx/settings/user.json")).toBe(true)
			expect(controller.isWriteProtected(".afx/modes/custom.json")).toBe(true)
		})

		it("should protect .afxprotected file", () => {
			expect(controller.isWriteProtected(".afxprotected")).toBe(true)
		})

		it("should protect .afxmodes files", () => {
			expect(controller.isWriteProtected(".afxmodes")).toBe(true)
		})

		it("should protect .afxrules* files", () => {
			expect(controller.isWriteProtected(".afxrules")).toBe(true)
			expect(controller.isWriteProtected(".afxrules.md")).toBe(true)
			expect(controller.isWriteProtected(".afxrules-code")).toBe(true)
		})

		it("should protect files in .vscode directory", () => {
			expect(controller.isWriteProtected(".vscode/settings.json")).toBe(true)
			expect(controller.isWriteProtected(".vscode/launch.json")).toBe(true)
			expect(controller.isWriteProtected(".vscode/tasks.json")).toBe(true)
		})

		it("should protect .code-workspace files", () => {
			expect(controller.isWriteProtected("myproject.code-workspace")).toBe(true)
			expect(controller.isWriteProtected("pentest.code-workspace")).toBe(true)
			expect(controller.isWriteProtected(".code-workspace")).toBe(true)
			expect(controller.isWriteProtected("folder/workspace.code-workspace")).toBe(true)
		})

		it("should protect AGENTS.md file", () => {
			expect(controller.isWriteProtected("AGENTS.md")).toBe(true)
		})

		it("should protect AGENT.md file", () => {
			expect(controller.isWriteProtected("AGENT.md")).toBe(true)
		})

		it("should not protect other files starting with .afx", () => {
			expect(controller.isWriteProtected(".afxsettings")).toBe(false)
			expect(controller.isWriteProtected(".afxconfig")).toBe(false)
		})

		it("should not protect regular files", () => {
			expect(controller.isWriteProtected("src/index.ts")).toBe(false)
			expect(controller.isWriteProtected("package.json")).toBe(false)
			expect(controller.isWriteProtected("README.md")).toBe(false)
		})

		it("should not protect files that contain 'roo' but don't start with .afx", () => {
			expect(controller.isWriteProtected("src/roo-utils.ts")).toBe(false)
			expect(controller.isWriteProtected("config/roo.config.js")).toBe(false)
		})

		it("should handle nested paths correctly", () => {
			expect(controller.isWriteProtected(".afx/config.json")).toBe(true) // .afx/** matches at root
			expect(controller.isWriteProtected("nested/.afxignore")).toBe(true) // .afxignore matches anywhere by default
			expect(controller.isWriteProtected("nested/.afxmodes")).toBe(true) // .afxmodes matches anywhere by default
			expect(controller.isWriteProtected("nested/.afxrules.md")).toBe(true) // .afxrules* matches anywhere by default
		})

		it("should handle absolute paths by converting to relative", () => {
			const absolutePath = path.join(TEST_CWD, ".afxignore")
			expect(controller.isWriteProtected(absolutePath)).toBe(true)
		})

		it("should handle paths with different separators", () => {
			expect(controller.isWriteProtected(".afx\\config.json")).toBe(true)
			expect(controller.isWriteProtected(".afx/config.json")).toBe(true)
		})

		it("should not throw for absolute paths outside cwd", () => {
			expect(controller.isWriteProtected("/tmp/comment-2-pr63.json")).toBe(false)
			expect(controller.isWriteProtected("/etc/passwd")).toBe(false)
		})
	})

	describe("getProtectedFiles", () => {
		it("should return set of protected files from a list", () => {
			const files = ["src/index.ts", ".afxignore", "package.json", ".afx/config.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set([".afxignore", ".afx/config.json"]))
		})

		it("should return empty set when no files are protected", () => {
			const files = ["src/index.ts", "package.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set())
		})
	})

	describe("annotatePathsWithProtection", () => {
		it("should annotate paths with protection status", () => {
			const files = ["src/index.ts", ".afxignore", ".afx/config.json", "package.json"]

			const annotated = controller.annotatePathsWithProtection(files)

			expect(annotated).toEqual([
				{ path: "src/index.ts", isProtected: false },
				{ path: ".afxignore", isProtected: true },
				{ path: ".afx/config.json", isProtected: true },
				{ path: "package.json", isProtected: false },
			])
		})
	})

	describe("getProtectionMessage", () => {
		it("should return appropriate protection message", () => {
			const message = controller.getProtectionMessage()
			expect(message).toBe("This is a AFX configuration file and requires approval for modifications")
		})
	})

	describe("getInstructions", () => {
		it("should return formatted instructions about protected files", () => {
			const instructions = controller.getInstructions()

			expect(instructions).toContain("# Protected Files")
			expect(instructions).toContain("write-protected")
			expect(instructions).toContain(".afxignore")
			expect(instructions).toContain(".afx/**")
			expect(instructions).toContain("\u{1F6E1}") // Shield symbol
		})
	})

	describe("getProtectedPatterns", () => {
		it("should return the list of protected patterns", () => {
			const patterns = AfxProtectedController.getProtectedPatterns()

			expect(patterns).toEqual([
				".afxignore",
				".afxmodes",
				".afxrules*",
				".afx/**",
				".vscode/**",
				"*.code-workspace",
				".afxprotected",
				"AGENTS.md",
				"AGENT.md",
			])
		})
	})
})
