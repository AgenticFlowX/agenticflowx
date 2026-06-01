---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["package", "shared", "provider-catalog", "providers", "models"]
spec: spec.md
---

# Package Provider Catalog - Technical Design

## [DES-OVR] Overview

The provider catalog is a shared static metadata module. It supplies provider display metadata, env aliases, startup/default models, OAuth capability flags, and setup fields to the host and webview without containing user secrets.

---

## [DES-ARCH] Architecture

```
packages/shared/src/provider-catalog.ts
  |-- provider ids / display names / help URLs
  |-- API key env aliases
  |-- default model ids
  |-- oauthCapable / oauthFlow / dualMethod
  |-- configFields[]
        |
        +--> apps/chat Settings cards
        +--> apps/vscode agent factory setup checks
        +--> packages/agent/pi-sdk env/bootstrap setup
```

Provider metadata is authored once and projected into each consumer. Consumers may filter or group providers, but they must not duplicate provider readiness requirements.

---

## [DES-DATA] Data Model

```typescript
export type ProviderOAuthFlow = "pkce-loopback" | "device-code";

export interface ProviderConfigField {
  id: string;
  label: string;
  envVar: string;
  description: string;
  placeholder?: string;
  required?: boolean;
  secret?: boolean;
}

export interface ProviderCatalogDetails {
  displayName: string;
  modelHint: string;
  helpUrl?: string;
  noKeyNeeded?: boolean;
  configFields?: readonly ProviderConfigField[];
  oauthCapable?: boolean;
  oauthFlow?: ProviderOAuthFlow;
  dualMethod?: boolean;
}
```

`DEFAULT_API_PROVIDER_MODELS` must remain Pi-compatible. `PROVIDER_API_KEY_ENV_ALIASES` maps provider ids to env vars understood by the managed SDK path.

---

## [DES-API] API Contracts

The catalog exports plain constants and types from `@afx/shared`. No runtime I/O happens here.

| Export                         | Purpose                                                 |
| ------------------------------ | ------------------------------------------------------- |
| `PROVIDER_DETAILS`             | Card/group metadata and capability flags                |
| `PROVIDER_API_KEY_ENV_ALIASES` | Host/bootstrap env mapping                              |
| `DEFAULT_API_PROVIDER_MODELS`  | Startup fallback/default model selection                |
| `ProviderConfigField`          | Required setup metadata for Settings and host readiness |

---

## [DES-SEC] Security Considerations

- Catalog entries may name env vars but must never contain literal user secrets.
- `secret: true` only describes UI/storage treatment for setup fields; values are stored by host services.
- Subscription-only provider ids remain distinct from API-key provider ids to avoid accidental credential fallback.

---

## [DES-TEST] Testing Strategy

- Unit tests assert critical providers, env aliases, OAuth flags, setup fields, and defaults.
- Drift checks compare catalog ids/defaults against the bundled Pi package before release.
- Consumer tests verify Settings readiness and SDK spawn behavior from catalog metadata.

---

## File Reference Map

| Task | File                                           | Required @see                                                  |
| ---- | ---------------------------------------------- | -------------------------------------------------------------- |
| 1.1  | `packages/shared/src/provider-catalog.ts`      | `docs/specs/141-package-provider-catalog/design.md [DES-DATA]` |
| 1.2  | `packages/shared/src/provider-catalog.test.ts` | `docs/specs/141-package-provider-catalog/design.md [DES-TEST]` |

---

## Open Technical Questions

| #   | Question                                                            | Status |
| --- | ------------------------------------------------------------------- | ------ |
| 1   | Should untested Pi providers remain hidden until manually verified? | Open   |
