#!/usr/bin/env node
// afx-doc-query — deterministic, read-only queries over AFX Markdown documents.
// Self-contained (Node stdlib only). Emits JSON to stdout, diagnostics to stderr.
// See docs/specs/900-fleet/16-agenticflowx-skill-optimization §7.4.
//
// Usage:
//   afx-doc-query map <file>                 Frontmatter + heading/anchor map
//   afx-doc-query section <file> <anchor>    One anchored section (## / ### heading or [ID])
//   afx-doc-query task <file> <id>           One WBS task group (### N.N) + its criteria
//   afx-doc-query journal <file> [--limit N] Recent journal discussion headers (default 5)
//   afx-doc-query status <file>              Task + Work Session status summary
//
// Options:
//   --help            Show this help.
//   --offset N        For 'journal', skip N items (pagination).
//
// Exit codes: 0 ok · 2 usage error · 3 file not found · 4 not found in doc.

import { readFileSync, existsSync } from 'node:fs';

const HELP = `afx-doc-query — read-only structured queries over AFX Markdown.

Commands:
  map <file>                 Frontmatter + heading/anchor map
  section <file> <anchor>    One anchored section (heading text or [ID])
  task <file> <id>           One WBS task group (### N.N) + criteria
  journal <file> [--limit N] Recent journal discussion headers (default 5)
  status <file>              Task + Work Session status summary

Options: --help  --limit N  --offset N
Output: JSON on stdout, diagnostics on stderr.
Exit: 0 ok · 2 usage · 3 no file · 4 not found`;

function die(code, msg) { process.stderr.write(msg + '\n'); process.exit(code); }
function out(obj) { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); }

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write(HELP + '\n'); process.exit(argv.length === 0 ? 2 : 0);
}
function optNum(name, dflt) {
  const i = argv.indexOf(name);
  if (i === -1) return dflt;
  const v = Number(argv[i + 1]);
  return Number.isFinite(v) ? v : dflt;
}

const cmd = argv[0];
const file = argv[1];
if (!file) die(2, 'Error: <file> is required. See --help.');
if (!existsSync(file)) die(3, `Error: file not found: ${file}`);
const text = readFileSync(file, 'utf8');
const lines = text.split('\n');

function parseFrontmatter(src) {
  const l = src.split('\n');
  if (l[0] !== '---') return { frontmatter: {}, bodyStart: 0 };
  const end = l.findIndex((x, i) => i > 0 && x === '---');
  if (end === -1) return { frontmatter: {}, bodyStart: 0 };
  const fm = {};
  for (const ln of l.slice(1, end)) {
    const m = ln.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { frontmatter: fm, bodyStart: end + 1 };
}

function headingMap() {
  const heads = [];
  lines.forEach((ln, i) => {
    const m = ln.match(/^(#{1,4})\s+(.*)$/);
    if (m) {
      const id = (m[2].match(/\[([A-Z]+-[A-Z0-9.-]+)\]/) || [])[1] || null;
      const wbs = (m[2].match(/^(\d+\.\d+)\b/) || [])[1] || null;
      heads.push({ line: i + 1, level: m[1].length, title: m[2].trim(), id, wbs });
    }
  });
  return heads;
}

function sectionAt(startLine, level) {
  const body = [];
  for (let i = startLine; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,4})\s+/);
    if (m && m[1].length <= level && i > startLine - 1) break;
    body.push(lines[i]);
  }
  return body;
}

switch (cmd) {
  case 'map': {
    const { frontmatter } = parseFrontmatter(text);
    out({ file, frontmatter, headings: headingMap() });
    break;
  }
  case 'section': {
    const anchor = argv[2];
    if (!anchor) die(2, 'Error: section requires <anchor>.');
    const heads = headingMap();
    const h = heads.find(x => x.id === anchor || x.title.includes(anchor));
    if (!h) die(4, `Not found: no section matching "${anchor}".`);
    const startIdx = h.line - 1;
    const content = sectionAt(startIdx + 1, h.level);
    out({ file, anchor, heading: h, content: [lines[startIdx], ...content].join('\n') });
    break;
  }
  case 'task': {
    const id = argv[2];
    if (!id) die(2, 'Error: task requires <id> (e.g. 1.1).');
    const heads = headingMap();
    const h = heads.find(x => x.wbs === id);
    if (!h) die(4, `Not found: no task group ${id}.`);
    const startIdx = h.line - 1;
    const content = sectionAt(startIdx + 1, h.level);
    const criteria = content
      .filter(x => /^-\s+\[[ xX]\]\s+/.test(x))
      .map(x => ({ done: /\[[xX]\]/.test(x), text: x.replace(/^-\s+\[[ xX]\]\s*/, '') }));
    const files = (content.join('\n').match(/<!--\s*files:\s*([^>]*?)-->/) || [])[1];
    out({
      file, task: id, title: h.title,
      files: files ? files.trim() : null,
      complete: criteria.length > 0 && criteria.every(c => c.done),
      criteria,
    });
    break;
  }
  case 'journal': {
    const limit = optNum('--limit', 5);
    const offset = optNum('--offset', 0);
    const items = [];
    lines.forEach((ln, i) => {
      // New documents use an ASCII hyphen. Read the em dash too because it was
      // emitted by shipped AFX examples before the separator was canonicalized.
      const m = ln.match(/^###\s+([A-Z]{2,4}-D\d{3})\s+(?:-|—)\s+(.*)$/);
      if (m) items.push({ line: i + 1, id: m[1], title: m[2].trim() });
    });
    const recent = items.reverse().slice(offset, offset + limit);
    out({ file, total: items.length, offset, limit, items: recent });
    break;
  }
  case 'status': {
    const heads = headingMap().filter(h => h.wbs);
    const groups = heads.map(h => {
      const content = sectionAt(h.line, h.level);
      const crit = content.filter(x => /^-\s+\[[ xX]\]\s+/.test(x));
      const done = crit.filter(x => /\[[xX]\]/.test(x)).length;
      return { id: h.wbs, title: h.title, criteria: crit.length, done, complete: crit.length > 0 && done === crit.length };
    });
    const wsCount = lines.filter(x => /^\|\s*\d{4}-\d{2}-\d{2}/.test(x)).length;
    out({
      file,
      taskGroups: groups.length,
      complete: groups.filter(g => g.complete).length,
      inProgress: groups.filter(g => g.done > 0 && !g.complete).length,
      planned: groups.filter(g => g.done === 0).length,
      workSessionRows: wsCount,
      groups,
    });
    break;
  }
  default:
    die(2, `Error: unknown command "${cmd}". See --help.`);
}
