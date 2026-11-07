import { spawn } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixture = await realpath(
  await mkdtemp(
    path.join(process.platform === "darwin" ? "/tmp" : tmpdir(), "afx-blueprint-restart-"),
  ),
);
const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = false;
try {
  for (const scenario of ["inspect", "maintenance"]) {
    const source = path.join(fixture, scenario, "source");
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, "README.md"), "Restart fixture project.\n");
    await writeFile(path.join(source, "engine.ts"), "export const engine = true;\n");
    for (const phase of ["write", "resume"]) {
      await new Promise((resolve, reject) => {
        const child = spawn(
          process.platform === "win32" ? "pnpm.cmd" : "pnpm",
          ["exec", "vscode-test"],
          {
            cwd,
            stdio: "inherit",
            env: {
              ...process.env,
              AFX_BLUEPRINT_RESTART_PHASE: phase,
              AFX_BLUEPRINT_RESTART_SCENARIO: scenario,
              AFX_BLUEPRINT_RESTART_SOURCE: source,
              AFX_BLUEPRINT_RESTART_PROFILE: path.join(fixture, scenario, "profile"),
            },
          },
        );
        child.on("error", reject);
        child.on("exit", (code, signal) =>
          code === 0
            ? resolve()
            : reject(new Error(`Blueprint restart ${phase} failed: ${signal ?? code}`)),
        );
      });
    }
  }
  passed = true;
} finally {
  if (passed) await rm(fixture, { recursive: true, force: true });
  else console.error("Retained failed restart fixture:", fixture);
}
