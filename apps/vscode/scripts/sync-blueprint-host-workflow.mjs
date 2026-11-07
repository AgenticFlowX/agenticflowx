import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceIndex = process.argv.indexOf("--source");
if (sourceIndex < 0 || !process.argv[sourceIndex + 1])
  throw new Error(
    "Use --source <canonical AFX checkout>; no network or pinned-bundle rewrite is performed.",
  );
const source = await readFile(
  path.join(process.argv[sourceIndex + 1], "skills/agenticflowx/afx-blueprint/SKILL.md"),
);
const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../resources/host-workflows/afx-blueprint",
);
const manifest = `${JSON.stringify({ source: "AgenticFlowX/afx/skills/agenticflowx/afx-blueprint/SKILL.md", sha256: createHash("sha256").update(source).digest("hex"), publication: "workspace-draft", capability: "extension-host-command" }, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (
    !(await readFile(path.join(directory, "SKILL.md"))).equals(source) ||
    (await readFile(path.join(directory, "source.json"), "utf8")) !== manifest
  )
    throw new Error("Host workflow differs from canonical source.");
} else {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "SKILL.md"), source);
  await writeFile(path.join(directory, "source.json"), manifest);
}
