// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import type { ProviderName, ModelInfo, OrganizationAllowList } from "@agenticflowx/types"

export const filterProviders = (
	providers: Array<{ value: string; label: string }>,
	organizationAllowList?: OrganizationAllowList,
): Array<{ value: string; label: string }> => {
	if (!organizationAllowList || organizationAllowList.allowAll) {
		return providers
	}

	return providers.filter((provider) => {
		const providerConfig = organizationAllowList.providers[provider.value]
		if (!providerConfig) {
			return false
		}

		return providerConfig.allowAll || (providerConfig.models && providerConfig.models.length > 0)
	})
}

export const filterModels = (
	models: Record<string, ModelInfo> | null,
	providerId?: ProviderName,
	organizationAllowList?: OrganizationAllowList,
): Record<string, ModelInfo> | null => {
	if (!models || !organizationAllowList || organizationAllowList.allowAll) {
		return models
	}

	if (!providerId) {
		return {}
	}

	const providerConfig = organizationAllowList.providers[providerId]
	if (!providerConfig) {
		return {}
	}

	if (providerConfig.allowAll) {
		return models
	}

	const allowedModels = providerConfig.models || []
	const filteredModels: Record<string, ModelInfo> = {}

	for (const modelId of allowedModels) {
		if (models[modelId]) {
			filteredModels[modelId] = models[modelId]
		}
	}

	return filteredModels
}
