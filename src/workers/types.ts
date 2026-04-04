// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { z } from "zod"

export const countTokensResultSchema = z.discriminatedUnion("success", [
	z.object({
		success: z.literal(true),
		count: z.number(),
	}),
	z.object({ success: z.literal(false), error: z.string() }),
])

export type CountTokensResult = z.infer<typeof countTokensResultSchema>
