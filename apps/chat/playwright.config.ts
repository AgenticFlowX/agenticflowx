/**
 * Playwright config for chat webview smoke tests.
 * Runs against the Vite dev server (started as a dependency).
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 * @see docs/specs/210-app-chat/design.md [DES-TEST]
 */
import { defineConfig, devices } from "@playwright/test";

const isExtensionCapture = process.env["AFX_EXTENSION_CAPTURE"] === "1";
const port = Number(process.env["AFX_CHAT_E2E_PORT"] ?? (isExtensionCapture ? 5194 : 5184));
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../vscode-e2e/artifacts/test-results/chat",
  // A curated still pass deliberately walks several independent surfaces at
  // retina resolution. Keep this separate from the 30s product-E2E budget.
  timeout: isExtensionCapture ? 240_000 : 30_000,
  testIgnore: isExtensionCapture ? undefined : "**/extension-capture.spec.ts",
  testMatch: isExtensionCapture ? "**/extension-capture.spec.ts" : "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: isExtensionCapture ? 0 : process.env["CI"] ? 2 : 0,
  // The webview and its Vite server share this process tree. Unbounded local
  // Playwright fan-out can starve app bootstrap and turn healthy 2–5s tests into
  // 30s mount timeouts; two workers keep the release aggregate deterministic.
  workers: isExtensionCapture ? 1 : process.env["CI"] ? 1 : 2,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    actionTimeout: isExtensionCapture ? 10_000 : 0,
    baseURL,
    trace: "on-first-retry",
    viewport: isExtensionCapture ? { width: 1600, height: 900 } : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Note: do NOT add `--` between `pnpm dev` and the flags. With pnpm 10 the
    // `--` is passed through to vite as a positional argument, which causes
    // vite to ignore the trailing `--port`/`--strictPort` flags and silently
    // fall back to its default port — Playwright then waits forever on the
    // wrong URL and only times out.
    command: `pnpm dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env["CI"],
    // Cold Vite startup with all workspace deps can exceed 30s on slower
    // machines and in CI containers. 120s gives healthy headroom.
    timeout: 120_000,
  },
});
