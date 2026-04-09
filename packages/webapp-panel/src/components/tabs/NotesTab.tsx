// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useMemo } from "react"
import { useAfxPanel } from "../AfxPanelContext"
import { ResizablePanes } from "../shared/ResizablePanes"
import MarkdownBlock from "@agenticflowx/webapp-core/components/common/MarkdownBlock"
import type { QuickNote } from "../types"

type DateFilter = "all" | "today" | "week" | "month"

function getDateRange(filter: DateFilter): Date | null {
	if (filter === "all") return null
	const now = new Date()
	if (filter === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate())
	if (filter === "week") {
		const d = new Date(now)
		d.setDate(d.getDate() - 7)
		return d
	}
	if (filter === "month") {
		const d = new Date(now)
		d.setMonth(d.getMonth() - 1)
		return d
	}
	return null
}

function NoteCard({ note, onDelete }: { note: QuickNote; onDelete: () => void }) {
	const [hovered, setHovered] = useState(false)
	return (
		<div
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{
				padding: "10px 12px",
				paddingLeft: "20px",
				marginBottom: "4px",
				borderRadius: "6px",
				borderLeft: `3px solid ${hovered ? "var(--afx-design-accent)" : "color-mix(in srgb, var(--afx-design-accent) 40%, transparent)"}`,
				background: hovered ? "var(--afx-surface-hover)" : "var(--afx-surface-bg)",
				fontSize: "12px",
				transition: "background 0.15s, border-color 0.15s",
				position: "relative",
			}}>
			{/* Timeline dot */}
			<span
				style={{
					position: "absolute",
					left: "-1px",
					top: "14px",
					width: "8px",
					height: "8px",
					borderRadius: "50%",
					background: "var(--afx-design-accent)",
					boxShadow: "0 0 6px color-mix(in srgb, var(--afx-design-accent) 40%, transparent)",
					transform: "translateX(-50%)",
				}}
			/>
			{/* Header: time badge + delete */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "4px",
				}}>
				<span
					style={{
						fontSize: "10px",
						fontFamily: "var(--vscode-editor-font-family, monospace)",
						padding: "1px 7px",
						borderRadius: "10px",
						background: "color-mix(in srgb, var(--afx-design-accent) 12%, transparent)",
						color: "var(--afx-design-accent)",
						letterSpacing: "0.3px",
					}}>
					{note.displayTime}
				</span>
				<button
					onClick={(e) => {
						e.stopPropagation()
						onDelete()
					}}
					title="Delete note"
					style={{
						background: "transparent",
						border: "none",
						cursor: "pointer",
						color: "var(--vscode-descriptionForeground)",
						padding: "0 2px",
						opacity: hovered ? 0.6 : 0,
						transition: "opacity 0.15s",
					}}>
					<span className="codicon codicon-close" style={{ fontSize: 12 }} />
				</button>
			</div>
			{/* Note text */}
			<div style={{ fontSize: "12px" }}>
				<MarkdownBlock markdown={note.text} />
			</div>
		</div>
	)
}

export function NotesTab() {
	const { notes, postMessage } = useAfxPanel()
	const [text, setText] = useState("")
	const [textareaFocused, setTextareaFocused] = useState(false)
	const [search, setSearch] = useState("")
	const [dateFilter, setDateFilter] = useState<DateFilter>("all")

	const filtered = useMemo(() => {
		let result = notes
		const cutoff = getDateRange(dateFilter)
		if (cutoff) {
			result = result.filter((n) => new Date(n.timestamp) >= cutoff)
		}
		if (search) {
			const q = search.toLowerCase()
			result = result.filter((n) => n.text.toLowerCase().includes(q))
		}
		return result
	}, [notes, dateFilter, search])

	const uniqueDays = useMemo(() => new Set(notes.map((n) => n.date)).size, [notes])

	function handleSubmit() {
		if (!text.trim()) return
		postMessage({ type: "afxAppendNote", text: text.trim() })
		setText("")
	}

	const inputPane = (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "4px" }}>
			<textarea
				value={text}
				onChange={(e) => setText(e.target.value)}
				onFocus={() => setTextareaFocused(true)}
				onBlur={() => setTextareaFocused(false)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault()
						handleSubmit()
					}
				}}
				placeholder="Quick note... (Enter to save, Shift+Enter for newline)"
				autoFocus
				style={{
					flex: 1,
					padding: "8px",
					fontSize: "12px",
					fontFamily: "inherit",
					background: "var(--vscode-input-background)",
					color: "var(--vscode-input-foreground)",
					border: "1px solid var(--vscode-input-border)",
					borderRadius: "3px",
					resize: "none",
					boxSizing: "border-box",
					borderLeft: textareaFocused
						? "3px solid var(--afx-design-accent)"
						: "3px solid color-mix(in srgb, var(--afx-design-accent) 20%, transparent)",
					boxShadow: textareaFocused
						? "inset 3px 0 12px -4px color-mix(in srgb, var(--afx-design-accent) 15%, transparent)"
						: "none",
					transition: "border-color 0.2s, box-shadow 0.2s",
				}}
			/>
			<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", padding: "4px 0" }}>
				Enter to save · Shift+Enter for newline
			</div>
		</div>
	)

	const timelinePane = (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			{/* Toolbar */}
			<div style={{ padding: "4px", display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
				<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
					<button
						onClick={() => postMessage({ type: "afxOpenFile", path: "" })}
						title="Open in Preview"
						style={{
							background: "transparent",
							border: "none",
							cursor: "pointer",
							padding: "2px",
							color: "var(--vscode-foreground)",
						}}>
						<span className="codicon codicon-eye" style={{ fontSize: 12 }} />
					</button>
					<button
						onClick={() => postMessage({ type: "afxOpenFile", path: "" })}
						title="Open in Editor"
						style={{
							background: "transparent",
							border: "none",
							cursor: "pointer",
							padding: "2px",
							color: "var(--vscode-foreground)",
						}}>
						<span className="codicon codicon-edit" style={{ fontSize: 12 }} />
					</button>
					<div style={{ flex: 1, display: "flex", alignItems: "center", gap: "4px" }}>
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
					<select
						value={dateFilter}
						onChange={(e) => setDateFilter(e.target.value as DateFilter)}
						style={{
							padding: "2px 6px",
							fontSize: "11px",
							background: "var(--vscode-dropdown-background)",
							color: "var(--vscode-dropdown-foreground)",
							border: "1px solid var(--vscode-dropdown-border)",
							borderRadius: "3px",
						}}>
						<option value="all">All</option>
						<option value="today">Today</option>
						<option value="week">This Week</option>
						<option value="month">This Month</option>
					</select>
				</div>
				<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
					{filtered.length} note(s) | {notes.length} total across {uniqueDays} day(s)
				</div>
			</div>

			{/* Notes timeline */}
			<div style={{ flex: 1, overflow: "auto" }}>
				{filtered.length === 0 ? (
					<div
						style={{
							padding: "16px",
							color: "var(--vscode-descriptionForeground)",
							fontSize: "12px",
							textAlign: "center",
						}}>
						{notes.length === 0 ? (
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
								<span className="codicon codicon-note" style={{ fontSize: 20, opacity: 0.25 }} />
								<span>No notes yet</span>
								<span style={{ fontSize: "10px", opacity: 0.5 }}>
									Type in the left box and press Enter. Notes are stored in .afx/notes.md
								</span>
							</div>
						) : (
							"No notes match your filter."
						)}
					</div>
				) : (
					<>
						{groupByDate(filtered).map((group) => (
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
								{group.notes.map((note) => (
									<NoteCard
										key={note.timestamp}
										note={note}
										onDelete={() =>
											postMessage({ type: "afxDeleteNote", timestamp: note.timestamp })
										}
									/>
								))}
							</div>
						))}
					</>
				)}
			</div>
		</div>
	)

	return (
		<div style={{ height: "100%" }}>
			<ResizablePanes
				left={inputPane}
				right={timelinePane}
				defaultLeftWidth={250}
				minLeftWidth={150}
				minRightWidth={200}
			/>
		</div>
	)
}

function groupByDate(notes: QuickNote[]): Array<{ date: string; notes: QuickNote[] }> {
	const groups = new Map<string, QuickNote[]>()
	for (const note of notes) {
		const list = groups.get(note.date) ?? []
		list.push(note)
		groups.set(note.date, list)
	}
	return Array.from(groups.entries())
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([date, notes]) => ({ date, notes }))
}
