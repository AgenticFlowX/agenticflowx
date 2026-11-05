/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-15] [FR-19]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-FORMAT] [DES-TEST]
 */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import { expect, it } from "vitest";

import { validatePortableBlueprint } from "./blueprint-validation";

const bundle = path.resolve(__dirname, "../../resources/contracts/blueprint");
it("validates every shipped example offline and verifies canonical byte pins", async () => {
  const compiler = new Ajv2020({ strict: true, allErrors: true });
  addFormats(compiler);
  for (const file of [
    "blueprint.schema.json",
    "blueprint-v2.schema.json",
    "blueprint-v3.schema.json",
  ])
    compiler.addSchema(JSON.parse(await readFile(path.join(bundle, file), "utf8")) as object);
  for (const file of await readdir(path.join(bundle, "examples"))) {
    if (!file.endsWith(".json")) continue;
    const example: unknown = JSON.parse(
      await readFile(path.join(bundle, "examples", file), "utf8"),
    );
    expect(() => validatePortableBlueprint(example)).not.toThrow();
    expect(
      compiler.validate(
        `urn:afx:blueprint:${(example as { schemaVersion: number }).schemaVersion}`,
        example,
      ),
    ).toBe(true);
  }
  const pin = JSON.parse(await readFile(path.join(bundle, "pin.json"), "utf8")) as {
    source: { ref: string };
    files: Record<string, string>;
  };
  expect(pin.source.ref).toBe("unreleased-working-tree");
  for (const [file, expected] of Object.entries(pin.files))
    expect(
      createHash("sha256")
        .update(await readFile(path.join(bundle, file)))
        .digest("hex"),
    ).toBe(expected);
});
