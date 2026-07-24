import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertLegalArchiveEntries,
  buildLegalArtifacts,
  checkLegalArtifacts,
} from "./third-party-notices.mjs";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("artifact-aware third-party notices", () => {
  it("discovers shipped packages from source maps and renders deterministic exact evidence", async () => {
    const root = await fixtureRoot({ license: "MIT" });
    const options = fixtureOptions(root);

    const first = await buildLegalArtifacts(options);
    const second = await buildLegalArtifacts(options);

    expect(first).toEqual(second);
    expect(first.inventory.components.map((component) => component.key)).toEqual(["demo@1.2.3"]);
    expect(first.notice).toContain("Demo Project (1.2.3)");
    expect(first.thirdPartyNotices).toContain("Permission is hereby granted");
    expect(first.thirdPartyNotices).toContain("demo@1.2.3");
  });

  it("fails closed on disallowed or missing license evidence", async () => {
    const disallowed = await fixtureRoot({ license: "GPL-3.0-only" });
    await expect(buildLegalArtifacts(fixtureOptions(disallowed))).rejects.toThrow(
      /Disallowed or unknown license/,
    );

    const missing = await fixtureRoot({ license: "MIT", includeLicenseFile: false });
    await expect(buildLegalArtifacts(fixtureOptions(missing))).rejects.toThrow(
      /Missing exact LICENSE evidence/,
    );
  });

  it("accepts only an exact version-bound audited override", async () => {
    const root = await fixtureRoot({ license: "MIT", includeLicenseFile: false });
    await mkdir(join(root, "legal"), { recursive: true });
    await writeFile(join(root, "legal/LICENSE"), "audited exact license\n");
    const base = fixtureOptions(root);
    const override = {
      name: "demo",
      version: "1.2.3",
      license: "MIT",
      repository: "https://example.com/demo",
      licenseFiles: ["legal/LICENSE"],
      reason: "Published fixture omits LICENSE.",
      source: "https://example.com/demo/LICENSE",
    };

    const result = await buildLegalArtifacts({ ...base, auditedOverrides: [override] });
    expect(result.inventory.components[0].override?.reason).toContain("omits LICENSE");

    await expect(
      buildLegalArtifacts({
        ...base,
        auditedOverrides: [{ ...override, version: "1.2.4" }],
      }),
    ).rejects.toThrow(/Missing exact LICENSE evidence/);
  });

  it("fails when tracked notice files are stale", async () => {
    const root = await fixtureRoot({ license: "MIT" });
    await writeFile(join(root, "NOTICE"), "stale\n");
    await writeFile(join(root, "THIRD_PARTY_NOTICES.md"), "stale\n");

    await expect(checkLegalArtifacts(fixtureOptions(root))).rejects.toThrow(
      /Legal artifacts are missing or stale: NOTICE, THIRD_PARTY_NOTICES\.md/,
    );
  });

  it("rejects missing and stale legal files in the packaged archive", () => {
    const expected = new Map([
      ["extension/LICENSE.txt", Buffer.from("license")],
      ["extension/NOTICE", Buffer.from("notice")],
      ["extension/THIRD_PARTY_NOTICES.md", Buffer.from("third")],
    ]);
    const missing = new Map(expected);
    missing.delete("extension/NOTICE");
    expect(() => assertLegalArchiveEntries(missing, expected)).toThrow(/missing extension\/NOTICE/);

    const stale = new Map(expected);
    stale.set("extension/NOTICE", Buffer.from("old"));
    expect(() => assertLegalArchiveEntries(stale, expected)).toThrow(/stale extension\/NOTICE/);
    expect(() => assertLegalArchiveEntries(new Map(expected), expected)).not.toThrow();
  });
});

async function fixtureRoot({
  license,
  includeLicenseFile = true,
}: {
  license: string;
  includeLicenseFile?: boolean;
}) {
  const root = await mkdtemp(join(tmpdir(), "afx-legal-"));
  tempRoots.push(root);
  const packageRoot = join(root, "node_modules/demo");
  await mkdir(join(root, "dist"), { recursive: true });
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    join(packageRoot, "package.json"),
    `${JSON.stringify({
      name: "demo",
      version: "1.2.3",
      license,
      repository: "https://example.com/demo.git",
    })}\n`,
  );
  await writeFile(join(packageRoot, "index.js"), "export const demo = true;\n");
  if (includeLicenseFile) {
    await writeFile(
      join(packageRoot, "LICENSE"),
      "MIT License\n\nPermission is hereby granted to use this fixture.\n",
    );
  }
  await writeFile(
    join(root, "dist/app.js.map"),
    JSON.stringify({ version: 3, sources: ["../node_modules/demo/index.js"], mappings: "" }),
  );
  return root;
}

function fixtureOptions(repoRoot: string) {
  return {
    repoRoot,
    allowedLicenses: new Set(["MIT"]),
    auditedOverrides: [],
    bundleGroups: [{ label: "fixture bundle", files: ["dist/app.js.map"] }],
    copiedAssets: [],
    projectAcknowledgments: [
      {
        title: "Demo Project",
        packageNames: ["demo"],
        text: "Demo fixture.",
        url: "https://example.com/demo",
      },
    ],
    standardsAcknowledgments: [],
  };
}
