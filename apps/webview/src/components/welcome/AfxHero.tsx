// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Hero section — product identity and tagline, with optional feature picker.
 * Hero banner always visible. When recent features exist, picker renders below tagline.
 *
 * @see docs/specs/35-afx-examples/spec.md [FR-12]
 * @see docs/specs/35-afx-examples/design.md [DES-VSCODE]
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/spec.md [FR-14] [FR-19] [FR-33]
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI]
 */

import React from "react"

import { vscode } from "@src/utils/vscode"

import { FeaturePickerCard, type FeatureSummary } from "./FeaturePickerCard"

interface AfxHeroProps {
	recentFeatures?: FeatureSummary[]
}

const AfxHero: React.FC<AfxHeroProps> = ({ recentFeatures }) => {
	const hasFeatures = recentFeatures && recentFeatures.length > 0

	return (
		<div className="flex flex-col gap-2">
			<h1 className="text-sm @[250px]:text-base @[350px]:text-lg font-bold my-0 text-vscode-textLink-foreground">
				AgenticFlowX
			</h1>
			<p className="text-sm font-medium my-0 text-vscode-foreground hidden @[350px]:block">
				The spec-driven AI coding environment
			</p>
			{!hasFeatures && (
				<>
					<p className="text-xs my-0 text-vscode-descriptionForeground leading-relaxed">
						Write the spec. Let agents build it. Every function traces back to a requirement — if it
						doesn&apos;t, it&apos;s a defect.
					</p>
					<button
						className="text-xs text-vscode-textLink-foreground hover:underline text-left mt-1"
						onClick={() => {
							vscode.postMessage({
								type: "newTask",
								text: "/afx-scaffold spec help me create my first spec",
							})
						}}>
						&#x2726; Create your first spec &rarr;
					</button>
				</>
			)}
			{hasFeatures && (
				<FeaturePickerCard
					features={recentFeatures}
					onFeatureClick={(feature) => {
						vscode.postMessage({ type: "openFeatureFiles", feature })
					}}
					onNewFeature={() => {
						vscode.postMessage({
							type: "newTask",
							text: "/afx-scaffold spec help me create my first spec",
						})
					}}
				/>
			)}
		</div>
	)
}

export default AfxHero
