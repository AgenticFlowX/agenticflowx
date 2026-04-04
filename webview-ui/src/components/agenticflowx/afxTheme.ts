// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * AFX theme palette system — defines dark/light palettes as CSS custom properties.
 *
 * @see docs/research/vscode-agenticflowx/res-v2-style-refresh.md#theme-support
 */

import { useEffect, useRef, useState } from "react"

// ── Palette tokens ──────────────────────────────────────────────

export interface AfxPalette {
	"--afx-spec-accent": string
	"--afx-design-accent": string
	"--afx-tasks-accent": string
	"--afx-sessions-accent": string
	"--afx-status-approved": string
	"--afx-status-living": string
	"--afx-status-draft": string
	"--afx-status-blocked": string
	"--afx-status-error": string
	"--afx-tint-opacity": string
	"--afx-glow-opacity": string
	"--afx-gradient-from": string
	"--afx-gradient-to": string
	"--afx-surface-bg": string
	"--afx-surface-border": string
	"--afx-surface-hover": string
}

export const darkPalette: AfxPalette = {
	"--afx-spec-accent": "#c586c0",
	"--afx-design-accent": "#7c3aed",
	"--afx-tasks-accent": "#ffa726",
	"--afx-sessions-accent": "#66bb6a",
	"--afx-status-approved": "#22c55e",
	"--afx-status-living": "#7c3aed",
	"--afx-status-draft": "#6b7280",
	"--afx-status-blocked": "#f59e0b",
	"--afx-status-error": "#ef4444",
	"--afx-tint-opacity": "0.15",
	"--afx-glow-opacity": "0.4",
	"--afx-gradient-from": "rgba(37,99,235,0.04)",
	"--afx-gradient-to": "rgba(124,58,237,0.04)",
	"--afx-surface-bg": "color-mix(in srgb, var(--vscode-editor-background) 85%, black)",
	"--afx-surface-border": "color-mix(in srgb, var(--vscode-panel-border) 80%, transparent)",
	"--afx-surface-hover": "color-mix(in srgb, var(--vscode-editor-background) 80%, black)",
}

export const lightPalette: AfxPalette = {
	"--afx-spec-accent": "#a94da0",
	"--afx-design-accent": "#6527be",
	"--afx-tasks-accent": "#e68a00",
	"--afx-sessions-accent": "#3d8b40",
	"--afx-status-approved": "#16a34a",
	"--afx-status-living": "#6527be",
	"--afx-status-draft": "#9ca3af",
	"--afx-status-blocked": "#d97706",
	"--afx-status-error": "#dc2626",
	"--afx-tint-opacity": "0.10",
	"--afx-glow-opacity": "0.25",
	"--afx-gradient-from": "rgba(37,99,235,0.03)",
	"--afx-gradient-to": "rgba(124,58,237,0.03)",
	"--afx-surface-bg": "color-mix(in srgb, var(--vscode-editor-background) 92%, black)",
	"--afx-surface-border": "color-mix(in srgb, var(--vscode-panel-border) 80%, transparent)",
	"--afx-surface-hover": "color-mix(in srgb, var(--vscode-editor-background) 88%, black)",
}

// ── Theme detection ─────────────────────────────────────────────

/** Detect light/dark from VS Code's body class (vscode-light / vscode-dark / vscode-high-contrast) */
function detectIsLight(): boolean {
	return /\bvscode-light\b|\bvscode-high-contrast-light\b/i.test(document.body.className)
}

export function getAfxPalette(isLight: boolean): AfxPalette {
	return isLight ? lightPalette : darkPalette
}

// ── Hook: apply palette as CSS custom properties ────────────────

/**
 * Returns a ref to attach to the panel root element.
 * Automatically detects VS Code theme changes and applies the matching palette.
 */
export function useAfxTheme() {
	const panelRef = useRef<HTMLDivElement>(null)
	const [isLight, setIsLight] = useState(detectIsLight)

	// Observe body class changes (VS Code updates it on theme switch)
	useEffect(() => {
		const observer = new MutationObserver(() => {
			setIsLight(detectIsLight())
		})
		observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })
		return () => observer.disconnect()
	}, [])

	// Apply palette tokens as CSS custom properties
	useEffect(() => {
		const el = panelRef.current
		if (!el) return
		const palette = getAfxPalette(isLight)
		for (const [key, value] of Object.entries(palette)) {
			el.style.setProperty(key, value)
		}
	}, [isLight])

	return { panelRef, isLight }
}

// ── Shared styles ───────────────────────────────────────────────

/** Surface container style for section elevation */
export const surfaceStyle: React.CSSProperties = {
	background: "var(--afx-surface-bg)",
	border: "1px solid var(--afx-surface-border)",
	borderRadius: "6px",
	padding: "12px",
	marginBottom: "8px",
}
