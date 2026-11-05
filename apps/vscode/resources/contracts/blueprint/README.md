# AFX Blueprint portable contracts

This directory is the canonical format owner. The VS Code extension, CLI and compatible agents consume this contract; they do not define another schema. Publication here is working-tree development, not a GitHub/Marketplace release or evidence of a completed consumer.

- [Schema bundle](blueprint.schema.json): JSON Schema Draft 2020-12, ID `urn:afx:blueprint:1`.
- [Manifest example](examples/blueprint.json) and [trace example](examples/links.json): illustrative data, not real repo bindings or verification records.

## Format and ownership

Instances use `kind` plus integer `schemaVersion: 1`. The schema discriminates `afx-blueprint`, `afx-blueprint-traces` and `afx-blueprint-evidence`. Manifest artifact paths are configurable: `docs/specs` is supported, `.afx` and any umbrella/home layout are optional. Code and artifact roots can belong to unrelated, independently owned Git repositories.

The standard LSP DocumentSymbol object remains inside `source.symbol`. AFX's surrounding record carries stable IDs, description, repo/path/scope, target and provenance. LSP Method=6, Class=5 and Function=12 are not raw VS Code enum values; adapters map explicitly. Position offsets are zero-based UTF-16; normalize at boundaries and test non-BMP text. Provider symbols have no universal persistent identity; ranges and lastKnownResolution are hints to revalidate.

Binding scope is file, symbol or range. Target paths are artifact-relative and may have a requirement/design/task/section anchor. Omit the anchor for a whole document. Record source repo IDs, not absolute machine paths/credentials. Keep actual checkout/artifact URIs in the local host registry. Descriptions explain authored associations; `implements` and similar relations do not prove requirement satisfaction.

## Validation and version policy

Validate offline with the shipped schema selected by kind/version; do not fetch untrusted `$schema` URLs. Enable format assertions (UUID/date-time) and strict object validation. Timestamps use ISO 8601 UTC with exactly millisecond precision. Then validate canonical containment/symlinks, unique/cross-file IDs, typed anchors, ordered/contained ranges and expected revisions. Missing current source/anchors leaves historical records valid but unresolved; creating a new binding requires its target to exist. JSON Schema alone cannot establish those semantic or authorization facts.

Unknown major versions are read-only/unsupported and must not be overwritten. Breaking field/meaning changes require a new schemaVersion and a separately reviewed, recoverable migration. Do not silently drop unknown fields or infer a migration by rescanning code. Disposable cache versions are separate from durable artifact versions.

## Consumer packaging and pins

The extension vendors this directory byte-for-byte (excluding its own pin.json) and records SHA-256 digests per file in pin.json. Pin provenance names repository/path, schemaVersion and an honest upstream ref. Until upstream changes are committed/released, the ref is explicitly `unreleased-working-tree`; do not invent a tag or imply an old commit contains new files. Before publishing the feature, resolve upstream release/ref provenance through the existing release convention and verify the shipped bundle against it. No runtime network fetch is needed.

Edits originate here; regenerate consumers by copying validated canonical bytes and rebuilding pin digests, not by hand-editing vendored files. Hash identity permits exact development reproduction; it does not by itself establish upstream publication or provenance trust. CLI packaging must retain these assets and version policy before claiming external-mode parity.

## Evidence and execution

Schema validation is not execution or Human approval. Real evidence records name actor, procedure/outcome, actual time, code snapshot and artifact hashes. Preserve Agent/Human separation; changes make affected evidence stale. Do not claim the synthetic shape-validation fixtures are test runs.

Canonical Sprint/task external policy and both Pi 0.84.4 execution paths are implemented/verified in Sprint 19 tasks 3.3/3.4. Task 0.1 publishes the contract and ownership only. Code-root execution, external artifact access, revision-aware durable transactions, hybrid CodeLens and completion checks are separate consumer responsibilities.

## Semantic-model contract v2

[The v2 bundle](blueprint-v2.schema.json) uses ID `urn:afx:blueprint:2` and retains the v1 schema for existing readers. [Manifest](examples/blueprint-v2.json) and [model](examples/model-v2.json) examples are synthetic shape fixtures, not execution evidence.

V2 adds immutable model snapshots, a hash-pinned revision index, reconciliation records and authored finding reviews. Snapshots contain disk baselines, normalized LSP symbols, evidence-backed components/claims/ordered flow steps and the investigation outcome/coverage gaps. Build/test/release findings remain descriptions with evidence; they are never executed by opening or inspecting a Blueprint. Source hashes describe the examined bytes, including dirty checkouts; a Git commit alone does not certify cleanliness. Local paths and active-checkout selection are host state.

Review decisions (`accepted`, `rejected`, `corrected`) retain their own actor, model/finding identity, notes and time in append-only `afx-blueprint-review` records. They do not change task verification or overwrite derived evidence. Reconciliation reports changed/missing/added/unknown paths, affected claims/entities and identical-content rename candidates for explicit review. It never silently retargets authored links.

V1 migration is explicit. Preserve authored IDs and Markdown, advance manifest revision, migrate trace/evidence shape and create an empty uninspected model index. A durable write journal stores before/after bytes, publishes the manifest last, and refuses independently edited destinations during recovery. Cooperating writers acquire `.afx-blueprint.lock`; an abandoned lock requires operator review before recovery.

## Compact contract v3

[The v3 bundle](blueprint-v3.schema.json) uses ID `urn:afx:blueprint:3`. A new Blueprint is exactly two durable files: human-owned `blueprint.md` and authoritative `blueprint.json`. The JSON embeds the current semantic model, links, reviews, reconciliation result and retained evidence; consumers must not scaffold model, trace, evidence, research or SDD directories when saving it.

Portable document descriptors contain IDs and labels only. Absolute Blueprint, checkout and SDD document roots remain in local host bindings and explicit context envelopes. Attaching a Blueprint restores identity and cheap freshness hints but does not enter a planning mode, replace the normal code working directory, invoke a model or create SDD files. V1/v2 remain readable; conversion to v3 is explicit and side-by-side.
