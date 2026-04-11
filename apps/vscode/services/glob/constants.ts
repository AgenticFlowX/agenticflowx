// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * List of directories that are typically large and should be ignored
 * when showing recursive file listings or scanning for code indexing.
 * This list is shared between list-files.ts and the codebase indexing scanner
 * to ensure consistent behavior across the application.
 */
export const DIRS_TO_IGNORE = [
	"node_modules",
	"__pycache__",
	"env",
	"venv",
	"target/dependency",
	"build/dependencies",
	"dist",
	"out",
	"bundle",
	"vendor",
	"tmp",
	"temp",
	"deps",
	"pkg",
	"Pods",
	".git",
	".*",
]
