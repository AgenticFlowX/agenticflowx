// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { useQuery } from "@tanstack/react-query"

import { type ModelRecord, type ExtensionMessage } from "@agenticflowx/types"

import { vscode } from "@src/utils/vscode"

const getOllamaModels = async () =>
	new Promise<ModelRecord>((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("Ollama models request timed out"))
		}, 10000)

		const handler = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "ollamaModels") {
				clearTimeout(timeout)
				cleanup()

				if (message.ollamaModels) {
					resolve(message.ollamaModels)
				} else {
					reject(new Error("No Ollama models in response"))
				}
			}
		}

		window.addEventListener("message", handler)
		vscode.postMessage({ type: "requestOllamaModels" })
	})

export const useOllamaModels = (modelId?: string) =>
	useQuery({ queryKey: ["ollamaModels"], queryFn: () => (modelId ? getOllamaModels() : {}) })
