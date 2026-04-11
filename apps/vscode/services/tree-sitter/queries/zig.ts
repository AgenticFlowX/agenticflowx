// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

export const zigQuery = `
; Functions
(function_declaration) @function.definition

; Structs and containers
(variable_declaration
  (identifier) @name
  (struct_declaration)
) @container.definition

; Enums
(variable_declaration
  (identifier) @name
  (enum_declaration)
) @container.definition

; Variables and constants
(variable_declaration
  (identifier) @name
) @variable.definition
`
