// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { type MarketplaceItem, type MarketplaceItemType } from "@agenticflowx/types"

export class RemoteConfigLoader {
	async loadAllItems(_hideMarketplaceMcps = false): Promise<MarketplaceItem[]> {
		return []
	}

	async fetchModes(): Promise<MarketplaceItem[]> {
		return []
	}

	async fetchMcps(): Promise<MarketplaceItem[]> {
		return []
	}

	async getItem(_id: string, _type: MarketplaceItemType): Promise<MarketplaceItem | null> {
		return null
	}

	clearCache(): void {
		// No-op — remote config loading is disabled
	}
}
