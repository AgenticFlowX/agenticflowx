## Summary

<!-- One-line description of the change -->

## Checklist

### Conventional Commit compliance

- [ ] PR title follows `type(scope): description` format
- [ ] `type` is one of: `build | chore | ci | docs | feat | fix | perf | refactor | revert | style | test`
- [ ] `scope` is from the enum (see `scripts/generate-scope-enum.mjs` or `.gitmessage`)
- [ ] Breaking changes use `!` suffix or `BREAKING CHANGE:` footer

### AFX traceability

- [ ] Spec-driven files carry `@see docs/specs/<feature>/<feature>.md [FR-X]` annotation
- [ ] New spec-driven files link to both spec (FR-X) and design (DES-X) anchors
- [ ] No orphaned `TODO` / `FIXME` comments — each has a `@see` link

### Tests & coverage

- [ ] New logic has co-located `*.test.ts` / `*.spec.ts`
- [ ] `pnpm test` passes locally
- [ ] Coverage thresholds not regressed (check coverage artifact in CI)
