/**
 * Playwright config for chat webview smoke tests.
 * Runs against the Vite dev server (started as a dependency).
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 * @see docs/specs/210-app-chat/design.md [DES-TEST]
 */
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["AFX_CHAT_E2E_PORT"] ?? 5184);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
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
