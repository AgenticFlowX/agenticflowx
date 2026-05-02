/**
 * Playwright config for workbench bottom-panel webview smoke + screenshot tests.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 * @see docs/specs/220-app-workbench/design.md [DES-TEST]
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
    viewport: { width: 1400, height: 600 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "vite --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env["CI"],
    timeout: 30_000,
  },
});
