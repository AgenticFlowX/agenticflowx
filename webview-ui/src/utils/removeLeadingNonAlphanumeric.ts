// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

// We need to remove certain leading characters from the path in order for our
// leading ellipses trick to work.
// However, we want to preserve all language characters (including CJK,
// Cyrillic, etc.) and only remove specific punctuation that might interfere
// with the ellipsis display.
//
// Only remove specific punctuation characters that might interfere with
// ellipsis display. Keep all language characters (including CJK, Cyrillic
//  etc.) and numbers.
export const removeLeadingNonAlphanumeric = (path: string): string => path.replace(/^[/\\:*?"<>|]+/, "")
