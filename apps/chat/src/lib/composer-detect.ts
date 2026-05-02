/**
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-7] [FR-12] [DES-TESTABILITY] [8.3]
 */

export interface ComposerTrigger {
  kind: "slash" | "mention";
  start: number;
  query: string;
}

export function detectComposerTrigger(
  text: string,
  caretIndex = text.length,
): ComposerTrigger | null {
  if (isInsideFence(text, caretIndex)) return null;
  const before = text.slice(0, caretIndex);
  const token = before.match(/(^|\s)([/@])([^\s]*)$/);
  if (!token || token.index === undefined) return null;
  const prefix = token[1] ?? "";
  const symbol = token[2];
  const query = token[3] ?? "";
  const start = token.index + prefix.length;
  if (start > 0 && text[start - 1] === "\\") return null;
  if (symbol === "/" && !/^\s*$/.test(before.slice(0, start))) return null;
  if (symbol === "/") return { kind: "slash", start, query };
  if (symbol === "@") return { kind: "mention", start, query };
  return null;
}

function isInsideFence(text: string, caretIndex: number): boolean {
  const before = text.slice(0, caretIndex);
  return (before.match(/^```/gm)?.length ?? 0) % 2 === 1;
}
