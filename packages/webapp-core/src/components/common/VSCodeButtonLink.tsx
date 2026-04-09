// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import React from "react"
import { Button } from "@src/components/ui"

interface VSCodeButtonLinkProps {
	href: string
	children: React.ReactNode
	appearance?: "primary" | "secondary"
	[key: string]: any
}

export const VSCodeButtonLink = ({ href, children, appearance, ...props }: VSCodeButtonLinkProps) => {
	// Map appearance to variant for the new Button component
	const variant = appearance === "primary" ? "primary" : appearance === "secondary" ? "secondary" : undefined

	return (
		<a
			href={href}
			style={{
				textDecoration: "none",
				color: "inherit",
			}}>
			<Button variant={variant} {...props}>
				{children}
			</Button>
		</a>
	)
}
