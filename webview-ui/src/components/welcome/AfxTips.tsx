// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

const TIPS = [
	{ icon: "mention", text: "Use @afx-specs in chat to inject spec context" },
	{ icon: "arrow-right", text: <>Right-click a task → dispatch to any agent</> },
	{ icon: "link", text: "Add @see annotations for code↔spec traceability" },
	{
		icon: "files",
		text: (
			<>
				Pass files with <code className="text-xs bg-vscode-textCodeBlock-background px-1 rounded">@file</code>{" "}
				for broader context
			</>
		),
	},
]

const AfxTips = () => {
	return (
		<div className="flex flex-col gap-3">
			<p className="my-0 text-sm font-semibold text-vscode-foreground">Tips for getting started</p>
			<ul className="list-none pl-0 my-0 flex flex-col gap-2.5">
				{TIPS.map(({ icon, text }, i) => (
					<li key={i} className="flex items-start gap-2.5 text-sm text-vscode-descriptionForeground">
						<span
							className={`codicon codicon-${icon} mt-0.5 flex-shrink-0 text-vscode-textLink-foreground`}
							style={{ fontSize: 13 }}
						/>
						<span className="leading-snug">{text}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

export default AfxTips
