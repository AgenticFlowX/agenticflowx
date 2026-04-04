// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useMemo } from "react"
import { useAfxPanel } from "../AfxPanelContext"
import { surfaceStyle } from "../afxTheme"
import type { PipelineRow } from "../types"

type SortKey = "name" | "progress" | "health"
type SortDir = "asc" | "desc"

const _statusStyle: Record<string, { bg: string; label: string }> = {
	Approved: { bg: "var(--vscode-charts-green)", label: "Approved" },
	Draft: { bg: "var(--vscode-descriptionForeground)", label: "Draft" },
	Living: { bg: "var(--vscode-charts-blue)", label: "Living" },
	Locked: { bg: "var(--vscode-charts-yellow)", label: "Locked" },
	Stable: { bg: "var(--vscode-charts-green)", label: "Stable" },
}

function getNextAction(row: PipelineRow): { label: string; color: string; path?: string } {
	if (row.featureStatus === "Complete") return { label: "Done", color: "var(--vscode-charts-green)" }
	if (row.specStatus !== "Approved")
		return { label: "Spec", color: "var(--vscode-charts-purple)", path: row.specPath }
	if (row.designStatus !== "Approved")
		return { label: "Design", color: "var(--vscode-charts-blue)", path: row.designPath }
	if (row.tasksStatus !== "Approved" && row.tasksStatus !== "Living")
		return { label: "Tasks", color: "var(--vscode-charts-orange)", path: row.tasksPath }
	return { label: "Build", color: "var(--vscode-charts-green)", path: row.tasksPath }
}

function healthPct(row: PipelineRow): number {
	return row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0
}

function GateStepper({ row, onOpenFile }: { row: PipelineRow; onOpenFile: (path: string) => void }) {
	const stages = [
		{ label: "Spec", status: row.specStatus, path: row.specPath },
		{ label: "Design", status: row.designStatus, path: row.designPath },
		{ label: "Tasks", status: row.tasksStatus, path: row.tasksPath },
	]

	return (
		<div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
			{stages.map((stage, i) => {
				const approved = stage.status === "Approved" || stage.status === "Living" || stage.status === "Stable"
				return (
					<div key={stage.label} style={{ display: "flex", alignItems: "center" }}>
						<button
							onClick={(e) => {
								e.stopPropagation()
								if (stage.path) onOpenFile(stage.path)
							}}
							title={`${stage.label}: ${stage.status}`}
							style={{
								padding: "1px 6px",
								fontSize: "10px",
								borderRadius: "8px",
								border: "none",
								cursor: stage.path ? "pointer" : "default",
								background: approved ? "var(--vscode-charts-green)" : "var(--vscode-badge-background)",
								color: approved ? "#fff" : "var(--vscode-badge-foreground)",
								fontWeight: 500,
								opacity: stage.status === "\u2014" ? 0.4 : 1,
							}}>
							{stage.label}
						</button>
						{i < stages.length - 1 && (
							<span
								style={{
									color: "var(--vscode-descriptionForeground)",
									fontSize: "10px",
									padding: "0 2px",
									display: "inline-flex",
									alignItems: "center",
								}}>
								→
							</span>
						)}
					</div>
				)
			})}
		</div>
	)
}

export function PipelineTab() {
	const { pipeline, postMessage } = useAfxPanel()
	const [sortKey, setSortKey] = useState<SortKey>("name")
	const [sortDir, setSortDir] = useState<SortDir>("asc")
	const [hoveredRow, setHoveredRow] = useState<string | null>(null)

	const sorted = useMemo(() => {
		const rows = [...pipeline]
		rows.sort((a, b) => {
			let cmp = 0
			if (sortKey === "name") cmp = a.name.localeCompare(b.name)
			else if (sortKey === "progress") cmp = healthPct(a) - healthPct(b)
			else if (sortKey === "health") cmp = healthPct(a) - healthPct(b)
			return sortDir === "desc" ? -cmp : cmp
		})
		return rows
	}, [pipeline, sortKey, sortDir])

	const toggleSort = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"))
		} else {
			setSortKey(key)
			setSortDir("asc")
		}
	}

	const openFile = (path: string) => postMessage({ type: "afxOpenFile", path })

	if (pipeline.length === 0) {
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
				<span className="codicon codicon-graph" style={{ fontSize: 20, opacity: 0.25 }} />
				<span>No features found</span>
				<span style={{ fontSize: "10px", opacity: 0.5 }}>Create specs in docs/specs/ to get started</span>
			</div>
		)
	}

	const totalTasks = pipeline.reduce((s, r) => s + r.total, 0)
	const completedTasks = pipeline.reduce((s, r) => s + r.completed, 0)
	const inProgress = pipeline.filter((r) => r.featureStatus === "In Progress").length
	const complete = pipeline.filter((r) => r.featureStatus === "Complete").length

	const SortIcon = ({ k }: { k: SortKey }) =>
		sortKey === k ? (
			sortDir === "asc" ? (
				<span className="codicon codicon-arrow-up" style={{ fontSize: 10 }} />
			) : (
				<span className="codicon codicon-arrow-down" style={{ fontSize: 10 }} />
			)
		) : null

	return (
		<div>
			<style>{`
				@keyframes fadeSlideIn {
					from { opacity: 0; transform: translateY(-4px); }
					to { opacity: 1; transform: translateY(0); }
				}
			`}</style>
			<div style={surfaceStyle}>
				<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
					<thead>
						<tr style={{ borderBottom: "1px solid var(--vscode-panel-border)", textAlign: "left" }}>
							<th
								style={{ padding: "4px 8px", cursor: "pointer", userSelect: "none" }}
								onClick={() => toggleSort("name")}>
								Feature <SortIcon k="name" />
							</th>
							<th style={{ padding: "4px 8px" }}>Pipeline</th>
							<th
								style={{ padding: "4px 8px", cursor: "pointer", userSelect: "none" }}
								onClick={() => toggleSort("progress")}>
								Progress <SortIcon k="progress" />
							</th>
							<th style={{ padding: "4px 8px" }}>Next</th>
							<th
								style={{
									padding: "4px 8px",
									textAlign: "right",
									cursor: "pointer",
									userSelect: "none",
								}}
								onClick={() => toggleSort("health")}>
								Health <SortIcon k="health" />
							</th>
						</tr>
					</thead>
					<tbody>
						{sorted.map((row, index) => {
							const pct = healthPct(row)
							const next = getNextAction(row)
							return (
								<tr
									key={row.name}
									style={{
										borderBottom: "1px solid var(--vscode-panel-border)",
										cursor: "pointer",
										background:
											hoveredRow === row.name
												? "var(--vscode-list-hoverBackground)"
												: "transparent",
										transition: "background 0.1s",
										animation: "fadeSlideIn 0.3s ease both",
										animationDelay: `${index * 0.02}s`,
									}}
									onMouseEnter={() => setHoveredRow(row.name)}
									onMouseLeave={() => setHoveredRow(null)}
									onClick={() => {
										if (row.specPath) openFile(row.specPath)
									}}>
									<td style={{ padding: "6px 8px", fontWeight: 500 }}>{row.name}</td>
									<td style={{ padding: "6px 8px" }}>
										<GateStepper row={row} onOpenFile={openFile} />
									</td>
									<td style={{ padding: "6px 8px" }}>
										<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
											<div
												style={{
													flex: 1,
													height: "6px",
													background: "var(--vscode-panel-border)",
													borderRadius: "3px",
													minWidth: "60px",
												}}>
												<div
													style={{
														width: `${pct}%`,
														height: "100%",
														background: "var(--vscode-progressBar-background)",
														borderRadius: "3px",
														transition: "width 0.3s",
													}}
												/>
											</div>
											<span style={{ fontSize: "11px", minWidth: "30px" }}>
												{row.completed}/{row.total}
											</span>
										</div>
									</td>
									<td style={{ padding: "6px 8px" }}>
										<span
											onClick={(e) => {
												e.stopPropagation()
												if (next.path) openFile(next.path)
											}}
											style={{
												padding: "1px 8px",
												borderRadius: "8px",
												fontSize: "10px",
												fontWeight: 600,
												background: next.color,
												color: "#fff",
												cursor: next.path ? "pointer" : "default",
											}}>
											{next.label}
										</span>
									</td>
									<td style={{ padding: "6px 8px", textAlign: "right" }}>
										<span
											style={{
												display: "inline-block",
												padding: "1px 8px",
												borderRadius: "8px",
												fontWeight: 600,
												fontSize: "11px",
												color:
													pct >= 80
														? "var(--afx-status-approved)"
														: pct >= 40
															? "var(--afx-status-blocked)"
															: "var(--afx-status-error)",
												background:
													pct >= 80
														? "color-mix(in srgb, var(--afx-status-approved) 15%, transparent)"
														: pct >= 40
															? "color-mix(in srgb, var(--afx-status-blocked) 15%, transparent)"
															: "color-mix(in srgb, var(--afx-status-error) 15%, transparent)",
											}}>
											{pct}%
										</span>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
			<div style={surfaceStyle}>
				<div
					style={{
						marginTop: "12px",
						padding: "8px",
						fontSize: "11px",
						color: "var(--vscode-descriptionForeground)",
						borderTop: "1px solid var(--vscode-panel-border)",
					}}>
					{pipeline.length} features | {inProgress} in progress | {complete} complete | {totalTasks} tasks (
					{completedTasks} done)
				</div>
			</div>
		</div>
	)
}
