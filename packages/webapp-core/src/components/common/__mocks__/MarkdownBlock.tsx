// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import * as React from "react"

interface MarkdownBlockProps {
	children?: React.ReactNode
	content?: string
}

const MarkdownBlock: React.FC<MarkdownBlockProps> = ({ content }) => (
	<div data-testid="mock-markdown-block">{content}</div>
)

export default MarkdownBlock
