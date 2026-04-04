// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Two-tier config resolution for .afx.yaml files.
 *
 * 1. .afx/.afx.yaml  → managed defaults (overwritten on install/update)
 * 2. .afx.yaml       → user overrides (never overwritten)
 * 3. Hardcoded DEFAULT_AFX_CONFIG as ultimate fallback
 *
 * @see docs/specs/vscode-agenticflowx-core/design.md#configuration
 */

import * as path from "path"
import { access, readFile } from "fs/promises"
import { parse as parseYaml } from "yaml"
import type { AfxConfig, ParsedAfxConfig } from "../models/config"
import { DEFAULT_AFX_CONFIG } from "./default-config"
import { autoDiscoverSpecsDir } from "../models/feature"

export async function parseAfxConfig(configPath: string): Promise<ParsedAfxConfig | undefined> {
	try {
		const content = await readFile(configPath, "utf-8")
		const raw = parseYaml(content)
		if (!raw || typeof raw !== "object") {
			return undefined
		}
		const config = normalizeConfig(raw)
		return config ? { config, rawText: content } : undefined
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return undefined
		}
		return undefined
	}
}

export async function loadEffectiveConfig(workspaceRoot: string): Promise<ParsedAfxConfig> {
	const managedPath = path.join(workspaceRoot, ".afx", ".afx.yaml")
	const userPath = path.join(workspaceRoot, ".afx.yaml")

	const managed = await parseAfxConfig(managedPath)
	const user = await parseAfxConfig(userPath)

	let config: AfxConfig
	let rawText: string

	if (user && managed) {
		config = mergeConfigs(managed.config, user.config)
		rawText = user.rawText
	} else if (user) {
		config = user.config
		rawText = user.rawText
	} else if (managed) {
		config = managed.config
		rawText = managed.rawText
	} else {
		config = { ...DEFAULT_AFX_CONFIG }
		rawText = ""
	}

	// Auto-discovery: if configured specs dir doesn't exist, try well-known paths
	const specsAbsPath = path.join(workspaceRoot, config.paths.specs)
	const specsDirExists = await access(specsAbsPath)
		.then(() => true)
		.catch(() => false)
	if (!specsDirExists) {
		const discovered = await autoDiscoverSpecsDir(workspaceRoot)
		if (discovered) {
			config = { ...config, paths: { ...config.paths, specs: discovered } }
		}
	}

	return { config, rawText }
}

function mergeConfigs(base: AfxConfig, user: AfxConfig): AfxConfig {
	return {
		version: user.version || base.version,
		source: user.source ?? base.source,
		paths: {
			specs: user.paths.specs || base.paths.specs,
			adr: user.paths.adr || base.paths.adr,
			templates: user.paths.templates || base.paths.templates,
			sessions: user.paths.sessions ?? base.paths.sessions,
		},
		features: user.features.length > 0 ? user.features : base.features,
		prefixes: Object.keys(user.prefixes).length > 0 ? { ...base.prefixes, ...user.prefixes } : base.prefixes,
		library: user.library ?? base.library,
		qualityGates: {
			requirePathCheck: user.qualityGates.requirePathCheck || base.qualityGates.requirePathCheck,
			requireHumanApproval: user.qualityGates.requireHumanApproval && base.qualityGates.requireHumanApproval,
			blockOnMockCode: user.qualityGates.blockOnMockCode || base.qualityGates.blockOnMockCode,
		},
		verification: {
			twoStage: user.verification.twoStage && base.verification.twoStage,
			staleThresholdDays: user.verification.staleThresholdDays || base.verification.staleThresholdDays,
		},
		testTraceability: user.testTraceability ?? base.testTraceability,
		anchors: user.anchors ?? base.anchors,
		timeMachine: user.timeMachine ?? base.timeMachine,
		architecture: user.architecture ?? base.architecture,
		logLevel: user.logLevel ?? base.logLevel,
	}
}

function normalizeConfig(raw: Record<string, unknown>): AfxConfig | undefined {
	const paths = raw.paths as Record<string, string> | undefined
	const features = raw.features as string[] | undefined
	const d = DEFAULT_AFX_CONFIG

	const qg = raw.quality_gates as Record<string, boolean> | undefined
	const ver = raw.verification as Record<string, unknown> | undefined
	const tt = raw.test_traceability as Record<string, unknown> | undefined
	const anc = raw.anchors as Record<string, string> | undefined
	const tm = raw.time_machine as Record<string, unknown> | undefined
	const arch = raw.architecture as Record<string, unknown> | undefined

	return {
		version: String(raw.version ?? d.version),
		source: typeof raw.source === "string" ? raw.source : undefined,
		paths: {
			specs: paths?.specs ?? d.paths.specs,
			adr: paths?.adr ?? d.paths.adr,
			templates: paths?.templates ?? d.paths.templates,
			sessions: paths?.sessions,
		},
		features: Array.isArray(features) ? features : [],
		prefixes: (raw.prefixes as Record<string, string>) ?? {},
		library: normalizeLibrary(raw.library ?? raw.context),
		qualityGates: {
			requirePathCheck: qg?.require_path_check ?? d.qualityGates.requirePathCheck,
			requireHumanApproval: qg?.require_human_approval ?? d.qualityGates.requireHumanApproval,
			blockOnMockCode: qg?.block_on_mock_code ?? d.qualityGates.blockOnMockCode,
		},
		verification: {
			twoStage: (ver?.two_stage as boolean) ?? d.verification.twoStage,
			staleThresholdDays: (ver?.stale_threshold_days as number) ?? d.verification.staleThresholdDays,
		},
		testTraceability: tt
			? {
					enabled: (tt.enabled as boolean) ?? false,
					annotation: (tt.annotation as string) ?? "@covers",
				}
			: undefined,
		anchors: anc
			? {
					taskFormat: anc.task_format ?? "",
					sectionFormat: anc.section_format ?? "",
				}
			: undefined,
		timeMachine: tm ? { enabled: (tm.enabled as boolean) ?? false } : undefined,
		architecture: normalizeArchitecture(arch),
		logLevel: ["debug", "info", "warn", "error", "silent"].includes(raw.log_level as string)
			? (raw.log_level as AfxConfig["logLevel"])
			: undefined,
	}
}

function normalizeArchitecture(raw: Record<string, unknown> | undefined): AfxConfig["architecture"] {
	if (!raw) return undefined
	const mermaid = raw.mermaid as Record<string, unknown> | undefined
	const layers = raw.layers as Array<{ name: string; patterns: string[] }> | undefined
	const mono = raw.monorepo as Record<string, string> | undefined
	return {
		enabled: (raw.enabled as boolean) ?? true,
		sourceRoots: Array.isArray(raw.source_roots) ? (raw.source_roots as string[]) : ["src/", "lib/"],
		exclude: Array.isArray(raw.exclude) ? (raw.exclude as string[]) : [],
		mermaid: mermaid
			? {
					theme: (["dark", "default", "forest", "neutral"].includes(mermaid.theme as string)
						? mermaid.theme
						: "dark") as "dark" | "default" | "forest" | "neutral",
					defaultDiagram: (["flow", "er", "sequence"].includes(mermaid.default_diagram as string)
						? mermaid.default_diagram
						: "flow") as "flow" | "er" | "sequence",
					maxNodes: (mermaid.max_nodes as number) ?? 30,
				}
			: undefined,
		layers: Array.isArray(layers) ? layers : undefined,
		monorepo: mono?.packages_glob ? { packagesGlob: mono.packages_glob } : undefined,
	}
}

function normalizeLibrary(raw: unknown): Record<string, string> | undefined {
	if (!raw || typeof raw !== "object") return undefined
	const result: Record<string, string> = {}
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (typeof value === "string") {
			result[key] = value
		}
	}
	return Object.keys(result).length > 0 ? result : undefined
}
