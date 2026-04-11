// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { ZodError } from "zod"

import {
	type TelemetryClient,
	type TelemetryPropertiesProvider,
	TelemetryEventName,
	type TelemetrySetting,
} from "@agenticflowx/types"

/**
 * Stubbed TelemetryService — all capture methods are no-ops.
 */
export class TelemetryService {
	constructor(private clients: TelemetryClient[]) {}

	public register(_client: TelemetryClient): void {}

	public setProvider(_provider: TelemetryPropertiesProvider): void {}

	public updateTelemetryState(_isOptedIn: boolean): void {}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public captureEvent(_eventName: TelemetryEventName, _properties?: Record<string, any>): void {}

	public captureException(_error: Error, _additionalProperties?: Record<string, unknown>): void {}

	public captureTaskCreated(_taskId: string): void {}

	public captureTaskRestarted(_taskId: string): void {}

	public captureTaskCompleted(_taskId: string): void {}

	public captureConversationMessage(_taskId: string, _source: "user" | "assistant"): void {}

	public captureLlmCompletion(
		_taskId: string,
		_properties: {
			inputTokens: number
			outputTokens: number
			cacheWriteTokens: number
			cacheReadTokens: number
			cost?: number
		},
	): void {}

	public captureModeSwitch(_taskId: string, _newMode: string): void {}

	public captureToolUsage(_taskId: string, _tool: string): void {}

	public captureCheckpointCreated(_taskId: string): void {}

	public captureCheckpointDiffed(_taskId: string): void {}

	public captureCheckpointRestored(_taskId: string): void {}

	public captureContextCondensed(_taskId: string, _isAutomaticTrigger: boolean, _usedCustomPrompt?: boolean): void {}

	public captureSlidingWindowTruncation(_taskId: string): void {}

	public captureCodeActionUsed(_actionType: string): void {}

	public capturePromptEnhanced(_taskId?: string): void {}

	public captureSchemaValidationError(_params: { schemaName: string; error: ZodError }): void {}

	public captureDiffApplicationError(_taskId: string, _consecutiveMistakeCount: number): void {}

	public captureShellIntegrationError(_taskId: string): void {}

	public captureConsecutiveMistakeError(_taskId: string): void {}

	public captureTabShown(_tab: string): void {}

	public captureModeSettingChanged(_settingName: string): void {}

	public captureCustomModeCreated(_modeSlug: string, _modeName: string): void {}

	public captureMarketplaceItemInstalled(
		_itemId: string,
		_itemType: string,
		_itemName: string,
		_target: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		_properties?: Record<string, any>,
	): void {}

	public captureMarketplaceItemRemoved(
		_itemId: string,
		_itemType: string,
		_itemName: string,
		_target: string,
	): void {}

	public captureTitleButtonClicked(_button: string): void {}

	public captureTelemetrySettingsChanged(_previousSetting: TelemetrySetting, _newSetting: TelemetrySetting): void {}

	public isTelemetryEnabled(): boolean {
		return false
	}

	public async shutdown(): Promise<void> {}

	private static _instance: TelemetryService | null = null

	static createInstance(clients: TelemetryClient[] = []) {
		if (this._instance) {
			throw new Error("TelemetryService instance already created")
		}
		this._instance = new TelemetryService(clients)
		return this._instance
	}

	static get instance() {
		if (!this._instance) {
			throw new Error("TelemetryService not initialized")
		}
		return this._instance
	}

	static hasInstance(): boolean {
		return this._instance !== null
	}
}
