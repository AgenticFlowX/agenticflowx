import { chmod, copyFile, mkdir, readdir, realpath, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { platform } from "node:process";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

// @see docs/specs/351-agent-pi/spec.md [FR-2] [FR-7]
// @see docs/specs/351-agent-pi/design.md [DES-PI-080-STARTUP] [DES-TEST]
const outfile = resolve("dist/bootstrap.js");
const piCodingAgentRoot = await realpath(
  resolve(dirname(fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"))), ".."),
);
// Pi 1.5's optional peer dependencies can make pnpm install two physical pi-ai
// copies. Register OAuth loaders on the copy consumed by pi-coding-agent.
const piAiBundledOAuth = resolve(piCodingAgentRoot, "../pi-ai/dist/bun-oauth.js");

await build({
  entryPoints: ["bootstrap/bootstrap.ts"],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  alias: { "@earendil-works/pi-ai/bun-oauth": piAiBundledOAuth },
  sourcemap: true,
  banner: {
    js: 'import { createRequire as __afxCreateRequire } from "node:module";\nconst require = __afxCreateRequire(import.meta.url);',
  },
});

// Pi keeps Bedrock's AWS SDK implementation behind a variable-specifier lazy
// import. Because esbuild folds the lazy loader into bootstrap.js, import.meta.url
// points at the emitted bootstrap rather than pi-ai's original `api/` directory.
// Ship the implementation as a sibling so `./bedrock-converse-stream.js` resolves.
const bedrockEntry = fileURLToPath(
  import.meta.resolve("@earendil-works/pi-ai/api/bedrock-converse-stream"),
);
const bedrockOutfile = resolve("dist/bedrock-converse-stream.js");
await Promise.all([
  rm(resolve("dist/amazon-bedrock.js"), { force: true }),
  rm(resolve("dist/amazon-bedrock.js.map"), { force: true }),
  rm(resolve("dist/api/bedrock-converse-stream.js"), { force: true }),
  rm(resolve("dist/api/bedrock-converse-stream.js.map"), { force: true }),
]);
await build({
  entryPoints: [bedrockEntry],
  outfile: bedrockOutfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  // AWS SDK has CommonJS deps that call `require("buffer")`, `require("util")`,
  // etc. at runtime. esbuild stubs `require` out in ESM mode unless we provide
  // a real one — same banner pattern as the main bootstrap.js bundle above.
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
