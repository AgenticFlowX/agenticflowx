// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useMemo } from "react"
import { useAfxPanel } from "../AfxPanelContext"
import { ResizablePanes } from "../shared/ResizablePanes"
import MarkdownBlock from "@src/components/common/MarkdownBlock"
import type { JournalEntry } from "../types"

const STATUS_COLORS: Record<string, string> = {
	active: "var(--afx-status-living)",
	blocked: "var(--afx-status-blocked)",
	closed: "var(--afx-status-approved)",
}

function groupByDate(entries: JournalEntry[]): Array<{ date: string; entries: JournalEntry[] }> {
	const groups = new Map<string, JournalEntry[]>()
	for (const entry of entries) {
		const list = groups.get(entry.date) ?? []
		list.push(entry)
		groups.set(entry.date, list)
	}
	return Array.from(groups.entries())
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([date, entries]) => ({ date, entries }))
}

function JournalCard({
	entry,
	isSelected,
	statusColor,
	onSelect,
}: {
	entry: JournalEntry
	isSelected: boolean
	statusColor: string
	onSelect: () => void
}) {
	const [hovered, setHovered] = useState(false)
	return (
		<div
			onClick={onSelect}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{
				padding: "10px 12px",
				paddingLeft: "20px",
				cursor: "pointer",
				fontSize: "12px",
				marginBottom: "4px",
				borderRadius: "6px",
				borderLeft: `3px solid ${isSelected || hovered ? statusColor : `color-mix(in srgb, ${statusColor} 40%, transparent)`}`,
				background: isSelected
					? "var(--vscode-list-activeSelectionBackground)"
					: hovered
						? "var(--afx-surface-hover)"
						: "var(--afx-surface-bg)",
				color: isSelected ? "var(--vscode-list-activeSelectionForeground)" : "var(--vscode-foreground)",
				transition: "background 0.15s, border-color 0.15s",
				position: "relative",
			}}>
			{/* Dot anchored to border */}
			<span
				style={{
					position: "absolute",
					left: "-1px",
					top: "14px",
					width: "8px",
					height: "8px",
					borderRadius: "50%",
					background: statusColor,
					boxShadow: `0 0 6px ${statusColor}`,
					transform: "translateX(-50%)",
				}}
			/>
			{/* Header: ID + status badge + feature tag */}
			<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
				<span style={{ fontWeight: 600, fontSize: "12px" }}>{entry.id}</span>
				<span
					style={{
						padding: "1px 6px",
						borderRadius: "8px",
						fontSize: "9px",
						fontWeight: 600,
						background: statusColor,
						color: "var(--vscode-badge-foreground)",
						textTransform: "uppercase",
						letterSpacing: "0.3px",
					}}>
					{entry.status}
				</span>
				<span
					style={{
						fontSize: "10px",
						padding: "1px 6px",
						borderRadius: "3px",
						background: "color-mix(in srgb, var(--vscode-descriptionForeground) 12%, transparent)",
						color: "var(--vscode-descriptionForeground)",
					}}>
					{entry.feature}
				</span>
			</div>
			{/* Title */}
			<div
				style={{
					fontSize: "12px",
					fontWeight: 500,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					marginBottom: entry.summary ? "2px" : 0,
				}}>
				{entry.title}
			</div>
			{/* Summary excerpt */}
			{entry.summary && (
				<div
					style={{
						fontSize: "11px",
						color: "var(--vscode-descriptionForeground)",
						display: "-webkit-box",
						WebkitLineClamp: 2,
						WebkitBoxOrient: "vertical",
						overflow: "hidden",
						lineHeight: "1.4",
						marginBottom: entry.decisions && entry.decisions.length > 0 ? "4px" : 0,
					}}>
					{entry.summary}
				</div>
			)}
			{/* Decision chips */}
			{entry.decisions && entry.decisions.length > 0 && (
				<div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "2px" }}>
					{entry.decisions.slice(0, 3).map((d, i) => (
						<span
							key={i}
							style={{
								fontSize: "10px",
								padding: "1px 6px",
								borderRadius: "3px",
								background: "color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent)",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								maxWidth: "200px",
							}}>
							{d}
						</span>
					))}
					{entry.decisions.length > 3 && (
						<span
							style={{
								fontSize: "10px",
								color: "var(--vscode-descriptionForeground)",
								fontStyle: "italic",
							}}>
							+{entry.decisions.length - 3} more
						</span>
					)}
				</div>
			)}
		</div>
	)
}

export function JournalTab() {
	const { journal, postMessage } = useAfxPanel()
	const [search, setSearch] = useState("")
	const [statusFilter, setStatusFilter] = useState<string>("all")
	const [featureFilter, setFeatureFilter] = useState<string>("all")
	const [selected, setSelected] = useState<JournalEntry | null>(null)
	const [previewContent, setPreviewContent] = useState<string | null>(null)

	const features = useMemo(() => [...new Set(journal.map((e) => e.feature))].sort(), [journal])

	const filtered = useMemo(() => {
		let result = journal
		if (statusFilter !== "all") result = result.filter((e) => e.status === statusFilter)
		if (featureFilter !== "all") result = result.filter((e) => e.feature === featureFilter)
		if (search) {
			const q = search.toLowerCase()
			result = result.filter(
				(e) =>
					e.title.toLowerCase().includes(q) ||
					e.id.toLowerCase().includes(q) ||
					e.feature.toLowerCase().includes(q),
			)
		}
		return result
	}, [journal, statusFilter, featureFilter, search])

	const grouped = useMemo(() => groupByDate(filtered), [filtered])

	// Auto-select first visible entry on load or when journal data arrives
	useEffect(() => {
		if (filtered.length > 0 && !selected) {
			// Pick the latest entry (grouped is sorted by date descending)
			const latest = grouped[0]?.entries[0]
			if (latest) setSelected(latest)
		}
	}, [filtered.length, grouped, selected])

	const statusCounts = useMemo(() => {
		const counts = { active: 0, blocked: 0, closed: 0 }
		for (const e of journal) {
			if (e.status in counts) counts[e.status as keyof typeof counts]++
		}
		return counts
	}, [journal])

	// Fetch section content for selected entry
	useEffect(() => {
		if (selected) {
			setPreviewContent(null)
			postMessage({ type: "afxFetchDocContent", filePath: selected.filePath })

			function handleMessage(event: MessageEvent) {
				if (event.data.type === "afxDocContent" && event.data.filePath === selected?.filePath) {
					setPreviewContent(event.data.content)
				}
			}
			window.addEventListener("message", handleMessage)
			return () => window.removeEventListener("message", handleMessage)
		}
	}, [selected, postMessage])

	if (journal.length === 0) {
		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					height: "100%",
					gap: "6px",
					color: "var(--vscode-descriptionForeground)",
					fontSize: "12px",
					padding: "16px",
				}}>
				<span className="codicon codicon-book" style={{ fontSize: 20, opacity: 0.25 }} />
				<span>No journal discussions found</span>
				<span style={{ fontSize: "10px", opacity: 0.5 }}>
					Discussions are stored in docs/specs/*/journal.md
				</span>
			</div>
		)
	}

	const sidebar = (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			{/* Search + filters */}
			<div style={{ padding: "4px", display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
				<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
					<span
						className="codicon codicon-search"
						style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)", flexShrink: 0 }}
					/>
					<input
						type="text"
						placeholder="Search..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						style={{
							flex: 1,
							padding: "2px 6px",
							fontSize: "11px",
							background: "var(--vscode-input-background)",
							color: "var(--vscode-input-foreground)",
							border: "1px solid var(--vscode-input-border)",
							borderRadius: "3px",
						}}
					/>
				</div>
				<div style={{ display: "flex", gap: "4px" }}>
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						style={{
							flex: 1,
							padding: "2px 4px",
							fontSize: "11px",
							background: "var(--vscode-dropdown-background)",
							color: "var(--vscode-dropdown-foreground)",
							border: "1px solid var(--vscode-dropdown-border)",
							borderRadius: "3px",
						}}>
						<option value="all">All status</option>
						<option value="active">Active</option>
						<option value="blocked">Blocked</option>
						<option value="closed">Closed</option>
					</select>
					<select
						value={featureFilter}
						onChange={(e) => setFeatureFilter(e.target.value)}
						style={{
							flex: 1,
							padding: "2px 4px",
							fontSize: "11px",
							background: "var(--vscode-dropdown-background)",
							color: "var(--vscode-dropdown-foreground)",
							border: "1px solid var(--vscode-dropdown-border)",
							borderRadius: "3px",
						}}>
						<option value="all">All features</option>
						{features.map((f) => (
							<option key={f} value={f}>
								{f}
							</option>
						))}
					</select>
				</div>
				{/* Stats */}
				<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", padding: "2px 0" }}>
					{statusCounts.active} active | {statusCounts.blocked} blocked | {statusCounts.closed} closed |{" "}
					{journal.length} total across {features.length} features
				</div>
			</div>

			{/* Timeline */}
			<div style={{ flex: 1, overflow: "auto" }}>
				{grouped.map((group) => (
					<div key={group.date}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--vscode-descriptionForeground)",
								padding: "6px 8px 2px",
							}}>
							{group.date}
							<div
								style={{
									flex: 1,
									height: 1,
									background: "var(--vscode-widget-border)",
									marginLeft: 8,
								}}
							/>
						</div>
						{group.entries.map((entry) => {
							const isSelected = selected?.id === entry.id && selected?.feature === entry.feature
							const statusColor = STATUS_COLORS[entry.status] ?? "var(--vscode-descriptionForeground)"
							return (
								<JournalCard
									key={`${entry.feature}-${entry.id}`}
									entry={entry}
									isSelected={isSelected}
									statusColor={statusColor}
									onSelect={() => setSelected(entry)}
								/>
							)
						})}
					</div>
				))}
			</div>
		</div>
	)

	const preview = (
		<div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
			{selected ? (
				<>
					<div
						style={{
							padding: "8px",
							borderBottom: "1px solid var(--vscode-panel-border)",
							flexShrink: 0,
						}}>
						<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
							<span style={{ fontSize: "13px", fontWeight: 600 }}>
								{selected.id} — {selected.title}
							</span>
							<span
								style={{
									padding: "1px 6px",
									borderRadius: "8px",
									fontSize: "10px",
									background: STATUS_COLORS[selected.status],
									color: "var(--vscode-badge-foreground)",
								}}>
								{selected.status}
							</span>
						</div>
						<div style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)" }}>
							{selected.feature} · {selected.date}
						</div>
					</div>
					<div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
						{selected.context && (
							<div style={{ marginBottom: "8px" }}>
								<div style={{ fontWeight: 600, fontSize: "11px", marginBottom: "2px" }}>Context</div>
								<div style={{ fontSize: "12px" }}>{selected.context}</div>
							</div>
						)}
						{selected.summary && (
							<div style={{ marginBottom: "8px" }}>
								<div style={{ fontWeight: 600, fontSize: "11px", marginBottom: "2px" }}>Summary</div>
								<div style={{ fontSize: "12px" }}>{selected.summary}</div>
							</div>
						)}
						{selected.decisions && selected.decisions.length > 0 && (
							<div style={{ marginBottom: "8px" }}>
								<div style={{ fontWeight: 600, fontSize: "11px", marginBottom: "2px" }}>Decisions</div>
								<ul style={{ margin: "0", paddingLeft: "16px", fontSize: "12px" }}>
									{selected.decisions.map((d, i) => (
										<li key={i}>{d}</li>
									))}
								</ul>
							</div>
						)}
						{previewContent && (
							<div
								style={{
									marginTop: "12px",
									borderTop: "1px solid var(--vscode-panel-border)",
									paddingTop: "8px",
								}}>
								<MarkdownBlock markdown={previewContent.replace(/^---\n[\s\S]*?\n---\n?/, "")} />
							</div>
						)}
					</div>
				</>
			) : (
				<div
					style={{
						flex: 1,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "var(--vscode-descriptionForeground)",
						fontSize: "12px",
					}}>
					Select a discussion to preview
				</div>
			)}
		</div>
	)

	return (
		<div style={{ height: "100%" }}>
			<ResizablePanes left={sidebar} right={preview} defaultLeftWidth={280} />
		</div>
	)
}
