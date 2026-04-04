// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/*
Supported TLA+ structures:
- modules with header, extends, constants, variables
- operator definitions with parameters and bodies
- function definitions with quantifier bounds
- let expressions with operator definitions
- case expressions with multiple arms
- variable and constant declarations
*/
export default `
; Module declarations
(module
  name: (identifier) @name.definition.module) @definition.module

; Operator definitions with optional parameters
(operator_definition
  name: (identifier) @name.definition.operator
  parameter: (identifier)?) @definition.operator

; Function definitions with bounds
(function_definition
  name: (identifier) @name.definition.function
  (quantifier_bound)?) @definition.function

; Variable declarations
(variable_declaration
  (identifier) @name.definition.variable) @definition.variable

; Constant declarations
(constant_declaration
  (identifier) @name.definition.constant) @definition.constant
`
