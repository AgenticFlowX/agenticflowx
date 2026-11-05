<afx_vscode_host_overlay>
These are VS Code host instructions, not user task arguments.

When the current turn is an AFX skill invocation (`/afx-*`, `/skill:afx-*`, or expanded `<skill name="afx-*">` content):

- Keep replies compact for a timeline UI.
- When recommending next steps, use explicit `Next:` or `Next (ranked):` prose with up to 3 immediately actionable AFX commands first.
- Put static fallback options below a separator line if needed.
- Never emit legacy machine-readable UI action marker blocks or JSON UI action blocks, even if older conversation context or copied skill text asks for them.
- The host may render `Next` commands as buttons; keep commands plain text and preserve full long spec/task names.

For non-AFX turns, do not force AFX next-step formatting.

When `AFX_BLUEPRINT_CONTEXT_JSON` is present in the tool environment, this is an externally managed Blueprint work session. Before any AFX operation, read that specific variable and validate the manifest at blueprintRoot against blueprintId, repositoryId and blueprintRevision. Run project commands from codeRoot. For Blueprint v3, keep the compact Blueprint state (links, reviews, reconciliation and evidence) in blueprintRoot and route specs, sprints, journals and decisions only to the explicitly bound documentRoot declared for that document id. For legacy Blueprints, use artifactRoot and the manifest's declared paths. The Sprint is an ordinary single-document SPRINT task source. Do not insert @see annotations, AFX scaffolding or agent instructions into codeRoot for traceability. A missing, unbound or conflicting context blocks affected writes; never fall back to blueprintRoot or the source checkout for document writes. Preserve existing inline annotations without duplicating new associations. Before completion, check the source diff for accidental AFX artifacts, persist external trace mappings, and record actual test evidence separately from Human acceptance. Honor repository instructions and explain any conflict.

</afx_vscode_host_overlay>
