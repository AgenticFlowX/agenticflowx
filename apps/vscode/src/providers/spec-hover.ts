/**
 * `@see` hover provider — shows file preview when hovering the spec path,
 * and the matching FR row / DES section / task heading when hovering a [node id] bracket.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 */
import { existsSync, readFileSync } from "node:fs";

import * as vscode from "vscode";

import { type SprintSection, isSprintFile, sliceSprintSection } from "../services/sprint";
import {
  type ResolvedNode,
  type SeeContext,
  getSeeContextAt,
  readPathPreview,
  resolveNode,
} from "./see-resolver";

const SECTION_LABEL: Record<SprintSection, string> = {
  SPEC: "Spec",
  DESIGN: "Design",
  TASKS: "Tasks",
  SESSIONS: "Sessions",
};

export function createSpecHoverProvider(getRoot: () => string | undefined): vscode.HoverProvider {
  return {
    provideHover(document, position): vscode.Hover | undefined {
      const root = getRoot();
      if (!root) return undefined;
      const ctx = getSeeContextAt(document, position, root);
      if (!ctx) return undefined;

      if (!ctx.exists) {
        return new vscode.Hover(buildGhostFile(ctx), ctx.tokenRange);
      }

      if (ctx.kind === "path") {
        const preview = readPathPreview(ctx.absPath);
        return new vscode.Hover(buildPathHover(ctx, preview), ctx.tokenRange);
      }

      const node = resolveNode(ctx.absPath, ctx.nodeId ?? "");
      if (!node) {
        return new vscode.Hover(buildGhostNode(ctx), ctx.tokenRange);
      }
      return new vscode.Hover(buildNodeHover(ctx, node), ctx.tokenRange);
    },
  };
}

function buildPathHover(
  ctx: SeeContext,
  preview: { content: string; truncated: boolean } | undefined,
): vscode.MarkdownString {
  const md = newMd();
  const display = ctx.relPath.split("/").slice(-2).join(" / ");

  const sprintMeta = readSprintMeta(ctx.absPath);
  if (sprintMeta) {
    md.appendMarkdown(`**${display}** · \`SPRINT\`\n\n`);
    md.appendMarkdown(`*Single-document SDD — Spec / Design / Tasks / Sessions.*\n\n`);
    md.appendMarkdown(`---\n\n`);
    appendSprintSectionLinks(md, ctx.absPath, sprintMeta);
    appendActions(md, ctx.absPath, 0);
    return md;
  }

  md.appendMarkdown(`**${display}**\n\n`);
  if (preview && preview.content.trim()) {
    md.appendMarkdown(`---\n\n`);
    md.appendCodeblock(preview.content, "markdown");
    if (preview.truncated) md.appendMarkdown(`\n\n*…40 lines shown*`);
  }
  appendActions(md, ctx.absPath, 0);
  return md;
}

function readSprintMeta(
  absPath: string,
): { sections: Partial<Record<SprintSection, number>> } | undefined {
  if (!existsSync(absPath)) return undefined;
  let raw: string;
  try {
    raw = readFileSync(absPath, "utf8");
  } catch {
    return undefined;
  }
  if (!isSprintFile(raw)) return undefined;
  const sections: Partial<Record<SprintSection, number>> = {};
  for (const s of ["SPEC", "DESIGN", "TASKS", "SESSIONS"] as SprintSection[]) {
    const slice = sliceSprintSection(raw, s);
    if (slice) sections[s] = slice.startLine;
  }
  return { sections };
}

function appendSprintSectionLinks(
  md: vscode.MarkdownString,
  absPath: string,
  meta: { sections: Partial<Record<SprintSection, number>> },
): void {
  const uri = vscode.Uri.file(absPath);
  const links: string[] = [];
  for (const s of ["SPEC", "DESIGN", "TASKS", "SESSIONS"] as SprintSection[]) {
    const line = meta.sections[s];
    if (typeof line !== "number") continue;
    const args = encodeURIComponent(
      JSON.stringify([uri, { selection: new vscode.Range(line, 0, line, 0) }]),
    );
    links.push(`[${SECTION_LABEL[s]}](command:vscode.open?${args})`);
  }
  if (links.length > 0) {
    md.appendMarkdown(`Jump to: ${links.join(" · ")}\n`);
  }
}

function buildNodeHover(ctx: SeeContext, node: ResolvedNode): vscode.MarkdownString {
  const md = newMd();
  const display = ctx.relPath.split("/").slice(-2).join(" / ");
  md.appendMarkdown(`**${ctx.nodeId}** — \`${display}\`\n\n---\n\n`);

  if (node.tableHeaders && node.tableCells) {
    const headers = node.tableHeaders;
    const cells = node.tableCells;
    const labelHeader = headers[0] ?? "ID";
    const idText = `**${labelHeader}** \`${ctx.nodeId}\``;
    const detailParts: string[] = [];
    for (let i = 1; i < headers.length; i++) {
      const head = headers[i];
      const value = cells[i - 1];
      if (!value) continue;
      detailParts.push(head ? `**${head}**: ${value}` : value);
    }
    md.appendMarkdown(`${idText}\n\n${detailParts.join(" · ")}`);
  } else {
    md.appendCodeblock(node.excerpt, "markdown");
  }

  appendActions(md, ctx.absPath, node.line);
  return md;
}

function buildGhostFile(ctx: SeeContext): vscode.MarkdownString {
  const md = newMd();
  md.appendMarkdown(`**AgenticFlowX** — ghost reference\n\n---\n\n`);
  md.appendMarkdown(
    `File not found: \`${ctx.relPath}\`\n\n*Check the path in your \`@see\` annotation.*`,
  );
  return md;
}

function buildGhostNode(ctx: SeeContext): vscode.MarkdownString {
  const md = newMd();
  md.appendMarkdown(`**AgenticFlowX** — ghost reference\n\n---\n\n`);
  md.appendMarkdown(
    `Node \`${ctx.nodeId}\` not found in \`${ctx.relPath}\`\n\n*Add the row/section, or update the annotation.*\n\n`,
  );
  appendActions(md, ctx.absPath, 0);
  return md;
}

function appendActions(md: vscode.MarkdownString, absPath: string, line: number): void {
  const uri = vscode.Uri.file(absPath);
  const openArgs = encodeURIComponent(
    JSON.stringify([uri, { selection: new vscode.Range(line, 0, line, 0) }]),
  );
  const fileArgs = encodeURIComponent(JSON.stringify([uri]));
  md.appendMarkdown(`\n\n---\n\n`);
  md.appendMarkdown(
    `[Open in Editor](command:vscode.open?${openArgs}) · ` +
      `[Open Preview](command:markdown.showPreview?${fileArgs}) · ` +
      `[Open Split](command:markdown.showPreviewToSide?${fileArgs})`,
  );
}

function newMd(): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.supportThemeIcons = true;
  return md;
}
