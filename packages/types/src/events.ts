// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { z } from "zod"

import { afxMessageSchema, queuedMessageSchema, tokenUsageSchema } from "./message.js"
import { modelInfoSchema } from "./model.js"
import { toolNamesSchema, toolUsageSchema } from "./tool.js"

/**
 * AfxEventName
 */

export enum AfxEventName {
	// Task Provider Lifecycle
	TaskCreated = "taskCreated",

	// Task Lifecycle
	TaskStarted = "taskStarted",
	TaskCompleted = "taskCompleted",
	TaskAborted = "taskAborted",
	TaskFocused = "taskFocused",
	TaskUnfocused = "taskUnfocused",
	TaskActive = "taskActive",
	TaskInteractive = "taskInteractive",
	TaskResumable = "taskResumable",
	TaskIdle = "taskIdle",

	// Subtask Lifecycle
	TaskPaused = "taskPaused",
	TaskUnpaused = "taskUnpaused",
	TaskSpawned = "taskSpawned",
	TaskDelegated = "taskDelegated",
	TaskDelegationCompleted = "taskDelegationCompleted",
	TaskDelegationResumed = "taskDelegationResumed",

	// Task Execution
	Message = "message",
	TaskModeSwitched = "taskModeSwitched",
	TaskAskResponded = "taskAskResponded",
	TaskUserMessage = "taskUserMessage",
	QueuedMessagesUpdated = "queuedMessagesUpdated",

	// Task Analytics
	TaskTokenUsageUpdated = "taskTokenUsageUpdated",
	TaskToolFailed = "taskToolFailed",

	// Configuration Changes
	ModeChanged = "modeChanged",
	ProviderProfileChanged = "providerProfileChanged",

	// Query Responses
	CommandsResponse = "commandsResponse",
	ModesResponse = "modesResponse",
	ModelsResponse = "modelsResponse",

	// Evals
	EvalPass = "evalPass",
	EvalFail = "evalFail",
}

/**
 * AfxEvents
 */

export const afxEventsSchema = z.object({
	[AfxEventName.TaskCreated]: z.tuple([z.string()]),

	[AfxEventName.TaskStarted]: z.tuple([z.string()]),
	[AfxEventName.TaskCompleted]: z.tuple([
		z.string(),
		tokenUsageSchema,
		toolUsageSchema,
		z.object({
			isSubtask: z.boolean(),
		}),
	]),
	[AfxEventName.TaskAborted]: z.tuple([z.string()]),
	[AfxEventName.TaskFocused]: z.tuple([z.string()]),
	[AfxEventName.TaskUnfocused]: z.tuple([z.string()]),
	[AfxEventName.TaskActive]: z.tuple([z.string()]),
	[AfxEventName.TaskInteractive]: z.tuple([z.string()]),
	[AfxEventName.TaskResumable]: z.tuple([z.string()]),
	[AfxEventName.TaskIdle]: z.tuple([z.string()]),

	[AfxEventName.TaskPaused]: z.tuple([z.string()]),
	[AfxEventName.TaskUnpaused]: z.tuple([z.string()]),
	[AfxEventName.TaskSpawned]: z.tuple([z.string(), z.string()]),
	[AfxEventName.TaskDelegated]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
	]),
	[AfxEventName.TaskDelegationCompleted]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
		z.string(), // completionResultSummary
	]),
	[AfxEventName.TaskDelegationResumed]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
	]),

	[AfxEventName.Message]: z.tuple([
		z.object({
			taskId: z.string(),
			action: z.union([z.literal("created"), z.literal("updated")]),
			message: afxMessageSchema,
		}),
	]),
	[AfxEventName.TaskModeSwitched]: z.tuple([z.string(), z.string()]),
	[AfxEventName.TaskAskResponded]: z.tuple([z.string()]),
	[AfxEventName.TaskUserMessage]: z.tuple([z.string()]),
	[AfxEventName.QueuedMessagesUpdated]: z.tuple([z.string(), z.array(queuedMessageSchema)]),

	[AfxEventName.TaskToolFailed]: z.tuple([z.string(), toolNamesSchema, z.string()]),
	[AfxEventName.TaskTokenUsageUpdated]: z.tuple([z.string(), tokenUsageSchema, toolUsageSchema]),

	[AfxEventName.ModeChanged]: z.tuple([z.string()]),
	[AfxEventName.ProviderProfileChanged]: z.tuple([z.object({ name: z.string(), provider: z.string() })]),

	[AfxEventName.CommandsResponse]: z.tuple([
		z.array(
			z.object({
				name: z.string(),
				source: z.enum(["global", "project", "built-in"]),
				filePath: z.string().optional(),
				description: z.string().optional(),
				argumentHint: z.string().optional(),
			}),
		),
	]),
	[AfxEventName.ModesResponse]: z.tuple([z.array(z.object({ slug: z.string(), name: z.string() }))]),
	[AfxEventName.ModelsResponse]: z.tuple([z.record(z.string(), modelInfoSchema)]),
})

export type AfxEvents = z.infer<typeof afxEventsSchema>

/**
 * TaskEvent
 */

export const taskEventSchema = z.discriminatedUnion("eventName", [
	// Task Provider Lifecycle
	z.object({
		eventName: z.literal(AfxEventName.TaskCreated),
		payload: afxEventsSchema.shape[AfxEventName.TaskCreated],
		taskId: z.number().optional(),
	}),

	// Task Lifecycle
	z.object({
		eventName: z.literal(AfxEventName.TaskStarted),
		payload: afxEventsSchema.shape[AfxEventName.TaskStarted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskCompleted),
		payload: afxEventsSchema.shape[AfxEventName.TaskCompleted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskAborted),
		payload: afxEventsSchema.shape[AfxEventName.TaskAborted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskFocused),
		payload: afxEventsSchema.shape[AfxEventName.TaskFocused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskUnfocused),
		payload: afxEventsSchema.shape[AfxEventName.TaskUnfocused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskActive),
		payload: afxEventsSchema.shape[AfxEventName.TaskActive],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskInteractive),
		payload: afxEventsSchema.shape[AfxEventName.TaskInteractive],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskResumable),
		payload: afxEventsSchema.shape[AfxEventName.TaskResumable],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskIdle),
		payload: afxEventsSchema.shape[AfxEventName.TaskIdle],
		taskId: z.number().optional(),
	}),

	// Subtask Lifecycle
	z.object({
		eventName: z.literal(AfxEventName.TaskPaused),
		payload: afxEventsSchema.shape[AfxEventName.TaskPaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskUnpaused),
		payload: afxEventsSchema.shape[AfxEventName.TaskUnpaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskSpawned),
		payload: afxEventsSchema.shape[AfxEventName.TaskSpawned],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskDelegated),
		payload: afxEventsSchema.shape[AfxEventName.TaskDelegated],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskDelegationCompleted),
		payload: afxEventsSchema.shape[AfxEventName.TaskDelegationCompleted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskDelegationResumed),
		payload: afxEventsSchema.shape[AfxEventName.TaskDelegationResumed],
		taskId: z.number().optional(),
	}),

	// Task Execution
	z.object({
		eventName: z.literal(AfxEventName.Message),
		payload: afxEventsSchema.shape[AfxEventName.Message],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskModeSwitched),
		payload: afxEventsSchema.shape[AfxEventName.TaskModeSwitched],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskAskResponded),
		payload: afxEventsSchema.shape[AfxEventName.TaskAskResponded],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.QueuedMessagesUpdated),
		payload: afxEventsSchema.shape[AfxEventName.QueuedMessagesUpdated],
		taskId: z.number().optional(),
	}),

	// Task Analytics
	z.object({
		eventName: z.literal(AfxEventName.TaskToolFailed),
		payload: afxEventsSchema.shape[AfxEventName.TaskToolFailed],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.TaskTokenUsageUpdated),
		payload: afxEventsSchema.shape[AfxEventName.TaskTokenUsageUpdated],
		taskId: z.number().optional(),
	}),

	// Query Responses
	z.object({
		eventName: z.literal(AfxEventName.CommandsResponse),
		payload: afxEventsSchema.shape[AfxEventName.CommandsResponse],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.ModesResponse),
		payload: afxEventsSchema.shape[AfxEventName.ModesResponse],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.ModelsResponse),
		payload: afxEventsSchema.shape[AfxEventName.ModelsResponse],
		taskId: z.number().optional(),
	}),

	// Evals
	z.object({
		eventName: z.literal(AfxEventName.EvalPass),
		payload: z.undefined(),
		taskId: z.number(),
	}),
	z.object({
		eventName: z.literal(AfxEventName.EvalFail),
		payload: z.undefined(),
		taskId: z.number(),
	}),
])

export type TaskEvent = z.infer<typeof taskEventSchema>
