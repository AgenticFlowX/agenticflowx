// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import React from "react"
import { Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

export const IssueFooter: React.FC = () => {
	return (
		<div className="text-xs text-vscode-descriptionForeground p-3">
			<Trans i18nKey="marketplace:footer.issueText">
				<VSCodeLink
					href="https://github.com/agenticflowx/agenticflowx/issues/new?template=marketplace.yml"
					style={{ display: "inline", fontSize: "inherit" }}>
					Open a GitHub issue
				</VSCodeLink>
			</Trans>
		</div>
	)
}
