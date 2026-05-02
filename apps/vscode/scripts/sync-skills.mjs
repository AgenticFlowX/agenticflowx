import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AFX_REF = process.env.AFX_REF ?? "main";

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensionRoot = join(__dirname, "..");
const workspaceRoot = join(extensionRoot, "..", "..");
const targetDir = join(extensionRoot, "resources", "skills", "agenticflowx");

/**
 * Fetches the upstream AFX skill pack using the canonical afx-cli install pipe.
 *
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-1] [NFR-3] [DES-DEPS] [1.1]
 */
function installSkillsToTemp(target) {
  const url = `https://raw.githubusercontent.com/AgenticFlowX/afx/${AFX_REF}/afx-cli`;
  const install = spawnSync(
    "bash",
    [
      "-c",
      'set -euo pipefail; curl -fsSL "$AFX_CLI_URL" | bash -s -- --skills-only --target "$AFX_SKILLS_TARGET" --yes',
    ],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        AFX_CLI_URL: url,
        AFX_SKILLS_TARGET: target,
      },
      stdio: "inherit",
    },
  );

  if (install.error) {
    throw install.error;
  }

  if (install.status !== 0) {
    throw new Error(`afx-cli skill sync failed with exit code ${install.status ?? "unknown"}`);
  }
}

/**
 * Replaces only the extension-owned vendored bundle after the temp sync succeeds.
 *
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-1] [NFR-5] [DES-FILES] [1.1]
 */
function replaceVendoredBundle(sourceDir) {
  if (!existsSync(sourceDir)) {
    throw new Error(`Expected skill pack not found: ${sourceDir}`);
  }

  mkdirSync(dirname(targetDir), { recursive: true });
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(sourceDir, targetDir, { recursive: true });
}

/**
 * Verifies the copied bundle shape without inspecting or executing skill content.
 *
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-1] [FR-3] [DES-FILES] [1.1]
 */
function validateVendoredBundle() {
  if (!existsSync(targetDir)) {
    throw new Error(`Vendored skill bundle missing after sync: ${targetDir}`);
  }

  const skills = readdirSync(targetDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const missingSkillMd = skills.filter((skill) => !existsSync(join(targetDir, skill, "SKILL.md")));
  if (missingSkillMd.length > 0) {
    throw new Error(`Synced skills missing SKILL.md: ${missingSkillMd.join(", ")}`);
  }

  if (skills.length === 0) {
    throw new Error("No skills were synced into the vendored bundle");
  }

  return skills;
}

const tempDir = mkdtempSync(join(tmpdir(), "afx-skills-"));

try {
  console.log(`Syncing AFX skills from AgenticFlowX/afx@${AFX_REF}`);
  installSkillsToTemp(tempDir);

  const sourceDir = join(tempDir, ".afx", "skills", "agenticflowx");
  replaceVendoredBundle(sourceDir);

  const skills = validateVendoredBundle();
  console.log(`Synced ${skills.length} skills to ${targetDir}`);
  console.log(skills.map((skill) => `  - ${skill}`).join("\n"));
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
