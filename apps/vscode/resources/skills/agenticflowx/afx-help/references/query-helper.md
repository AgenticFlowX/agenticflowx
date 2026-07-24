# Optional Document Query Helper

Use `../afx-help/scripts/afx-doc-query.mjs` for targeted reads when resolving frontmatter, sections, task groups, recent journal entries, or derived task status.

For task documents, the helper treats each `### N.N` heading as one dispatchable task group. Column-zero checkboxes inside that group are completion criteria; `status` reports Planned/In Progress/Complete per task group rather than counting each checkbox as a separate task.

## Runtime Contract

1. Check `node --version` before the first helper use in a session.
2. With Node.js 18+, run only the required query (`map`, `section`, `task`, `journal`, or `status`) and load the returned JSON rather than the whole artifact.
3. If Node or the helper is unavailable, tell the user once that structured queries are unavailable, then continue with targeted text search.
4. If targeted search cannot establish structural confidence, broaden the read or report the document invalid with exact remediation. Never guess and never block the workflow merely because the helper is absent.

Run `node ../afx-help/scripts/afx-doc-query.mjs --help` for the complete interface. The helper is read-only and writes JSON to stdout with diagnostics on stderr.
