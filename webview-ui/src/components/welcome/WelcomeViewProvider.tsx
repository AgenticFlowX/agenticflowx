// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { useCallback, useState } from "react"

import type { ProviderSettings } from "@agenticflowx/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"

import AfxHero from "./AfxHero"
import AfxTips from "./AfxTips"

type ProviderOption = "router" | "custom"

const WelcomeViewProvider = () => {
	const { apiConfiguration, currentApiConfigName, setApiConfiguration, uriScheme } = useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null)

	// Memoize the setApiConfigurationField function to pass to ApiOptions
	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => {
			setApiConfiguration({ [field]: value })
		},
		[setApiConfiguration], // setApiConfiguration from context is stable
	)

	const handleGetStarted = useCallback(() => {
		// Landing screen - go straight to API key setup (no cloud, no router)
		if (selectedProvider === null) {
			setSelectedProvider("custom")
		}
		// Provider Selection screen
		else {
			// Custom provider - validate first
			const error = apiConfiguration ? validateApiConfiguration(apiConfiguration) : undefined

			if (error) {
				setErrorMessage(error)
				return
			}

			setErrorMessage(undefined)
			vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
		}
	}, [selectedProvider, apiConfiguration, currentApiConfigName])

	const handleBackToLanding = useCallback(() => {
		// Return to the landing screen
		setSelectedProvider(null)
		setErrorMessage(undefined)
	}, [])

	// Landing screen - shown when selectedProvider === null
	if (selectedProvider === null) {
		return (
			<Tab>
				<TabContent className="p-4 bg-vscode-sideBar-background flex flex-col gap-3 justify-center">
					{/* Hero card */}
					<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-xl p-5 flex flex-col gap-4">
						<AfxHero />
						<div className="flex gap-2 items-center pt-1">
							<Button onClick={handleGetStarted} variant="primary">
								{t("welcome:landing.getStarted")}
							</Button>
						</div>
					</div>

					{/* Tips card */}
					<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-xl p-5">
						<AfxTips />
					</div>

					{/* Footer link */}
					<div className="text-center">
						<button
							onClick={() => vscode.postMessage({ type: "importSettings" })}
							className="cursor-pointer bg-transparent border-none p-0 text-xs text-vscode-descriptionForeground hover:text-vscode-foreground hover:underline transition-colors">
							{t("welcome:importSettings")}
						</button>
					</div>
				</TabContent>
			</Tab>
		)
	}

	// Provider Selection screen - shown when selectedProvider is "router" or "custom"
	return (
		<Tab>
			<TabContent className="flex flex-col gap-4 p-6 justify-center">
				<span className="codicon codicon-circuit-board size-8" />
				<h2 className="mt-0 mb-0 text-xl">{t("welcome:providerSignup.heading")}</h2>

				<p className="text-base text-vscode-foreground">
					{t("welcome:providerSignup.useAnotherProviderDescription")}
				</p>

				<div>
					<div className="mb-8">
						<ApiOptions
							fromWelcomeView
							apiConfiguration={apiConfiguration || {}}
							uriScheme={uriScheme}
							setApiConfigurationField={setApiConfigurationFieldForApiOptions}
							errorMessage={errorMessage}
							setErrorMessage={setErrorMessage}
						/>
					</div>
				</div>

				<div className="-mt-4 flex gap-2">
					<Button onClick={handleBackToLanding} variant="secondary">
						<span className="codicon codicon-arrow-left size-4" />
						{t("welcome:providerSignup.goBack")}
					</Button>
					<Button onClick={handleGetStarted} variant="primary">
						{t("welcome:providerSignup.finish")} →
					</Button>
				</div>
			</TabContent>
		</Tab>
	)
}

export default WelcomeViewProvider
