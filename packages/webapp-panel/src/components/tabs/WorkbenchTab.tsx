// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useCallback } from "react"
import { useAfxPanel } from "../AfxPanelContext"
import MarkdownBlock from "@agenticflowx/webapp-core/components/common/MarkdownBlock"
import { surfaceStyle } from "../afxTheme"

type ColumnId = "spec" | "design" | "tasks" | "sessions"
type ViewMode = "preview" | "edit" | "editor"

interface ColumnConfig {
	id: ColumnId
	label: string
	docKey: "spec" | "design" | "tasks" | "tasks" // sessions uses tasks doc
}

const COLUMN_ACCENT: Record<ColumnId, string> = {
	spec: "var(--afx-spec-accent)",
	design: "var(--afx-design-accent)",
	tasks: "var(--afx-tasks-accent)",
	sessions: "var(--afx-sessions-accent)",
}

const COLUMNS: ColumnConfig[] = [
	{ id: "spec", label: "SPEC", docKey: "spec" },
	{ id: "design", label: "DESIGN", docKey: "design" },
	{ id: "tasks", label: "TASKS", docKey: "tasks" },
	{ id: "sessions", label: "SESSIONS", docKey: "tasks" },
]

const defaultVisible: Record<ColumnId, boolean> = {
	spec: false,
	design: false,
	tasks: true,
	sessions: true,
}

export function WorkbenchTab() {
	const { featureTasks, pipeline, postMessage } = useAfxPanel()
	const [selectedIdx, setSelectedIdx] = useState(0)
	const [visible, setVisible] = useState<Record<ColumnId, boolean>>(defaultVisible)
	const [viewModes, setViewModes] = useState<Record<ColumnId, ViewMode>>({
		spec: "preview",
		design: "preview",
		tasks: "preview",
		sessions: "preview",
	})
	const [docContents, setDocContents] = useState<Record<string, string>>({})
	const [showHint, setShowHint] = useState(true)
	const [editBuffers, setEditBuffers] = useState<Record<string, string>>({})

	const feature = featureTasks[selectedIdx]
	const pipelineRow = pipeline[selectedIdx]

	// Request doc content from extension
	const requestDocContent = useCallback(
		(filePath: string) => {
			if (!docContents[filePath]) {
				postMessage({ type: "afxFetchDocContent", filePath })
			}
		},
		[docContents, postMessage],
	)

	// Listen for doc content responses
	useState(() => {
		function handleMessage(event: MessageEvent) {
			const msg = event.data
			if (msg.type === "afxDocContent" && msg.filePath) {
				setDocContents((prev) => ({ ...prev, [msg.filePath]: msg.content }))
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	})

	if (featureTasks.length === 0) {
		return (
			<div style={{ color: "var(--vscode-descriptionForeground)", padding: "16px", fontSize: "12px" }}>
				No features with tasks found. Create specs in <code>docs/specs/</code> to get started.
			</div>
		)
	}

	const toggleColumn = (id: ColumnId) => {
		setVisible((prev) => ({ ...prev, [id]: !prev[id] }))
	}

	const setViewMode = (id: ColumnId, mode: ViewMode) => {
		if (mode === "editor") {
			const path = getDocPath(id)
			if (path) postMessage({ type: "afxOpenFile", path })
			return
		}
		setViewModes((prev) => ({ ...prev, [id]: mode }))
	}

	const getDocPath = (colId: ColumnId): string | undefined => {
		if (!pipelineRow) return undefined
		if (colId === "spec") return pipelineRow.specPath
		if (colId === "design") return pipelineRow.designPath
		if (colId === "tasks" || colId === "sessions") return pipelineRow.tasksPath
		return undefined
	}

	const getDocStatus = (colId: ColumnId): string => {
		if (!pipelineRow) return ""
		if (colId === "spec") return pipelineRow.specStatus
		if (colId === "design") return pipelineRow.designStatus
		if (colId === "tasks") return `${feature?.completed ?? 0}/${feature?.total ?? 0}`
		if (colId === "sessions") return `(${feature?.workSessions.length ?? 0})`
		return ""
	}

	const visibleColumns = COLUMNS.filter((c) => visible[c.id])

	const handleToggleTask = (line: number, completed: boolean) => {
		if (feature?.tasksPath) {
			postMessage({ type: "afxToggleTask", path: feature.tasksPath, line, completed: !completed })
		}
	}

	const handleSaveEdit = (colId: ColumnId) => {
		const path = getDocPath(colId)
		const content = editBuffers[colId]
		if (path && content !== undefined) {
			postMessage({ type: "afxSaveFile", path, content })
			setViewModes((prev) => ({ ...prev, [colId]: "preview" }))
		}
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			{/* Header: Feature selector + column toggles */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "10px",
					padding: "6px 0",
					borderBottom: "1px solid var(--vscode-panel-border)",
					flexShrink: 0,
					flexWrap: "wrap",
				}}>
				<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
					<span style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)" }}>Feature:</span>
					<select
						value={selectedIdx}
						onChange={(e) => setSelectedIdx(Number(e.target.value))}
						style={{
							background: "var(--vscode-dropdown-background)",
							color: "var(--vscode-dropdown-foreground)",
							border: "1px solid var(--vscode-dropdown-border)",
							padding: "2px 6px",
							fontSize: "12px",
							borderRadius: "3px",
						}}>
						{featureTasks.map((ft, i) => (
							<option key={ft.name} value={i}>
								{ft.name} ({ft.completed}/{ft.total})
							</option>
						))}
					</select>
				</div>

				{/* Progress indicator */}
				{feature && feature.total > 0 && (
					<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
						<div
							style={{
								width: "60px",
								height: "4px",
								background: "var(--vscode-panel-border)",
								borderRadius: "2px",
								overflow: "hidden",
							}}>
							<div
								style={{
									width: `${Math.round((feature.completed / feature.total) * 100)}%`,
									height: "100%",
									background: "var(--afx-status-approved)",
									borderRadius: "2px",
									transition: "width 0.3s",
								}}
							/>
						</div>
						<span style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
							{Math.round((feature.completed / feature.total) * 100)}%
						</span>
					</div>
				)}

				{/* Column toggles — pill shape matching sidebar pattern */}
				<div style={{ display: "flex", gap: "5px", marginLeft: "auto" }}>
					{COLUMNS.map((col) => {
						const accent = COLUMN_ACCENT[col.id]
						const status = getDocStatus(col.id)
						const isActive = visible[col.id]
						return (
							<button
								key={col.id}
								onClick={() => toggleColumn(col.id)}
								style={{
									padding: "3px 10px",
									fontSize: "11px",
									border: isActive ? `1px solid ${accent}` : "1px solid var(--vscode-panel-border)",
									borderRadius: "16px",
									cursor: "pointer",
									background: isActive
										? `color-mix(in srgb, ${accent} 12%, transparent)`
										: "transparent",
									color: isActive ? accent : "var(--vscode-descriptionForeground)",
									fontWeight: isActive ? 600 : 400,
									display: "flex",
									alignItems: "center",
									gap: "5px",
									transition: "all 0.15s",
									opacity: isActive ? 1 : 0.6,
								}}>
								{isActive ? (
									<span className="codicon codicon-pass" style={{ fontSize: 10 }} />
								) : (
									<span className="codicon codicon-circle-outline" style={{ fontSize: 10 }} />
								)}
								{col.label}
								{(col.id === "tasks" || col.id === "sessions") && status && (
									<span style={{ fontSize: "9px", fontWeight: 400, opacity: 0.7 }}>{status}</span>
								)}
							</button>
						)
					})}
				</div>
			</div>

			{/* Hint bar */}
			{showHint && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "5px 10px",
						background: "color-mix(in srgb, var(--afx-design-accent) 8%, transparent)",
						border: "1px solid color-mix(in srgb, var(--afx-design-accent) 20%, transparent)",
						borderRadius: "5px",
						margin: "4px 0",
						flexShrink: 0,
						fontSize: "11px",
						color: "var(--vscode-descriptionForeground)",
					}}>
					<span style={{ flex: 1 }}>
						Toggle columns above to show or hide documents side by side. Click{" "}
						<span className="codicon codicon-file-text" /> to preview,{" "}
						<span className="codicon codicon-edit" /> to edit inline, or ↗ to open in editor.
					</span>
					<button
						onClick={() => setShowHint(false)}
						style={{
							background: "none",
							border: "none",
							color: "var(--vscode-descriptionForeground)",
							cursor: "pointer",
							padding: "2px",
							borderRadius: "3px",
							opacity: 0.6,
							display: "flex",
						}}>
						<span className="codicon codicon-close" style={{ fontSize: 12 }} />
					</button>
				</div>
			)}

			{/* Column content */}
			{visibleColumns.length === 0 ? (
				<div
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						gap: "8px",
						color: "var(--vscode-descriptionForeground)",
						fontSize: "12px",
					}}>
					<span className="codicon codicon-file-text" style={{ fontSize: 24, opacity: 0.3 }} />
					<span>Toggle a column above to get started</span>
					<span style={{ fontSize: "10px", opacity: 0.6 }}>
						Select SPEC, DESIGN, TASKS, or SESSIONS to view feature documents
					</span>
				</div>
			) : (
				<div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
					{visibleColumns.map((col, idx) => {
						const docPath = getDocPath(col.id)
						const content = docPath ? docContents[docPath] : undefined
						const mode = viewModes[col.id]

						// Request content if needed
						if (docPath && !content) {
							requestDocContent(docPath)
						}

						return (
							<div
								key={col.id}
								style={{
									flex: 1,
									display: "flex",
									flexDirection: "column",
									borderRight:
										idx < visibleColumns.length - 1
											? "1px solid var(--vscode-panel-border)"
											: "none",
									overflow: "hidden",
								}}>
								{/* Column header */}
								<div
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										padding: "4px 8px",
										borderBottom: "1px solid var(--vscode-panel-border)",
										borderLeft: `3px solid ${COLUMN_ACCENT[col.id]}`,
										background: `color-mix(in srgb, ${COLUMN_ACCENT[col.id]} 7%, transparent)`,
										fontSize: "11px",
										flexShrink: 0,
									}}>
									<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
										<span style={{ fontWeight: 600 }}>{col.label}</span>
										{(col.id === "spec" || col.id === "design") && docPath ? (
											<select
												value={getDocStatus(col.id)}
												onChange={(e) => {
													e.stopPropagation()
													if (docPath) {
														postMessage({
															type: "afxChangeStatus",
															filePath: docPath,
															status: e.target.value,
														})
													}
												}}
												style={{
													padding: "0 4px",
													borderRadius: "3px",
													background: "var(--vscode-dropdown-background)",
													color: "var(--vscode-dropdown-foreground)",
													border: "1px solid var(--vscode-dropdown-border)",
													fontSize: "10px",
													cursor: "pointer",
												}}>
												<option value="Draft">Draft</option>
												<option value="Approved">Approved</option>
												<option value="Living">Living</option>
											</select>
										) : (
											<span
												style={{
													padding: "0 4px",
													borderRadius: "3px",
													background: "var(--vscode-badge-background)",
													color: "var(--vscode-badge-foreground)",
													fontSize: "10px",
												}}>
												{getDocStatus(col.id)}
											</span>
										)}
									</div>
									{/* View mode buttons */}
									<div style={{ display: "flex", gap: "2px" }}>
										{col.id !== "sessions" && (
											<>
												<button
													onClick={() => setViewMode(col.id, "preview")}
													title="Preview"
													style={{
														background:
															mode === "preview"
																? "var(--vscode-toolbar-hoverBackground)"
																: "transparent",
														border: "none",
														cursor: "pointer",
														padding: "2px",
														borderRadius: "3px",
														color: "var(--vscode-foreground)",
													}}>
													<span
														className="codicon codicon-file-text"
														style={{ fontSize: 12 }}
													/>
												</button>
												<button
													onClick={() => {
														if (docPath && content) {
															setEditBuffers((prev) => ({ ...prev, [col.id]: content }))
														}
														setViewMode(col.id, "edit")
													}}
													title="Edit"
													style={{
														background:
															mode === "edit"
																? "var(--vscode-toolbar-hoverBackground)"
																: "transparent",
														border: "none",
														cursor: "pointer",
														padding: "2px",
														borderRadius: "3px",
														color: "var(--vscode-foreground)",
													}}>
													<span className="codicon codicon-edit" style={{ fontSize: 12 }} />
												</button>
											</>
										)}
										<button
											onClick={() => setViewMode(col.id, "editor")}
											title="Open in Editor"
											style={{
												background: "transparent",
												border: "none",
												cursor: "pointer",
												padding: "2px",
												borderRadius: "3px",
												color: "var(--vscode-foreground)",
											}}>
											<span className="codicon codicon-link-external" style={{ fontSize: 12 }} />
										</button>
									</div>
								</div>

								{/* Column body */}
								<div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
									{!docPath ? (
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
											}}>
											<span
												className="codicon codicon-file-text"
												style={{ fontSize: 20, opacity: 0.25 }}
											/>
											<span>No {col.label.toLowerCase()} document found.</span>
											<span style={{ fontSize: "10px", opacity: 0.5 }}>
												Create{" "}
												<code>
													docs/specs/{feature?.name ?? "feature"}/
													{col.id === "sessions" ? "tasks" : col.id}.md
												</code>
											</span>
										</div>
									) : !content ? (
										<div style={{ color: "var(--vscode-descriptionForeground)", fontSize: "12px" }}>
											Loading...
										</div>
									) : col.id === "sessions" ? (
										<SessionsView
											workSessions={feature?.workSessions ?? []}
											onToggle={(sessionIndex, column, completed) => {
												if (feature?.tasksPath) {
													postMessage({
														type: "afxToggleSession",
														filePath: feature.tasksPath,
														sessionIndex,
														column,
														completed,
													})
												}
											}}
										/>
									) : mode === "edit" ? (
										<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
											<textarea
												value={editBuffers[col.id] ?? content}
												onChange={(e) =>
													setEditBuffers((prev) => ({ ...prev, [col.id]: e.target.value }))
												}
												style={{
													flex: 1,
													fontFamily: "var(--vscode-editor-font-family)",
													fontSize: "12px",
													background: "var(--vscode-input-background)",
													color: "var(--vscode-input-foreground)",
													border: "1px solid var(--vscode-input-border)",
													padding: "8px",
													resize: "none",
												}}
											/>
											<div style={{ display: "flex", gap: "4px", padding: "4px 0" }}>
												<button
													onClick={() => handleSaveEdit(col.id)}
													style={{
														padding: "2px 8px",
														fontSize: "11px",
														background: "var(--vscode-button-background)",
														color: "var(--vscode-button-foreground)",
														border: "none",
														borderRadius: "3px",
														cursor: "pointer",
													}}>
													Save
												</button>
												<button
													onClick={() => setViewMode(col.id, "preview")}
													style={{
														padding: "2px 8px",
														fontSize: "11px",
														background: "transparent",
														color: "var(--vscode-foreground)",
														border: "1px solid var(--vscode-panel-border)",
														borderRadius: "3px",
														cursor: "pointer",
													}}>
													Cancel
												</button>
											</div>
										</div>
									) : col.id === "tasks" ? (
										<TasksPreview feature={feature} onToggle={handleToggleTask} />
									) : (
										<div style={{ fontSize: "13px" }}>
											<MarkdownBlock markdown={content.replace(/^---\n[\s\S]*?\n---\n?/, "")} />
										</div>
									)}
								</div>
							</div>
						)
					})}
				</div>
			)}

			{/* Footer: drift indicators */}
			{pipelineRow && (
				<div
					style={{
						...surfaceStyle,
						display: "flex",
						gap: "12px",
						padding: "4px 8px",
						borderTop: "1px solid var(--vscode-panel-border)",
						fontSize: "10px",
						color: "var(--vscode-descriptionForeground)",
						flexShrink: 0,
					}}>
					{(["spec", "design", "tasks"] as const).map((key) => {
						const status = pipelineRow[`${key}Status` as keyof typeof pipelineRow] as string | undefined
						const verified = pipelineRow[`${key}LastVerified` as keyof typeof pipelineRow] as
							| string
							| undefined
						const staleDays = verified
							? Math.floor((Date.now() - new Date(verified).getTime()) / 86400000)
							: undefined
						const dotColor =
							status === "Approved" || status === "Stable"
								? "var(--afx-status-approved)"
								: status === "Living"
									? "var(--afx-status-living)"
									: "var(--afx-status-draft)"
						const freshnessColor =
							staleDays === undefined
								? "var(--afx-status-draft)"
								: staleDays <= 7
									? "var(--afx-status-approved)"
									: staleDays <= 30
										? "var(--afx-status-blocked)"
										: "var(--afx-status-error)"
						return (
							<span key={key} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
								<span
									style={{
										display: "inline-block",
										width: "6px",
										height: "6px",
										borderRadius: "50%",
										background: dotColor,
										boxShadow: `0 0 4px ${dotColor}`,
									}}
								/>
								<span style={{ textTransform: "uppercase", letterSpacing: "0.3px", fontWeight: 500 }}>
									{key}
								</span>
								: {status ?? "\u2014"}
								{staleDays !== undefined && (
									<span style={{ color: freshnessColor }}>({staleDays}d)</span>
								)}
							</span>
						)
					})}
				</div>
			)}
		</div>
	)
}

function TaskItem({
	item,
	onToggle,
}: {
	item: { text: string; completed: boolean; line: number }
	onToggle: (line: number, completed: boolean) => void
}) {
	const [hovered, setHovered] = useState(false)
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "6px",
				padding: "2px 4px",
				cursor: "pointer",
				borderRadius: "3px",
				background: hovered ? "var(--vscode-list-hoverBackground)" : "transparent",
				transition: "background 0.1s",
			}}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onClick={() => onToggle(item.line, item.completed)}>
			<input
				type="checkbox"
				checked={item.completed}
				readOnly
				style={{ cursor: "pointer", accentColor: "var(--afx-status-approved)" }}
			/>
			<span
				style={{
					opacity: item.completed ? 0.6 : 1,
				}}>
				{item.text}
			</span>
		</div>
	)
}

function TasksPreview({
	feature,
	onToggle,
}: {
	feature: ReturnType<typeof useAfxPanel>["featureTasks"][0] | undefined
	onToggle: (line: number, completed: boolean) => void
}) {
	if (!feature) return null

	return (
		<div style={{ fontSize: "12px" }}>
			{feature.phases.map((phase) => (
				<div key={phase.number} style={{ marginBottom: "12px" }}>
					<div style={{ fontWeight: 600, marginBottom: "4px" }}>
						Phase {phase.number}: {phase.name}{" "}
						<span style={{ fontWeight: 400, color: "var(--vscode-descriptionForeground)" }}>
							({phase.completed}/{phase.total})
						</span>
					</div>
					{phase.items.map((item) => (
						<TaskItem key={item.line} item={item} onToggle={onToggle} />
					))}
				</div>
			))}
			<div style={{ marginTop: "8px", color: "var(--vscode-descriptionForeground)" }}>
				Progress: {feature.completed}/{feature.total} (
				{feature.total > 0 ? Math.round((feature.completed / feature.total) * 100) : 0}%)
			</div>
		</div>
	)
}

function SessionRow({
	ws,
	index,
	onToggle,
}: {
	ws: { date: string; task: string; action: string; filesModified: string; agent: boolean; human: boolean }
	index: number
	onToggle: (sessionIndex: number, column: "agent" | "human", completed: boolean) => void
}) {
	const [hovered, setHovered] = useState(false)
	return (
		<tr
			style={{
				borderBottom: "1px solid var(--vscode-panel-border)",
				background: hovered ? "var(--vscode-list-hoverBackground)" : "transparent",
				transition: "background 0.1s",
			}}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}>
			<td style={{ padding: "3px 6px", whiteSpace: "nowrap" }}>{ws.date.slice(0, 10)}</td>
			<td style={{ padding: "3px 6px" }}>{ws.task}</td>
			<td style={{ padding: "3px 6px" }}>{ws.action}</td>
			<td style={{ padding: "3px 6px" }}>{ws.filesModified}</td>
			<td style={{ padding: "3px 6px", textAlign: "center" }}>
				<input
					type="checkbox"
					checked={ws.agent}
					onChange={() => onToggle(index, "agent", !ws.agent)}
					style={{ cursor: "pointer", accentColor: "var(--afx-status-approved)" }}
				/>
			</td>
			<td style={{ padding: "3px 6px", textAlign: "center" }}>
				<input
					type="checkbox"
					checked={ws.human}
					onChange={() => onToggle(index, "human", !ws.human)}
					style={{ cursor: "pointer", accentColor: "var(--afx-status-approved)" }}
				/>
			</td>
		</tr>
	)
}

function SessionsView({
	workSessions,
	onToggle,
}: {
	workSessions: Array<{
		date: string
		task: string
		action: string
		filesModified: string
		agent: boolean
		human: boolean
	}>
	onToggle: (sessionIndex: number, column: "agent" | "human", completed: boolean) => void
}) {
	if (workSessions.length === 0) {
		return (
			<div style={{ color: "var(--vscode-descriptionForeground)", fontSize: "12px" }}>No work sessions yet.</div>
		)
	}

	return (
		<table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
			<thead>
				<tr style={{ borderBottom: "1px solid var(--vscode-panel-border)", textAlign: "left" }}>
					<th style={{ padding: "3px 6px" }}>Date</th>
					<th style={{ padding: "3px 6px" }}>Task</th>
					<th style={{ padding: "3px 6px" }}>Action</th>
					<th style={{ padding: "3px 6px" }}>Files</th>
					<th style={{ padding: "3px 6px", textAlign: "center" }}>Agent</th>
					<th style={{ padding: "3px 6px", textAlign: "center" }}>Human</th>
				</tr>
			</thead>
			<tbody>
				{workSessions.map((ws, i) => (
					<SessionRow key={i} ws={ws} index={i} onToggle={onToggle} />
				))}
			</tbody>
		</table>
	)
}
