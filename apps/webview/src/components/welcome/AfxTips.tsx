// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tips section — used by WelcomeViewProvider and ChatView
 */

import { vscode } from "@src/utils/vscode"

export const TIPS: { icon: string; text: string; url?: string; urlLabel?: string }[] = [
	{ icon: "filter", text: "Switch to Focus track in the mode dropdown for lean, spec-focused prompts" },
	{ icon: "dashboard", text: "Open the AFX Panel for spec health, task board, and pipeline views" },
	{
		icon: "book",
		text: "Spec-Driven Development — write the spec, let agents build it.",
		url: "https://github.com/agenticFlowX/afx",
		urlLabel: "Learn more",
	},
]

const AfxTips = () => {
	return (
		<div className="flex flex-col gap-3">
			<p className="my-0 text-sm font-semibold text-vscode-foreground">Tips</p>
			<ul className="list-none pl-0 my-0 flex flex-col gap-2.5">
				{TIPS.map(({ icon, text, url, urlLabel }, i) => (
					<li key={i} className="flex items-start gap-2.5 text-sm text-vscode-descriptionForeground">
						<span
							className={`codicon codicon-${icon} mt-0.5 flex-shrink-0 text-vscode-textLink-foreground`}
							style={{ fontSize: 13 }}
						/>
						<span className="leading-snug text-xs">
							{text}
							{url && (
								<>
									{" "}
									<button
										onClick={() => vscode.postMessage({ type: "openExternal", url })}
										className="cursor-pointer bg-transparent border-none p-0 text-vscode-textLink-foreground hover:underline text-xs">
										{urlLabel ?? url}
									</button>
								</>
							)}
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}

export default AfxTips
