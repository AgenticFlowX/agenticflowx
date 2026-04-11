// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { useRequestyKeyInfo } from "@/components/ui/hooks/use-requesty-key-info"
import { toRequestyServiceUrl } from "@afx/utils/requesty"

type RequestyBalanceDisplayProps = {
	apiKey: string
	baseUrl?: string
}

export const RequestyBalanceDisplay = ({ baseUrl, apiKey }: RequestyBalanceDisplayProps) => {
	const { data: keyInfo } = useRequestyKeyInfo(baseUrl, apiKey)

	if (!keyInfo) {
		return null
	}

	// Parse the balance to a number and format it to 2 decimal places.
	const balance = parseFloat(keyInfo.org_balance)
	const formattedBalance = balance.toFixed(2)

	const resolvedBaseUrl = toRequestyServiceUrl(baseUrl, "app")
	const settingsUrl = new URL("settings", resolvedBaseUrl)

	return (
		<VSCodeLink href={settingsUrl.toString()} className="text-vscode-foreground hover:underline">
			${formattedBalance}
		</VSCodeLink>
	)
}
