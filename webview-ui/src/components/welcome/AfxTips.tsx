// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Tips section — used by WelcomeViewProvider and ChatView
 */
const TIPS = [
	{ icon: "mention", text: "Use @afx-specs in chat to inject spec context" },
	{ icon: "arrow-right", text: "Right-click a task → dispatch to any agent" },
	{ icon: "link", text: "Add @see annotations for code↔spec traceability" },
	{ icon: "files", text: "Pass files with @file for broader context" },
	{ icon: "terminal", text: "Use /afx-next in chat for context-aware guidance" },
]

const AfxTips = () => {
	return (
		<div className="flex flex-col gap-3">
			<p className="my-0 text-sm font-semibold text-vscode-foreground">Power tips</p>
			<ul className="list-none pl-0 my-0 flex flex-col gap-2.5">
				{TIPS.map(({ icon, text }, i) => (
					<li key={i} className="flex items-start gap-2.5 text-sm text-vscode-descriptionForeground">
						<span
							className={`codicon codicon-${icon} mt-0.5 flex-shrink-0 text-vscode-textLink-foreground`}
							style={{ fontSize: 13 }}
						/>
						<span className="leading-snug text-xs">{text}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

export default AfxTips
