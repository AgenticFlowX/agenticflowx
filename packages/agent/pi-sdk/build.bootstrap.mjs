import { chmod, copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { platform } from "node:process";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const outfile = resolve("dist/bootstrap.js");
const piCodingAgentRoot = resolve(
  dirname(fileURLToPath(import.meta.resolve("@mariozechner/pi-coding-agent"))),
  "..",
);

await build({
  entryPoints: ["bootstrap/bootstrap.ts"],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  banner: {
    js: 'import { createRequire as __afxCreateRequire } from "node:module";\nconst require = __afxCreateRequire(import.meta.url);',
  },
});

await copyRuntimeAssets();

if (platform !== "win32") {
  await chmod(outfile, 0o755);
}

async function copyRuntimeAssets() {
  await copyFilteredFiles("dist/modes/interactive/theme", "dist/modes/interactive/theme", (file) =>
    file.endsWith(".json"),
  );
  await copyFilteredFiles(
    "dist/modes/interactive/assets",
    "dist/modes/interactive/assets",
    (file) => file.endsWith(".png"),
  );
  await copyExportHtmlAssets();
}

async function copyFilteredFiles(sourceDir, targetDir, includeFile) {
  const resolvedSourceDir = resolve(piCodingAgentRoot, sourceDir);
  const resolvedTargetDir = resolve(targetDir);
  await resetDirectory(resolvedTargetDir);

  const files = await readdir(resolvedSourceDir, { withFileTypes: true });
  await Promise.all(
    files
      .filter((file) => file.isFile() && includeFile(file.name))
      .map((file) =>
        copyFile(resolve(resolvedSourceDir, file.name), resolve(resolvedTargetDir, file.name)),
      ),
  );
}

async function copyExportHtmlAssets() {
  const sourceDir = resolve(piCodingAgentRoot, "dist/core/export-html");
  const targetDir = resolve("dist/core/export-html");
  await resetDirectory(targetDir);

  await Promise.all(
    ["template.html", "template.css", "template.js"].map((file) =>
      copyFile(resolve(sourceDir, file), resolve(targetDir, file)),
    ),
  );

  await copyFilteredFiles("dist/core/export-html/vendor", "dist/core/export-html/vendor", (file) =>
    file.endsWith(".js"),
  );
}

async function resetDirectory(directory) {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}
