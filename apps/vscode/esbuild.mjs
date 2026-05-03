// @see docs/specs/310-infra-build/spec.md [FR-2]
// @see docs/specs/310-infra-build/design.md [DES-INFRA-BUILD-SYSTEM-CONTEXT]
import console from "node:console";
import process from "node:process";

import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').Plugin} */
const problemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => console.log("[esbuild-problem-matcher#onStart]"));
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location?.file) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`);
        }
      }
      console.log("[esbuild-problem-matcher#onEnd]");
    });
  },
};

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "out/extension.js",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "silent",
  plugins: [problemMatcherPlugin],
};

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
} else {
  await esbuild.build(config);
}
