import { createHash } from "node:crypto";

const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const END = "<!-- AFX-BLUEPRINT:END -->";
const START = /<!-- AFX-BLUEPRINT:START sha256=([a-f0-9]{64}) -->\n/g;

/** Replaces only an intact generated section; surrounding authored bytes are retained. */
export function updateBlueprintReader(previous: string, generated: string): string {
  const matches = [...previous.matchAll(START)];
  if (matches.length !== 1 || previous.split(END).length !== 2)
    throw new Error(
      "Reader has no unique generated section. Adopt the reader explicitly before updating; the original is preserved.",
    );
  const match = matches[0]!;
  const begin = match.index + match[0].length;
  const end = previous.indexOf(END, begin);
  if (end < begin || digest(previous.slice(begin, end)) !== match[1])
    throw new Error(
      "Generated Blueprint text was edited. Resolve those edits before applying; no files were changed.",
    );
  return (
    previous.slice(0, match.index) +
    generatedBlueprintSection(generated) +
    previous.slice(end + END.length)
  );
}

export function generatedBlueprintSection(generated: string): string {
  if (generated.includes("AFX-BLUEPRINT:"))
    throw new Error("Generated report contains reserved reader markers.");
  const body = `${generated.trim()}\n`;
  return `<!-- AFX-BLUEPRINT:START sha256=${digest(body)} -->\n${body}${END}`;
}

/** Legacy adoption keeps the whole original document as authored content. */
export function adoptBlueprintReader(previous: string, generated: string): string {
  if (previous.includes("AFX-BLUEPRINT:"))
    throw new Error("Reader markers already exist; resolve them before adoption.");
  return `${previous}\n\n${generatedBlueprintSection(generated)}\n`;
}
