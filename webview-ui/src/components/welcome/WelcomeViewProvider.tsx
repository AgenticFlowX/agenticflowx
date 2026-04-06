// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * Welcome page — 3-card onboarding layout with collapsible sections
 *
 * @see docs/specs/35-afx-examples/spec.md [FR-12]
 * @see docs/specs/35-afx-examples/design.md [DES-VSCODE]
 */

import { useCallback, useState } from "react"

import type { ProviderSettings } from "@agenticflowx/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"
import AfxQuickStart from "./AfxQuickStart"

const FOUR_FILES = [
	{ icon: "file-code", name: "spec.md", role: "WHAT", desc: "Requirements, acceptance criteria, user stories" },
	{ icon: "tools", name: "design.md", role: "HOW", desc: "Architecture, API contracts, component design" },
	{ icon: "checklist", name: "tasks.md", role: "WHEN", desc: "Implementation tasks, ordering, assignments" },
	{ icon: "book", name: "journal.md", role: "MEMORY", desc: "Decisions, blockers, learnings, session logs" },
]

const VALUE_PROPS = [
	{
		title: "Bidirectional traceability",
		lines: ["Code traces to spec. Spec traces to code.", "Orphaned code is a defect."],
	},
	{
		title: "Agent-agnostic",
		lines: ["Works with Claude, Copilot, Codex, Gemini.", "Dispatch any task to any agent."],
	},
	{
		title: "Auditable by design",
		lines: ["Every change links to a requirement.", "Your codebase has a memory."],
	},
]

const TIPS = [
	{ icon: "mention", text: "Use @afx-specs in chat to inject spec context" },
	{ icon: "arrow-right", text: "Right-click a task → dispatch to any agent" },
	{ icon: "link", text: "Add @see annotations for code↔spec traceability" },
	{ icon: "files", text: "Pass files with @file for broader context" },
	{ icon: "terminal", text: "Use /afx-next in chat for context-aware guidance" },
]

const CollapsibleSection = ({
	title,
	defaultOpen = false,
	children,
}: {
	title: string
	defaultOpen?: boolean
	children: React.ReactNode
}) => {
	const [open, setOpen] = useState(defaultOpen)
	return (
		<div className="flex flex-col">
			<button
				onClick={() => setOpen(!open)}
				className="cursor-pointer bg-transparent border-none p-0 flex items-center gap-1.5 text-sm font-semibold text-vscode-foreground hover:text-vscode-textLink-foreground transition-colors">
				<span className={`codicon codicon-chevron-${open ? "down" : "right"}`} style={{ fontSize: 12 }} />
				{title}
			</button>
			{open && <div className="mt-2">{children}</div>}
		</div>
	)
}

type ProviderOption = "router" | "custom"

const WelcomeViewProvider = () => {
	const { apiConfiguration, currentApiConfigName, setApiConfiguration, uriScheme } = useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null)

	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => {
			setApiConfiguration({ [field]: value })
		},
		[setApiConfiguration],
	)

	const handleGetStarted = useCallback(() => {
		if (selectedProvider === null) {
			setSelectedProvider("custom")
		} else {
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
		setSelectedProvider(null)
		setErrorMessage(undefined)
	}, [])

	// Landing screen
	if (selectedProvider === null) {
		return (
			<Tab>
				<TabContent className="p-4 bg-vscode-sideBar-background flex flex-col gap-3">
					{/* ── Card 1: What is AFX ── */}
					<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-xl p-5 flex flex-col gap-4">
						{/* Hero */}
						<div className="flex flex-col gap-2">
							<h1 className="text-xl font-bold my-0 text-vscode-textLink-foreground">AgenticFlowX</h1>
							<p className="text-sm font-medium my-0 text-vscode-foreground">
								The spec-driven AI coding environment
							</p>
							<p className="text-xs my-0 text-vscode-descriptionForeground leading-relaxed">
								Write the spec. Let agents build it. Every function traces back to a requirement — if it
								doesn&apos;t, it&apos;s a defect.
							</p>
						</div>

						{/* Philosophy strip */}
						<div className="flex justify-between bg-vscode-panel-background/30 rounded-lg px-4 py-3">
							{[
								{ icon: "debug-pause", label: "Pause" },
								{ icon: "lightbulb", label: "Think" },
								{ icon: "tasklist", label: "Plan" },
								{ icon: "rocket", label: "Ship" },
							].map(({ icon, label }) => (
								<div key={label} className="flex flex-col items-center gap-1">
									<span
										className={`codicon codicon-${icon} text-vscode-textLink-foreground`}
										style={{ fontSize: 14 }}
									/>
									<span className="text-xs font-semibold text-vscode-foreground">{label}</span>
								</div>
							))}
						</div>

						{/* Four files — collapsed */}
						<CollapsibleSection title="How spec-driven development works">
							<p className="my-0 mb-2 text-xs text-vscode-descriptionForeground">
								Every feature starts with four files:
							</p>
							<div className="flex flex-col gap-2.5">
								{FOUR_FILES.map(({ icon, name, role, desc }) => (
									<div key={name} className="flex flex-col gap-0.5">
										<div className="flex items-center gap-2">
											<span
												className={`codicon codicon-${icon} text-vscode-textLink-foreground flex-shrink-0`}
												style={{ fontSize: 14 }}
											/>
											<span className="text-xs font-mono font-semibold text-vscode-foreground">
												{name}
											</span>
											<span className="text-xs font-semibold text-vscode-textLink-foreground">
												{role}
											</span>
										</div>
										<p className="my-0 text-xs text-vscode-descriptionForeground pl-6 leading-snug">
											{desc}
										</p>
									</div>
								))}
							</div>
						</CollapsibleSection>

						{/* Why spec-driven — collapsed */}
						<CollapsibleSection title="Why spec-driven?">
							<div className="flex flex-col gap-3">
								{VALUE_PROPS.map(({ title, lines }) => (
									<div key={title} className="flex flex-col gap-0.5">
										<div className="flex items-center gap-2">
											<span
												className="codicon codicon-arrow-right text-vscode-textLink-foreground flex-shrink-0"
												style={{ fontSize: 12 }}
											/>
											<span className="text-xs font-semibold text-vscode-foreground">
												{title}
											</span>
										</div>
										{lines.map((line, i) => (
											<p
												key={i}
												className="my-0 text-xs text-vscode-descriptionForeground pl-5 leading-snug">
												{line}
											</p>
										))}
									</div>
								))}
							</div>
						</CollapsibleSection>
					</div>

					{/* ── Card 2: Quick Start ── */}
					<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-xl p-5 flex flex-col gap-4">
						<p className="my-0 text-sm font-semibold text-vscode-foreground">Quick start</p>
						<AfxQuickStart onSetUpProvider={handleGetStarted} />
					</div>

					{/* ── Card 3: Tips + Telemetry ── */}
					<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-xl p-5 flex flex-col gap-4">
						<CollapsibleSection title="Power tips">
							<ul className="list-none pl-0 my-0 flex flex-col gap-2.5">
								{TIPS.map(({ icon, text }, i) => (
									<li
										key={i}
										className="flex items-start gap-2.5 text-sm text-vscode-descriptionForeground">
										<span
											className={`codicon codicon-${icon} mt-0.5 flex-shrink-0 text-vscode-textLink-foreground`}
											style={{ fontSize: 13 }}
										/>
										<span className="leading-snug text-xs">{text}</span>
									</li>
								))}
							</ul>
						</CollapsibleSection>

						{/* Telemetry */}
						<div className="flex items-start gap-2 text-xs text-vscode-descriptionForeground bg-vscode-panel-background/30 rounded-md px-3 py-2">
							<span className="codicon codicon-info flex-shrink-0 mt-0.5" style={{ fontSize: 12 }} />
							<p className="my-0 leading-snug">
								AgenticFlowX collects error and usage data to help fix bugs and improve the extension.
								This does not collect code, prompts or personal information. You can turn this off in{" "}
								<button
									onClick={() => vscode.postMessage({ type: "switchTab", tab: "settings" })}
									className="cursor-pointer bg-transparent border-none p-0 text-vscode-textLink-foreground hover:underline">
									settings
								</button>
								.
							</p>
						</div>
					</div>

					{/* Footer */}
					<div className="flex justify-center gap-4">
						<button
							onClick={() => vscode.postMessage({ type: "importSettings" })}
							className="cursor-pointer bg-transparent border-none p-0 text-xs text-vscode-descriptionForeground hover:text-vscode-foreground hover:underline transition-colors">
							{t("welcome:importSettings")}
						</button>
						<button
							onClick={() =>
								vscode.postMessage({
									type: "openExternal",
									url: "https://agenticflowx.github.io/agenticflowx/",
								})
							}
							className="cursor-pointer bg-transparent border-none p-0 text-xs text-vscode-descriptionForeground hover:text-vscode-foreground hover:underline transition-colors">
							Documentation
						</button>
					</div>
				</TabContent>
			</Tab>
		)
	}

	// Provider Selection screen
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
