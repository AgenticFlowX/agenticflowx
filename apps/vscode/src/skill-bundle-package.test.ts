/**
 * Bundled AFX skill packaging contract.
 *
 * Ensures VSCE includes every vendored skill file, including progressively
 * disclosed references, templates, and executable helpers.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-3]
 * @see docs/specs/351-agent-pi/design.md [DES-DEPS] [DES-FILES] [DES-TEST]
 * @see docs/specs/520-ci-publish/spec.md [FR-2]
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PackageManager, listFiles } from "@vscode/vsce";
import { describe, expect, it } from "vitest";

const extensionRoot = fileURLToPath(new URL("..", import.meta.url));
const bundledSkillsRoot = path.join(extensionRoot, "resources", "skills", "agenticflowx");

function listBundledFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listBundledFiles(absolutePath);
    return [path.relative(extensionRoot, absolutePath).split(path.sep).join("/")];
  });
}

describe("bundled AFX skill package", () => {
  it("includes every split skill resource in the VSIX file set", async () => {
    const packagedFiles = new Set(
      await listFiles({
        cwd: extensionRoot,
        packageManager: PackageManager.None,
        packagedDependencies: [],
      }),
    );
    const bundledFiles = listBundledFiles(bundledSkillsRoot);
    const missingFiles = bundledFiles.filter((file) => !packagedFiles.has(file));

    expect(bundledFiles).toEqual(
      expect.arrayContaining([
        "resources/skills/agenticflowx/afx-dash/SKILL.md",
        "resources/skills/agenticflowx/afx-dash/assets/dash-template.md",
        "resources/skills/agenticflowx/afx-dev/references/refactor.md",
        "resources/skills/agenticflowx/afx-help/scripts/afx-doc-query.mjs",
        "resources/skills/agenticflowx/afx-help/scripts/afx-validate.mjs",
      ]),
    );
    expect(missingFiles).toEqual([]);
  });
});
