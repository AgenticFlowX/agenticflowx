// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Quick start section — CLI install + examples
 * Used by WelcomeViewProvider (full mode) and ChatView (compact mode)
 *
 * @see docs/specs/afx-examples/spec.md [FR-12]
 * @see docs/specs/afx-examples/design.md [DES-VSCODE]
 */

import { useState } from "react"

import { Button } from "@src/components/ui"

const AFX_REMOTE = "curl -sL https://raw.githubusercontent.com/AgenticFlowX/afx/main/afx-cli | bash -s --"

const EXAMPLES = [
	{ name: "Starter", description: "Sample spec to learn the pattern", command: `${AFX_REMOTE} example starter .` },
	{ name: "Basic", description: "Spec + README + implementation target", command: `${AFX_REMOTE} example basic .` },
	{ name: "Full (FuelSnap)", description: "Complete SDD lifecycle", command: `${AFX_REMOTE} example full .` },
]

const CopyButton = ({ text }: { text: string }) => {
	const [copied, setCopied] = useState(false)
	const handleCopy = () => {
		navigator.clipboard?.writeText(text).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		})
	}
	return (
		<button
			onClick={handleCopy}
			className="cursor-pointer bg-transparent border-none p-0 text-xs text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground transition-colors flex items-center gap-1 flex-shrink-0"
			title="Copy to clipboard">
			<span className={`codicon codicon-${copied ? "check" : "copy"}`} style={{ fontSize: 12 }} />
			{copied ? "Copied" : "Copy"}
		</button>
	)
}

const StepNumber = ({ n }: { n: number }) => (
	<div className="w-5 h-5 rounded-full bg-vscode-textLink-foreground text-vscode-editor-background text-xs font-bold flex items-center justify-center flex-shrink-0">
		{n}
	</div>
)

interface AfxQuickStartProps {
	onSetUpProvider?: () => void
}

const AfxQuickStart = ({ onSetUpProvider }: AfxQuickStartProps) => {
	const [expandedExample, setExpandedExample] = useState<string | null>(null)
	const showProvider = !!onSetUpProvider

	return (
		<div className="flex flex-col gap-3">
			{/* Step 1: Provider — only in Welcome page */}
			{showProvider && (
				<div className="flex gap-3 items-start">
					<StepNumber n={1} />
					<div className="flex flex-col gap-1.5 flex-1">
						<p className="my-0 text-xs font-semibold text-vscode-foreground">Connect an AI provider</p>
						<Button onClick={onSetUpProvider} variant="primary">
							Set Up Provider →
						</Button>
					</div>
				</div>
			)}

			{/* Step 2 (or 1): CLI install */}
			<div className="flex gap-3 items-start">
				<StepNumber n={showProvider ? 2 : 1} />
				<div className="flex flex-col gap-1.5 flex-1">
					<p className="my-0 text-xs font-semibold text-vscode-foreground">Install AFX CLI</p>
					<div className="bg-vscode-panel-background border border-vscode-panel-border rounded-md px-3 py-2">
						<div className="flex items-center justify-between gap-2">
							<span className="text-xs text-vscode-descriptionForeground">Remote command</span>
							<CopyButton text={`${AFX_REMOTE} .`} />
						</div>
						<code className="text-xs text-vscode-foreground break-all block mt-1">$ {AFX_REMOTE} .</code>
					</div>
				</div>
			</div>

			{/* Step 3 (or 2): Examples */}
			<div className="flex gap-3 items-start">
				<StepNumber n={showProvider ? 3 : 2} />
				<div className="flex flex-col gap-1.5 flex-1">
					<p className="my-0 text-xs font-semibold text-vscode-foreground">Try an example</p>
					<div className="flex flex-col gap-1">
						{EXAMPLES.map(({ name, description, command }) => (
							<div key={name}>
								<button
									onClick={() => setExpandedExample(expandedExample === name ? null : name)}
									className="cursor-pointer bg-transparent border-none p-0 w-full text-left flex items-center gap-1.5 text-xs text-vscode-descriptionForeground hover:text-vscode-foreground transition-colors">
									<span
										className={`codicon codicon-chevron-${expandedExample === name ? "down" : "right"}`}
										style={{ fontSize: 10 }}
									/>
									<span className="font-semibold text-vscode-foreground">{name}</span>
									<span>— {description}</span>
								</button>
								{expandedExample === name && (
									<div className="ml-4 mt-1 bg-vscode-panel-background border border-vscode-panel-border rounded-md px-3 py-2">
										<div className="flex items-center justify-between gap-2">
											<span className="text-xs text-vscode-descriptionForeground">
												Remote command
											</span>
											<CopyButton text={command} />
										</div>
										<code className="text-xs text-vscode-foreground break-all block mt-1">
											$ {command}
										</code>
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

export default AfxQuickStart
