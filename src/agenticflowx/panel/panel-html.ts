// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * HTML generation for the AgenticFlowX panel webview.
 * Follows AfxProvider.getHtmlContent() pattern (src/core/webview/AfxProvider.ts:1308).
 *
 * @see docs/specs/vscode-agenticflowx-panel/design.md#panel-html
 */

import * as vscode from "vscode"
import { getUri } from "../../core/webview/getUri"

export function getAfxPanelHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const scriptUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "panel.js"])
	const cssUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.css"])
	const codiconsUri = getUri(webview, extensionUri, ["assets", "codicons", "codicon.css"])

	const nonce = getNonce()

	const html = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'unsafe-eval' ${webview.cspSource} 'nonce-${nonce}';">
	<link rel="stylesheet" href="${codiconsUri}">
	<link rel="stylesheet" href="${cssUri}">
	<title>AgenticFlowX</title>
</head>
<body>
	<div id="afx-root"></div>
	<script nonce="${nonce}">
		console.log("[AFX-WEBVIEW] HTML loaded, afx-root exists:", !!document.getElementById("afx-root"));
		window.addEventListener("message", function(e) {
			console.log("[AFX-WEBVIEW] Got message:", e.data?.type, "pipeline:", e.data?.pipeline?.length);
		});
		window.onerror = function(msg, src, line, col, err) {
			console.error("[AFX-WEBVIEW] ERROR:", msg, src, line, col, err);
		};
	</script>
	<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`

	return html
}

export function getAfxPanelHMRHtml(webview: vscode.Webview, port: number): string {
	const localServerUrl = `localhost:${port}`
	const nonce = getNonce()

	return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline' http://${localServerUrl}; script-src 'nonce-${nonce}' http://${localServerUrl}; connect-src ws://${localServerUrl} http://${localServerUrl};">
	<title>AgenticFlowX</title>
</head>
<body>
	<div id="afx-root"></div>
	<script type="module" nonce="${nonce}">
		import RefreshRuntime from "http://${localServerUrl}/@react-refresh"
		RefreshRuntime.injectIntoGlobalHook(window)
		window.$RefreshReg$ = () => {}
		window.$RefreshSig$ = () => (type) => type
		window.__vite_plugin_react_preamble_installed__ = true
	</script>
	<script type="module" nonce="${nonce}" src="http://${localServerUrl}/src/panel.tsx"></script>
</body>
</html>`
}

function getNonce(): string {
	let text = ""
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length))
	}
	return text
}
