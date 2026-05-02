/**
 * Capture chat webview screenshots for Chat/History/Settings tabs.
 *
 * Defaults write to the repo-root `artifacts/chat/screenshots/` directory so
 * captures sit outside any app source tree and stay clear of build pipelines.
 *
 * Usage:
 *   pnpm --filter apps/chat screenshot:ui
 *   pnpm --filter apps/chat screenshot:ui -- --url http://localhost:5175
 *   pnpm --filter apps/chat screenshot:ui -- --out ../../artifacts/chat/screenshots --light-host
 */
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..", "..");
const DEFAULT_URL = "http://localhost:5173/";
const DEFAULT_OUT_DIR = resolve(REPO_ROOT, "artifacts/chat/screenshots");
const DEFAULT_VIEWPORT = { width: 656, height: 1104 };
const DEFAULT_NARROW_VIEWPORT = { width: 320, height: 800 };

function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    out: DEFAULT_OUT_DIR,
    lightHost: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--url" && i + 1 < argv.length) {
      args.url = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--out" && i + 1 < argv.length) {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--light-host") {
      args.lightHost = true;
    }
  }

  return args;
}

async function applySimulatedLightHost(page) {
  await page.evaluate(() => {
    const root = document.documentElement.style;
    root.setProperty("--vscode-sideBar-background", "#f3f3f3");
    root.setProperty("--vscode-editor-foreground", "#1f1f1f");
    root.setProperty("--vscode-editorWidget-background", "#fbfbfb");
    root.setProperty("--vscode-editorGroupHeader-tabsBackground", "#ededed");
    root.setProperty("--vscode-descriptionForeground", "#707070");
    root.setProperty("--vscode-editor-background", "#ffffff");
    root.setProperty("--vscode-list-hoverBackground", "#e7e7e7");
    root.setProperty("--vscode-panel-border", "#d5d5d5");
    root.setProperty("--vscode-input-background", "#ffffff");
    root.setProperty("--vscode-input-border", "#d0d0d0");
    root.setProperty("--vscode-focusBorder", "#b9872a");
    document.body.classList.remove("vscode-dark");
    document.body.classList.add("theme-meridian", "style-lyra", "vscode-light");
  });
}

async function captureSuite(page, prefix, outDir, includeNarrow = false) {
  await page.screenshot({ path: resolve(outDir, `${prefix}-chat.png`), fullPage: true });
  await page.getByRole("tab", { name: "History" }).click();
  await page.waitForTimeout(120);
  await page.screenshot({ path: resolve(outDir, `${prefix}-history.png`), fullPage: true });
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.waitForTimeout(120);
  await page.screenshot({ path: resolve(outDir, `${prefix}-settings.png`), fullPage: true });

  if (includeNarrow) {
    await page.setViewportSize(DEFAULT_NARROW_VIEWPORT);
    await page.waitForTimeout(120);
    await page.screenshot({
      path: resolve(outDir, `${prefix}-settings-narrow.png`),
      fullPage: true,
    });
  }
}

async function main() {
  const { url, out, lightHost } = parseArgs(process.argv.slice(2));
  const outDir = resolve(out);
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: DEFAULT_VIEWPORT, deviceScaleFactor: 1 });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
    await captureSuite(page, "default", outDir);

    if (lightHost) {
      await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
      await applySimulatedLightHost(page);
      await page.waitForTimeout(350);
      await captureSuite(page, "light", outDir, true);
    }
  } finally {
    await browser.close();
  }

  console.log(`Saved screenshots to: ${outDir}`);
}

main().catch((error) => {
  console.error("screenshot capture failed:", error);
  process.exit(1);
});
