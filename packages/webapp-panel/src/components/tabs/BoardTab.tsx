// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useRef, useCallback, useMemo } from "react"
import { useAfxPanel } from "../AfxPanelContext"
import type { KanbanBoard } from "../types"

type ViewMode = "board" | "markdown"

export function BoardTab() {
	const { kanban, postMessage } = useAfxPanel()
	const [selectedBoardIdx, setSelectedBoardIdx] = useState(0)
	const [viewMode, setViewMode] = useState<ViewMode>("board")
	const [localBoards, setLocalBoards] = useState<KanbanBoard[] | null>(null)

	// Use local state for DnD, sync back to extension on change
	const boards = useMemo(() => localBoards ?? kanban?.boards ?? [], [localBoards, kanban?.boards])
	const board = boards[selectedBoardIdx]

	const [newCardText, setNewCardText] = useState<Record<string, string>>({})
	const [newColTitle, setNewColTitle] = useState("")
	const [showAddColumn, setShowAddColumn] = useState(false)

	// DnD state
	const dragItem = useRef<{ colIdx: number; cardIdx: number } | null>(null)
	const dragOverItem = useRef<{ colIdx: number; cardIdx: number } | null>(null)

	const updateBoard = useCallback(
		(updatedBoard: KanbanBoard) => {
			const newBoards = [...boards]
			newBoards[selectedBoardIdx] = updatedBoard
			setLocalBoards(newBoards)
			// Serialize to markdown and save
			const md = serializeBoardToMarkdown(updatedBoard)
			postMessage({ type: "afxSaveFile", path: updatedBoard.filePath, content: md })
		},
		[boards, selectedBoardIdx, postMessage],
	)

	if (!kanban || boards.length === 0) {
		return (
			<div style={{ color: "var(--vscode-descriptionForeground)", padding: "16px", fontSize: "12px" }}>
				No kanban boards found in .afx/kanban/
			</div>
		)
	}

	if (!board) return null

	const addCard = (colIdx: number) => {
		const text = newCardText[colIdx]?.trim()
		if (!text) return
		const newBoard = structuredClone(board)
		newBoard.columns[colIdx].cards.push({ text })
		updateBoard(newBoard)
		setNewCardText((prev) => ({ ...prev, [colIdx]: "" }))
	}

	const deleteCard = (colIdx: number, cardIdx: number) => {
		const newBoard = structuredClone(board)
		newBoard.columns[colIdx].cards.splice(cardIdx, 1)
		updateBoard(newBoard)
	}

	const addColumn = () => {
		if (!newColTitle.trim()) return
		const newBoard = structuredClone(board)
		newBoard.columns.push({ title: newColTitle.trim(), cards: [] })
		updateBoard(newBoard)
		setNewColTitle("")
		setShowAddColumn(false)
	}

	const deleteColumn = (colIdx: number) => {
		if (board.columns[colIdx].cards.length > 0) return // Only delete empty columns
		const newBoard = structuredClone(board)
		newBoard.columns.splice(colIdx, 1)
		updateBoard(newBoard)
	}

	const handleDragStart = (colIdx: number, cardIdx: number) => {
		dragItem.current = { colIdx, cardIdx }
	}

	const handleDragOver = (e: React.DragEvent, colIdx: number, cardIdx: number) => {
		e.preventDefault()
		dragOverItem.current = { colIdx, cardIdx }
	}

	const handleDrop = () => {
		if (!dragItem.current || !dragOverItem.current) return
		const from = dragItem.current
		const to = dragOverItem.current

		const newBoard = structuredClone(board)
		const [card] = newBoard.columns[from.colIdx].cards.splice(from.cardIdx, 1)
		newBoard.columns[to.colIdx].cards.splice(to.cardIdx, 0, card)
		updateBoard(newBoard)

		dragItem.current = null
		dragOverItem.current = null
	}

	const handleColumnDragOver = (e: React.DragEvent, colIdx: number) => {
		e.preventDefault()
		dragOverItem.current = { colIdx, cardIdx: board.columns[colIdx].cards.length }
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "4px 0",
					borderBottom: "1px solid var(--vscode-panel-border)",
					flexShrink: 0,
				}}>
				<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
					{boards.length > 1 && (
						<select
							value={selectedBoardIdx}
							onChange={(e) => {
								setSelectedBoardIdx(Number(e.target.value))
								setLocalBoards(null)
							}}
							style={{
								padding: "2px 6px",
								fontSize: "11px",
								background: "var(--vscode-dropdown-background)",
								color: "var(--vscode-dropdown-foreground)",
								border: "1px solid var(--vscode-dropdown-border)",
								borderRadius: "3px",
							}}>
							{boards.map((b, i) => (
								<option key={b.name} value={i}>
									{b.name}
								</option>
							))}
						</select>
					)}
					<span style={{ fontSize: "12px", fontWeight: 500 }}>{board.name}</span>
				</div>
				<div style={{ display: "flex", gap: "2px" }}>
					<button
						onClick={() => setViewMode("board")}
						title="Board view"
						style={{
							background: viewMode === "board" ? "var(--vscode-toolbar-hoverBackground)" : "transparent",
							border: "none",
							cursor: "pointer",
							padding: "2px 4px",
							borderRadius: "3px",
							color: "var(--vscode-foreground)",
						}}>
						<span className="codicon codicon-layout" style={{ fontSize: 14 }} />
					</button>
					<button
						onClick={() => setViewMode("markdown")}
						title="Markdown view"
						style={{
							background:
								viewMode === "markdown" ? "var(--vscode-toolbar-hoverBackground)" : "transparent",
							border: "none",
							cursor: "pointer",
							padding: "2px 4px",
							borderRadius: "3px",
							color: "var(--vscode-foreground)",
						}}>
						<span className="codicon codicon-file-text" style={{ fontSize: 14 }} />
					</button>
				</div>
			</div>

			{/* Content */}
			{viewMode === "markdown" ? (
				<div style={{ flex: 1, overflow: "auto", padding: "4px" }}>
					<textarea
						value={board.rawContent ?? serializeBoardToMarkdown(board)}
						onChange={(e) => {
							const newBoard = { ...board, rawContent: e.target.value }
							const newBoards = [...boards]
							newBoards[selectedBoardIdx] = newBoard
							setLocalBoards(newBoards)
						}}
						onBlur={() => {
							if (board.rawContent) {
								postMessage({ type: "afxSaveFile", path: board.filePath, content: board.rawContent })
							}
						}}
						style={{
							width: "100%",
							height: "100%",
							fontFamily: "var(--vscode-editor-font-family)",
							fontSize: "12px",
							background: "var(--vscode-input-background)",
							color: "var(--vscode-input-foreground)",
							border: "1px solid var(--vscode-input-border)",
							padding: "8px",
							resize: "none",
							boxSizing: "border-box",
						}}
					/>
				</div>
			) : (
				<div style={{ flex: 1, display: "flex", gap: "8px", overflow: "auto", padding: "8px" }}>
					{board.columns.map((col, colIdx) => (
						<div
							key={colIdx}
							onDragOver={(e) => handleColumnDragOver(e, colIdx)}
							onDrop={handleDrop}
							style={{
								minWidth: "200px",
								maxWidth: "300px",
								flex: 1,
								display: "flex",
								flexDirection: "column",
								border: "1px solid var(--vscode-panel-border)",
								borderRadius: "4px",
								background: "var(--vscode-editor-background)",
							}}>
							{/* Column header */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "6px 8px",
									borderBottom: "1px solid var(--vscode-panel-border)",
									fontWeight: 600,
									fontSize: "12px",
								}}>
								<span>
									{col.title} ({col.cards.length})
								</span>
								{col.cards.length === 0 && (
									<button
										onClick={() => deleteColumn(colIdx)}
										title="Delete empty column"
										style={{
											background: "transparent",
											border: "none",
											cursor: "pointer",
											color: "var(--vscode-errorForeground)",
											padding: "0 2px",
											fontSize: "12px",
										}}>
										<span className="codicon codicon-close" style={{ fontSize: 12 }} />
									</button>
								)}
							</div>

							{/* Cards */}
							<div style={{ flex: 1, overflow: "auto", padding: "4px" }}>
								{col.cards.map((card, cardIdx) => (
									<div
										key={cardIdx}
										draggable
										onDragStart={() => handleDragStart(colIdx, cardIdx)}
										onDragOver={(e) => handleDragOver(e, colIdx, cardIdx)}
										onDrop={handleDrop}
										style={{
											display: "flex",
											alignItems: "flex-start",
											gap: "4px",
											padding: "6px 8px",
											marginBottom: "4px",
											border: "1px solid var(--vscode-panel-border)",
											borderRadius: "3px",
											fontSize: "12px",
											cursor: "grab",
											background: "var(--vscode-sideBar-background)",
										}}>
										<span
											className="codicon codicon-gripper"
											style={{
												fontSize: 12,
												color: "var(--vscode-descriptionForeground)",
												flexShrink: 0,
												marginTop: "2px",
											}}
										/>
										<span style={{ flex: 1, wordBreak: "break-word" }}>{card.text}</span>
										<button
											onClick={() => deleteCard(colIdx, cardIdx)}
											style={{
												background: "transparent",
												border: "none",
												cursor: "pointer",
												color: "var(--vscode-descriptionForeground)",
												padding: "0",
												fontSize: "12px",
												flexShrink: 0,
											}}>
											<span className="codicon codicon-close" style={{ fontSize: 12 }} />
										</button>
									</div>
								))}
							</div>

							{/* Add card input */}
							<div style={{ padding: "4px", borderTop: "1px solid var(--vscode-panel-border)" }}>
								<input
									type="text"
									placeholder="Add card..."
									value={newCardText[colIdx] ?? ""}
									onChange={(e) => setNewCardText((prev) => ({ ...prev, [colIdx]: e.target.value }))}
									onKeyDown={(e) => {
										if (e.key === "Enter") addCard(colIdx)
									}}
									style={{
										width: "100%",
										padding: "3px 6px",
										fontSize: "11px",
										background: "var(--vscode-input-background)",
										color: "var(--vscode-input-foreground)",
										border: "1px solid var(--vscode-input-border)",
										borderRadius: "3px",
										boxSizing: "border-box",
									}}
								/>
							</div>
						</div>
					))}

					{/* Add column */}
					<div style={{ minWidth: "160px", flexShrink: 0 }}>
						{showAddColumn ? (
							<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
								<input
									type="text"
									placeholder="Column title..."
									value={newColTitle}
									onChange={(e) => setNewColTitle(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") addColumn()
										if (e.key === "Escape") setShowAddColumn(false)
									}}
									autoFocus
									style={{
										padding: "4px 6px",
										fontSize: "12px",
										background: "var(--vscode-input-background)",
										color: "var(--vscode-input-foreground)",
										border: "1px solid var(--vscode-input-border)",
										borderRadius: "3px",
									}}
								/>
								<div style={{ display: "flex", gap: "4px" }}>
									<button
										onClick={addColumn}
										style={{
											padding: "2px 8px",
											fontSize: "11px",
											background: "var(--vscode-button-background)",
											color: "var(--vscode-button-foreground)",
											border: "none",
											borderRadius: "3px",
											cursor: "pointer",
										}}>
										Add
									</button>
									<button
										onClick={() => setShowAddColumn(false)}
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
						) : (
							<button
								onClick={() => setShowAddColumn(true)}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "4px",
									padding: "6px 10px",
									fontSize: "12px",
									background: "transparent",
									border: "1px dashed var(--vscode-panel-border)",
									borderRadius: "4px",
									cursor: "pointer",
									color: "var(--vscode-descriptionForeground)",
									width: "100%",
								}}>
								<span className="codicon codicon-add" style={{ fontSize: 14 }} /> Add column
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

function serializeBoardToMarkdown(board: KanbanBoard): string {
	const lines: string[] = []
	lines.push("---")
	if (board.meta?.title) lines.push(`title: ${board.meta.title}`)
	if (board.meta?.status) lines.push(`status: ${board.meta.status}`)
	lines.push("---")
	lines.push("")

	for (const col of board.columns) {
		lines.push(`## ${col.title}`)
		lines.push("")
		for (const card of col.cards) {
			lines.push(`- ${card.text}`)
		}
		lines.push("")
	}

	return lines.join("\n")
}
