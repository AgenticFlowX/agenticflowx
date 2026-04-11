// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { useOpenRouterKeyInfo } from "@/components/ui/hooks/use-open-router-key-info"

export const OpenRouterBalanceDisplay = ({ apiKey, baseUrl }: { apiKey: string; baseUrl?: string }) => {
	const { data: keyInfo } = useOpenRouterKeyInfo(apiKey, baseUrl)

	if (!keyInfo || !keyInfo.limit) {
		return null
	}

	const formattedBalance = (keyInfo.limit - keyInfo.usage).toFixed(2)

	return (
		<VSCodeLink href="https://openrouter.ai/settings/keys" className="text-vscode-foreground hover:underline">
			${formattedBalance}
		</VSCodeLink>
	)
}
