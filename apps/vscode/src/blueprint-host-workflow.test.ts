import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vitest";

it("packages a digest-pinned host workflow separately from the upstream skill archive", async () => {
  const directory = path.resolve(__dirname, "../resources/host-workflows/afx-blueprint");
  const source = await readFile(path.join(directory, "SKILL.md"));
  const provenance = JSON.parse(await readFile(path.join(directory, "source.json"), "utf8"));
  expect(provenance.sha256).toBe(createHash("sha256").update(source).digest("hex"));
  expect(provenance.publication).toBe("workspace-draft");
  expect(source.toString()).toContain("CLI check does not implement model-assisted Update/Rebuild");
});
