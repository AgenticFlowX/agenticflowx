## Summary

<!-- One-line description of the change -->

## Checklist

### Conventional Commit compliance

- [ ] PR title follows `type(scope): description` format
- [ ] `type` is one of: `build | chore | ci | docs | feat | fix | perf | refactor | revert | style | test`
- [ ] `scope` is from the enum (see `scripts/generate-scope-enum.mjs` or `.gitmessage`)
- [ ] Breaking changes use `!` suffix or `BREAKING CHANGE:` footer

### Commit log context

- [ ] Non-trivial commits include `Why`, `Changed`, `Spec`, `Traceability`, and `Verification` body sections
- [ ] Spec-driven commits cite governing `docs/specs/...` anchors in the commit body
- [ ] Generated/vendored artifacts are named with the command or source that produced them
- [ ] Multi-surface commits identify the primary owning spec and secondary touched surfaces

### AFX traceability

- [ ] Spec-driven files carry `@see docs/specs/<feature>/spec.md [FR-X]` annotation
- [ ] New spec-driven files link to both spec (FR-X) and design (DES-X) anchors
- [ ] No orphaned `TODO` / `FIXME` comments — each has a `@see` link

### Tests & coverage

- [ ] New logic has co-located `*.test.ts` / `*.spec.ts`
- [ ] `pnpm verify` passes locally
- [ ] Coverage thresholds not regressed (check coverage artifact in CI)
