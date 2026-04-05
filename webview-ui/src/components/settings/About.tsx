// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Trans } from "react-i18next"
import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { type TelemetrySetting } from "@agenticflowx/types"

import { Package } from "@afx/package"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SearchableSetting } from "./SearchableSetting"

/**
 * About section with telemetry opt-in/out checkbox.
 *
 * @see docs/specs/vscode-agenticflowx-clarity/spec.md [FR-1]
 * @see docs/specs/vscode-agenticflowx-clarity/design.md [DES-UI]
 */
type AboutProps = HTMLAttributes<HTMLDivElement> & {
	telemetrySetting: TelemetrySetting
	setTelemetrySetting: (setting: TelemetrySetting) => void
	debug?: boolean
	setDebug?: (debug: boolean) => void
}

export const About = ({ telemetrySetting, setTelemetrySetting, debug, setDebug, className, ...props }: AboutProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>{t("settings:sections.about")}</SectionHeader>

			<Section>
				<p>
					{Package.sha
						? `Version: ${Package.version} (${Package.sha.slice(0, 8)})`
						: `Version: ${Package.version}`}
				</p>
			</Section>

			<Section className="space-y-0">
				<h3>{t("settings:about.contactAndCommunity")}</h3>
				<div className="flex flex-col gap-3">
					<div className="flex items-start gap-2">
						<span className="codicon codicon-bug size-4 text-vscode-descriptionForeground shrink-0" />
						<span>
							{t("settings:about.bugReport.label")}{" "}
							<VSCodeLink href="https://github.com/AgenticFlowX/agenticflowx/issues/new">
								{t("settings:about.bugReport.link")}
							</VSCodeLink>
						</span>
					</div>
					<div className="flex items-start gap-2">
						<span className="codicon codicon-lightbulb size-4 text-vscode-descriptionForeground shrink-0" />
						<span>
							{t("settings:about.featureRequest.label")}{" "}
							<VSCodeLink href="https://github.com/AgenticFlowX/agenticflowx/issues/new">
								{t("settings:about.featureRequest.link")}
							</VSCodeLink>
						</span>
					</div>
					<div className="flex items-start gap-2">
						<span className="codicon codicon-shield size-4 text-vscode-descriptionForeground shrink-0" />
						<span>
							{t("settings:about.securityIssue.label")}{" "}
							<VSCodeLink href="https://github.com/AgenticFlowX/agenticflowx/security/policy">
								{t("settings:about.securityIssue.link")}
							</VSCodeLink>
						</span>
					</div>
					<div className="flex items-start gap-2">
						<span className="codicon codicon-feedback size-4 text-vscode-descriptionForeground shrink-0" />
						<span>
							{t("settings:about.contact.label")}{" "}
							<VSCodeLink href="https://github.com/AgenticFlowX/agenticflowx/discussions">
								GitHub Discussions
							</VSCodeLink>
						</span>
					</div>
					<div className="flex items-start gap-2">
						<span className="codicon codicon-comment-discussion size-4 text-vscode-descriptionForeground shrink-0" />
						<span>
							<Trans
								i18nKey="settings:about.community"
								components={{
									redditLink: (
										<VSCodeLink href="https://github.com/AgenticFlowX/agenticflowx/discussions" />
									),
								}}
							/>
						</span>
					</div>
					{setDebug && (
						<SearchableSetting
							settingId="about-debug-mode"
							section="about"
							label={t("settings:about.debugMode.label")}
							className="mt-4 pt-4 border-t border-vscode-settings-headerBorder">
							<VSCodeCheckbox
								checked={debug ?? false}
								onChange={(e: any) => {
									const checked = e.target.checked === true
									setDebug(checked)
								}}>
								{t("settings:about.debugMode.label")}
							</VSCodeCheckbox>
							<p className="text-vscode-descriptionForeground text-sm mt-0">
								{t("settings:about.debugMode.description")}
							</p>
						</SearchableSetting>
					)}
				</div>
			</Section>

			<Section className="space-y-0">
				<SearchableSetting
					settingId="about-manage-settings"
					section="about"
					label={t("settings:about.manageSettings")}>
					<h3>{t("settings:about.manageSettings")}</h3>
					<div className="flex flex-wrap items-center gap-2">
						<Button onClick={() => vscode.postMessage({ type: "exportSettings" })} className="w-28">
							<span className="codicon codicon-export p-0.5" />
							{t("settings:footer.settings.export")}
						</Button>
						<Button onClick={() => vscode.postMessage({ type: "importSettings" })} className="w-28">
							<span className="codicon codicon-cloud-download p-0.5" />
							{t("settings:footer.settings.import")}
						</Button>
						<Button
							variant="destructive"
							onClick={() => vscode.postMessage({ type: "resetState" })}
							className="w-28">
							<span className="codicon codicon-warning p-0.5" />
							{t("settings:footer.settings.reset")}
						</Button>
					</div>
				</SearchableSetting>
			</Section>

			<Section className="space-y-0">
				<SearchableSetting
					settingId="about-telemetry"
					section="about"
					label={t("settings:footer.telemetry.label")}>
					<VSCodeCheckbox
						checked={telemetrySetting !== "disabled"}
						onChange={(e: any) => {
							const checked = e.target.checked === true
							setTelemetrySetting(checked ? "enabled" : "disabled")
						}}>
						{t("settings:footer.telemetry.label")}
					</VSCodeCheckbox>
					<p className="text-vscode-descriptionForeground text-sm mt-0">
						<Trans
							i18nKey="settings:footer.telemetry.description"
							components={{
								privacyLink: <VSCodeLink href="https://agenticflowx.github.io/privacy" />,
							}}
						/>
					</p>
				</SearchableSetting>
			</Section>
		</div>
	)
}
