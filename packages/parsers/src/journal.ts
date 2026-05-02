/**
 * journal.md parser — extracts discussion entries from AFX journal documents.
 *
 * @see docs/specs/120-package-parsers/spec.md [FR-4]
 * @see docs/specs/120-package-parsers/design.md [DES-API]
 */
export interface Discussion {
  id: string;
  timestamp: string;
  status: "open" | "resolved" | "promoted";
  summary: string;
  line: number;
}

export interface JournalParseResult {
  discussions: Discussion[];
  totalCount: number;
}

export function parseJournal(raw: string): JournalParseResult {
  const lines = raw.split("\n");
  const discussions: Discussion[] = [];

  const discRegex = /\b(\d{2}-[Dd]\d{3,})\b/g;
  const headingRegex = /^##\s+(.+?)\s*$/;
  const dateRegex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?Z?)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const heading = headingRegex.exec(line);
    if (heading) {
      const title = heading[1]?.trim() ?? "";
      const timestamp = dateRegex.exec(title)?.[1] ?? dateRegex.exec(lines[i + 2] ?? "")?.[1] ?? "";
      const normalized = title.toLowerCase();
      discussions.push({
        id: `J-${String(discussions.length + 1).padStart(3, "0")}`,
        timestamp,
        status:
          normalized.includes("complete") || normalized.includes("resolved")
            ? "resolved"
            : normalized.includes("promoted")
              ? "promoted"
              : "open",
        summary: title,
        line: i + 1,
      });
      continue;
    }

    const matches = [...line.matchAll(discRegex)];
    if (matches.length > 0) {
      for (const match of matches) {
        if (discussions.some((d) => d.line === i + 1 && d.summary === line.trim())) continue;
        const tsMatch = lines[i - 1]?.match(/\*\*(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}[^)]*)\*\*/);
        discussions.push({
          id: match[1] ?? "",
          timestamp: tsMatch ? (tsMatch[1] ?? "") : "",
          status: "open",
          summary: line.trim(),
          line: i + 1,
        });
      }
    }
  }

  return {
    discussions,
    totalCount: discussions.length,
  };
}
