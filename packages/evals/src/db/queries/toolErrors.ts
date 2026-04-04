// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { RecordNotCreatedError } from "./errors"
import type { InsertToolError } from "../schema"
import { toolErrors } from "../schema"
import { client as db } from "../db"

export const createToolError = async (args: InsertToolError) => {
	const records = await db
		.insert(toolErrors)
		.values({
			...args,
			createdAt: new Date(),
		})
		.returning()

	const record = records[0]

	if (!record) {
		throw new RecordNotCreatedError()
	}

	return record
}
