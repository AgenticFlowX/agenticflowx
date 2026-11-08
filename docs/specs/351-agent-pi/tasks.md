---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.2"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-11-08T11:50:52.000Z"
tags: ["agent", "pi", "rpc", "sdk", "custom-providers"]
spec: spec.md
design: design.md
---

# Agent Pi - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source retargeting
- **2.x** - Future Pi adapter work
- **3.x** - Verification

---

## Phase 1: Source Retargeting

### 1.1 Retarget Pi Files

- [ ] Replace retired chat/Pi plan refs in adapter and SDK files
- [ ] Keep generic manager refs pointed at `350-agent-manager`

---

## Phase 2: Future Pi Work

### 2.1 Pi SDK Bootstrap Updates

- [ ] Update requirements before changing bootstrap/bundling
- [ ] Add platform-focused tests for changed behavior

---

## Phase 3: Verification

### 3.1 Verify Pi Routing

- [ ] Run stale-ref search for Pi files
- [ ] Run Pi adapter tests

---

## Phase 4: Pi SDK Custom Providers Adapter

### 4.1 Pi SDK adapter package

- [ ] Add `packages/agent/pi-sdk/src/custom-providers-adapter.ts` — `createPiSdkCustomProvidersAdapter()` returning `HarnessAdapter` with `materialization: 'in-process-register'`
- [ ] Add `packages/agent/pi-sdk/src/secret-env.ts` — `secretEnvVarFor(providerId)` and slug validation
- [ ] Export from `packages/agent/pi-sdk/src/index.ts`
- [ ] Unit tests: round-trip canonical → `encodeForBootstrap` → re-parsed registry config; `parseHandEdited` classification (CUSTOM vs OVERRIDE/TWEAKS) using kimi/moonshot-open fixture
- [ ] Confirm no `vscode` import in adapter package per NFR-1

### 4.2 Bootstrap modification

- [ ] Modify `packages/agent/pi-sdk/bootstrap/bootstrap.ts` — branch on `AFX_CUSTOM_PROVIDERS_JSON`; remove `void createAgentSessionRuntime` / `void runRpcMode` and use them in the new code path
- [ ] Add `packages/agent/pi-sdk/bootstrap/custom-providers-bootstrap.ts` — pure helpers: `parseEnvelope(text)`, `buildRegistry(envelope)`
- [ ] Update `packages/agent/pi-sdk/bootstrap/bootstrap.test.ts` — regression test for `AFX_CUSTOM_PROVIDERS_JSON` unset (current behaviour preserved); new tests for: envelope present → empty registry built and `registerProvider` called per record; malformed envelope throws before pi-mono is invoked

### 4.3 Verification

- [ ] `pnpm -F @afx/agent-pi-sdk check:types && pnpm -F @afx/agent-pi-sdk test`
- [ ] Confirm bootstrap behaviour unchanged when env var absent (regression test passes)
- [ ] Manual smoke test: spawn Pi SDK with envelope, confirm `getAvailableModels` returns AFX-registered providers

---

## Phase 5: Bedrock Lazy Module Packaging Hotfix

### 5.1 Correct Emitted Runtime Path

- [x] Emit `bedrock-converse-stream.js` beside `bootstrap.js`, matching the bundled lazy loader's `import.meta.url` base
- [x] Stage the root-level sibling in `resources/pi-sdk/` and remove stale historical Bedrock asset paths
- [x] Add a bundle regression test that resolves the lazy import exactly as the generated bootstrap does
- [x] Run repository verification and inspect the packaged VSIX asset layout
- [ ] Human smoke test: send a prompt through Amazon Bedrock and confirm streaming starts without a module-resolution error

---

## Implementation Flow

```text
Retarget Pi refs
    ↓
Update adapter/bootstrap behavior
    ↓
Verify RPC, SDK, and runtime status
    ↓
Pi SDK Custom Providers adapter + bootstrap branch
```

---

## Cross-Reference Index

| Task | Spec Requirement       | Design Section                        |
| ---- | ---------------------- | ------------------------------------- |
| 1.1  | [FR-1], [FR-2], [FR-3] | [DES-FILES], [DES-API]                |
| 2.1  | [FR-2], [NFR-3]        | [DES-TEST]                            |
| 4.1  | [FR-5]                 | [DES-PI-CUSTOM-PROVIDERS]             |
| 4.2  | [FR-5], [FR-6]         | [DES-PI-CUSTOM-PROVIDERS]             |
| 4.3  | [NFR-1], [NFR-2]       | [DES-PI-CUSTOM-PROVIDERS], [DES-TEST] |
| 5.1  | [FR-2], [FR-7]         | [DES-PI-080-STARTUP], [DES-TEST]      |

---

## Notes

- This spec explicitly supersedes Pi-specific content from the old plan once retargeting completes.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date                     | Task | Action     | Files Modified                                                                                                                                                               | Agent | Human |
| ------------------------ | ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-02               | 1.1  | Scaffolded | docs/specs/351-agent-pi/                                                                                                                                                     | [x]   | [x]   |
| 2026-05-03               | 1.2  | Coded      | design.md, Pi adapter source comments                                                                                                                                        | [x]   | [x]   |
| 2026-05-08T12:18:59.000Z | 4.x  | Scaffolded | docs/specs/351-agent-pi/{spec,design,tasks}.md, docs/adr/ADR-0008-afx-custom-providers-adapter-pattern.md (planned)                                                          | [x]   | [x]   |
| 2026-05-22T05:56:29.000Z | FR-2 | Tested     | packages/agent/pi-sdk/src/sdk-rpc-manager.test.ts, docs/specs/351-agent-pi/tasks.md                                                                                          | [x]   | [x]   |
| 2026-05-22T06:20:53.000Z | FR-5 | Fixed      | apps/vscode/src/{extension.ts,services/custom-providers-service.ts,services/custom-providers-service.test.ts}, docs/specs/351-agent-pi/{design,tasks}.md                     | [x]   | [x]   |
| 2026-06-01T21:10:52.000Z | 2.1  | Optimized  | packages/agent/pi-sdk/src/{sdk-rpc-manager.ts,sdk-rpc-manager.test.ts}, docs/specs/351-agent-pi/tasks.md                                                                     | [x]   | [x]   |
| 2026-11-08T11:44:07.000Z | 5.1  | Verified   | packages/agent/pi-sdk/build.bootstrap.mjs, apps/vscode/scripts/prepare-pi-sdk.mjs, apps/vscode/src/pi-sdk-bundle.test.ts, scripts/legal/config.mjs, docs/specs/351-agent-pi/ | [x]   | [ ]   |
