/**
 * Lossless document model for `.afx/notes.md`.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-10] [FR-12] [NFR-5]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-IDENTITY] [DES-NOTES-MARKDOWN]
 */
import { createHash } from "node:crypto";

export interface NotesCheckbox {
  fingerprint: string;
  text: string;
  completed: boolean;
}

export interface ParsedQuickNote {
  id: string;
  timestamp: string;
  time: string;
  displayTime: string;
  date: string;
  text: string;
  checkboxes: NotesCheckbox[];
}

export type NotesDocumentMutation =
  | { kind: "append"; text: string; now?: Date }
  | { kind: "edit"; noteId: string; text: string }
  | { kind: "delete"; noteId: string }
  | {
      kind: "toggleCheckbox";
      noteId: string;
      itemFingerprint: string;
      completed: boolean;
    };

export type NotesPatchResult =
  | { ok: true; content: string; changed: boolean }
  | { ok: false; reason: "invalid-document" | "note-not-found" | "checkbox-not-found" };

interface SourceLine {
  start: number;
  contentEnd: number;
  end: number;
  text: string;
}

interface CheckboxSpan extends NotesCheckbox {
  markerStart: number;
}

interface NoteSpan {
  note: ParsedQuickNote;
  kind: "canonical" | "legacy";
  blockStart: number;
  blockEnd: number;
  bodyStart: number;
  bodyEnd: number;
  dayStart?: number;
  dayHeadingEnd?: number;
  dayEnd?: number;
  checkboxes: CheckboxSpan[];
}

interface DaySpan {
  date: string;
  start: number;
  headingEnd: number;
  end: number;
}

const DATE_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const TIME_HEADING = /^###\s+(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s*$/;
const LEGACY_NOTE = /^-\s+\*\*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?Z?)\*\*\s+(.+)$/;
const CHECKBOX = /^(\s*[-*+]\s+)\[([ xX])\](?:\s+)(.*)$/;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Stable SHA-256 revision used by revision-protected Notes mutations. */
export function notesContentRevision(content: string): string {
  return digest(content);
}

function sourceLines(content: string): SourceLine[] {
  if (!content) return [];
  const lines: SourceLine[] = [];
  const re = /.*?(?:\r\n|\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const raw = match[0] ?? "";
    if (!raw) break;
    const newlineLength = raw.endsWith("\r\n") ? 2 : raw.endsWith("\n") ? 1 : 0;
    const start = match.index;
    const end = start + raw.length;
    lines.push({
      start,
      contentEnd: end - newlineLength,
      end,
      text: raw.slice(0, raw.length - newlineLength),
    });
    if (end >= content.length) break;
  }
  return lines;
}

function localDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function localTime(date: Date): string {
  return `${[
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

function displayTime(timestamp: string, fallback: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function bodyText(content: string, start: number, end: number): string {
  return content
    .slice(start, end)
    .replace(/^\s*\r?\n/, "")
    .trim();
}

function trailingSeparator(segment: string, eol: string, hasFollowingBlock: boolean): string {
  const match = segment.match(/(?:\r?\n)+$/);
  if (match?.[0]) return match[0];
  return hasFollowingBlock ? `${eol}${eol}` : segment.length > 0 ? eol : "";
}

function frontmatterEnd(lines: SourceLine[]): { end: number; valid: boolean } {
  if (lines[0]?.text.replace(/^\uFEFF/, "").trim() !== "---") return { end: 0, valid: true };
  const closing = lines.find((line, index) => index > 0 && line.text.trim() === "---");
  return closing ? { end: closing.end, valid: true } : { end: 0, valid: false };
}

function checkboxSpans(
  lines: SourceLine[],
  noteId: string,
  bodyStart: number,
  bodyEnd: number,
): CheckboxSpan[] {
  const spans: CheckboxSpan[] = [];
  for (const line of lines) {
    if (line.start < bodyStart || line.contentEnd > bodyEnd) continue;
    const match = CHECKBOX.exec(line.text);
    if (!match) continue;
    const prefix = match[1] ?? "";
    const completed = (match[2] ?? "").toLowerCase() === "x";
    const text = match[3] ?? "";
    const ordinal = spans.length;
    spans.push({
      fingerprint: digest(`${noteId}\u0000${ordinal}\u0000${text}`).slice(0, 24),
      text,
      completed,
      markerStart: line.start + prefix.length + 1,
    });
  }
  return spans;
}

/**
 * Parsed Notes source with exact mutation spans. Parsing never normalizes the
 * source, so reading and no-op operations remain byte-identical.
 */
export class NotesMarkdownDocument {
  readonly revision: string;
  readonly notes: ParsedQuickNote[];
  readonly valid: boolean;
  readonly diagnostics: readonly string[];

  private readonly spans: NoteSpan[];
  private readonly days: DaySpan[];
  private readonly eol: string;
  private readonly frontmatterBoundary: number;

  private constructor(
    readonly content: string,
    spans: NoteSpan[],
    days: DaySpan[],
    valid: boolean,
    diagnostics: string[],
    frontmatterBoundary: number,
  ) {
    this.revision = notesContentRevision(content);
    this.spans = spans;
    this.days = days;
    this.notes = spans
      .map((span) => span.note)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    this.valid = valid;
    this.diagnostics = diagnostics;
    this.eol = content.includes("\r\n") ? "\r\n" : "\n";
    this.frontmatterBoundary = frontmatterBoundary;
  }

  /** Parse canonical and legacy note records without rewriting their source. */
  static parse(content: string): NotesMarkdownDocument {
    const lines = sourceLines(content);
    const frontmatter = frontmatterEnd(lines);
    const diagnostics: string[] = [];
    if (!frontmatter.valid) diagnostics.push("Unterminated YAML frontmatter.");

    const headingEligible: boolean[] = [];
    let fenceMarker: "`" | "~" | undefined;
    for (const line of lines) {
      const fence = /^\s*(```+|~~~+)/.exec(line.text)?.[1];
      if (fence) {
        const marker = fence.startsWith("`") ? "`" : "~";
        headingEligible.push(false);
        if (!fenceMarker) fenceMarker = marker;
        else if (fenceMarker === marker) fenceMarker = undefined;
        continue;
      }
      headingEligible.push(!fenceMarker);
    }

    const dayRows: Array<{ lineIndex: number; date: string; endLineIndex: number }> = [];
    for (let index = 0; index < lines.length; index++) {
      if (!headingEligible[index]) continue;
      const match = DATE_HEADING.exec(lines[index]?.text ?? "");
      if (!match) continue;
      const nextDay = lines.findIndex(
        (line, candidate) =>
          candidate > index && headingEligible[candidate] === true && DATE_HEADING.test(line.text),
      );
      dayRows.push({
        lineIndex: index,
        date: match[1] ?? "",
        endLineIndex: nextDay === -1 ? lines.length : nextDay,
      });
    }

    const spans: NoteSpan[] = [];
    for (const day of dayRows) {
      const dayLine = lines[day.lineIndex];
      if (!dayLine) continue;
      const noteHeadingIndexes: number[] = [];
      for (let index = day.lineIndex + 1; index < day.endLineIndex; index++) {
        if (headingEligible[index] && TIME_HEADING.test(lines[index]?.text ?? "")) {
          noteHeadingIndexes.push(index);
        }
      }
      noteHeadingIndexes.forEach((lineIndex, ordinal) => {
        const heading = lines[lineIndex];
        if (!heading) return;
        const time = TIME_HEADING.exec(heading.text)?.[1] ?? "";
        const nextIndex = noteHeadingIndexes[ordinal + 1] ?? day.endLineIndex;
        const blockEnd = lines[nextIndex]?.start ?? content.length;
        const bodyStart = heading.end;
        const text = bodyText(content, bodyStart, blockEnd);
        const timestamp = `${day.date}T${time}`;
        const id = digest(`canonical\u0000${day.date}\u0000${time}\u0000${ordinal}`).slice(0, 24);
        const checkboxes = checkboxSpans(lines, id, bodyStart, blockEnd);
        const note: ParsedQuickNote = {
          id,
          timestamp,
          time,
          displayTime: displayTime(timestamp, time),
          date: day.date,
          text,
          checkboxes: checkboxes.map(({ markerStart: _markerStart, ...item }) => item),
        };
        spans.push({
          note,
          kind: "canonical",
          blockStart: heading.start,
          blockEnd,
          bodyStart,
          bodyEnd: blockEnd,
          dayStart: dayLine.start,
          dayHeadingEnd: dayLine.end,
          dayEnd: lines[day.endLineIndex]?.start ?? content.length,
          checkboxes,
        });
      });
    }

    const days: DaySpan[] = dayRows.map((day) => ({
      date: day.date,
      start: lines[day.lineIndex]?.start ?? 0,
      headingEnd: lines[day.lineIndex]?.end ?? 0,
      end: lines[day.endLineIndex]?.start ?? content.length,
    }));
    const canonicalRanges = spans
      .filter((span) => span.kind === "canonical")
      .map((span) => ({ start: span.blockStart, end: span.blockEnd }));
    for (const line of lines) {
      if (canonicalRanges.some((range) => line.start >= range.start && line.start < range.end)) {
        continue;
      }
      const match = LEGACY_NOTE.exec(line.text);
      if (!match) continue;
      const timestamp = match[1] ?? "";
      const text = match[2] ?? "";
      const time = timestamp.slice(11).replace(/Z$/, "");
      const id = digest(`legacy\u0000${line.start}\u0000${timestamp}`).slice(0, 24);
      const textOffset = line.text.lastIndexOf(text);
      const bodyStart = line.start + Math.max(0, textOffset);
      const legacyCheckbox = CHECKBOX.exec(text);
      const checkboxes: CheckboxSpan[] = legacyCheckbox
        ? [
            {
              fingerprint: digest(`${id}\u00000\u0000${legacyCheckbox[3] ?? ""}`).slice(0, 24),
              text: legacyCheckbox[3] ?? "",
              completed: (legacyCheckbox[2] ?? "").toLowerCase() === "x",
              markerStart: bodyStart + (legacyCheckbox[1] ?? "").length + 1,
            },
          ]
        : [];
      spans.push({
        note: {
          id,
          timestamp,
          time,
          displayTime: displayTime(timestamp, time),
          date: timestamp.slice(0, 10),
          text,
          checkboxes: checkboxes.map(({ markerStart: _markerStart, ...item }) => item),
        },
        kind: "legacy",
        blockStart: line.start,
        blockEnd: line.end,
        bodyStart,
        bodyEnd: line.contentEnd,
        checkboxes,
      });
    }

    const seenIds = new Set<string>();
    for (const span of spans) {
      if (seenIds.has(span.note.id)) diagnostics.push(`Ambiguous note identity: ${span.note.id}`);
      seenIds.add(span.note.id);
    }
    return new NotesMarkdownDocument(
      content,
      spans,
      days,
      frontmatter.valid && diagnostics.length === 0,
      diagnostics,
      frontmatter.end,
    );
  }

  /** Apply one exact, fail-closed Notes mutation. */
  apply(mutation: NotesDocumentMutation): NotesPatchResult {
    if (!this.valid) return { ok: false, reason: "invalid-document" };
    if (mutation.kind === "append") return this.append(mutation.text, mutation.now ?? new Date());

    const span = this.spans.find((candidate) => candidate.note.id === mutation.noteId);
    if (!span) return { ok: false, reason: "note-not-found" };
    if (mutation.kind === "delete") return this.delete(span);
    if (mutation.kind === "toggleCheckbox") {
      const checkbox = span.checkboxes.find(
        (candidate) => candidate.fingerprint === mutation.itemFingerprint,
      );
      if (!checkbox) return { ok: false, reason: "checkbox-not-found" };
      if (checkbox.completed === mutation.completed) {
        return { ok: true, content: this.content, changed: false };
      }
      const marker = mutation.completed ? "x" : " ";
      return {
        ok: true,
        content: `${this.content.slice(0, checkbox.markerStart)}${marker}${this.content.slice(
          checkbox.markerStart + 1,
        )}`,
        changed: true,
      };
    }

    const text = mutation.text.trim();
    if (!text || text === span.note.text.trim()) {
      return { ok: true, content: this.content, changed: false };
    }
    if (span.kind === "legacy") {
      return {
        ok: true,
        content: `${this.content.slice(0, span.bodyStart)}${text}${this.content.slice(span.bodyEnd)}`,
        changed: true,
      };
    }
    const segment = this.content.slice(span.bodyStart, span.blockEnd);
    const separator = trailingSeparator(segment, this.eol, span.blockEnd < this.content.length);
    return {
      ok: true,
      content: `${this.content.slice(0, span.bodyStart)}${text}${separator}${this.content.slice(
        span.blockEnd,
      )}`,
      changed: true,
    };
  }

  private append(textValue: string, now: Date): NotesPatchResult {
    const text = textValue.trim();
    if (!text) return { ok: true, content: this.content, changed: false };
    const date = localDate(now);
    const time = localTime(now);
    const entry = `### ${time}${this.eol}${text}${this.eol}${this.eol}`;
    const day = this.days.find((candidate) => candidate.date === date);
    if (day) {
      return {
        ok: true,
        content: `${this.content.slice(0, day.headingEnd)}${entry}${this.content.slice(
          day.headingEnd,
        )}`,
        changed: true,
      };
    }

    const dayBlock = `## ${date}${this.eol}${this.eol}${entry}`;
    const insertion = this.frontmatterBoundary;
    const before = this.content.slice(0, insertion);
    const after = this.content.slice(insertion);
    const prefix = before && !before.endsWith(this.eol) ? this.eol : "";
    return {
      ok: true,
      content: `${before}${prefix}${dayBlock}${after}`,
      changed: true,
    };
  }

  private delete(span: NoteSpan): NotesPatchResult {
    if (span.kind === "legacy") {
      return {
        ok: true,
        content: `${this.content.slice(0, span.blockStart)}${this.content.slice(span.blockEnd)}`,
        changed: true,
      };
    }

    if (
      span.dayStart !== undefined &&
      span.dayHeadingEnd !== undefined &&
      span.dayEnd !== undefined
    ) {
      const remaining = `${this.content.slice(span.dayHeadingEnd, span.blockStart)}${this.content.slice(
        span.blockEnd,
        span.dayEnd,
      )}`;
      const sibling = this.spans.some(
        (candidate) =>
          candidate !== span &&
          candidate.kind === "canonical" &&
          candidate.dayStart === span.dayStart,
      );
      if (!sibling && remaining.trim() === "") {
        return {
          ok: true,
          content: `${this.content.slice(0, span.dayStart)}${this.content.slice(span.dayEnd)}`,
          changed: true,
        };
      }
    }
    return {
      ok: true,
      content: `${this.content.slice(0, span.blockStart)}${this.content.slice(span.blockEnd)}`,
      changed: true,
    };
  }
}
