// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useMemo } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AfxPanelProvider, useAfxPanel } from "./AfxPanelContext"
import { useAfxTheme } from "./afxTheme"
import { PipelineTab } from "./tabs/PipelineTab"
import { WorkbenchTab } from "./tabs/WorkbenchTab"
import { DocumentsTab } from "./tabs/DocumentsTab"
import { AnalyticsTab } from "./tabs/AnalyticsTab"
import { JournalTab } from "./tabs/JournalTab"
import { BoardTab } from "./tabs/BoardTab"
import { NotesTab } from "./tabs/NotesTab"

const TABS = [
	{ id: "workbench", label: "Workbench" },
	{ id: "pipeline", label: "Pipeline" },
	{ id: "documents", label: "Documents" },
	{ id: "analytics", label: "Analytics" },
	{ id: "journal", label: "Journal" },
	{ id: "board", label: "Board" },
	{ id: "notes", label: "Notes" },
] as const

type TabId = (typeof TABS)[number]["id"]

function PanelContent() {
	const [activeTab, setActiveTab] = useState<TabId>("workbench")
	const { isLoading, pipeline, featureTasks, documents, journal, notes } = useAfxPanel()
	const { panelRef } = useAfxTheme()

	const tabCounts = useMemo<Partial<Record<TabId, number>>>(() => {
		const counts: Partial<Record<TabId, number>> = {}
		if (pipeline.length > 0) counts.pipeline = pipeline.length
		if (featureTasks.length > 0) counts.workbench = featureTasks.length
		if (documents.length > 0) counts.documents = documents.length
		if (journal.length > 0) counts.journal = journal.length
		if (notes.length > 0) counts.notes = notes.length
		return counts
	}, [pipeline, featureTasks, documents, journal, notes])

	if (isLoading) {
		return (
			<div style={{ padding: "16px", color: "var(--vscode-descriptionForeground)" }}>Loading AgenticFlowX...</div>
		)
	}

	return (
		<div ref={panelRef} style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
			<div
				style={{
					display: "flex",
					gap: "2px",
					padding: "4px 8px 0",
					borderBottom: "1px solid var(--vscode-panel-border)",
					flexShrink: 0,
				}}>
				{TABS.map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveTab(tab.id)}
						style={{
							padding: "4px 10px",
							fontSize: "12px",
							border: "none",
							borderRadius: "3px 3px 0 0",
							cursor: "pointer",
							background: activeTab === tab.id ? "var(--vscode-tab-activeBackground)" : "transparent",
							color:
								activeTab === tab.id
									? "var(--vscode-tab-activeForeground)"
									: "var(--vscode-tab-inactiveForeground)",
							fontWeight: activeTab === tab.id ? 600 : 400,
							borderBottom:
								activeTab === tab.id ? "2px solid var(--vscode-focusBorder)" : "2px solid transparent",
							marginBottom: "-1px",
						}}>
						{tab.label}
						{tabCounts[tab.id] !== undefined && (
							<span
								style={{
									marginLeft: "4px",
									padding: "0 4px",
									fontSize: "10px",
									borderRadius: "6px",
									background: "var(--vscode-badge-background)",
									color: "var(--vscode-badge-foreground)",
									fontWeight: 400,
								}}>
								{tabCounts[tab.id]}
							</span>
						)}
					</button>
				))}
			</div>
			<div
				style={{
					flex: 1,
					overflow: "auto",
					padding: "8px",
					background: "linear-gradient(135deg, var(--afx-gradient-from) 0%, var(--afx-gradient-to) 100%)",
				}}>
				{activeTab === "pipeline" && <PipelineTab />}
				{activeTab === "workbench" && <WorkbenchTab />}
				{activeTab === "documents" && <DocumentsTab />}
				{activeTab === "analytics" && <AnalyticsTab />}
				{activeTab === "journal" && <JournalTab />}
				{activeTab === "board" && <BoardTab />}
				{activeTab === "notes" && <NotesTab />}
			</div>
		</div>
	)
}

export function AfxPanel() {
	return (
		<TooltipProvider delayDuration={200}>
			<AfxPanelProvider>
				<PanelContent />
			</AfxPanelProvider>
		</TooltipProvider>
	)
}
