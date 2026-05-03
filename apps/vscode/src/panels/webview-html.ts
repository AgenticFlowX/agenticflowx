/**
 * Webview HTML generator — supports dev (Vite HMR iframe) and prod (compiled dist) modes.
 *
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-3]
 * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-WEBVIEW-HTML] [DES-PANELS-BOOT-SEQUENCE]
 * @see docs/specs/131-package-ui-design-system/spec.md [FR-3]
 * @see docs/specs/131-package-ui-design-system/design.md [DES-APPEARANCE-BRIDGE]
 */
import * as fs from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";

import { AFX_STYLE_IDS, type AfxStyleId } from "@afx/shared";

const DEFAULT_APPEARANCE_CLASS = "theme-meridian style-lyra";
const DEFAULT_DEV_SERVER_HOST = "127.0.0.1";
const LEGACY_PORT_FILE_MAX_AGE_MS = 30_000;

/**
 * Builds the HTML for a webview panel, supporting two modes:
 *   - Dev (HMR): reads `.vite-port` from repo root → points iframe at Vite dev server
 *   - Prod: loads compiled `dist/index.html` with webview-safe URIs
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-5]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 */
export function loadWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  appName: "chat" | "workbench",
  extensionMode: vscode.ExtensionMode,
): string {
  const appearanceClass = getAppearanceClass();

  if (extensionMode === vscode.ExtensionMode.Development) {
    const devHtml = tryDevModeHtml(extensionUri, appName, appearanceClass);
    if (devHtml) return devHtml;
  }

  return prodHtml(webview, extensionUri, appName, appearanceClass);
}

/**
 * Resolves the host-provided appearance class injected into chat/workbench webviews.
 *
 * @see docs/specs/131-package-ui-design-system/spec.md [FR-4]
 * @see docs/specs/131-package-ui-design-system/design.md [DES-API]
 */
export function getAppearanceClass(): string {
  const cfg = vscode.workspace.getConfiguration("afx");
  const rawTheme = cfg.get<string>("theme", "meridian");
  const rawStyle = cfg.get<string>("style", "lyra");
  const style = isStyleId(rawStyle) ? rawStyle : rawTheme === "lyra" ? "lyra" : "lyra";
  return `theme-meridian style-${style}`;
}

/**
 * Finds the compiled webview bundle for the requested app.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-5]
 * @see docs/specs/200-app-vscode/design.md [DES-FILES]
 */
export function getAppDistPath(
  extensionUri: vscode.Uri,
  appName: "chat" | "workbench",
): string | null {
  const candidates = [
    path.join(extensionUri.fsPath, "..", appName, "dist"),
    path.join(extensionUri.fsPath, "resources", "webviews", appName, "dist"),
  ];

  for (const distPath of candidates) {
    if (fs.existsSync(path.join(distPath, "index.html"))) return distPath;
  }

  return null;
}

function isStyleId(value: string): value is AfxStyleId {
  return (AFX_STYLE_IDS as readonly string[]).includes(value);
}

/**
 * Attempts to load the Vite HMR URL from `.vite-port-{appName}`.
 * Returns null if the file is absent — caller falls back to prod bundle.
 */
function tryDevModeHtml(
  extensionUri: vscode.Uri,
  appName: "chat" | "workbench",
  appearanceClass: string,
): string | null {
  // .vite-port-{chat|workbench} lives at repo root: two levels up from apps/vscode
  const vitePortFile = path.join(extensionUri.fsPath, "..", "..", `.vite-port-${appName}`);
  const devServer = readViteDevServer(vitePortFile);
  if (!devServer) return null;

  const localServerUrl = `${devServer.host}:${devServer.port}`;
  const nonce = getNonce();
  const bodyClass = ` class="${appearanceClass}"`;

  const csp = [
    "default-src 'none'",
    `font-src data: http://${localServerUrl}`,
    `style-src 'unsafe-inline' http://${localServerUrl}`,
    `img-src data: http://${localServerUrl} https://www.clarity.ms https://*.clarity.ms`,
    `script-src 'unsafe-eval' 'nonce-${nonce}' http://${localServerUrl} https://www.clarity.ms https://*.clarity.ms`,
    `connect-src http://${localServerUrl} ws://${localServerUrl} https://www.clarity.ms https://*.clarity.ms`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>AFX ${appName} (dev)</title>
  <script nonce="${nonce}" type="module">
    import RefreshRuntime from "http://${localServerUrl}/@react-refresh"
    RefreshRuntime.injectIntoGlobalHook(window)
    window.$RefreshReg$ = () => {}
    window.$RefreshSig$ = () => (type) => type
    window.__vite_plugin_react_preamble_installed__ = true
  </script>
</head>
<body${bodyClass}>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="http://${localServerUrl}/src/main.tsx"></script>
</body>
</html>`;
}

function readViteDevServer(vitePortFile: string): { host: string; port: string } | null {
  if (!fs.existsSync(vitePortFile)) return null;

  const stat = fs.statSync(vitePortFile);
  const raw = fs.readFileSync(vitePortFile, "utf8").trim();
  if (!raw) {
    deleteStalePortFile(vitePortFile);
    return null;
  }

  const parsed = parseVitePortFile(raw);
  if (!parsed) {
    deleteStalePortFile(vitePortFile);
    return null;
  }
  if (parsed.pid !== undefined && !isProcessAlive(parsed.pid)) {
    deleteStalePortFile(vitePortFile);
    return null;
  }
  if (parsed.legacy && Date.now() - stat.mtimeMs > LEGACY_PORT_FILE_MAX_AGE_MS) {
    deleteStalePortFile(vitePortFile);
    return null;
  }

  return {
    host: parsed.host ?? DEFAULT_DEV_SERVER_HOST,
    port: String(parsed.port),
  };
}

// Best-effort cleanup so a crashed dev server doesn't trap future loads on the
// stale prod bundle. Failures are swallowed — the next read will try again.
function deleteStalePortFile(filePath: string): void {
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // ignore — readViteDevServer will return null regardless
  }
}

function parseVitePortFile(
  raw: string,
): { host?: string; port: number; pid?: number; legacy: boolean } | null {
  if (/^\d+$/.test(raw)) {
    return { port: Number(raw), legacy: true };
  }

  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const rawPort = record["port"];
    const port = typeof rawPort === "number" ? rawPort : Number(rawPort);
    if (!Number.isInteger(port) || port <= 0 || port > 65_535) return null;
    const rawHost = record["host"];
    const host = typeof rawHost === "string" && rawHost.trim() ? rawHost.trim() : undefined;
    const rawPid = record["pid"];
    const pid = typeof rawPid === "number" ? rawPid : undefined;
    return { host, port, pid, legacy: false };
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function prodHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  appName: "chat" | "workbench",
  appearanceClass: string,
): string {
  const appDistPath = getAppDistPath(extensionUri, appName);

  if (!appDistPath) {
    return missingBuildHtml(appName, appearanceClass);
  }

  const indexHtmlPath = path.join(appDistPath, "index.html");
  const appDistUri = vscode.Uri.file(appDistPath);
  let html = fs.readFileSync(indexHtmlPath, "utf8");

  // Rewrite absolute asset paths to webview URIs.
  html = html.replace(
    /(src|href)="\/([^"]+)"/g,
    (_match: string, attr: string, assetPath: string) => {
      const assetUri = vscode.Uri.joinPath(appDistUri, assetPath);
      const webviewUri = webview.asWebviewUri(assetUri);
      return `${attr}="${webviewUri.toString()}"`;
    },
  );

  // Remove `crossorigin` attributes — they cause CORS failures in webviews.
  html = html.replace(/\s+crossorigin/g, "");

  // Inject CSP allowing webview resource URIs and nonce-less inline styles.
  const csp = [
    `default-src 'none'`,
    `script-src ${webview.cspSource} https://www.clarity.ms https://*.clarity.ms`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `img-src ${webview.cspSource} data: https://www.clarity.ms https://*.clarity.ms`,
    `font-src ${webview.cspSource}`,
    `connect-src ${webview.cspSource} https://www.clarity.ms https://*.clarity.ms`,
  ].join("; ");
  const cspTag = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  html = html.replace(/<head>/, `<head>\n  ${cspTag}`);

  html = html.replace(/<body([^>]*)>/, (_match: string, attrs: string) => {
    if (attrs.includes('class="')) {
      return `<body${attrs.replace('class="', `class="${appearanceClass} `)}>`;
    }
    return `<body class="${appearanceClass}"${attrs}>`;
  });

  return html;
}

function missingBuildHtml(appName: string, appearanceClass: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>AFX ${appName}</title></head>
<body class="${appearanceClass || DEFAULT_APPEARANCE_CLASS}">
  <div id="root">
    <p>AFX ${appName} build not found.</p>
    <p>Run <code>pnpm --filter "apps/${appName}" build</code>.</p>
  </div>
</body>
</html>`;
}
