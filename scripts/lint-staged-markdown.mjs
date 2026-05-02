import { spawnSync } from "node:child_process";

const VENDORED_SKILLS_PATH = "apps/vscode/resources/skills/";

const files = process.argv
  .slice(2)
  .filter((file) => !file.replaceAll("\\", "/").includes(VENDORED_SKILLS_PATH));

if (files.length === 0) {
  process.exit(0);
}

run("prettier", ["--write", ...files]);
run("markdownlint-cli2", ["--fix", ...files]);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
