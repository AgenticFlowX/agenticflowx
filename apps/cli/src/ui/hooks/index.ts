// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

// Export existing hooks
export { TerminalSizeProvider, useTerminalSize } from "./TerminalSizeContext.js"
export { useToast, useToastStore } from "./use-toast.js"
export { useInputHistory } from "./use-input-history.js"

// Export new extracted hooks
export { useFollowupCountdown } from "./use-followup-countdown.js"
export { useFocusManagement } from "./use-focus-management.js"
export { useMessageHandlers } from "./use-message-handlers.js"
export { useExtensionHost } from "./use-extension-host.js"
export { useTaskSubmit } from "./use-task-submit.js"
export { useGlobalInput } from "./use-global-input.js"
export { usePickerHandlers } from "./use-picker-handlers.js"

// Export types
export type { UseFollowupCountdownOptions } from "./use-followup-countdown.js"
export type { UseFocusManagementOptions, UseFocusManagementReturn } from "./use-focus-management.js"
export type { UseMessageHandlersOptions, UseMessageHandlersReturn } from "./use-message-handlers.js"
export type { UseExtensionHostOptions, UseExtensionHostReturn } from "./use-extension-host.js"
export type { UseTaskSubmitOptions, UseTaskSubmitReturn } from "./use-task-submit.js"
export type { UseGlobalInputOptions } from "./use-global-input.js"
export type { UsePickerHandlersOptions, UsePickerHandlersReturn } from "./use-picker-handlers.js"
