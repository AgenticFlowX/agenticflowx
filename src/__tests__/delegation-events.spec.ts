// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

// npx vitest run __tests__/delegation-events.spec.ts

import { AfxEventName, afxEventsSchema, taskEventSchema } from "@agenticflowx/types"

describe("delegation event schemas", () => {
	test("afxEventsSchema validates tuples", () => {
		expect(() => (afxEventsSchema.shape as any)[AfxEventName.TaskDelegated].parse(["p", "c"])).not.toThrow()
		expect(() =>
			(afxEventsSchema.shape as any)[AfxEventName.TaskDelegationCompleted].parse(["p", "c", "s"]),
		).not.toThrow()
		expect(() => (afxEventsSchema.shape as any)[AfxEventName.TaskDelegationResumed].parse(["p", "c"])).not.toThrow()

		// invalid shapes
		expect(() => (afxEventsSchema.shape as any)[AfxEventName.TaskDelegated].parse(["p"])).toThrow()
		expect(() => (afxEventsSchema.shape as any)[AfxEventName.TaskDelegationCompleted].parse(["p", "c"])).toThrow()
		expect(() => (afxEventsSchema.shape as any)[AfxEventName.TaskDelegationResumed].parse(["p"])).toThrow()
	})

	test("taskEventSchema discriminated union includes delegation events", () => {
		expect(() =>
			taskEventSchema.parse({
				eventName: AfxEventName.TaskDelegated,
				payload: ["p", "c"],
				taskId: 1,
			}),
		).not.toThrow()

		expect(() =>
			taskEventSchema.parse({
				eventName: AfxEventName.TaskDelegationCompleted,
				payload: ["p", "c", "s"],
				taskId: 1,
			}),
		).not.toThrow()

		expect(() =>
			taskEventSchema.parse({
				eventName: AfxEventName.TaskDelegationResumed,
				payload: ["p", "c"],
				taskId: 1,
			}),
		).not.toThrow()
	})
})
