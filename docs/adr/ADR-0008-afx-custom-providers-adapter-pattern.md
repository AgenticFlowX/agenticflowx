---
afx: true
type: ADR
status: Proposed
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-08T12:18:59.000Z"
updated_at: "2026-05-08T12:18:59.000Z"
tags: ["adr", "architecture", "custom-providers", "harness-adapter", "pi-sdk", "secret-storage"]
---

# ADR-0008: AFX Custom Providers — Harness-Agnostic Adapter Pattern

## Context

Pi-mono ships `~/.pi/agent/models.json`, the user-editable registry that defines custom providers (Ollama, vLLM, LM Studio, OpenRouter, Vercel AI Gateway, Moonshot, etc.). Today AFX has no UI for it; users hand-edit JSON and risk literal API keys on disk (the current `~/.pi/agent/models.json` has at least one entry with `"apiKey": "sk-..."` in plaintext).

We need a structured custom-provider editor in the chat Settings UI that:

1. Lets users add / edit / remove non-API-key (Ollama, vLLM, LM Studio) and API-key (OpenRouter, Moonshot, etc.) providers via forms — not JSON.
2. Stores API keys in OS keychain via VSCode SecretStorage, never as literal values on disk.
3. Surfaces configured custom providers in the chat model picker so chat sessions can use them.
4. Supports more than just pi-mono — the same UI should drive other coding harnesses (oh-my-pi, opencode) without rewrites.
5. Keeps the user's existing hand-edited `~/.pi/agent/models.json` untouched.

### Constraints

- **Per `[ADR-0004]`** any runtime-specific code lives in `packages/agent/<runtime>/` and never imports `vscode`.
- **Per `214-app-chat-settings [NFR-1]`** secrets and non-public fields never cross the host→webview bridge.
- **Per `351-agent-pi [FR-2]`** Pi SDK bootstrap is owned by AFX (`packages/agent/pi-sdk/bootstrap/`).
- pi-mono exposes `ModelRegistry.registerProvider(name, config)` and `createAgentSessionRuntime({ modelRegistry })` — verified at `pi-mono/.../agent-session-services.ts:149` and `pi-mono/.../sdk.ts:33`.

### Harness comparison (research summary, see `docs/research/pi/res-pi-models-json-settings-ui.md`)

| Harness          | Config path                             | Format               | Schema                                                            | In-process register      |
| ---------------- | --------------------------------------- | -------------------- | ----------------------------------------------------------------- | ------------------------ |
| pi-mono / Pi SDK | `~/.pi/agent/models.json`               | JSON                 | `providers: Record<id, {baseUrl, api, apiKey, models[], compat}>` | Yes (`registerProvider`) |
| oh-my-pi         | `~/.omp/agent/models.yml`               | YAML (JSON fallback) | Superset of pi-mono                                               | Yes (same API)           |
| opencode         | `~/.config/opencode/config.jsonc` (XDG) | JSONC                | Different — models nested under `provider.<id>.options.apiKey`    | No (config-file only)    |

A common schema across all three is **not** feasible. A canonical AFX record + per-harness translator **is**.

---

## Decision

**Adopt a harness-agnostic canonical-record + adapter pattern for AFX-managed custom providers. Ship the Pi SDK adapter first; oh-my-pi and opencode adapters become future iterations without touching shared code or UI.**

Concretely:

1. **Canonical record + summary** in `packages/shared/src/custom-providers/`:
   - `CustomProviderRecord` — host-internal canonical form (id, displayName?, baseUrl, api, apiKey value, models[], headers?, compat?).
   - `CustomProviderSummary` — webview-safe redacted form (id, baseUrl, api, modelCount, apiKeySource label, origin) — the **only** shape the bridge ever carries.
   - Zod schema for runtime validation.

2. **`HarnessAdapter` interface** in `packages/shared/src/custom-providers/harness-adapter.ts`:
   - `id`, `displayName`, `materialization: 'in-process-register' | 'temp-file'`.
   - `encodeForBootstrap(records)` — produces a JSON envelope + env map shipped to the runtime.
   - `parseHandEdited(text)` — tolerant parse of the harness's native config for read-only display.
   - `handEditedConfigPath?()` — for the read-only display surface.

3. **VSCode SecretStorage as source of truth** for AFX-managed records:
   - One SecretStorage entry per provider, JSON-serialized, key form `afx.customProvider.${id}`.
   - Index entry `afx.customProviders.index` for enumeration.
   - The full record (incl. apiKey value) lives in the OS keychain; never in `~/.pi/agent/models.json` or any AFX file on disk.

4. **In-process registration for Pi SDK** (the first concrete adapter):
   - Adapter `materialization: 'in-process-register'`.
   - At Pi SDK spawn the host calls `customProvidersService.buildEnvForPiSdkSpawn()` → `{ AFX_CUSTOM_PROVIDERS_JSON, AFX_<SLUG>_KEY=... }`.
   - Pi SDK bootstrap branches on `AFX_CUSTOM_PROVIDERS_JSON`: builds an empty `ModelRegistry`, calls `registerProvider(...)` per record, hands the registry to `createAgentSessionRuntime({ modelRegistry })` followed by `runRpcMode(runtime)`.
   - When the env var is absent, bootstrap falls through to `main(args)` unchanged.
   - **No temp file is materialized. `PI_CODING_AGENT_DIR` is not overridden for custom-providers purposes. Session storage is unaffected.**

5. **Two-track UI in `214-app-chat-settings`**:
   - **Pi SDK track** — full Add/Edit/Delete CRUD over SecretStorage records.
   - **Pi RPC track** — read-only display of `~/.pi/agent/models.json`, with "Open in editor" buttons that re-use the existing `chat/openModelsJson` deep-link. AFX never writes the file.

6. **Pluggability invariant** — nothing in `apps/chat/`, `packages/shared/src/custom-providers/`, or `apps/vscode/src/services/custom-providers-service.ts` may import from a specific harness adapter. Adapters are wired only in `apps/vscode/src/extension.ts` activation and the bootstrap dir of their owning runtime package.

---

## Alternatives Considered

### A. Write to `~/.pi/agent/models.json` directly

AFX would own the file: read/parse/edit/write, with backup-on-write, schema validation, etc.

**Rejected** because:

- The user explicitly opposed AFX modifying that file (it's the user's hand-edit domain).
- Pi RPC reads the same file natively; coupling AFX writes to that runtime path creates "did pi see my change yet?" UX confusion.
- An AFX uninstall would leave AFX-shaped entries behind in `~/.pi/agent/models.json`.

### B. Materialize a temp `models.json` and override `PI_CODING_AGENT_DIR`

AFX would write `${tmpdir}/afx-pi-${session}/agent/models.json` and point pi at the temp dir.

**Rejected** because:

- `PI_CODING_AGENT_DIR` is overloaded — at `packages/agent/pi-sdk/src/sdk-rpc-manager.ts:694` it carries the session dir as well. Overriding it for models.json purposes loses session continuity.
- Temp-dir lifecycle (cleanup on subprocess crash, extension deactivation, Windows-specific quirks) adds attack surface and complexity for no gain over option (D).

### C. Add a CLI flag to pi-mono for an explicit models.json path

Patch pi-mono upstream to accept `--models-config /path/to/file.json`.

**Rejected** because:

- Out of AFX's release control.
- pi-mono already exposes the right hook at the SDK level — `createAgentSessionRuntime({ modelRegistry })` accepts an explicit registry. Use what's there.

### D. Per-harness storage namespace (records scoped to a harness)

Each harness gets its own SecretStorage namespace; AFX records are not portable across harnesses.

**Rejected** because:

- Defeats the user's stated goal of cross-harness reuse ("the same UI should drive other coding harnesses").
- The canonical-form approach achieves portability at the cost of one additional translation layer per adapter — small price for genuine reuse.

### E. Common schema across harnesses

Force pi-mono / oh-my-pi / opencode shapes into a single shared schema.

**Rejected** because:

- opencode nests models very differently (`provider.<id>.options.apiKey`, `variants`, `npm` package refs); coercing into pi-mono's flat shape is lossy.
- Each harness's compat fields are vendor-specific and not universally meaningful.
- Canonical record + per-adapter translation is strictly more flexible.

---

## Consequences

### Positive

- **AFX becomes the structured editor** for custom providers without owning the file format.
- **Secrets never on disk** — the `~/.pi/agent/models.json` literal-key problem (`moonshot-open` entry today) is solved by env-var indirection compiled at bootstrap.
- **Pluggable for the next harness** — adding oh-my-pi or opencode is a new `packages/agent/<harness>/` package with one `HarnessAdapter` implementation. Zero changes to shared types, the host service, or the UI.
- **Pi RPC users keep working** — their hand-edited `~/.pi/agent/models.json` is untouched and Pi RPC continues reading it directly.
- **No VSCode dependency in adapters** — `HarnessAdapter` lives in `@afx/shared`; concrete adapters live in `packages/agent/<harness>/` and stay vscode-free per `[ADR-0004]`.

### Negative

- **One more abstraction layer** — UI captures canonical records; adapter translates. Future contributors must keep the boundary clean (lint/eslint enforces it, but it's still a boundary).
- **Translation can drop fields** — opencode's `variants` and `npm` refs, oh-my-pi's `equivalence` are not in the canonical form. They're either lost on round-trip or surfaced via adapter-specific UI extensions later.
- **Bootstrap diverges** — Pi SDK bootstrap now has two code paths (with/without `AFX_CUSTOM_PROVIDERS_JSON`). Tested as a regression, but it's still a fork.
- **Records stored in SecretStorage** can balloon the number of secret entries. Each provider is one entry. If a user adds 20 providers, that's 20 + 1 (index) entries. Acceptable given typical use.

### Operational notes

- When a user switches active runtime from Pi SDK to a future harness (oh-my-pi, opencode), the same SecretStorage records are re-translated by the new adapter. Compatibility depends on canonical-form coverage of the user's records.
- `~/.pi/agent/models.json` literal-key entries (today's `moonshot-open`) are surfaced as warnings in the Pi RPC track. Users can recreate the same provider in the Pi SDK track via the structured UI to migrate keys into SecretStorage.
- Cleanup on AFX uninstall removes SecretStorage entries (VSCode handles this via secret namespace) — `~/.pi/agent/models.json` is untouched.

---

## Implementation Mapping

- Canonical types and `HarnessAdapter` interface → `packages/shared/src/custom-providers/`
- Pi SDK adapter (first concrete) → `packages/agent/pi-sdk/src/custom-providers-adapter.ts`
- Bootstrap branch → `packages/agent/pi-sdk/bootstrap/bootstrap.ts` + `bootstrap/custom-providers-bootstrap.ts`
- Host service factory → `apps/vscode/src/services/custom-providers-service.ts`
- SecretStorage CRUD → `apps/vscode/src/secret-store.ts`
- UI → `apps/chat/src/views/settings.tsx` + `apps/chat/src/components/{custom-model-card,preset-picker,api-key-source-input,custom-provider-form,custom-model-form}.tsx`

Spec ownership: `214-app-chat-settings` for UI surface; `351-agent-pi` for adapter + bootstrap. No new spec folder.

---

## Status

Proposed — ready for implementation under `214-app-chat-settings` Phase 4 and `351-agent-pi` Phase 4 task plans.

## References

- `[ADR-0002]` AFX Agent Manager Abstraction
- `[ADR-0004]` AFX Agent Adapter Roadmap (vocabulary, defer-list, sibling-package convention)
- `docs/research/pi/res-pi-models-json-settings-ui.md` — full investigation including UI mockups
- `docs/specs/214-app-chat-settings/spec.md` `[FR-8]` `[FR-9]` `[FR-10]`
- `docs/specs/351-agent-pi/spec.md` `[FR-5]` `[FR-6]`
- pi-mono SDK reference: `pi-mono/packages/coding-agent/src/core/sdk.ts:33` (`createAgentSessionRuntime` accepts `modelRegistry`)
- pi-mono register API: `pi-mono/packages/coding-agent/src/core/agent-session-services.ts:149` (`modelRegistry.registerProvider(name, config)`)
