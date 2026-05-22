import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const source = resolve(repoRoot, "packages/agent/pi-sdk/dist/bootstrap.js");
const target = resolve(here, "../resources/pi-sdk/bootstrap.js");
const resourceRoot = dirname(target);
const piCodingAgentPackageJson = await readPiCodingAgentPackageJson();

await mkdir(resourceRoot, { recursive: true });
await copyFile(source, target);
// Also copy the source map referenced by `//# sourceMappingURL=bootstrap.js.map`
// so Vite (during tests) and any debugger don't warn about a missing map.
await copyFile(`${source}.map`, `${target}.map`).catch(() => {});

// Bedrock is the only pi-ai provider that bootstrap.js lazy-loads via a
// runtime `import("./amazon-bedrock.js")`. Ship the pre-bundled sibling
// produced by build.bootstrap.mjs so the dynamic import resolves at runtime.
const bedrockSource = resolve(repoRoot, "packages/agent/pi-sdk/dist/amazon-bedrock.js");
const bedrockTarget = resolve(resourceRoot, "amazon-bedrock.js");
await copyFile(bedrockSource, bedrockTarget);
await copyFile(`${bedrockSource}.map`, `${bedrockTarget}.map`).catch(() => {});
await writeFile(
  resolve(resourceRoot, "package.json"),
  `${JSON.stringify(
    {
      type: "module",
      afxBundledPi: {
        package: piCodingAgentPackageJson.name ?? "@earendil-works/pi-coding-agent",
        version: piCodingAgentPackageJson.version ?? "?",
      },
    },
    null,
    2,
  )}\n`,
);

await Promise.all(
  ["core", "modes"].map(async (directory) => {
    const resourceTarget = resolve(resourceRoot, "dist", directory);
    await rm(resourceTarget, { recursive: true, force: true });
    await cp(resolve(repoRoot, "packages/agent/pi-sdk/dist", directory), resourceTarget, {
      recursive: true,
      force: true,
    });
  }),
);

async function readPiCodingAgentPackageJson() {
  const installedPackageJson = resolve(
    repoRoot,
    "packages",
    "agent",
    "pi-sdk",
    "node_modules",
    "@earendil-works",
    "pi-coding-agent",
    "package.json",
  );
  try {
    return JSON.parse(await readFile(installedPackageJson, "utf8"));
  } catch {
    const adapterPackageJson = JSON.parse(
      await readFile(resolve(repoRoot, "packages/agent/pi-sdk/package.json"), "utf8"),
    );
    const versionRange = adapterPackageJson.dependencies?.["@earendil-works/pi-coding-agent"];
    return {
      name: "@earendil-works/pi-coding-agent",
      version: typeof versionRange === "string" ? versionRange.replace(/^[^\d]*/, "") : "?",
    };
  }
}
