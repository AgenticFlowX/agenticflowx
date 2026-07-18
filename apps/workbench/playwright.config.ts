/**
 * Playwright config for workbench bottom-panel webview smoke + screenshot tests.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-TEST]
 */
import { defineConfig, devices } from "@playwright/test";

const isExtensionCapture = process.env["AFX_EXTENSION_CAPTURE"] === "1";
const port = Number(process.env["AFX_WORKBENCH_E2E_PORT"] ?? (isExtensionCapture ? 5195 : 5175));
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../vscode-e2e/artifacts/test-results/workbench",
  // Capture tests render several real documents and retina screenshots; they
  // are an asset pipeline, not part of the 30s product-E2E budget.
  timeout: isExtensionCapture ? 240_000 : 30_000,
  testIgnore: isExtensionCapture ? undefined : "**/extension-capture.spec.ts",
  testMatch: isExtensionCapture ? "**/extension-capture.spec.ts" : "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: isExtensionCapture ? 0 : process.env["CI"] ? 2 : 0,
  // Canvas/preview browser cases share the Vite server and can starve one
  // another when local Playwright consumes every core. Match Chat's proven
  // two-worker release configuration; CI and asset capture remain serial.
  workers: isExtensionCapture ? 1 : process.env["CI"] ? 1 : 2,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    actionTimeout: isExtensionCapture ? 10_000 : 0,
    baseURL,
    trace: "on-first-retry",
    viewport: isExtensionCapture ? { width: 1600, height: 900 } : { width: 1400, height: 600 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env["CI"],
    timeout: isExtensionCapture ? 120_000 : 30_000,
  },
});
