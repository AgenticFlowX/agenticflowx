// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { t } from "i18next"

type TodoStatus = "completed" | "in_progress" | "pending"

interface TodoItem {
	id?: string
	content: string
	status?: TodoStatus | string
}

interface TodoChangeDisplayProps {
	previousTodos: TodoItem[]
	newTodos: TodoItem[]
}

function getTodoIcon(status: TodoStatus | null) {
	switch (status) {
		case "completed":
			return <span className="codicon codicon-check size-3 mt-1 shrink-0" />
		case "in_progress":
			return <span className="codicon codicon-arrow-right size-3 mt-1 shrink-0" />
		default:
			return <span className="codicon codicon-circle-outline size-3 mt-1 shrink-0" />
	}
}

export function TodoChangeDisplay({ previousTodos, newTodos }: TodoChangeDisplayProps) {
	const isInitialState = previousTodos.length === 0

	// Determine which todos to display
	let todosToDisplay: TodoItem[]

	if (isInitialState && newTodos.length > 0) {
		// For initial state, show all todos in their original order
		todosToDisplay = newTodos
	} else {
		// For updates, only show changes (completed or started) in their original order
		todosToDisplay = newTodos.filter((newTodo) => {
			if (newTodo.status === "completed") {
				const previousTodo = previousTodos.find((p) => p.id === newTodo.id || p.content === newTodo.content)
				return !previousTodo || previousTodo.status !== "completed"
			}
			if (newTodo.status === "in_progress") {
				const previousTodo = previousTodos.find((p) => p.id === newTodo.id || p.content === newTodo.content)
				return !previousTodo || previousTodo.status !== "in_progress"
			}
			return false
		})
	}

	// If no todos to display, don't render anything
	if (todosToDisplay.length === 0) {
		return null
	}

	return (
		<div data-todo-changes className="overflow-hidden">
			<div className="flex items-center gap-2">
				<span className="codicon codicon-checklist size-4 shrink-0" />
				<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold">
					{t("chat:todo.updated")}
				</span>
			</div>

			<div className="pl-1 pr-1 pt-1 font-light leading-normal">
				<ul className="list-none space-y-1 my-1">
					{todosToDisplay.map((todo) => {
						const status = (todo.status || "pending") as TodoStatus
						const icon = getTodoIcon(status)
						return (
							<li
								key={todo.id || todo.content}
								className={`flex flex-row gap-2 items-start ${
									status === "in_progress" ? "text-vscode-charts-yellow" : ""
								}`}>
								{icon}
								<span>{todo.content}</span>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}
