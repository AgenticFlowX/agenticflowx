// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { Box, Text } from "ink"
import { Select } from "@inkjs/ui"

import { OnboardingProviderChoice } from "@/types/index.js"

export interface OnboardingScreenProps {
	onSelect: (choice: OnboardingProviderChoice) => void
}

export function OnboardingScreen({ onSelect }: OnboardingScreenProps) {
	return (
		<Box flexDirection="column" gap={1}>
			<Text bold color="cyan">
				AgenticFlowX
			</Text>
			<Text dimColor>Welcome! How would you like to connect to an LLM provider?</Text>
			<Select
				options={[{ label: "Bring your own API key", value: OnboardingProviderChoice.Byok }]}
				onChange={(value: string) => {
					onSelect(value as OnboardingProviderChoice)
				}}
			/>
		</Box>
	)
}
