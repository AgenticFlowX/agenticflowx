// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import React from "react"
import { useTranslation } from "react-i18next"
import { Package } from "@afx/package"

interface VersionIndicatorProps {
	onClick: () => void
	className?: string
}

const VersionIndicator: React.FC<VersionIndicatorProps> = ({ onClick, className = "" }) => {
	const { t } = useTranslation()

	return (
		<button
			onClick={onClick}
			className={`text-xs text-vscode-descriptionForeground rounded-full hover:text-vscode-foreground transition-colors cursor-pointer px-2 py-1 border ${className}`}
			aria-label={t("chat:versionIndicator.ariaLabel", { version: Package.version })}>
			v{Package.version}
		</button>
	)
}

export default VersionIndicator
