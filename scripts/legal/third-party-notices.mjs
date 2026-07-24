#!/usr/bin/env node

/**
 * Deterministic, artifact-aware third-party notice generator and VSIX gate.
 *
 * The inventory is derived from production source maps plus an explicit list
 * of copied runtime assets. It does not assume that the root package graph is
 * equivalent to what the extension ships.
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-18] [DES-SUPPLY]
 * @see docs/specs/520-ci-publish/tasks.md [3.1]
 */
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

import {
  allowedLicenses,
  auditedOverrides,
  bundleGroups,
  copiedAssets,
  projectAcknowledgments,
  standardsAcknowledgments,
} from "./config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const defaultRepoRoot = resolve(here, "../..");
const NOTICE_PATH = "NOTICE";
const THIRD_PARTY_PATH = "THIRD_PARTY_NOTICES.md";
const EXTENSION_ROOT = "apps/vscode";
const LEGAL_ARCHIVE_PATHS = [
  "extension/LICENSE.txt",
  "extension/NOTICE",
  "extension/THIRD_PARTY_NOTICES.md",
];

/**
 * Build the complete legal inventory and rendered tracked files.
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-18]
 */
export async function buildLegalArtifacts(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const policy = {
    allowedLicenses: options.allowedLicenses ?? allowedLicenses,
    auditedOverrides: options.auditedOverrides ?? auditedOverrides,
    bundleGroups: options.bundleGroups ?? bundleGroups,
    copiedAssets: options.copiedAssets ?? copiedAssets,
    projectAcknowledgments: options.projectAcknowledgments ?? projectAcknowledgments,
    standardsAcknowledgments: options.standardsAcknowledgments ?? standardsAcknowledgments,
  };
  const components = new Map();
  const inputFiles = [];

  for (const group of policy.bundleGroups) {
    const files = await expandRequiredInput(repoRoot, group);
    inputFiles.push(...files);
    for (const mapPath of files) {
      const packageJsonPaths = await packagesFromSourceMap(mapPath);
      for (const packageJsonPath of packageJsonPaths) {
        const component = await componentFromPackage(repoRoot, packageJsonPath, policy);
        addComponent(components, component, group.label, relative(repoRoot, mapPath));
      }
    }
  }

  for (const declaration of policy.copiedAssets) {
    const files = await expandRequiredInput(repoRoot, declaration);
    inputFiles.push(...files);
    await verifyDeclaredVersion(files, declaration);
    const component = declaration.packageJson
      ? await componentFromPackage(repoRoot, resolve(repoRoot, declaration.packageJson), policy)
      : await componentFromDeclaration(repoRoot, declaration.component, policy.allowedLicenses);
    for (const file of files) {
      addComponent(components, component, declaration.label, relative(repoRoot, file));
    }
  }

  const sortedComponents = [...components.values()].map(finalizeComponent).sort(compareComponents);
  if (sortedComponents.length === 0) {
    throw new Error("Legal inventory is empty; refusing to generate incomplete notices.");
  }

  const inventory = {
    components: sortedComponents,
    inputs: [...new Set(inputFiles.map((file) => relative(repoRoot, file)))].sort(),
  };
  return {
    inventory,
    notice: renderNotice(inventory, policy),
    thirdPartyNotices: renderThirdPartyNotices(inventory, policy),
  };
}

/**
 * Write the canonical legal files at the repository root.
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-18]
 */
export async function writeLegalArtifacts(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const artifacts = await buildLegalArtifacts(options);
  await writeFile(resolve(repoRoot, NOTICE_PATH), artifacts.notice, "utf8");
  await writeFile(resolve(repoRoot, THIRD_PARTY_PATH), artifacts.thirdPartyNotices, "utf8");
  return artifacts;
}

/**
 * Fail when the tracked legal files do not exactly match the shipped inputs.
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-18]
 */
export async function checkLegalArtifacts(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const artifacts = await buildLegalArtifacts(options);
  const mismatches = [];
  for (const [path, expected] of [
    [NOTICE_PATH, artifacts.notice],
    [THIRD_PARTY_PATH, artifacts.thirdPartyNotices],
  ]) {
    const actual = await readFile(resolve(repoRoot, path), "utf8").catch(() => null);
    if (actual !== expected) mismatches.push(path);
  }
  if (mismatches.length > 0) {
    throw new Error(
      `Legal artifacts are missing or stale: ${mismatches.join(", ")}. Run pnpm legal:write after building production bundles.`,
    );
  }
  return artifacts;
}

/**
 * Check notices, then stage exact tracked copies for VSIX packaging.
 *
 * @see docs/specs/520-ci-publish/tasks.md [3.1]
 */
export async function stageExtensionLegalFiles(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  await checkLegalArtifacts(options);
  const extensionRoot = resolve(repoRoot, EXTENSION_ROOT);
  await mkdir(extensionRoot, { recursive: true });
  await Promise.all(
    [NOTICE_PATH, THIRD_PARTY_PATH].map((path) =>
      copyFile(resolve(repoRoot, path), resolve(extensionRoot, path)),
    ),
  );
  const rootLicense = normalizeExact(await readFile(resolve(repoRoot, "LICENSE"), "utf8"));
  const extensionLicense = normalizeExact(
    await readFile(resolve(extensionRoot, "LICENSE"), "utf8"),
  );
  if (rootLicense !== extensionLicense) {
    throw new Error("apps/vscode/LICENSE is not an exact normalized copy of root LICENSE.");
  }
}

/**
 * Assert that a VSIX includes exact copies of every required legal file.
 *
 * @see docs/specs/520-ci-publish/spec.md [FR-4]
 * @see docs/specs/520-ci-publish/design.md [DES-TEST]
 */
export async function verifyVsixLegalFiles(target, options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const vsixPath = await resolveVsixPath(repoRoot, target);
  const entries = readZipEntries(await readFile(vsixPath));
  const expected = new Map([
    ["extension/LICENSE.txt", await readFile(resolve(repoRoot, EXTENSION_ROOT, "LICENSE"))],
    ["extension/NOTICE", await readFile(resolve(repoRoot, NOTICE_PATH))],
    ["extension/THIRD_PARTY_NOTICES.md", await readFile(resolve(repoRoot, THIRD_PARTY_PATH))],
  ]);
  assertLegalArchiveEntries(entries, expected);
  return vsixPath;
}

/**
 * Assert required archive entries against their tracked source bytes.
 *
 * @see docs/specs/520-ci-publish/design.md [DES-TEST]
 */
export function assertLegalArchiveEntries(entries, expected) {
  const errors = [];
  for (const path of LEGAL_ARCHIVE_PATHS) {
    const actual = entries.get(path);
    if (!actual) {
      errors.push(`missing ${path}`);
      continue;
    }
    const expectedContent = expected.get(path);
    if (expectedContent && !actual.equals(expectedContent)) {
      errors.push(`stale ${path}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`VSIX legal artifact check failed: ${errors.join(", ")}`);
  }
}

async function packagesFromSourceMap(mapPath) {
  let sourceMap;
  try {
    sourceMap = JSON.parse(await readFile(mapPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse source map ${mapPath}: ${errorMessage(error)}`, {
      cause: error,
    });
  }
  if (!Array.isArray(sourceMap.sources)) {
    throw new Error(`Source map has no sources array: ${mapPath}`);
  }

  const packages = new Set();
  for (const source of sourceMap.sources) {
    if (typeof source !== "string" || !source.includes("node_modules")) continue;
    const sourcePath = resolveMapSource(mapPath, source);
    if (!sourcePath) continue;
    const packageJson = await findNearestPackageJson(sourcePath);
    if (packageJson) packages.add(packageJson);
  }
  return [...packages].sort();
}

function resolveMapSource(mapPath, source) {
  const clean = source
    .replace(/^webpack:\/\//, "")
    .replace(/^vite:\/\//, "")
    .replace(/[?#].*$/, "");
  if (clean.startsWith("file://")) {
    try {
      return fileURLToPath(clean);
    } catch {
      return null;
    }
  }
  if (clean.startsWith("\0") || clean.startsWith("<")) return null;
  return isAbsolute(clean) ? clean : resolve(dirname(mapPath), clean);
}

async function findNearestPackageJson(sourcePath) {
  let current = extname(sourcePath) ? dirname(sourcePath) : sourcePath;
  const nodeModulesSegment = `${sep}node_modules${sep}`;
  if (!current.includes(nodeModulesSegment)) return null;
  while (current !== dirname(current)) {
    const candidate = join(current, "package.json");
    if (await isFile(candidate)) {
      const metadata = JSON.parse(await readFile(candidate, "utf8"));
      if (typeof metadata.name === "string" && typeof metadata.version === "string") {
        return candidate;
      }
    }
    current = dirname(current);
  }
  return null;
}

async function componentFromPackage(repoRoot, packageJsonPath, policy) {
  if (!(await isFile(packageJsonPath))) {
    throw new Error(
      `Missing package metadata for copied asset: ${relative(repoRoot, packageJsonPath)}`,
    );
  }
  const metadata = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const name = metadata.name;
  const version = metadata.version;
  if (typeof name !== "string" || typeof version !== "string") {
    throw new Error(`Invalid package name/version in ${packageJsonPath}`);
  }
  const override = policy.auditedOverrides.find(
    (entry) => entry.name === name && entry.version === version,
  );
  const license = override?.license ?? metadata.license;
  validateLicense(name, version, license, policy.allowedLicenses);
  if (override && metadata.license && metadata.license !== override.license) {
    throw new Error(
      `Audited override license mismatch for ${name}@${version}: package=${metadata.license}, override=${override.license}`,
    );
  }

  const packageRoot = dirname(packageJsonPath);
  const detectedLicenseFiles = override
    ? []
    : await evidenceFiles(packageRoot, /^(licen[cs]e|copying)([-._].*)?$/i);
  const licenseFiles = override
    ? (override.licenseFiles ?? []).map((path) => resolve(repoRoot, path))
    : detectedLicenseFiles;
  const sectionEvidence = override?.packageLicenseSections
    ? await readEvidenceSections(packageRoot, override.packageLicenseSections)
    : [];
  if (licenseFiles.length === 0 && sectionEvidence.length === 0) {
    throw new Error(
      `Missing exact LICENSE evidence for ${name}@${version}; add a version-bound audited override if upstream omitted it.`,
    );
  }
  const noticeFiles = await evidenceFiles(packageRoot, /^notice(\..*)?$/i);
  return {
    key: `${name}@${version}`,
    name,
    version,
    license,
    repository:
      override?.repository ??
      normalizeRepository(metadata.repository) ??
      metadata.homepage ??
      npmUrl(name),
    licenses: [...(await readEvidence(licenseFiles)), ...sectionEvidence],
    notices: await readEvidence(noticeFiles),
    override: override
      ? { reason: override.reason, source: override.source ?? override.repository }
      : null,
  };
}

async function componentFromDeclaration(repoRoot, declaration, allowed) {
  if (!declaration) throw new Error("Copied asset declaration has no package or component.");
  validateLicense(declaration.name, declaration.version, declaration.license, allowed);
  const licenseFiles = declaration.licenseFiles.map((path) => resolve(repoRoot, path));
  return {
    key: `${declaration.name}@${declaration.version}`,
    name: declaration.name,
    version: declaration.version,
    license: declaration.license,
    repository: declaration.repository,
    licenses: await readEvidence(licenseFiles),
    notices: [],
    override: { reason: declaration.reason, source: declaration.repository },
  };
}

function addComponent(components, component, use, input) {
  const existing = components.get(component.key);
  if (existing) {
    assertSameEvidence(existing, component);
    existing.override ??= component.override;
    existing.uses.add(use);
    existing.inputs.add(input);
    return;
  }
  components.set(component.key, {
    ...component,
    uses: new Set([use]),
    inputs: new Set([input]),
  });
}

function finalizeComponent(component) {
  return {
    ...component,
    uses: [...component.uses].sort(),
    inputs: [...component.inputs].sort(),
  };
}

function assertSameEvidence(left, right) {
  const comparable = (value) =>
    JSON.stringify({
      license: value.license,
      repository: value.repository,
      licenses: value.licenses.map((entry) => entry.text),
      notices: value.notices.map((entry) => entry.text),
    });
  if (comparable(left) !== comparable(right)) {
    throw new Error(`Conflicting legal evidence for ${left.key}`);
  }
}

function validateLicense(name, version, expression, allowed) {
  if (typeof expression !== "string" || expression.trim() === "") {
    throw new Error(`Unknown or missing license for ${name}@${version}`);
  }
  const identifiers = expression.match(/[A-Za-z0-9][A-Za-z0-9.-]*/g) ?? [];
  const operators = new Set(["AND", "OR", "WITH"]);
  const disallowed = identifiers.filter((id) => !operators.has(id) && !allowed.has(id));
  const invalidSyntax = expression.replace(/[A-Za-z0-9][A-Za-z0-9.-]*/g, "").replace(/[()\s]/g, "");
  if (disallowed.length > 0 || invalidSyntax.length > 0) {
    throw new Error(
      `Disallowed or unknown license for ${name}@${version}: ${expression}${
        disallowed.length > 0 ? ` (${[...new Set(disallowed)].join(", ")})` : ""
      }`,
    );
  }
}

async function expandRequiredInput(repoRoot, declaration) {
  const files = [];
  for (const file of declaration.files ?? []) {
    const absolute = resolve(repoRoot, file);
    if (!(await isFile(absolute))) throw new Error(`Required legal input is missing: ${file}`);
    files.push(absolute);
  }
  if (declaration.directory) {
    const directory = resolve(repoRoot, declaration.directory);
    const directoryFiles = await walkFiles(directory);
    files.push(
      ...directoryFiles.filter((file) => {
        if (declaration.suffix && !file.endsWith(declaration.suffix)) return false;
        if (declaration.namePattern && !declaration.namePattern.test(file.split(sep).at(-1))) {
          return false;
        }
        return true;
      }),
    );
  }
  const unique = [...new Set(files)].sort();
  if (unique.length === 0) {
    throw new Error(`Required legal input group is empty: ${declaration.label}`);
  }
  return unique;
}

async function verifyDeclaredVersion(files, declaration) {
  if (!declaration.versionPattern) return;
  const content = await readFile(files[0], "utf8");
  const match = declaration.versionPattern.exec(content);
  const detected = match?.groups?.version ?? match?.[1];
  if (!detected) {
    throw new Error(`Cannot detect version for copied asset: ${declaration.label}`);
  }
  if (detected !== declaration.component.version) {
    throw new Error(
      `Copied asset version changed for ${declaration.label}: expected ${declaration.component.version}, found ${detected}`,
    );
  }
}

async function evidenceFiles(root, pattern) {
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => resolve(root, entry.name))
    .sort();
}

async function readEvidence(files) {
  return Promise.all(
    files.map(async (file) => ({
      file: file.split(sep).at(-1),
      text: normalizeExact(await readFile(file, "utf8")),
    })),
  );
}

async function readEvidenceSections(packageRoot, sections) {
  return Promise.all(
    sections.map(async (section) => {
      const source = await readFile(resolve(packageRoot, section.file), "utf8");
      const start = source.indexOf(section.start);
      if (start < 0) {
        throw new Error(
          `Audited license start marker missing in ${section.file}: ${section.start}`,
        );
      }
      const end = section.end ? source.indexOf(section.end, start) : source.length;
      if (end < 0) {
        throw new Error(`Audited license end marker missing in ${section.file}: ${section.end}`);
      }
      return {
        file: `${section.file}#license`,
        text: normalizeExact(source.slice(start, end)),
      };
    }),
  );
}

function renderNotice(inventory, policy) {
  const lines = [
    "AgenticFlowX",
    "Copyright 2026 AgenticFlowX Contributors",
    "",
    "This product is licensed under the Apache License, Version 2.0.",
    "",
    "Third-party project acknowledgments",
    "=====================================",
    "",
  ];
  const names = new Set(inventory.components.map((component) => component.name));
  for (const acknowledgment of policy.projectAcknowledgments) {
    const matches = inventory.components.filter(
      (component) =>
        acknowledgment.packageNames?.includes(component.name) ||
        acknowledgment.packagePrefixes?.some((prefix) => component.name.startsWith(prefix)),
    );
    if (matches.length === 0) continue;
    const versions = [...new Set(matches.map((component) => component.version))].sort();
    const versionLabel =
      versions.length === 1
        ? versions[0]
        : matches
            .map((component) => `${component.name} ${component.version}`)
            .sort()
            .join("; ");
    lines.push(`${acknowledgment.title} (${versionLabel})`);
    lines.push(acknowledgment.text, acknowledgment.url, "");
  }
  for (const acknowledgment of policy.standardsAcknowledgments) {
    lines.push(`${acknowledgment.title} (open standard acknowledgment)`);
    lines.push(acknowledgment.text, acknowledgment.url, "");
  }
  if (names.size === 0) throw new Error("Cannot render NOTICE from an empty inventory.");
  lines.push(
    "Complete component metadata, exact upstream license text, and upstream NOTICE",
    "content are provided in THIRD_PARTY_NOTICES.md.",
    "",
  );
  return lines.join("\n");
}

function renderThirdPartyNotices(inventory, policy) {
  const licenseTexts = new Map();
  for (const component of inventory.components) {
    for (const evidence of component.licenses) {
      const hash = digest(evidence.text);
      const existing = licenseTexts.get(hash) ?? { text: evidence.text, components: new Set() };
      existing.components.add(component.key);
      licenseTexts.set(hash, existing);
    }
  }

  const lines = [
    "# Third-Party Notices",
    "",
    "<!-- markdownlint-disable MD034 -->",
    "",
    "This file is generated from the production bundles and copied runtime assets.",
    "Do not edit it manually. Run `pnpm legal:write` after `pnpm build`.",
    "",
    `Inventory: ${inventory.components.length} shipped package-version components.`,
    "",
    "## Shipped components",
    "",
  ];
  for (const component of inventory.components) {
    const evidenceIds = component.licenses.map((entry) => digest(entry.text).slice(0, 12));
    lines.push(`### ${component.name} ${component.version}`);
    lines.push("");
    lines.push(`- License: \`${component.license}\``);
    lines.push(`- Repository: ${component.repository}`);
    lines.push(`- Included by: ${component.uses.join(", ")}`);
    lines.push(`- Exact license evidence: ${evidenceIds.map((id) => `\`${id}\``).join(", ")}`);
    if (component.notices.length > 0) {
      lines.push(
        `- Upstream NOTICE files: ${component.notices.map((entry) => entry.file).join(", ")}`,
      );
    }
    lines.push("");
  }

  const overrides = inventory.components.filter((component) => component.override);
  lines.push("## Audited evidence overrides", "");
  if (overrides.length === 0) {
    lines.push("None.", "");
  } else {
    for (const component of overrides) {
      lines.push(
        `- **${component.key}** — ${component.override.reason} Source: ${component.override.source}`,
      );
    }
    lines.push("");
  }

  lines.push("## Open-format and standards acknowledgments", "");
  for (const acknowledgment of policy.standardsAcknowledgments) {
    lines.push(`- **${acknowledgment.title}** — ${acknowledgment.text} ${acknowledgment.url}`);
  }
  lines.push("");

  const noticeComponents = inventory.components.filter((component) => component.notices.length > 0);
  lines.push("## Exact upstream NOTICE content", "");
  if (noticeComponents.length === 0) {
    lines.push("No shipped package contains a separate upstream NOTICE file.", "");
  } else {
    for (const component of noticeComponents) {
      for (const notice of component.notices) {
        lines.push(`### ${component.key} — ${notice.file}`, "", "~~~~text");
        lines.push(notice.text.trimEnd(), "~~~~", "");
      }
    }
  }

  lines.push("## Exact upstream license texts", "");
  for (const [hash, evidence] of [...licenseTexts.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    lines.push(`### ${hash.slice(0, 12)}`, "");
    lines.push(`Used by: ${[...evidence.components].sort().join(", ")}`, "", "~~~~text");
    lines.push(evidence.text.trimEnd(), "~~~~", "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function compareComponents(left, right) {
  return left.name.localeCompare(right.name) || left.version.localeCompare(right.version);
}

function normalizeRepository(repository) {
  const raw = typeof repository === "string" ? repository : repository?.url;
  if (!raw) return null;
  const githubShorthand = raw.match(/^github:(.+)$/);
  if (githubShorthand) return `https://github.com/${githubShorthand[1]}`;
  const githubSsh = raw.match(/^git@github\.com:(.+)$/);
  if (githubSsh) return `https://github.com/${githubSsh[1]}`.replace(/\.git$/, "");
  return raw
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
    .replace(/^https:\/\/[^/@]+@github\.com\//, "https://github.com/")
    .replace(/\.git$/, "");
}

function npmUrl(name) {
  return `https://www.npmjs.com/package/${encodeURIComponent(name)}`;
}

function normalizeExact(text) {
  return `${text.replace(/\r\n/g, "\n").trimEnd()}\n`;
}

function digest(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
    throw new Error(
      `Cannot read required legal input directory ${directory}: ${errorMessage(error)}`,
    );
  });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function isFile(path) {
  return stat(path)
    .then((value) => value.isFile())
    .catch(() => false);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function resolveVsixPath(repoRoot, target) {
  const absolute = resolve(repoRoot, target);
  if ((await stat(absolute).catch(() => null))?.isFile()) return absolute;
  if (!(await stat(absolute).catch(() => null))?.isDirectory()) {
    throw new Error(`VSIX target does not exist: ${target}`);
  }
  const packageJson = JSON.parse(
    await readFile(resolve(repoRoot, EXTENSION_ROOT, "package.json"), "utf8"),
  );
  const suffix = `-${packageJson.version}.vsix`;
  const candidates = (await readdir(absolute))
    .filter((name) => name.endsWith(suffix))
    .map((name) => resolve(absolute, name));
  if (candidates.length === 0) {
    throw new Error(`No VSIX for extension version ${packageJson.version} found in ${target}`);
  }
  const withStats = await Promise.all(
    candidates.map(async (path) => ({ path, mtime: (await stat(path)).mtimeMs })),
  );
  return withStats.sort((left, right) => right.mtime - left.mtime)[0].path;
}

/** Read regular, non-ZIP64 entries from a VSIX archive. */
function readZipEntries(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Invalid VSIX central directory.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (entries.has(name)) throw new Error(`Duplicate VSIX archive entry: ${name}`);
    entries.set(name, readLocalZipEntry(buffer, localOffset, compressedSize, method));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readLocalZipEntry(buffer, offset, compressedSize, method) {
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error("Invalid VSIX local entry.");
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(start, start + compressedSize);
  if (method === 0) return Buffer.from(compressed);
  if (method === 8) return inflateRawSync(compressed);
  throw new Error(`Unsupported VSIX ZIP compression method: ${method}`);
}

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Invalid VSIX: end of central directory not found.");
}

async function runCli() {
  const [command = "check", target] = process.argv.slice(2);
  if (command === "write") {
    const artifacts = await writeLegalArtifacts();
    console.log(`Generated legal notices for ${artifacts.inventory.components.length} components.`);
    return;
  }
  if (command === "check") {
    const artifacts = await checkLegalArtifacts();
    console.log(
      `Legal notices are current for ${artifacts.inventory.components.length} components.`,
    );
    return;
  }
  if (command === "stage-extension") {
    await stageExtensionLegalFiles();
    console.log("Staged NOTICE and THIRD_PARTY_NOTICES.md for VSIX packaging.");
    return;
  }
  if (command === "verify-vsix") {
    if (!target) throw new Error("Usage: third-party-notices.mjs verify-vsix <file-or-directory>");
    const verified = await verifyVsixLegalFiles(target);
    console.log(`Verified packaged legal files in ${relative(defaultRepoRoot, verified)}.`);
    return;
  }
  throw new Error(`Unknown legal command: ${command}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().catch((error) => {
    console.error(`legal: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
