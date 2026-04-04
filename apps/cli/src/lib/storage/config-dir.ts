// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import fs from "fs/promises"
import os from "os"
import path from "path"

const CONFIG_DIR = path.join(os.homedir(), ".afx")

export function getConfigDir(): string {
	return CONFIG_DIR
}

export async function ensureConfigDir(): Promise<void> {
	try {
		await fs.mkdir(CONFIG_DIR, { recursive: true })
	} catch (err) {
		// Directory may already exist, that's fine.
		const error = err as NodeJS.ErrnoException

		if (error.code !== "EEXIST") {
			throw err
		}
	}
}
