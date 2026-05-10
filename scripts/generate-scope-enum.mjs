/**
 * Generates the commitlint scope-enum array by combining:
 *   1. Package names derived from pnpm-workspace.yaml globs
 *   2. Hand-maintained UI subsystems and cross-cutting scopes
 *
 * `deps` and `ci` are explicitly hand-maintained because Dependabot PR titles
 * use `chore(deps):` and `chore(ci):` — those need to pass amannn/action-semantic-pull-request.
 *
 * @see docs/specs/320-infra-scripts/spec.md [FR-1] [FR-2] [FR-3]
 * @see docs/specs/320-infra-scripts/design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW]
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Read pnpm-workspace.yaml to find workspace package paths
const workspaceYaml = yaml.load(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"));
const patterns = workspaceYaml.packages ?? [];

// Resolve concrete package dirs from globs (simple glob: "apps/*" → list apps/*)
const packageScopes = [];
for (const pattern of patterns) {
  if (pattern.endsWith("/*")) {
    const baseDir = join(root, pattern.slice(0, -2));
    try {
      const entries = readdirSync(baseDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          packageScopes.push(e.name);
        }
      }
    } catch {
      // dir doesn't exist yet — skip
    }
  }
}

// Hand-maintained UI subsystems and cross-cutting scopes (C-1)
// deps / ci: needed for Dependabot PR title validation
const handMaintained = [
  "chat/history",
  "chat/settings",
  "workbench/analytics",
  "workbench/board",
  "workbench/documents",
  "workbench/impact-lens",
  "workbench/journal",
  "workbench/notes",
  "workbench/pipeline",
  "workbench/shell",
  "bottom-panel",
  "ci",
  "deps",
  "docs",
  "dx",
  "e2e",
  "infra",
  "release",
  "repo",
  "scripts",
  "spec",
  "chat",
  "security",
];

const scopes = [...new Set([...packageScopes, ...handMaintained])].sort();

export default scopes;
