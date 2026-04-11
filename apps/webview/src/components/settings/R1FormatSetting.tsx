// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { Checkbox } from "vscrui"

import { useAppTranslation } from "@/i18n/TranslationContext"

interface R1FormatSettingProps {
	onChange: (value: boolean) => void
	openAiR1FormatEnabled?: boolean
}

export const R1FormatSetting = ({ onChange, openAiR1FormatEnabled }: R1FormatSettingProps) => {
	const { t } = useAppTranslation()

	return (
		<div>
			<div className="flex items-center gap-2">
				<Checkbox checked={openAiR1FormatEnabled} onChange={onChange}>
					<span className="font-medium">{t("settings:modelInfo.enableR1Format")}</span>
				</Checkbox>
			</div>
			<p className="text-vscode-descriptionForeground text-sm mt-0">
				{t("settings:modelInfo.enableR1FormatTips")}
			</p>
		</div>
	)
}
