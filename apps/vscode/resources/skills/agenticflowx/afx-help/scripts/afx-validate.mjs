#!/usr/bin/env node
// afx-validate — deterministic AFX skill validator (network-free).
// Agent Skills spec conformance + AFX structural checks. See plan §11.
// Self-contained (Node stdlib only). JSON to stdout, human summary to stderr.
//
// Usage:
//   afx-validate <skills-dir>      Validate every <skills-dir>/<skill>/SKILL.md
//   afx-validate <skill-dir>       Validate a single skill directory
//   --json                         Emit machine JSON only (no stderr summary)
//   --help
//
// Exit codes: 0 all pass · 1 errors found · 2 usage.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname, relative } from 'node:path';

const ALLOWED = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);
const MAX_NAME = 64, MAX_DESC = 1024, MAX_COMPAT = 500;
const SIZE_LINES = 500, ROUTER_LINES = 250; // AFX outer budget / router target

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.length === 0) {
  process.stdout.write('afx-validate <skills-dir|skill-dir> [--json]\nExit: 0 pass · 1 errors · 2 usage\n');
  process.exit(argv.length === 0 ? 2 : 0);
}
const jsonOnly = argv.includes('--json');
const target = argv.find(a => !a.startsWith('--'));
if (!target || !existsSync(target)) { process.stderr.write(`Error: path not found: ${target}\n`); process.exit(2); }

function frontmatter(text) {
  const l = text.split('\n');
  if (l[0] !== '---') return { keys: [], map: {}, metadata: {}, ok: false };
  const end = l.findIndex((x, i) => i > 0 && x === '---');
  if (end === -1) return { keys: [], map: {}, metadata: {}, ok: false };
  const keys = [], map = {}, metadata = {};
  let currentTop = null;
  for (const ln of l.slice(1, end)) {
    const top = ln.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (top) {
      currentTop = top[1];
      keys.push(currentTop);
      map[currentTop] = scalar(top[2]);
      continue;
    }
    const nested = ln.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (nested && currentTop === 'metadata') metadata[nested[1]] = { value: scalar(nested[2]), raw: nested[2].trim() };
  }
  return { keys, map, metadata, ok: true };
}

function scalar(value) { return value.trim().replace(/^["']|["']$/g, ''); }

function walkFiles(root, predicate) {
  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) found.push(...walkFiles(path, predicate));
    else if (predicate(path)) found.push(path);
  }
  return found;
}

function validateSkill(dir) {
  const errors = [], advisories = [];
  const skill = basename(dir);
  const md = join(dir, 'SKILL.md');
  if (!existsSync(md)) { errors.push('missing SKILL.md'); return { skill, errors, advisories }; }
  const text = readFileSync(md, 'utf8');
  const lineCount = text.split('\n').length;
  const markdownFiles = walkFiles(dir, path => path.endsWith('.md'));
  const markdown = markdownFiles.map(path => ({ path, text: readFileSync(path, 'utf8') }));

  // --- Agent Skills spec conformance ---
  const fm = frontmatter(text);
  if (!fm.ok) errors.push('missing/invalid frontmatter');
  const extra = fm.keys.filter(k => !ALLOWED.has(k));
  if (extra.length) errors.push(`disallowed top-level frontmatter keys: ${extra.join(', ')}`);
  const name = fm.map.name;
  if (!name) errors.push('missing name');
  else {
    if (name !== name.toLowerCase()) errors.push(`name not lowercase: ${name}`);
    if (!/^[a-z0-9-]+$/.test(name)) errors.push(`name has invalid chars: ${name}`);
    if (name.startsWith('-') || name.endsWith('-')) errors.push('name starts/ends with hyphen');
    if (name.includes('--')) errors.push('name has consecutive hyphens');
    if (name.length > MAX_NAME) errors.push('name > 64 chars');
    if (name !== skill) errors.push(`name "${name}" != directory "${skill}"`);
  }
  const desc = fm.map.description;
  if (!desc) errors.push('missing/empty description');
  else if (desc.length > MAX_DESC) errors.push('description > 1024 chars');
  if (fm.map.compatibility && fm.map.compatibility.length > MAX_COMPAT) errors.push('compatibility > 500 chars');
  for (const [key, item] of Object.entries(fm.metadata)) {
    if (!item.raw || /^[\[{]/.test(item.raw) || item.raw === '|' || item.raw === '>')
      errors.push(`metadata.${key} must be a scalar string`);
  }

  // --- Size budgets ---
  if (lineCount > SIZE_LINES) errors.push(`SKILL.md ${lineCount} lines exceeds AFX outer budget ${SIZE_LINES}`);
  else if (lineCount > ROUTER_LINES) advisories.push(`SKILL.md ${lineCount} lines over router target ${ROUTER_LINES}`);

  // --- AFX contract checks ---
  for (const file of markdown) {
    const label = relative(dir, file.path);
    if (/\/afx-dev code/.test(file.text)) errors.push(`${label}: dead route /afx-dev code (use /afx-task code)`);
    if (/ask_followup_question/.test(file.text)) errors.push(`${label}: provider-specific tool ask_followup_question`);
    if (/^\s*(?:afx-status|status):\s*["']?Living["']?\s*$/m.test(file.text)) errors.push(`${label}: emits removed status Living`);
    if (/^\s*modeSlugs:\s*$/m.test(file.text)) errors.push(`${label}: legacy modeSlugs`);

    const hasWorkSessions = /^##(?: \d+\.)? Work Sessions\s*$/m.test(file.text);
    if (label.startsWith('assets/') && hasWorkSessions) {
      const canonicalHeader = /^\| Date \| Task \| Action \| Files Modified \| Agent \| Human \|\s*$/m;
      if (!canonicalHeader.test(file.text)) errors.push(`${label}: Work Sessions must use canonical six-column header`);

      const h2 = [...file.text.matchAll(/^##\s+(.+)$/gm)].map(match => match[1].trim());
      if (!/(?:^|\d+\. )Work Sessions$/.test(h2.at(-1) || '')) errors.push(`${label}: Work Sessions must be the final section`);
    }

    if (label.startsWith('assets/')) validateGeneratedDocumentAsset(file.text, label, errors);
  }

  // --- Reference link integrity + nesting depth ---
  const refs = [
    ...[...text.matchAll(/\]\(((?:references|assets)\/[^)]+)\)/g)].map(m => m[1]),
    ...[...text.matchAll(/`((?:references|assets)\/[A-Za-z0-9._/-]+)`/g)].map(m => m[1]),
  ];
  for (const r of refs) {
    if (!existsSync(join(dir, r))) errors.push(`broken reference link: ${r}`);
    if (r.startsWith('references/') && (r.match(/\//g) || []).length > 1) advisories.push(`reference nested more than one level: ${r}`);
  }

  // --- Read-only skills must not write journals ---
  // A skill is read-only when it declares allowed-tools that exclude write tools.
  const at = fm.map['allowed-tools'] || '';
  const readOnly = at && !/\b(Write|Edit|NotebookEdit)\b/.test(at);
  if (readOnly && markdown.some(file => /auto-capture to `journal\.md`|Proactive Journal Capture/.test(file.text)))
    errors.push('read-only skill (allowed-tools excludes writes) still auto-captures to journal.md');
  if (/NO stored lifecycle status/.test(text) && markdown.some(file => /^status:\s*/m.test(file.text)))
    errors.push('mutation contract says no stored lifecycle status but a bundled Markdown file emits status');

  return { skill, lines: lineCount, errors, advisories };
}

function validateGeneratedDocumentAsset(text, label, errors) {
  const fm = frontmatter(text);
  const type = fm.map.type;
  if (!['SPEC', 'DESIGN', 'TASKS', 'JOURNAL'].includes(type)) return;

  const hasStatus = Object.hasOwn(fm.map, 'status');
  if (['SPEC', 'DESIGN'].includes(type) && !hasStatus) errors.push(`${label}: ${type} requires lifecycle status`);
  if (['TASKS', 'JOURNAL'].includes(type) && hasStatus) errors.push(`${label}: ${type} must not carry lifecycle status`);

  if (type === 'DESIGN') {
    const headings = [...text.matchAll(/^##\s+(.+)$/gm)].map(match => match[1].trim());
    for (const heading of headings) {
      if (!/^\[DES-[A-Z0-9-]+\]\s+\S/.test(heading)) errors.push(`${label}: DESIGN H2 missing [DES-ID]: ${heading}`);
    }
    const ids = headings.map(heading => (heading.match(/^\[(DES-[A-Z0-9-]+)\]/) || [])[1]).filter(Boolean);
    const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    for (const id of duplicates) errors.push(`${label}: duplicate DESIGN H2 anchor: ${id}`);
  }

  if (type === 'TASKS') {
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (/^[ \t]+-\s+\[[ xX]\]\s+/.test(line)) errors.push(`${label}: TASKS checkbox must start at column 0 (line ${index + 1})`);
    });
    const groups = lines.flatMap((line, index) => /^###\s+\d+\.\d+\b/.test(line) ? [{ line: index, title: line.slice(4).trim() }] : []);
    for (const group of groups) {
      const nextHeading = lines.slice(group.line + 1).findIndex(line => /^#{1,3}\s+/.test(line));
      const end = nextHeading === -1 ? lines.length : group.line + 1 + nextHeading;
      const criteria = lines.slice(group.line + 1, end).filter(line => /^-\s+\[[ xX]\]\s+/.test(line));
      if (criteria.length === 0) errors.push(`${label}: TASKS group has no completion criteria: ${group.title}`);
    }
  }

  if (/^```[^\n]*\n(?:[ \t]*\n)*```[ \t]*$/m.test(text)) errors.push(`${label}: empty fenced code block`);
}

function isSkillDir(d) { return existsSync(join(d, 'SKILL.md')); }

function findSkillDirs(root) {
  if (isSkillDir(root)) return [root];
  const dirs = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    dirs.push(...findSkillDirs(join(root, entry.name)));
  }
  return dirs;
}

const targets = findSkillDirs(target);

const results = targets.map(validateSkill);
validateManifest(target, targets, results);
const errCount = results.reduce((n, r) => n + r.errors.length, 0);
const report = { pass: errCount === 0, skills: results.length, errors: errCount, results };

if (jsonOnly) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  for (const r of results) {
    const tag = r.errors.length ? 'FAIL' : 'ok  ';
    process.stderr.write(`${tag} ${r.skill}${r.errors.length ? ': ' + r.errors.join('; ') : ''}\n`);
    for (const a of (r.advisories || [])) process.stderr.write(`     advisory: ${a}\n`);
  }
  process.stderr.write(`\n${report.pass ? 'ALL PASS' : errCount + ' error(s)'} across ${results.length} skills\n`);
}
process.exit(report.pass ? 0 : 1);

function validateManifest(root, skillDirs, validationResults) {
  const agenticRoot = basename(root) === 'agenticflowx' ? root : join(root, 'agenticflowx');
  const manifestPath = join(agenticRoot, 'afx-help', 'references', 'commands.json');
  if (!existsSync(manifestPath)) return;
  const helpResult = validationResults.find(result => result.skill === 'afx-help');
  if (!helpResult) return;

  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
  catch (error) { helpResult.errors.push(`commands.json is invalid JSON: ${error.message}`); return; }

  const agenticDirs = skillDirs.filter(dir => dirname(dir) === agenticRoot);
  const actualIds = agenticDirs.map(dir => basename(dir)).sort();
  const entries = Array.isArray(manifest.skills) ? manifest.skills : [];
  const manifestIds = entries.map(entry => entry.id).sort();
  if (actualIds.join('|') !== manifestIds.join('|')) helpResult.errors.push('commands.json skill IDs do not match agenticflowx directories');

  const commands = new Map(entries.map(entry => [entry.id, new Set(entry.subcommands || [])]));
  for (const dir of agenticDirs) {
    const fm = frontmatter(readFileSync(join(dir, 'SKILL.md'), 'utf8'));
    const hint = fm.metadata['afx-argument-hint']?.value || '';
    const entry = entries.find(item => item.id === basename(dir));
    if (!entry) continue;
    if ((entry.argumentHint || '') !== hint) helpResult.errors.push(`commands.json argumentHint drift: ${basename(dir)}`);
    const hinted = hint.replace(/[\[\]]/g, '').split('|').map(value => value.trim().split(/\s+/)[0]).filter(Boolean).sort();
    const listed = [...(entry.subcommands || [])].sort();
    if (hinted.join('|') !== listed.join('|')) helpResult.errors.push(`commands.json subcommand drift: ${basename(dir)} (hint=${hinted.join(',')}; manifest=${listed.join(',')})`);
  }

  for (const dir of agenticDirs) {
    for (const path of walkFiles(dir, file => file.endsWith('.md'))) {
      const source = readFileSync(path, 'utf8');
      const snippets = [
        ...[...source.matchAll(/`(\/afx-[^`\n]+)`/g)].map(match => match[1]),
        ...source.split('\n').map(line => line.trim()).filter(line => line.startsWith('/afx-')),
      ];
      for (const snippet of snippets) {
        const match = snippet.match(/^\/(afx-[a-z0-9-]+)(?:\s+([a-z][a-z-]*))?/);
        if (!match || !commands.has(match[1]) || !match[2]) continue;
        const allowed = commands.get(match[1]);
        if (allowed.size && !allowed.has(match[2])) helpResult.errors.push(`${relative(agenticRoot, path)}: unsupported route /${match[1]} ${match[2]}`);
      }
    }
  }
}
