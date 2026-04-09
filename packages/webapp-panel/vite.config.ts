// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import path, { resolve } from "path"
import fs from "fs"
import { execSync } from "child_process"

import { defineConfig, type PluginOption } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

function getGitSha() {
	let gitSha: string | undefined = undefined

	try {
		gitSha = execSync("git rev-parse HEAD").toString().trim()
	} catch (_error) {
		// Do nothing.
	}

	return gitSha
}

export default defineConfig(({ mode }) => {
	const outDir = "../../src/webapp-core/build"

	const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "src", "package.json"), "utf8"))
	const gitSha = getGitSha()

	const define: Record<string, any> = {
		"process.platform": JSON.stringify(process.platform),
		"process.env.VSCODE_TEXTMATE_DEBUG": JSON.stringify(process.env.VSCODE_TEXTMATE_DEBUG),
		"process.env.PKG_NAME": JSON.stringify(pkg.name),
		"process.env.PKG_VERSION": JSON.stringify(pkg.version),
		"process.env.PKG_OUTPUT_CHANNEL": JSON.stringify("AgenticFlowX"),
		...(gitSha ? { "process.env.PKG_SHA": JSON.stringify(gitSha) } : {}),
	}

	const plugins: PluginOption[] = [
		react({
			babel: {
				plugins: [["babel-plugin-react-compiler", { target: "18" }]],
			},
		}),
		tailwindcss(),
	]

	return {
		plugins,
		resolve: {
			alias: {
				// Resolve webapp-core's internal path aliases when following cross-package imports.
				// webapp-panel's own files use @agenticflowx/webapp-core/ imports (not @/ aliases),
				// so @/ can safely point to webapp-core's src to resolve transitive deps.
				"@": resolve(__dirname, "../webapp-core/src"),
				"@src": resolve(__dirname, "../webapp-core/src"),
				"@afx": resolve(__dirname, "../../src/shared"),
			},
		},
		build: {
			outDir,
			// Do NOT emptyOutDir — webapp-core writes index.js here too
			emptyOutDir: false,
			reportCompressedSize: false,
			sourcemap: true,
			minify: mode === "production" ? "esbuild" : false,
			cssCodeSplit: false,
			rollupOptions: {
				external: ["vscode"],
				input: {
					panel: resolve(__dirname, "index.html"),
				},
				output: {
					entryFileNames: `assets/[name].js`,
					chunkFileNames: `assets/chunk-[hash].js`,
					assetFileNames: (assetInfo) => {
						const name = assetInfo.name || ""

						if (name.endsWith(".css")) {
							return "assets/panel.css"
						}

						if (name.endsWith(".woff2") || name.endsWith(".woff") || name.endsWith(".ttf")) {
							return "assets/fonts/[name][extname]"
						}

						if (name.endsWith(".map")) {
							return "assets/[name]"
						}

						return "assets/[name][extname]"
					},
				},
			},
		},
		server: {
			hmr: {
				host: "localhost",
				protocol: "ws",
			},
			cors: {
				origin: "*",
				methods: "*",
				allowedHeaders: "*",
			},
		},
		define,
		optimizeDeps: {
			exclude: ["vscode"],
		},
	}
})
