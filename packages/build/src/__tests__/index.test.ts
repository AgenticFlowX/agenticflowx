// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

// npx vitest run src/__tests__/index.test.ts

import { generatePackageJson } from "../index.js"

describe("generatePackageJson", () => {
	it("should be a test", () => {
		const generatedPackageJson = generatePackageJson({
			packageJson: {
				name: "agenticflowx",
				displayName: "%extension.displayName%",
				description: "%extension.description%",
				publisher: "RooVeterinaryInc",
				version: "3.17.2",
				icon: "assets/icons/icon.png",
				contributes: {
					viewsContainers: {
						activitybar: [
							{
								id: "agenticflowx-ActivityBar",
								title: "%views.activitybar.title%",
								icon: "assets/icons/icon.svg",
							},
						],
					},
					views: {
						"agenticflowx-ActivityBar": [
							{
								type: "webview",
								id: "agenticflowx.SidebarProvider",
								name: "",
							},
						],
					},
					commands: [
						{
							command: "agenticflowx.plusButtonClicked",
							title: "%command.newTask.title%",
							icon: "$(edit)",
						},
						{
							command: "agenticflowx.openInNewTab",
							title: "%command.openInNewTab.title%",
							category: "%configuration.title%",
						},
					],
					menus: {
						"editor/context": [
							{
								submenu: "agenticflowx.contextMenu",
								group: "navigation",
							},
						],
						"agenticflowx.contextMenu": [
							{
								command: "agenticflowx.addToContext",
								group: "1_actions@1",
							},
						],
						"editor/title": [
							{
								command: "agenticflowx.plusButtonClicked",
								group: "navigation@1",
								when: "activeWebviewPanelId == agenticflowx.TabPanelProvider",
							},
							{
								command: "agenticflowx.settingsButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == agenticflowx.TabPanelProvider",
							},
							{
								command: "agenticflowx.accountButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == agenticflowx.TabPanelProvider",
							},
						],
					},
					submenus: [
						{
							id: "agenticflowx.contextMenu",
							label: "%views.contextMenu.label%",
						},
						{
							id: "agenticflowx.terminalMenu",
							label: "%views.terminalMenu.label%",
						},
					],
					configuration: {
						title: "%configuration.title%",
						properties: {
							"agenticflowx.allowedCommands": {
								type: "array",
								items: {
									type: "string",
								},
								default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
								description: "%commands.allowedCommands.description%",
							},
							"agenticflowx.customStoragePath": {
								type: "string",
								default: "",
								description: "%settings.customStoragePath.description%",
							},
						},
					},
				},
				scripts: {
					lint: "eslint **/*.ts",
				},
			},
			overrideJson: {
				name: "agenticflowx-nightly",
				displayName: "AgenticFlowX Nightly",
				publisher: "RooVeterinaryInc",
				version: "0.0.1",
				icon: "assets/icons/icon-nightly.png",
				scripts: {},
			},
			substitution: ["agenticflowx", "agenticflowx-nightly"],
		})

		expect(generatedPackageJson).toStrictEqual({
			name: "agenticflowx-nightly",
			displayName: "AgenticFlowX Nightly",
			description: "%extension.description%",
			publisher: "RooVeterinaryInc",
			version: "0.0.1",
			icon: "assets/icons/icon-nightly.png",
			contributes: {
				viewsContainers: {
					activitybar: [
						{
							id: "agenticflowx-nightly-ActivityBar",
							title: "%views.activitybar.title%",
							icon: "assets/icons/icon.svg",
						},
					],
				},
				views: {
					"agenticflowx-nightly-ActivityBar": [
						{
							type: "webview",
							id: "agenticflowx-nightly.SidebarProvider",
							name: "",
						},
					],
				},
				commands: [
					{
						command: "agenticflowx-nightly.plusButtonClicked",
						title: "%command.newTask.title%",
						icon: "$(edit)",
					},
					{
						command: "agenticflowx-nightly.openInNewTab",
						title: "%command.openInNewTab.title%",
						category: "%configuration.title%",
					},
				],
				menus: {
					"editor/context": [
						{
							submenu: "agenticflowx-nightly.contextMenu",
							group: "navigation",
						},
					],
					"agenticflowx-nightly.contextMenu": [
						{
							command: "agenticflowx-nightly.addToContext",
							group: "1_actions@1",
						},
					],
					"editor/title": [
						{
							command: "agenticflowx-nightly.plusButtonClicked",
							group: "navigation@1",
							when: "activeWebviewPanelId == agenticflowx-nightly.TabPanelProvider",
						},
						{
							command: "agenticflowx-nightly.settingsButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == agenticflowx-nightly.TabPanelProvider",
						},
						{
							command: "agenticflowx-nightly.accountButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == agenticflowx-nightly.TabPanelProvider",
						},
					],
				},
				submenus: [
					{
						id: "agenticflowx-nightly.contextMenu",
						label: "%views.contextMenu.label%",
					},
					{
						id: "agenticflowx-nightly.terminalMenu",
						label: "%views.terminalMenu.label%",
					},
				],
				configuration: {
					title: "%configuration.title%",
					properties: {
						"agenticflowx-nightly.allowedCommands": {
							type: "array",
							items: {
								type: "string",
							},
							default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
							description: "%commands.allowedCommands.description%",
						},
						"agenticflowx-nightly.customStoragePath": {
							type: "string",
							default: "",
							description: "%settings.customStoragePath.description%",
						},
					},
				},
			},
			scripts: {},
		})
	})
})
