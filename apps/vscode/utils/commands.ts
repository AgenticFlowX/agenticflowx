// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import type { CommandId, CodeActionId, TerminalActionId } from "@agenticflowx/types"

import { Package } from "../shared/package"

export const getCommand = (id: CommandId) => `${Package.name}.${id}`

export const getCodeActionCommand = (id: CodeActionId) => `${Package.name}.${id}`

export const getTerminalCommand = (id: TerminalActionId) => `${Package.name}.${id}`
