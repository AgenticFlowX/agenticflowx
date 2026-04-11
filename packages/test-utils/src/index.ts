// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

// Re-export the VS Code mock path for use in vitest resolve.alias configs.
// Usage: import { vscodeMockPath } from "@agenticflowx/test-utils"
//        resolve: { alias: { vscode: vscodeMockPath } }

import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const vscodeMockPath = path.resolve(__dirname, "vscode-mock.js")
