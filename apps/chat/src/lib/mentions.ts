/**
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-12] [DES-MENTION] [6.4]
 */

const MENTION_RE = /(^|[^A-Za-z0-9\\])@([\w./_-]+)/g;

export function extractMentions(text: string): string[] {
  const seen = new Set<string>();
  const mentions: string[] = [];
  for (const match of text.matchAll(MENTION_RE)) {
    const path = stripTrailingPunctuation(match[2] ?? "");
    if (!path || seen.has(path)) continue;
    seen.add(path);
    mentions.push(path);
  }
  return mentions;
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[),.;:]+$/g, "");
}
