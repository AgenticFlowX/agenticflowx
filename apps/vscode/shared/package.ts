// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { publisher, name, version } from "../package.json"

// These ENV variables can be defined by ESBuild when building the extension
// in order to override the values in package.json. This allows us to build
// different extension variants with the same package.json file.
// The build process still needs to emit a modified package.json for consumption
// by VSCode, but that build artifact is not used during the transpile step of
// the build, so we still need this override mechanism.
export const Package = {
	publisher,
	name: process.env.PKG_NAME || name,
	version: process.env.PKG_VERSION || version,
	outputChannel: process.env.PKG_OUTPUT_CHANNEL || "AgenticFlowX",
	sha: process.env.PKG_SHA,
} as const
