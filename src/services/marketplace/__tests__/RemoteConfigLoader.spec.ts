// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

// npx vitest services/marketplace/__tests__/RemoteConfigLoader.spec.ts

import { RemoteConfigLoader } from "../RemoteConfigLoader"
import type { MarketplaceItemType } from "@agenticflowx/types"

describe("RemoteConfigLoader", () => {
	let loader: RemoteConfigLoader

	beforeEach(() => {
		loader = new RemoteConfigLoader()
	})

	describe("loadAllItems", () => {
		it("should return an empty array (remote loading disabled)", async () => {
			const items = await loader.loadAllItems()
			expect(items).toEqual([])
		})
	})

	describe("fetchModes", () => {
		it("should return an empty array", async () => {
			const modes = await loader.fetchModes()
			expect(modes).toEqual([])
		})
	})

	describe("fetchMcps", () => {
		it("should return an empty array", async () => {
			const mcps = await loader.fetchMcps()
			expect(mcps).toEqual([])
		})
	})

	describe("getItem", () => {
		it("should return null for any item", async () => {
			const item = await loader.getItem("any-id", "mode" as MarketplaceItemType)
			expect(item).toBeNull()
		})
	})

	describe("clearCache", () => {
		it("should not throw", () => {
			expect(() => loader.clearCache()).not.toThrow()
		})
	})
})
