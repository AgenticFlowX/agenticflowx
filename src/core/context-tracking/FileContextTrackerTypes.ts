// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { z } from "zod"

// Zod schema for RecordSource
export const recordSourceSchema = z.enum(["read_tool", "user_edited", "afx_edited", "file_mentioned"])

// TypeScript type derived from the Zod schema
export type RecordSource = z.infer<typeof recordSourceSchema>

// Zod schema for FileMetadataEntry
export const fileMetadataEntrySchema = z.object({
	path: z.string(),
	record_state: z.enum(["active", "stale"]),
	record_source: recordSourceSchema,
	afx_read_date: z.number().nullable(),
	afx_edit_date: z.number().nullable(),
	user_edit_date: z.number().nullable().optional(),
})

// TypeScript type derived from the Zod schema
export type FileMetadataEntry = z.infer<typeof fileMetadataEntrySchema>

// Zod schema for TaskMetadata
export const taskMetadataSchema = z.object({
	files_in_context: z.array(fileMetadataEntrySchema),
})

// TypeScript type derived from the Zod schema
export type TaskMetadata = z.infer<typeof taskMetadataSchema>
