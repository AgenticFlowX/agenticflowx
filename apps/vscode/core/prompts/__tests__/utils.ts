// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import * as fs from "fs/promises"
import { PathLike } from "fs"

// Make a path take a unix-like form.  Useful for making path comparisons.
export function toPosix(filePath: PathLike | fs.FileHandle) {
	return filePath.toString().toPosix()
}
