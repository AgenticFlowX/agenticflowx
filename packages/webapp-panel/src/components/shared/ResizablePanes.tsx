// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { useState, useCallback, useRef, type ReactNode } from "react"

interface ResizablePanesProps {
	left: ReactNode
	right: ReactNode
	defaultLeftWidth?: number
	minLeftWidth?: number
	minRightWidth?: number
}

export function ResizablePanes({
	left,
	right,
	defaultLeftWidth = 280,
	minLeftWidth = 150,
	minRightWidth = 200,
}: ResizablePanesProps) {
	const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
	const containerRef = useRef<HTMLDivElement>(null)
	const dragging = useRef(false)

	const onMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			dragging.current = true

			const onMouseMove = (ev: MouseEvent) => {
				if (!dragging.current || !containerRef.current) return
				const rect = containerRef.current.getBoundingClientRect()
				const newWidth = ev.clientX - rect.left
				const maxWidth = rect.width - minRightWidth
				setLeftWidth(Math.max(minLeftWidth, Math.min(maxWidth, newWidth)))
			}

			const onMouseUp = () => {
				dragging.current = false
				document.removeEventListener("mousemove", onMouseMove)
				document.removeEventListener("mouseup", onMouseUp)
			}

			document.addEventListener("mousemove", onMouseMove)
			document.addEventListener("mouseup", onMouseUp)
		},
		[minLeftWidth, minRightWidth],
	)

	const [handleHovered, setHandleHovered] = useState(false)

	return (
		<div ref={containerRef} style={{ display: "flex", height: "100%", overflow: "hidden" }}>
			<div style={{ width: leftWidth, flexShrink: 0, overflow: "auto" }}>{left}</div>
			<div
				onMouseDown={onMouseDown}
				onMouseEnter={() => setHandleHovered(true)}
				onMouseLeave={() => setHandleHovered(false)}
				style={{
					width: "4px",
					cursor: "col-resize",
					background: handleHovered ? "var(--vscode-focusBorder)" : "var(--vscode-panel-border)",
					flexShrink: 0,
					transition: "background 0.15s",
				}}
			/>
			<div style={{ flex: 1, overflow: "auto" }}>{right}</div>
		</div>
	)
}
