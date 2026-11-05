/**
 * Read-only repository metadata and selected-document symbol inspection.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-3] [FR-4] [FR-6] [FR-7]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-DATA] [DES-API] [DES-ERR]
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import * as vscode from "vscode";

import type { ProjectContext } from "./project-context";

export interface MetadataObservation {
  path: string;
  kind: "package-json" | "manifest";
  scripts: string[];
  entryPoints: string[];
  contentHash: string;
}

export interface RepositoryObservation {
  schemaVersion: 1;
  projectId: string;
  collectedAt: string;
  complete: boolean;
  metadata: MetadataObservation[];
  errors?: string[];
}

export interface SymbolObservation {
  name: string;
  detail?: string;
  kind: number;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  selectionRange: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  children?: SymbolObservation[];
}

export interface SelectedDocumentObservation {
  uri: string;
  documentVersion: number;
  contentRevision: string;
  dirty: boolean;
  state: "current" | "partial" | "stale" | "unknown";
  truncated: boolean;
  symbols: SymbolObservation[];
  error?: string;
}

function hash(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

/**
 * Reads only allowlisted manifest fields and never executes declared scripts.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-3] [NFR-1] [NFR-2]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-SEC]
 */
export async function inspectProjectMetadata(
  project: ProjectContext,
): Promise<RepositoryObservation> {
  const metadata: MetadataObservation[] = [];
  const errors: string[] = [];
  const expected = new Set(project.packagePaths);
  const candidates = [
    ...new Set([...project.packagePaths, "package.json", "pyproject.toml", "Cargo.toml", "go.mod"]),
  ];
  for (const relativePath of candidates) {
    const location = path.join(project.rootUri.fsPath, relativePath);
    try {
      if (!(await stat(location)).isFile()) continue;
      const content = await readFile(location, "utf8");
      let scripts: string[] = [];
      const entryPoints: string[] = [];
      if (path.basename(relativePath) === "package.json") {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        const declaredScripts = parsed["scripts"];
        if (declaredScripts && typeof declaredScripts === "object")
          scripts = Object.keys(declaredScripts);
        for (const key of ["main", "module", "types", "bin", "exports"]) {
          const value = parsed[key];
          if (typeof value === "string") entryPoints.push(`${key}: ${value}`);
          else if (value && typeof value === "object") entryPoints.push(`${key}: declared`);
        }
      }
      metadata.push({
        path: relativePath,
        kind: path.basename(relativePath) === "package.json" ? "package-json" : "manifest",
        scripts,
        entryPoints,
        contentHash: hash(content),
      });
    } catch {
      if (expected.has(relativePath))
        errors.push(`Could not read supported metadata: ${relativePath}`);
    }
  }
  return {
    schemaVersion: 1,
    projectId: project.id,
    collectedAt: new Date().toISOString(),
    complete: project.discovery.complete && errors.length === 0,
    metadata,
    ...(errors.length ? { errors } : {}),
  };
}

function position(value: vscode.Position) {
  return { line: value.line, character: value.character };
}

function mapSymbol(value: vscode.DocumentSymbol): SymbolObservation {
  return {
    name: value.name,
    ...(value.detail ? { detail: value.detail } : {}),
    kind: Number(value.kind) + 1,
    range: { start: position(value.range.start), end: position(value.range.end) },
    selectionRange: {
      start: position(value.selectionRange.start),
      end: position(value.selectionRange.end),
    },
    ...(value.children.length ? { children: value.children.map(mapSymbol) } : {}),
  };
}

/**
 * Requests public document symbols for the current buffer and discards superseded results.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-4] [FR-7] [NFR-2]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-API] [DES-ERR]
 */
export async function inspectDocumentSymbols(
  document: vscode.TextDocument,
  generation: number,
  currentGeneration: () => number,
): Promise<SelectedDocumentObservation> {
  const content = document.getText();
  const version = document.version;
  try {
    const provided = await vscode.commands.executeCommand<
      Array<vscode.DocumentSymbol | vscode.SymbolInformation>
    >("vscode.executeDocumentSymbolProvider", document.uri);
    if (generation !== currentGeneration() || version !== document.version)
      return {
        uri: document.uri.toString(),
        documentVersion: document.version,
        contentRevision: hash(content),
        dirty: document.isDirty,
        state: "stale",
        truncated: false,
        symbols: [],
      };
    const documentSymbols = (provided ?? []).filter(
      (symbol): symbol is vscode.DocumentSymbol => "selectionRange" in symbol,
    );
    const symbols = documentSymbols.slice(0, 200).map(mapSymbol);
    return {
      uri: document.uri.toString(),
      documentVersion: document.version,
      contentRevision: hash(content),
      dirty: document.isDirty,
      state: provided ? "current" : "partial",
      truncated: documentSymbols.length > 200,
      symbols,
      ...(!provided ? { error: "No document-symbol provider is available." } : {}),
    };
  } catch (error) {
    return {
      uri: document.uri.toString(),
      documentVersion: document.version,
      contentRevision: hash(content),
      dirty: document.isDirty,
      state: "unknown",
      truncated: false,
      symbols: [],
      error: error instanceof Error ? error.message : "Document-symbol provider failed.",
    };
  }
}
