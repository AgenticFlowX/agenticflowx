// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

const AfxHero = () => {
	return (
		<div className="flex flex-col gap-2">
			<h1 className="text-2xl font-bold my-0 text-vscode-textLink-foreground">Welcome to AgenticFlowX</h1>
			<p className="text-sm text-vscode-descriptionForeground my-0 leading-relaxed">How can AgenticFlowX help?</p>
			<div className="flex flex-wrap gap-2 mt-2">
				{[
					{ icon: "checklist", label: "Specs" },
					{ icon: "git-merge", label: "Multi-agent" },
					{ icon: "link", label: "Traceability" },
					{ icon: "graph", label: "Dashboard" },
				].map(({ icon, label }) => (
					<span
						key={label}
						className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-vscode-panel-border text-vscode-descriptionForeground bg-vscode-panel-background/50">
						<span className={`codicon codicon-${icon}`} style={{ fontSize: 10 }} />
						{label}
					</span>
				))}
			</div>
		</div>
	)
}

export default AfxHero
