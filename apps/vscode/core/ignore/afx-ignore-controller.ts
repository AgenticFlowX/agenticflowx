// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Re-export from @agenticflowx/ignore package.
// Consumers within apps/vscode/ can continue importing from this path.

export { AfxIgnoreController, LOCK_TEXT_SYMBOL } from "@agenticflowx/ignore"
export { createVscodeFileWatcher } from "./create-vscode-file-watcher.js"
