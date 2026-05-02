import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(extensionRoot, "..", "..");

const targets = [
  { name: "chat", source: path.join(repoRoot, "apps", "chat", "dist") },
  { name: "workbench", source: path.join(repoRoot, "apps", "workbench", "dist") },
];

for (const target of targets) {
  const sourceIndex = path.join(target.source, "index.html");
  if (!fs.existsSync(sourceIndex)) {
    throw new Error(
      `Missing ${target.name} build at ${sourceIndex}. Run pnpm --filter "apps/${target.name}" build first.`,
    );
  }

  const destination = path.join(extensionRoot, "resources", "webviews", target.name, "dist");
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(target.source, destination, { recursive: true });
}
