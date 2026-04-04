// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import * as React from "react"

interface CodeBlockProps {
	children?: React.ReactNode
	language: string
}

const CodeBlock: React.FC<CodeBlockProps> = () => <div data-testid="mock-code-block">Mocked Code Block</div>

export default CodeBlock
