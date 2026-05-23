/**
 * Tests for the webview HTML loader — both Production (loads compiled bundle
 * or falls back to "missing build" page) and Development (HMR via Vite port
 * file) paths, plus theme class injection and CSP wiring.
 *
 * The CSP guard block at the bottom enforces FR-22: prod CSP must never include
 * `unsafe-eval` or `unsafe-inline` for scripts; dev CSP must use a random nonce.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-5]
 * @see docs/specs/200-app-vscode/design.md [DES-TEST]
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-22] [DES-APPSEC]
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { getAppearanceClass, loadWebviewHtml } from "./webview-html";

function fakeWebview(): vscode.Webview {
  return {
    cspSource: "vscode-webview://test",
    asWebviewUri: (uri: { toString: () => string }) => ({
      toString: () => `https://wv/${uri.toString()}`,
    }),
  } as unknown as vscode.Webview;
}

function mockAfxConfig(values: Record<string, string>): void {
  vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
    get: <T>(key: string, def?: T) => (values[key] ?? def) as T,
    has: () => true,
    inspect: () => undefined,
    update: async () => {},
  });
}

describe("loadWebviewHtml — Production", () => {
  let tmpRoot: string;
  let extensionUri: vscode.Uri;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "afx-wv-"));
    // Mirror real layout: tmpRoot/apps/vscode + tmpRoot/apps/chat/dist
    fs.mkdirSync(path.join(tmpRoot, "apps", "vscode"), { recursive: true });
    extensionUri = vscode.Uri.file(path.join(tmpRoot, "apps", "vscode"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("returns 'missing build' fallback when dist/index.html is absent", () => {
    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "chat",
      vscode.ExtensionMode.Production,
    );

    expect(html).toContain("AFX chat build not found");
    expect(html).toContain("pnpm --filter");
  });

  it("rewrites absolute asset paths to webview URIs and injects CSP", () => {
    const distDir = path.join(tmpRoot, "apps", "chat", "dist");
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, "index.html"),
      `<!doctype html><html><head><link rel="stylesheet" crossorigin href="/assets/main.css"></head><body><script src="/assets/main.js" crossorigin></script></body></html>`,
    );

    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "chat",
      vscode.ExtensionMode.Production,
    );

    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("vscode-webview://test");
    expect(html).not.toMatch(/\scrossorigin/);
    expect(html).toMatch(/href="https:\/\/wv\//);
    expect(html).toMatch(/src="https:\/\/wv\//);
  });

  it("applies identity and style classes with legacy afx.theme = 'lyra'", () => {
    mockAfxConfig({ theme: "lyra" });

    const distDir = path.join(tmpRoot, "apps", "chat", "dist");
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, "index.html"),
      `<!doctype html><html><head></head><body><div id="root"></div></body></html>`,
    );

    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "chat",
      vscode.ExtensionMode.Production,
    );

    expect(html).toContain('class="theme-meridian style-lyra"');
  });

  it("adds supported style treatment classes", () => {
    const distDir = path.join(tmpRoot, "apps", "chat", "dist");
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, "index.html"),
      `<!doctype html><html><head></head><body class="vscode-dark"><div id="root"></div></body></html>`,
    );

    for (const style of ["lyra", "luma", "maia", "nova", "vega", "mira", "sera"]) {
      mockAfxConfig({ theme: "meridian", style });
      const html = loadWebviewHtml(
        fakeWebview(),
        extensionUri,
        "chat",
        vscode.ExtensionMode.Production,
      );
      expect(html).toContain(`theme-meridian style-${style} vscode-dark`);
      vi.restoreAllMocks();
    }
  });

  it("falls back to Meridian identity and Lyra treatment for unknown values", () => {
    mockAfxConfig({ theme: "unknown", style: "wat" });

    expect(getAppearanceClass()).toBe("theme-meridian style-lyra");
  });
});

describe("loadWebviewHtml — Development (HMR)", () => {
  let tmpRoot: string;
  let extensionUri: vscode.Uri;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "afx-wv-dev-"));
    fs.mkdirSync(path.join(tmpRoot, "apps", "vscode"), { recursive: true });
    extensionUri = vscode.Uri.file(path.join(tmpRoot, "apps", "vscode"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("loads Vite HMR URL when .vite-port-{app} exists", () => {
    mockAfxConfig({ theme: "meridian", style: "mira" });
    fs.writeFileSync(
      path.join(tmpRoot, ".vite-port-chat"),
      JSON.stringify({ host: "127.0.0.1", port: 5174, pid: process.pid }),
    );

    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "chat",
      vscode.ExtensionMode.Development,
    );

    expect(html).toContain("127.0.0.1:5174");
    expect(html).toContain("AFX chat (dev)");
    expect(html).toContain('body class="theme-meridian style-mira"');
    expect(html).toMatch(/nonce="[A-Za-z0-9]{32}"/);
  });

  it("falls back to prod path when a JSON port file references a dead process", () => {
    const portFile = path.join(tmpRoot, ".vite-port-chat");
    fs.writeFileSync(portFile, JSON.stringify({ host: "127.0.0.1", port: 5174, pid: -1 }));

    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "chat",
      vscode.ExtensionMode.Development,
    );

    expect(html).toContain("AFX chat build not found");
    // Stale file is removed so future loads don't repeat the dead-PID check.
    expect(fs.existsSync(portFile)).toBe(false);
  });

  it("falls back to prod path when a legacy numeric port file is stale", () => {
    const portFile = path.join(tmpRoot, ".vite-port-chat");
    fs.writeFileSync(portFile, "5174");
    const staleDate = new Date(Date.now() - 60_000);
    fs.utimesSync(portFile, staleDate, staleDate);

    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "chat",
      vscode.ExtensionMode.Development,
    );

    expect(html).toContain("AFX chat build not found");
    expect(fs.existsSync(portFile)).toBe(false);
  });

  it("falls back to prod path when .vite-port-{app} is missing", () => {
    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "chat",
      vscode.ExtensionMode.Development,
    );

    // No port file → no HMR HTML → prod path → missing build fallback
    expect(html).toContain("AFX chat build not found");
  });

  it("falls back to prod path when port file content is invalid", () => {
    const portFile = path.join(tmpRoot, ".vite-port-chat");
    fs.writeFileSync(portFile, "not-a-port");

    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "chat",
      vscode.ExtensionMode.Development,
    );

    expect(html).toContain("AFX chat build not found");
    expect(fs.existsSync(portFile)).toBe(false);
  });
});

// @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-6]
// @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-PREVIEW-PANEL]
describe("loadWebviewHtml — preview boot mode", () => {
  let tmpRoot: string;
  let extensionUri: vscode.Uri;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "afx-wv-preview-"));
    fs.mkdirSync(path.join(tmpRoot, "apps", "vscode"), { recursive: true });
    extensionUri = vscode.Uri.file(path.join(tmpRoot, "apps", "vscode"));
    const distDir = path.join(tmpRoot, "apps", "workbench", "dist");
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, "index.html"),
      `<!doctype html><html><head></head><body><div id="root"></div></body></html>`,
    );
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('adds data-afx-view="preview" on <body> when view is preview', () => {
    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "workbench",
      vscode.ExtensionMode.Production,
      { view: "preview" },
    );

    expect(html).toMatch(/<body[^>]*data-afx-view="preview"/);
  });

  it("does NOT add the attribute for a non-preview call", () => {
    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "workbench",
      vscode.ExtensionMode.Production,
    );

    expect(html).not.toContain('data-afx-view="preview"');
  });

  it("leaves the prod CSP unchanged in preview mode (FR-22 guard still passes)", () => {
    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "workbench",
      vscode.ExtensionMode.Production,
      { view: "preview" },
    );

    expect(html).toMatch(/<meta\s+http-equiv="Content-Security-Policy"/);
    expect(html).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(html).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(html).toMatch(/script-src\s+vscode-webview:\/\/test/);
  });
});

// @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-22] [DES-APPSEC]
describe("CSP guard (430-dx-enforcement FR-22)", () => {
  let tmpRoot: string;
  let extensionUri: vscode.Uri;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "afx-wv-csp-"));
    fs.mkdirSync(path.join(tmpRoot, "apps", "vscode"), { recursive: true });
    extensionUri = vscode.Uri.file(path.join(tmpRoot, "apps", "vscode"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("prod HTML always emits a CSP meta tag with no script unsafe-eval / unsafe-inline", () => {
    const distDir = path.join(tmpRoot, "apps", "chat", "dist");
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, "index.html"),
      `<!doctype html><html><head></head><body><div id="root"></div></body></html>`,
    );

    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "chat",
      vscode.ExtensionMode.Production,
    );

    expect(html).toMatch(/<meta\s+http-equiv="Content-Security-Policy"/);
    // Prod CSP must NOT permit eval-style script execution.
    expect(html).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(html).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    // Prod CSP must use webview cspSource for scripts, plus allow Clarity.
    expect(html).toMatch(/script-src\s+vscode-webview:\/\/test[^;]*https:\/\/www\.clarity\.ms/);
    expect(html).toMatch(/connect-src\s+vscode-webview:\/\/test[^;]*https:\/\/\*\.clarity\.ms/);
    expect(html).toMatch(/img-src\s+vscode-webview:\/\/test[^;]*https:\/\/\*\.clarity\.ms/);
  });

  it("dev HTML emits a CSP meta tag with a 32-char random script nonce", () => {
    fs.writeFileSync(path.join(tmpRoot, ".vite-port-chat"), "5174");

    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "chat",
      vscode.ExtensionMode.Development,
    );

    expect(html).toMatch(/<meta\s+http-equiv="Content-Security-Policy"/);
    expect(html).toMatch(
      /img-src\s+data:\s+http:\/\/127\.0\.0\.1:5174[^;]*https:\/\/\*\.clarity\.ms/,
    );
    // Dev needs unsafe-eval for HMR; that's the documented exception.
    // But it MUST also carry a per-render nonce to scope script execution.
    expect(html).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9]{32}'/);
  });

  it("'missing build' fallback also emits well-formed HTML (no CSP required — static error page)", () => {
    const html = loadWebviewHtml(
      fakeWebview(),
      extensionUri,
      "chat",
      vscode.ExtensionMode.Production,
    );

    // No CSP is fine for the error page; assert the page is still well-formed.
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("AFX chat build not found");
  });
});
