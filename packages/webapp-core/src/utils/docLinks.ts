// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * Utility for building AgenticFlowX documentation links with UTM telemetry.
 *
 * @param path - The path after the docs root (no leading slash)
 * @param campaign - The UTM campaign context (e.g. "welcome", "provider_docs", "tips", "error_tooltip")
 * @returns The full docs URL with UTM parameters
 */
export function buildDocLink(path: string, campaign: string): string {
	// Remove any leading slash from path
	const cleanPath = path.replace(/^\//, "")
	const [basePath, hash] = cleanPath.split("#")
	const baseUrl = `https://github.com/AgenticFlowX/agenticflowx/wiki/${basePath}?utm_source=extension&utm_medium=ide&utm_campaign=${encodeURIComponent(campaign)}`
	return hash ? `${baseUrl}#${hash}` : baseUrl
}
