// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

// pnpm --filter @agenticflowx/types test src/__tests__/message.test.ts

import { afxAsks, isIdleAsk, isInteractiveAsk, isResumableAsk, isNonBlockingAsk } from "../message.js"

describe("ask messages", () => {
	test("all ask messages are classified", () => {
		for (const ask of afxAsks) {
			expect(
				isIdleAsk(ask) || isInteractiveAsk(ask) || isResumableAsk(ask) || isNonBlockingAsk(ask),
				`${ask} is not classified`,
			).toBe(true)
		}
	})
})
