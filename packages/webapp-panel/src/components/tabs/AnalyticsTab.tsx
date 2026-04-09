// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react"
import { useAfxPanel } from "../AfxPanelContext"
import { surfaceStyle } from "../afxTheme"

function DonutRing({
	value,
	max,
	label,
	sublabel,
	color,
}: {
	value: number
	max: number
	label: string
	sublabel: string
	color: string
}) {
	const pct = max > 0 ? value / max : 0
	const radius = 36
	const stroke = 6
	const circumference = 2 * Math.PI * radius
	const offset = circumference * (1 - pct)

	return (
		<div style={{ textAlign: "center", padding: "12px" }}>
			<svg width="90" height="90" viewBox="0 0 90 90">
				<circle
					cx="45"
					cy="45"
					r={radius}
					fill="none"
					stroke="var(--vscode-panel-border)"
					strokeWidth={stroke}
				/>
				<circle
					cx="45"
					cy="45"
					r={radius}
					fill="none"
					stroke={color}
					strokeWidth={stroke}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					transform="rotate(-90 45 45)"
					style={{ transition: "stroke-dashoffset 0.5s" }}
				/>
				<text x="45" y="42" textAnchor="middle" fill="var(--vscode-foreground)" fontSize="16" fontWeight="700">
					{max > 0 ? Math.round(pct * 100) : 0}%
				</text>
				<text x="45" y="56" textAnchor="middle" fill="var(--vscode-descriptionForeground)" fontSize="9">
					{value}/{max}
				</text>
			</svg>
			<div style={{ fontSize: "11px", fontWeight: 600, marginTop: "4px" }}>{label}</div>
			<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>{sublabel}</div>
		</div>
	)
}

function StageBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
	const pct = total > 0 ? (count / total) * 100 : 0
	return (
		<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontSize: "12px" }}>
			<span style={{ width: "60px", textAlign: "right", color: "var(--vscode-descriptionForeground)" }}>
				{label}
			</span>
			<div
				style={{
					flex: 1,
					height: "10px",
					background: "var(--vscode-panel-border)",
					borderRadius: "5px",
					overflow: "hidden",
				}}>
				<div
					style={{
						width: `${pct}%`,
						height: "100%",
						background: color,
						borderRadius: "5px",
						transition: "width 0.3s",
					}}
				/>
			</div>
			<span style={{ width: "30px", fontSize: "11px" }}>
				{count}/{total}
			</span>
		</div>
	)
}

export function AnalyticsTab() {
	const { pipeline, ghostTasks } = useAfxPanel()

	const stats = useMemo(() => {
		const totalTasks = pipeline.reduce((s, r) => s + r.total, 0)
		const completedTasks = pipeline.reduce((s, r) => s + r.completed, 0)
		const healthPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
		const specsApproved = pipeline.filter((r) => r.specStatus === "Approved" || r.specStatus === "Stable").length
		const designsApproved = pipeline.filter(
			(r) => r.designStatus === "Approved" || r.designStatus === "Stable",
		).length
		const gatesClear = pipeline.filter(
			(r) =>
				(r.specStatus === "Approved" || r.specStatus === "Stable") &&
				(r.designStatus === "Approved" || r.designStatus === "Stable") &&
				(r.tasksStatus === "Approved" || r.tasksStatus === "Living" || r.tasksStatus === "Stable"),
		).length
		const inProgress = pipeline.filter((r) => r.featureStatus === "In Progress").length
		const complete = pipeline.filter((r) => r.featureStatus === "Complete").length

		return {
			totalTasks,
			completedTasks,
			healthPct,
			specsApproved,
			designsApproved,
			gatesClear,
			inProgress,
			complete,
		}
	}, [pipeline])

	const alerts = useMemo(() => {
		const items: Array<{ type: "warning" | "error" | "info"; message: string; features: string[] }> = []

		const noSpec = pipeline.filter((r) => r.specStatus !== "Approved" && r.specStatus !== "Stable")
		if (noSpec.length > 0) {
			items.push({ type: "warning", message: "Spec not approved", features: noSpec.map((r) => r.name) })
		}

		const noDesign = pipeline.filter(
			(r) =>
				(r.specStatus === "Approved" || r.specStatus === "Stable") &&
				r.designStatus !== "Approved" &&
				r.designStatus !== "Stable" &&
				r.designStatus !== "\u2014",
		)
		if (noDesign.length > 0) {
			items.push({ type: "warning", message: "Design awaiting approval", features: noDesign.map((r) => r.name) })
		}

		if (ghostTasks.count > 0) {
			items.push({
				type: "error",
				message: `${ghostTasks.count} broken @see reference(s)`,
				features: [...new Set(ghostTasks.items.map((g) => g.feature))],
			})
		}

		return items
	}, [pipeline, ghostTasks])

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

	const healthColor =
		stats.healthPct >= 80
			? "var(--vscode-charts-green)"
			: stats.healthPct >= 40
				? "var(--vscode-charts-yellow)"
				: "var(--vscode-errorForeground)"

	return (
		<div>
			{/* Hero cards */}
			<div style={surfaceStyle}>
				<div
					style={{
						display: "flex",
						justifyContent: "center",
						gap: "8px",
						flexWrap: "wrap",
						marginBottom: "16px",
					}}>
					<DonutRing
						value={stats.completedTasks}
						max={stats.totalTasks}
						label="Health"
						sublabel="task completion"
						color={healthColor}
					/>
					<DonutRing
						value={stats.completedTasks}
						max={stats.totalTasks}
						label="Tasks"
						sublabel="completed"
						color="var(--vscode-charts-purple)"
					/>
					<DonutRing
						value={stats.gatesClear}
						max={pipeline.length}
						label="Gates Clear"
						sublabel="all docs approved"
						color="var(--vscode-charts-blue)"
					/>
					<div style={{ textAlign: "center", padding: "12px" }}>
						<div
							style={{
								width: "90px",
								height: "90px",
								borderRadius: "50%",
								border: `6px solid ${ghostTasks.count > 0 ? "var(--vscode-errorForeground)" : "var(--vscode-charts-green)"}`,
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
							}}>
							<span
								style={{
									fontSize: "22px",
									fontWeight: 700,
									color:
										ghostTasks.count > 0
											? "var(--vscode-errorForeground)"
											: "var(--vscode-charts-green)",
								}}>
								{ghostTasks.count}
							</span>
						</div>
						<div style={{ fontSize: "11px", fontWeight: 600, marginTop: "4px" }}>Ghost Tasks</div>
						<div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
							broken @see refs
						</div>
					</div>
				</div>
			</div>

			{/* Summary chips */}
			<div
				style={{
					display: "flex",
					gap: "12px",
					justifyContent: "center",
					marginBottom: "16px",
					fontSize: "11px",
				}}>
				<span>
					<span
						style={{
							display: "inline-block",
							width: "8px",
							height: "8px",
							borderRadius: "50%",
							background: "var(--vscode-charts-blue)",
							marginRight: "4px",
						}}
					/>
					{pipeline.length} features
				</span>
				<span>
					<span
						style={{
							display: "inline-block",
							width: "8px",
							height: "8px",
							borderRadius: "50%",
							background: "var(--vscode-charts-purple)",
							marginRight: "4px",
						}}
					/>
					{stats.completedTasks}/{stats.totalTasks} tasks
				</span>
				<span>
					<span
						style={{
							display: "inline-block",
							width: "8px",
							height: "8px",
							borderRadius: "50%",
							background:
								alerts.length > 0 ? "var(--vscode-errorForeground)" : "var(--vscode-charts-green)",
							marginRight: "4px",
						}}
					/>
					{alerts.length} blockers
				</span>
			</div>

			{/* Stage distribution */}
			<div style={{ ...surfaceStyle, marginBottom: "16px", padding: "0 8px" }}>
				<div
					style={{
						fontSize: "11px",
						fontWeight: 600,
						marginBottom: "8px",
						borderLeft: "2px solid var(--afx-design-accent)",
						paddingLeft: "8px",
						textTransform: "uppercase",
						letterSpacing: "0.05em",
					}}>
					Pipeline Stages
				</div>
				<StageBar
					label="Specify"
					count={stats.specsApproved}
					total={pipeline.length}
					color="var(--vscode-charts-purple)"
				/>
				<StageBar
					label="Design"
					count={stats.designsApproved}
					total={pipeline.length}
					color="var(--vscode-charts-blue)"
				/>
				<StageBar
					label="Build"
					count={stats.inProgress + stats.complete}
					total={pipeline.length}
					color="var(--vscode-charts-orange)"
				/>
				<StageBar
					label="Done"
					count={stats.complete}
					total={pipeline.length}
					color="var(--vscode-charts-green)"
				/>
			</div>

			{/* Alerts */}
			{alerts.length > 0 && (
				<div style={{ ...surfaceStyle, padding: "0 8px" }}>
					<div
						style={{
							fontSize: "11px",
							fontWeight: 600,
							marginBottom: "8px",
							borderLeft: "2px solid var(--afx-design-accent)",
							paddingLeft: "8px",
							textTransform: "uppercase",
							letterSpacing: "0.05em",
						}}>
						Alerts
					</div>
					{alerts.map((alert, i) => (
						<div
							key={i}
							style={{
								display: "flex",
								alignItems: "flex-start",
								gap: "6px",
								padding: "6px 8px",
								marginBottom: "4px",
								borderRadius: "4px",
								background:
									alert.type === "error"
										? "color-mix(in srgb, var(--afx-status-error) 8%, transparent)"
										: "color-mix(in srgb, var(--afx-status-blocked) 8%, transparent)",
								borderLeft: `3px solid ${alert.type === "error" ? "var(--afx-status-error)" : "var(--afx-status-blocked)"}`,
								fontSize: "12px",
							}}>
							<span>{alert.type === "error" ? "\ud83d\udd34" : "\u26a0\ufe0f"}</span>
							<div>
								<span style={{ fontWeight: 500 }}>{alert.message}</span>
								<span style={{ color: "var(--vscode-descriptionForeground)", marginLeft: "6px" }}>
									{alert.features.join(", ")}
								</span>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
