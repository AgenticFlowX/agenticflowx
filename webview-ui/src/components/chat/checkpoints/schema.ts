// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { z } from "zod"

export const checkpointSchema = z.object({
	from: z.string(),
	to: z.string(),
})

export type Checkpoint = z.infer<typeof checkpointSchema>
