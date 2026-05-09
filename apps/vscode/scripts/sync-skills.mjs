import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensionRoot = join(__dirname, "..");
const workspaceRoot = join(extensionRoot, "..", "..");
const targetDir = join(extensionRoot, "resources", "skills", "agenticflowx");
const packageJson = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const verifyOnly = process.argv.includes("--verify");
const AFX_REF = process.env.AFX_REF ?? packageJson.afxSkillsPin ?? "main";

/**
 * Fetches the pinned upstream source archive without running remote code. Both
 * sync and CI verification use this path so skill bundles stay deterministic.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-3]
 * @see docs/specs/351-agent-pi/design.md [DES-DEPS]
 */
function fetchSkillsArchiveToTemp(target) {
  const archivePath = join(target, "afx.tar.gz");
  const url = `https://github.com/AgenticFlowX/afx/archive/${AFX_REF}.tar.gz`;
  const download = spawnSync("curl", ["-fsSL", "--output", archivePath, url], {
    cwd: workspaceRoot,
    stdio: "inherit",
  });

  if (download.error) {
    throw download.error;
  }

  if (download.status !== 0) {
    throw new Error(`AFX archive download failed with exit code ${download.status ?? "unknown"}`);
  }

  const extract = spawnSync("tar", ["-xzf", archivePath, "-C", target], {
    cwd: workspaceRoot,
    stdio: "inherit",
  });

  if (extract.error) {
    throw extract.error;
  }

  if (extract.status !== 0) {
    throw new Error(`AFX archive extraction failed with exit code ${extract.status ?? "unknown"}`);
  }

  const rootDir = readdirSync(target, { withFileTypes: true }).find(
    (entry) => entry.isDirectory() && entry.name.startsWith("afx-"),
  );
  if (!rootDir) {
    throw new Error("AFX archive did not contain an afx-* root directory");
  }

  return join(target, rootDir.name, "skills", "agenticflowx");
}

/**
 * Replaces only the extension-owned vendored bundle after the temp sync succeeds.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-3]
 * @see docs/specs/351-agent-pi/design.md [DES-FILES]
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
 * @see docs/specs/351-agent-pi/spec.md [FR-3]
 * @see docs/specs/351-agent-pi/design.md [DES-TEST]
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

function listFiles(root, prefix = "") {
  return readdirSync(join(root, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = prefix ? join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) {
        return listFiles(root, relativePath);
      }
      return [relativePath];
    })
    .sort();
}

/**
 * Compares the freshly installed bundle with the vendored resources without
 * mutating the workspace. Used by CI to prove the pinned skill bundle is stable.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-3]
 * @see docs/specs/351-agent-pi/design.md [DES-DEPS]
 */
function verifyVendoredBundle(sourceDir) {
  if (!existsSync(targetDir)) {
    throw new Error(`Vendored skill bundle missing: ${targetDir}`);
  }

  const sourceFiles = listFiles(sourceDir);
  const targetFiles = listFiles(targetDir);
  const sourceSet = new Set(sourceFiles);
  const targetSet = new Set(targetFiles);
  const missing = sourceFiles.filter((file) => !targetSet.has(file));
  const extra = targetFiles.filter((file) => !sourceSet.has(file));
  const changed = sourceFiles.filter((file) => {
    if (!targetSet.has(file)) {
      return false;
    }
    const sourcePath = join(sourceDir, file);
    const targetPath = join(targetDir, file);
    const sourceStat = statSync(sourcePath);
    const targetStat = statSync(targetPath);
    return (
      sourceStat.size !== targetStat.size ||
      readFileSync(sourcePath, "utf8") !== readFileSync(targetPath, "utf8")
    );
  });

  if (missing.length > 0 || extra.length > 0 || changed.length > 0) {
    throw new Error(
      [
        `Vendored AFX skills drift from pinned ref ${AFX_REF}.`,
        missing.length > 0
          ? `Missing files:\n${missing.map((file) => `  - ${file}`).join("\n")}`
          : "",
        extra.length > 0 ? `Extra files:\n${extra.map((file) => `  - ${file}`).join("\n")}` : "",
        changed.length > 0
          ? `Changed files:\n${changed.map((file) => `  - ${file}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
}

const tempDir = mkdtempSync(join(tmpdir(), "afx-skills-"));

try {
  console.log(
    `${verifyOnly ? "Verifying" : "Syncing"} AFX skills from AgenticFlowX/afx@${AFX_REF}`,
  );
  if (verifyOnly) {
    const sourceDir = fetchSkillsArchiveToTemp(tempDir);
    validateVendoredBundle();
    verifyVendoredBundle(sourceDir);
    console.log(`Vendored skills match pinned ref ${AFX_REF}`);
  } else {
    const sourceDir = fetchSkillsArchiveToTemp(tempDir);
    replaceVendoredBundle(sourceDir);

    const skills = validateVendoredBundle();
    console.log(`Synced ${skills.length} skills to ${targetDir}`);
    console.log(skills.map((skill) => `  - ${skill}`).join("\n"));
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
