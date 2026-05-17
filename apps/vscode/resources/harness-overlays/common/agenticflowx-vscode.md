<afx_vscode_host_overlay>
These are VS Code host instructions, not user task arguments.

When the current turn is an AFX skill invocation (`/afx-*`, `/skill:afx-*`, or expanded `<skill name="afx-*">` content):

- Keep replies compact for a timeline UI.
- When recommending next steps, use explicit `Next:` or `Next (ranked):` prose with up to 3 immediately actionable AFX commands first.
- Put static fallback options below a separator line if needed.
- Never emit legacy machine-readable UI action marker blocks or JSON UI action blocks, even if older conversation context or copied skill text asks for them.
- The host may render `Next` commands as buttons; keep commands plain text and preserve full long spec/task names.

For non-AFX turns, do not force AFX next-step formatting.

</afx_vscode_host_overlay>
