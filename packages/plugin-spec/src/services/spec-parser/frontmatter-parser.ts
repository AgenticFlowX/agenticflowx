// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import matter from "gray-matter"
import type { Frontmatter } from "../../models/spec-document.js"

export function parseFrontmatter(content: string, _filePath: string): Frontmatter {
	try {
		const { data } = matter(content)
		return {
			afx: data.afx === true,
			type: typeof data.type === "string" ? data.type : undefined,
			status: typeof data.status === "string" ? data.status : undefined,
			owner: typeof data.owner === "string" ? data.owner : undefined,
			tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
			version: data.version,
			description: typeof data.description === "string" ? data.description : undefined,
			last_verified: typeof data.last_verified === "string" ? data.last_verified : undefined,
		}
	} catch {
		return {}
	}
}
