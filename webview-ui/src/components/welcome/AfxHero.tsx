// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Hero section — product identity and tagline
 * Used by WelcomeViewProvider and ChatView
 *
 * @see docs/specs/afx-examples/spec.md [FR-12]
 * @see docs/specs/afx-examples/design.md [DES-VSCODE]
 */
const AfxHero = () => {
	return (
		<div className="flex flex-col gap-2">
			<h1 className="text-xl font-bold my-0 text-vscode-textLink-foreground">AgenticFlowX</h1>
			<p className="text-sm font-medium my-0 text-vscode-foreground">The spec-driven AI coding environment</p>
			<p className="text-xs my-0 text-vscode-descriptionForeground leading-relaxed">
				Write the spec. Let agents build it. Every function traces back to a requirement — if it doesn&apos;t,
				it&apos;s a defect.
			</p>
		</div>
	)
}

export default AfxHero
