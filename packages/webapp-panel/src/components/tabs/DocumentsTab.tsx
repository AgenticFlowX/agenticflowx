// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useMemo } from "react"
import { useAfxPanel } from "../AfxPanelContext"
import { ResizablePanes } from "../shared/ResizablePanes"
import MarkdownBlock from "@agenticflowx/webapp-core/components/common/MarkdownBlock"
import type { DocumentRow } from "../types"

const TYPE_FILTERS = [
	{ value: "all", label: "All" },
	{ value: "SPEC", label: "Spec" },
	{ value: "DESIGN", label: "Design" },
	{ value: "TASKS", label: "Tasks" },
	{ value: "JOURNAL", label: "Journal" },
	{ value: "RES", label: "Research" },
	{ value: "ADR", label: "ADR" },
]

const TYPE_COLORS: Record<string, string> = {
	SPEC: "var(--vscode-charts-purple)",
	DESIGN: "var(--vscode-charts-blue)",
	TASKS: "var(--vscode-charts-orange)",
	JOURNAL: "var(--vscode-charts-green)",
	RES: "var(--vscode-descriptionForeground)",
	ADR: "var(--vscode-charts-yellow)",
}

const EXT_ICONS: Record<string, string> = {
	md: "markdown",
	mdx: "markdown",
	pdf: "file-pdf",
	txt: "file-text",
	csv: "table",
	json: "json",
	yaml: "symbol-misc",
	yml: "symbol-misc",
	ts: "symbol-class",
	tsx: "symbol-class",
	js: "symbol-class",
	jsx: "symbol-class",
	py: "symbol-class",
	rs: "symbol-class",
	go: "symbol-class",
	sh: "terminal",
	png: "file-media",
	jpg: "file-media",
	jpeg: "file-media",
	svg: "file-media",
	gif: "file-media",
	zip: "file-zip",
	tar: "file-zip",
	gz: "file-zip",
}

function extIcon(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
	return EXT_ICONS[ext] ?? "file"
}

const TYPE_ICONS: Record<string, string> = {
	SPEC: "symbol-interface",
	DESIGN: "notebook",
	TASKS: "tasklist",
	JOURNAL: "book",
	RES: "beaker",
	ADR: "law",
}

interface TreeNode {
	name: string
	path: string
	isDir: boolean
	children: TreeNode[]
	doc?: DocumentRow
}

function buildTree(docs: DocumentRow[]): TreeNode[] {
	const root: TreeNode = { name: "", path: "", isDir: true, children: [] }

	for (const doc of docs) {
		const parts = doc.name.split("/")
		let current = root
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]
			const isLast = i === parts.length - 1
			let child = current.children.find((c) => c.name === part)
			if (!child) {
				child = {
					name: part,
					path: parts.slice(0, i + 1).join("/"),
					isDir: !isLast,
					children: [],
					doc: isLast ? doc : undefined,
				}
				current.children.push(child)
			}
			current = child
		}
	}

	// Auto-hoist single-child root
	let tree = root.children
	while (tree.length === 1 && tree[0].isDir) {
		tree = tree[0].children
	}

	return tree
}

function TreeItem({
	node,
	depth,
	selectedPath,
	onSelect,
	expandedPaths,
	onToggleExpand,
}: {
	node: TreeNode
	depth: number
	selectedPath: string | null
	onSelect: (doc: DocumentRow) => void
	expandedPaths: Set<string>
	onToggleExpand: (path: string) => void
}) {
	const expanded = expandedPaths.has(node.path)
	const isSelected = node.doc?.filePath === selectedPath

	if (node.isDir) {
		return (
			<>
				<div
					onClick={() => onToggleExpand(node.path)}
					style={{
						display: "flex",
						alignItems: "center",
						gap: "4px",
						padding: "2px 4px",
						paddingLeft: `${depth * 12 + 4}px`,
						cursor: "pointer",
						fontSize: "12px",
						fontWeight: 500,
					}}>
					{expanded ? (
						<span className="codicon codicon-chevron-down" style={{ fontSize: 12 }} />
					) : (
						<span className="codicon codicon-chevron-right" style={{ fontSize: 12 }} />
					)}
					<span>{node.name}</span>
				</div>
				{expanded &&
					node.children.map((child) => (
						<TreeItem
							key={child.path}
							node={child}
							depth={depth + 1}
							selectedPath={selectedPath}
							onSelect={onSelect}
							expandedPaths={expandedPaths}
							onToggleExpand={onToggleExpand}
						/>
					))}
			</>
		)
	}

	const typeColor = node.doc?.isAfx
		? (TYPE_COLORS[node.doc.type] ?? "var(--vscode-foreground)")
		: "var(--vscode-foreground)"

	return (
		<div
			onClick={() => node.doc && onSelect(node.doc)}
			style={{
				display: "flex",
				alignItems: "center",
				gap: "4px",
				padding: "2px 4px",
				paddingLeft: `${depth * 12 + 4}px`,
				cursor: "pointer",
				fontSize: "12px",
				background: isSelected ? "var(--vscode-list-activeSelectionBackground)" : "transparent",
				color: isSelected ? "var(--vscode-list-activeSelectionForeground)" : "var(--vscode-foreground)",
			}}>
			<span
				className={`codicon codicon-${node.doc?.isAfx ? (TYPE_ICONS[node.doc.type] ?? "file-text") : extIcon(node.doc?.filePath ?? "")}`}
				style={{ fontSize: 12, color: typeColor, flexShrink: 0 }}
			/>
			<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
			{node.doc?.isAfx && (
				<span
					style={{
						fontSize: "9px",
						padding: "0 3px",
						borderRadius: "3px",
						background: typeColor,
						color: "var(--vscode-badge-foreground)",
						flexShrink: 0,
					}}>
					{node.doc.type}
				</span>
			)}
		</div>
	)
}

export function DocumentsTab() {
	const { documents, postMessage } = useAfxPanel()
	const [search, setSearch] = useState("")
	const [typeFilter, setTypeFilter] = useState("all")
	const [selected, setSelected] = useState<DocumentRow | null>(null)
	const [previewContent, setPreviewContent] = useState<string | null>(null)
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

	const filtered = useMemo(() => {
		let result = documents
		if (typeFilter !== "all") {
			result = result.filter((d) => d.type === typeFilter)
		}
		if (search) {
			const q = search.toLowerCase()
			result = result.filter((d) => d.name.toLowerCase().includes(q))
		}
		return result
	}, [documents, typeFilter, search])

	const tree = useMemo(() => buildTree(filtered), [filtered])

	// Auto-expand first 2 levels
	useEffect(() => {
		const paths = new Set<string>()
		function walk(nodes: TreeNode[], depth: number) {
			for (const n of nodes) {
				if (n.isDir && depth < 2) {
					paths.add(n.path)
					walk(n.children, depth + 1)
				}
			}
		}
		walk(tree, 0)
		setExpandedPaths(paths)
	}, [tree])

	// Fetch preview content when selecting a file
	useEffect(() => {
		if (selected?.filePath) {
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

	const toggleExpand = (path: string) => {
		setExpandedPaths((prev) => {
			const next = new Set(prev)
			if (next.has(path)) next.delete(path)
			else next.add(path)
			return next
		})
	}

	const sidebar = (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			{/* Search + filter */}
			<div style={{ padding: "4px", display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
				<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
					<span
						className="codicon codicon-search"
						style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)", flexShrink: 0 }}
					/>
					<input
						type="text"
						placeholder="Filter..."
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
					value={typeFilter}
					onChange={(e) => setTypeFilter(e.target.value)}
					style={{
						padding: "2px 6px",
						fontSize: "11px",
						background: "var(--vscode-dropdown-background)",
						color: "var(--vscode-dropdown-foreground)",
						border: "1px solid var(--vscode-dropdown-border)",
						borderRadius: "3px",
					}}>
					{TYPE_FILTERS.map((f) => (
						<option key={f.value} value={f.value}>
							{f.label}
						</option>
					))}
				</select>
			</div>

			{/* Tree */}
			<div style={{ flex: 1, overflow: "auto" }}>
				{tree.map((node) => (
					<TreeItem
						key={node.path}
						node={node}
						depth={0}
						selectedPath={selected?.filePath ?? null}
						onSelect={setSelected}
						expandedPaths={expandedPaths}
						onToggleExpand={toggleExpand}
					/>
				))}
			</div>

			<div
				style={{
					padding: "4px 8px",
					fontSize: "10px",
					color: "var(--vscode-descriptionForeground)",
					borderTop: "1px solid var(--vscode-panel-border)",
					flexShrink: 0,
				}}>
				{filtered.length} documents
			</div>
		</div>
	)

	const preview = (
		<div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
			{selected ? (
				<>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							padding: "4px 8px",
							borderBottom: "1px solid var(--vscode-panel-border)",
							flexShrink: 0,
						}}>
						<span style={{ fontSize: "12px", fontWeight: 500 }}>{selected.name}</span>
						<div style={{ display: "flex", gap: "4px" }}>
							<button
								onClick={() => postMessage({ type: "afxOpenFile", path: selected.filePath })}
								title="Open in Preview"
								style={{
									background: "transparent",
									border: "none",
									cursor: "pointer",
									padding: "2px",
									color: "var(--vscode-foreground)",
								}}>
								<span className="codicon codicon-eye" style={{ fontSize: 14 }} />
							</button>
							<button
								onClick={() => postMessage({ type: "afxOpenFile", path: selected.filePath })}
								title="Open in Editor"
								style={{
									background: "transparent",
									border: "none",
									cursor: "pointer",
									padding: "2px",
									color: "var(--vscode-foreground)",
								}}>
								<span className="codicon codicon-edit" style={{ fontSize: 14 }} />
							</button>
						</div>
					</div>
					<div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
						{previewContent === null ? (
							<div style={{ color: "var(--vscode-descriptionForeground)", fontSize: "12px" }}>
								Loading...
							</div>
						) : (
							<MarkdownBlock markdown={previewContent.replace(/^---\n[\s\S]*?\n---\n?/, "")} />
						)}
					</div>
				</>
			) : (
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
					<span className="codicon codicon-file-text" style={{ fontSize: 20, opacity: 0.25 }} />
					<span>Select a document to preview</span>
				</div>
			)}
		</div>
	)

	return (
		<div style={{ height: "100%" }}>
			<ResizablePanes
				left={sidebar}
				right={preview}
				defaultLeftWidth={240}
				minLeftWidth={150}
				minRightWidth={200}
			/>
		</div>
	)
}
