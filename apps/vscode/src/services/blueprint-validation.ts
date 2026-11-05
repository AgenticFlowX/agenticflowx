/**
 * Lazy offline validation from the pinned canonical standalone validator.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-15] [FR-19]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-FORMAT] [DES-MODEL]
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { ValidateFunction } from "ajv";

// The first path is for source-host tests; the second is the installed out/extension.js.
// Both are relative to trusted extension code, never a workspace or document $schema URL.
function resource(file: string): string {
  const candidates = [
    path.resolve(__dirname, "../../resources/contracts/blueprint", file),
    path.resolve(__dirname, "../resources/contracts/blueprint", file),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found)
    throw new Error(
      "Bundled Blueprint contract is missing. Reinstall the extension before writing artifacts.",
    );
  return found;
}
let validators: { v1: ValidateFunction; v2: ValidateFunction; v3: ValidateFunction } | undefined;
export function validatePortableBlueprint(value: unknown): void {
  const version = (value as { schemaVersion?: number } | null)?.schemaVersion;
  if (version !== 1 && version !== 2 && version !== 3)
    throw new Error("Unsupported Blueprint schema version.");
  validators ??= createRequire(__filename)(resource("validate.cjs")) as {
    v1: ValidateFunction;
    v2: ValidateFunction;
    v3: ValidateFunction;
  };
  const validate = version === 1 ? validators.v1 : version === 2 ? validators.v2 : validators.v3;
  if (!validate(value))
    throw new Error(`Invalid Blueprint contract: ${JSON.stringify(validate.errors?.slice(0, 3))}`);
}
export function portableBlueprintSchema(version: 1 | 2 | 3): unknown {
  return JSON.parse(
    readFileSync(
      resource(
        version === 3
          ? "blueprint-v3.schema.json"
          : version === 2
            ? "blueprint-v2.schema.json"
            : "blueprint.schema.json",
      ),
      "utf8",
    ),
  );
}
