// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import path from "path"
import os from "os"
import fs from "fs"

export async function createEphemeralStorageDir(): Promise<string> {
	const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
	const tmpDir = path.join(os.tmpdir(), `afx-cli-${uniqueId}`)
	await fs.promises.mkdir(tmpDir, { recursive: true })
	return tmpDir
}
