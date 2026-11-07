/** @see docs/specs/231-app-vscode-blueprint/design.md [DES-TEST] [DES-INSPECT] */
import { describe, expect, it } from "vitest";

import { listBlueprintFiles, summarizeBlueprintInventory } from "./blueprint-discovery";

describe("progressive Blueprint discovery", () => {
  it("keeps a large repository index small and navigable without dropping deep files", () => {
    const files = [
      "README.md",
      "Cargo.toml",
      ...Array.from({ length: 4998 }, (_, i) => `crates/component-${i}/src/main.rs`),
    ];
    expect(summarizeBlueprintInventory(files).length).toBeLessThan(1000);
    expect(listBlueprintFiles(files).entries).toEqual(["Cargo.toml", "README.md", "crates/"]);
    const names: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = listBlueprintFiles(files, "crates", offset);
      names.push(...page.entries);
      offset = page.nextOffset;
    }
    expect(new Set(names).size).toBe(4998);
    expect(listBlueprintFiles(files, "crates/component-4997/src").entries).toEqual(["main.rs"]);
  });

  it("keeps sibling prefixes separate and rejects traversal and invalid cursors", () => {
    const files = ["src/a.ts", "src-other/b.ts"];
    expect(listBlueprintFiles(files, "src").entries).toEqual(["a.ts"]);
    expect(() => listBlueprintFiles(files, "../private")).toThrow();
    expect(() => listBlueprintFiles(files, ".", -1)).toThrow();
    expect(() => listBlueprintFiles(files, ".", 0.5)).toThrow();
  });
});
