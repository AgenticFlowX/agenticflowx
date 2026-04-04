// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { useState } from "react"

export interface UseClipboardProps {
	timeout?: number
}

export function useClipboard({ timeout = 2000 }: UseClipboardProps = {}) {
	const [isCopied, setIsCopied] = useState(false)

	const copy = (value: string) => {
		if (typeof window === "undefined" || !navigator.clipboard?.writeText || !value) {
			return
		}

		navigator.clipboard.writeText(value).then(() => {
			setIsCopied(true)
			setTimeout(() => setIsCopied(false), timeout)
		})
	}

	return { isCopied, copy }
}
