// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { z } from "zod"

import { afxSettingsSchema } from "./global-settings.js"

/**
 * AFX CLI stdin commands
 */

export const afxCliCommandNames = ["start", "message", "cancel", "ping", "shutdown"] as const

export const afxCliCommandNameSchema = z.enum(afxCliCommandNames)

export type AfxCliCommandName = z.infer<typeof afxCliCommandNameSchema>

export const afxCliCommandBaseSchema = z.object({
	command: afxCliCommandNameSchema,
	requestId: z.string().min(1),
})

export type AfxCliCommandBase = z.infer<typeof afxCliCommandBaseSchema>

const afxCliSessionIdSchema = z
	.string()
	.trim()
	.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)

export const afxCliStartCommandSchema = afxCliCommandBaseSchema.extend({
	command: z.literal("start"),
	prompt: z.string(),
	taskId: afxCliSessionIdSchema.optional(),
	images: z.array(z.string()).optional(),
	configuration: afxSettingsSchema.optional(),
})

export type AfxCliStartCommand = z.infer<typeof afxCliStartCommandSchema>

export const afxCliMessageCommandSchema = afxCliCommandBaseSchema.extend({
	command: z.literal("message"),
	prompt: z.string(),
	images: z.array(z.string()).optional(),
})

export type AfxCliMessageCommand = z.infer<typeof afxCliMessageCommandSchema>

export const afxCliCancelCommandSchema = afxCliCommandBaseSchema.extend({
	command: z.literal("cancel"),
})

export type AfxCliCancelCommand = z.infer<typeof afxCliCancelCommandSchema>

export const afxCliPingCommandSchema = afxCliCommandBaseSchema.extend({
	command: z.literal("ping"),
})

export type AfxCliPingCommand = z.infer<typeof afxCliPingCommandSchema>

export const afxCliShutdownCommandSchema = afxCliCommandBaseSchema.extend({
	command: z.literal("shutdown"),
})

export type AfxCliShutdownCommand = z.infer<typeof afxCliShutdownCommandSchema>

export const afxCliInputCommandSchema = z.discriminatedUnion("command", [
	afxCliStartCommandSchema,
	afxCliMessageCommandSchema,
	afxCliCancelCommandSchema,
	afxCliPingCommandSchema,
	afxCliShutdownCommandSchema,
])

export type AfxCliInputCommand = z.infer<typeof afxCliInputCommandSchema>

/**
 * AFX CLI stream-json output
 */

export const afxCliOutputFormats = ["text", "json", "stream-json"] as const

export const afxCliOutputFormatSchema = z.enum(afxCliOutputFormats)

export type AfxCliOutputFormat = z.infer<typeof afxCliOutputFormatSchema>

export const afxCliEventTypes = [
	"system",
	"control",
	"queue",
	"assistant",
	"user",
	"tool_use",
	"tool_result",
	"thinking",
	"error",
	"result",
] as const

export const afxCliEventTypeSchema = z.enum(afxCliEventTypes)

export type AfxCliEventType = z.infer<typeof afxCliEventTypeSchema>

export const afxCliControlSubtypes = ["ack", "done", "error"] as const

export const afxCliControlSubtypeSchema = z.enum(afxCliControlSubtypes)

export type AfxCliControlSubtype = z.infer<typeof afxCliControlSubtypeSchema>

export const afxCliQueueItemSchema = z.object({
	id: z.string().min(1),
	text: z.string().optional(),
	imageCount: z.number().optional(),
	timestamp: z.number().optional(),
})

export type AfxCliQueueItem = z.infer<typeof afxCliQueueItemSchema>

export const afxCliToolUseSchema = z.object({
	name: z.string(),
	input: z.record(z.unknown()).optional(),
})

export type AfxCliToolUse = z.infer<typeof afxCliToolUseSchema>

export const afxCliToolResultSchema = z.object({
	name: z.string(),
	output: z.string().optional(),
	error: z.string().optional(),
	exitCode: z.number().optional(),
})

export type AfxCliToolResult = z.infer<typeof afxCliToolResultSchema>

export const afxCliCostSchema = z.object({
	totalCost: z.number().optional(),
	inputTokens: z.number().optional(),
	outputTokens: z.number().optional(),
	cacheWrites: z.number().optional(),
	cacheReads: z.number().optional(),
})

export type AfxCliCost = z.infer<typeof afxCliCostSchema>

export const afxCliStreamEventSchema = z
	.object({
		type: afxCliEventTypeSchema.optional(),
		subtype: z.string().optional(),
		requestId: z.string().optional(),
		command: afxCliCommandNameSchema.optional(),
		taskId: z.string().optional(),
		code: z.string().optional(),
		content: z.string().optional(),
		success: z.boolean().optional(),
		id: z.number().optional(),
		done: z.boolean().optional(),
		queueDepth: z.number().optional(),
		queue: z.array(afxCliQueueItemSchema).optional(),
		schemaVersion: z.number().optional(),
		protocol: z.string().optional(),
		capabilities: z.array(z.string()).optional(),
		tool_use: afxCliToolUseSchema.optional(),
		tool_result: afxCliToolResultSchema.optional(),
		cost: afxCliCostSchema.optional(),
	})
	.passthrough()

export type AfxCliStreamEvent = z.infer<typeof afxCliStreamEventSchema>

export const afxCliControlEventSchema = afxCliStreamEventSchema.extend({
	type: z.literal("control"),
	subtype: afxCliControlSubtypeSchema,
	requestId: z.string().min(1),
})

export type AfxCliControlEvent = z.infer<typeof afxCliControlEventSchema>

export const afxCliFinalOutputSchema = z.object({
	type: z.literal("result"),
	success: z.boolean(),
	content: z.string().optional(),
	cost: afxCliCostSchema.optional(),
	events: z.array(afxCliStreamEventSchema),
})

export type AfxCliFinalOutput = z.infer<typeof afxCliFinalOutputSchema>
