// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

const getReleaseLine = async (changeset) => {
	const lines = changeset.summary
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean)
	return lines.map((line) => (line.startsWith("- ") ? line : `- ${line}`)).join("\n")
}

const getDependencyReleaseLine = async () => {
	return ""
}

const changelogFunctions = {
	getReleaseLine,
	getDependencyReleaseLine,
}

module.exports = changelogFunctions
