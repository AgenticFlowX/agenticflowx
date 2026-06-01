---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:48:22.000Z"
tags: ["app", "chat", "settings", "providers", "subscription-accounts"]
spec: spec.md
---

# App Chat Provider Settings - Technical Design

## [DES-OVR] Overview

Settings provider management renders catalog-backed provider cards. Subscription-capable accounts are grouped separately, API-key providers keep key/setup controls, and every OAuth state is rendered from redacted host snapshots.

---

## [DES-ARCH] Architecture

```
agent/settingsSnapshot
  -> settings-snapshot.ts normalization
  -> settings.tsx grouping/search/filter
  -> ProviderCard
       - API key form
       - setup fields
       - subscription sign-in states
       - connected/sign-out states
```

Provider cards do not decide provider capability from hard-coded names. They consume catalog fields projected by the host/mock snapshot.

---

## [DES-UI] ASCII Surface Maps

The Settings provider surface lives inside Settings -> Models -> Built-in. The maps below are functional surface contracts, not pixel-perfect artwork. Stable map IDs are used by future doc-to-code traceability and Playwright screenshot naming.

### SM-PROVIDER-SHELL

```
+--------------------------------------------------------------------------------+
| Settings                                                          Connected 3   |
| [Workspace] [Runtimes] [Models] [Look] [Support]                                |
|                                                                                |
| Models                                                                         |
| Hosted providers and local/custom model setup.                                 |
| [ Built-in ] [ Custom Models ]                                                 |
|                                                                                |
| Providers 25          Ready 4             Models 6                             |
| [ Find provider or model...                                             ]       |
| [ All 25 ] [ Ready 4 ] [ Needs setup 3 ] [ Needs key 18 ]                      |
|                                                                                |
| Subscription accounts          ChatGPT, Claude, and Copilot sign-ins.           |
|   ... cards ...                                                                |
|                                                                                |
| API key providers              Metered hosted providers and compatible APIs.    |
|   ... cards ...                                                                |
+--------------------------------------------------------------------------------+
```

### SM-PROVIDER-GROUPS

```
+--------------------------------------------------------------------------------+
| Subscription accounts                                                        |
| +------------------------------+ +------------------------------+              |
| | Anthropic            [Sign in]| | ChatGPT (Codex)      [Sign in]|              |
| | Claude Opus, Sonnet, Haiku    | | GPT via ChatGPT Plus/Pro      |              |
| | [Sign in with Claude]         | | [Sign in with ChatGPT]        |              |
| +------------------------------+ +------------------------------+              |
| | GitHub Copilot       [Sign in]|                                           |
| | GitHub Copilot-backed models  |                                           |
| | [Sign in with GitHub]         |                                           |
| +------------------------------+                                           |
|                                                                                |
| API key providers                                                              |
| +------------------------------+ +------------------------------+              |
| | OpenAI                 Ready  | | Cloudflare AI Gateway Setup  |              |
| | GPT API models               | | Account and gateway required |              |
| | [Manage]                     | | [Configure]                  |              |
| +------------------------------+ +------------------------------+              |
+--------------------------------------------------------------------------------+
```

### SM-PROVIDER-DUAL-METHOD

```
+--------------------------------------------------------------------------------+
| Anthropic                                                        [Connected]    |
| Claude Opus, Sonnet, and Haiku models                                           |
|                                                                                |
| Method                                                                         |
| ( ) Subscription        Uses your signed-in account                             |
| ( ) API key             Uses your metered API key                               |
|                                                                                |
| Subscription                                                                  |
| Signed in as account ending 1234                                                |
| [Sign out]                                                                      |
|                                                                                |
| API key                                                                         |
| Saved key: sk-ant-...abcd                                                       |
| [Update key] [Clear key]                                                        |
+--------------------------------------------------------------------------------+
```

### SM-PROVIDER-SUBSCRIPTION-SIGNIN

```
+--------------------------------------------------------------------------------+
| ChatGPT (Codex)                                             [Needs sign in]     |
| GPT models via your ChatGPT Plus/Pro plan                                      |
|                                                                                |
| [Sign in with ChatGPT]                                                          |
| Uses your ChatGPT Plus/Pro plan. No API credits are used here.                  |
| Prefer a metered API key? Use the OpenAI card in API key providers.             |
+--------------------------------------------------------------------------------+
```

### SM-PROVIDER-SIGNING-PKCE

```
+--------------------------------------------------------------------------------+
| Anthropic                                                     [Signing in...]    |
| Complete sign-in in your browser.                                               |
|                                                                                |
| Waiting for browser callback...                                                 |
| [Paste authorization code] [Cancel]                                             |
|                                                                                |
| If the browser cannot return to VS Code, paste the code shown after sign-in.    |
+--------------------------------------------------------------------------------+
```

### SM-PROVIDER-DEVICE-CODE

```
+--------------------------------------------------------------------------------+
| GitHub Copilot                                             [Waiting for auth]    |
| Go to GitHub and enter the code below.                                           |
|                                                                                |
| Code        ABCD-1234                                                           |
| [Copy code] [Open GitHub] [Cancel]                                              |
|                                                                                |
| This card updates automatically when GitHub completes sign-in.                  |
+--------------------------------------------------------------------------------+
```

### SM-PROVIDER-CONNECTED

```
+--------------------------------------------------------------------------------+
| ChatGPT (Codex)                                                [Connected]      |
| GPT models via your ChatGPT Plus/Pro plan                                      |
|                                                                                |
| Signed in                                                                       |
| Last refreshed recently                                                        |
| [Sign out]                                                                      |
+--------------------------------------------------------------------------------+
```

### SM-PROVIDER-SETUP-FIELDS

```
+--------------------------------------------------------------------------------+
| Cloudflare AI Gateway                                      [Needs setup]        |
| Cloudflare AI Gateway routed hosted models                                      |
|                                                                                |
| API key                                                                         |
| Saved key: cf-...abcd                                                           |
|                                                                                |
| Required setup                                                                  |
| Account ID   [ Cloudflare account ID                                      ]     |
| Gateway ID   [ AI Gateway slug                                             ]     |
|                                                                                |
| [Save setup]                                                                    |
+--------------------------------------------------------------------------------+
```

### SM-PROVIDER-EMPTY-FILTER

```
+--------------------------------------------------------------------------------+
| Models                                                                         |
| [ Find provider or model...      "codex private"                         ]     |
|                                                                                |
| No providers match this filter.                                                |
| [Clear search]                                                                 |
+--------------------------------------------------------------------------------+
```

---

## [DES-DEC] Key Decisions

| Decision                    | Options Considered                                | Choice                      | Rationale                                                                            |
| --------------------------- | ------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| Subscription grouping       | Mixed provider list, separate subscription group  | Separate subscription group | Subscription accounts are hard to find in the full API-key provider list.            |
| Method chooser              | Chooser on every OAuth provider, capability flag  | Catalog-driven `dualMethod` | Only true dual-method providers need a chooser; subscription-only cards stay simple. |
| Setup-field readiness       | API key means ready, all required setup must save | Require all setup fields    | Cloudflare needs account/gateway values before Pi can construct usable endpoints.    |
| Webview credential exposure | Raw records, redacted status                      | Redacted status only        | Keeps Settings useful without moving secrets into the webview.                       |

---

## [DES-DATA] Snapshot Data

Settings consumes redacted provider records:

- provider id/display name/model hint
- ready/needs-key/setup-incomplete state
- OAuth capability flags
- active method and connected status
- setup-field descriptors and saved/missing status

Raw API keys, OAuth access tokens, and OAuth refresh tokens never cross into the webview.

---

## [DES-API] Bridge Contracts

| Message                  | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `agent/settingsSnapshot` | Hydrates provider status/capabilities            |
| `provider/setApiKey`     | Saves API key/setup field mutations through host |
| `provider/clearApiKey`   | Clears API key record                            |
| `oauth/signIn`           | Starts subscription sign-in                      |
| `oauth/signOut`          | Clears OAuth record                              |
| `oauth/setAuthMethod`    | Sets active method for dual-method provider      |
| `oauth/progress`         | Updates sign-in/device/paste progress            |

---

## [DES-FILES] File Structure

### Files to Modify

| File                                         | Ownership in this zone                                        |
| -------------------------------------------- | ------------------------------------------------------------- |
| `apps/chat/src/views/settings.tsx`           | Built-in provider grouping, filters, and Settings layout slot |
| `apps/chat/src/components/provider-card.tsx` | Provider card states, actions, setup fields, and badges       |
| `apps/chat/src/lib/settings-copy.ts`         | User-facing labels, descriptions, and action copy             |
| `apps/chat/src/lib/settings-snapshot.ts`     | Webview-safe snapshot normalization                           |
| `packages/transport/src/mock.ts`             | Browser/Playwright provider metadata parity                   |

### Related Files Owned Elsewhere

| File/Spec                                 | Relationship                                                      |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `packages/shared/src/provider-catalog.ts` | Provider metadata owned by `141-package-provider-catalog`         |
| `apps/vscode/src/secret-store.ts`         | SecretStorage records owned by `353-agent-oauth-credential-store` |
| `apps/vscode/src/services/oauth/**/*.ts`  | Provider flows owned by `354-agent-oauth-provider-flows`          |
| `packages/agent/pi-sdk/**/*.ts`           | Runtime injection owned by `355-agent-sdk-credential-injection`   |

---

## [DES-DEPS] Dependencies

### Internal Dependencies

| Dependency                         | Purpose                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| `141-package-provider-catalog`     | Provider display, OAuth capability, and setup-field metadata |
| `352-agent-managed-oauth`          | Managed SDK vs external runtime ownership policy             |
| `353-agent-oauth-credential-store` | Redacted OAuth status and active method                      |
| `354-agent-oauth-provider-flows`   | OAuth progress states and provider flow results              |
| `214-app-chat-settings`            | Settings shell, nav, tabs, and non-provider settings         |

### External Packages

| Package        | Purpose                                      |
| -------------- | -------------------------------------------- |
| `lucide-react` | Button/card icons through existing UI system |
| `@afx/ui`      | Shared shadcn-style UI primitives            |

---

## [DES-SEC] Security Considerations

- The webview receives only redacted provider and OAuth state.
- Setup fields marked secret by the catalog must be treated like credential inputs and saved through host-owned storage.
- OAuth tokens, refresh tokens, and raw API keys must not appear in Settings copy, bridge messages, telemetry, output logs, or screenshots.
- External runtime cards must guide users to external auth setup rather than exposing AFX-owned sign-in actions.

---

## [DES-ERR] Error Handling

| Scenario                        | Handling                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| OAuth sign-in fails             | Keep card expanded, show safe error copy, preserve Sign in action        |
| Device-code expires or cancels  | Stop waiting state and return to unconnected sign-in state               |
| Required setup field is missing | Show setup-incomplete badge and block ready/provider configured state    |
| API key save fails              | Keep input editable and show actionable error copy                       |
| Snapshot lacks capability flags | Fall back to API-key-only card behavior and log a host/mock parity issue |

---

## [DES-TEST] Testing Strategy

- Provider-card tests cover subscription-only, dual-method, API-key, setup-field, connected, and waiting states.
- Settings/app tests cover grouping and snapshot hydration.
- Playwright screenshots cover subscription accounts, API-key providers, setup fields, OAuth progress, connected cards, and empty-filter state.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Phase 1: Canonical doc migration

1. Retarget provider Settings `@see` links from transient fleet docs to this zone.
2. Add parent route pointers from `214-app-chat-settings`.
3. Keep live provider sign-in acceptance open for human verification.

### Rollback Plan

If this child zone proves too narrow, route provider Settings ownership back to `214-app-chat-settings` and retarget source `@see` links accordingly. Do not remove this folder until traceability checks confirm no source annotations point here.

---

## File Reference Map

| Task | File                                         | Required @see                                                            |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------ |
| 1.1  | `apps/chat/src/views/settings.tsx`           | `docs/specs/218-app-chat-provider-settings/design.md [DES-UI]`           |
| 1.2  | `apps/chat/src/components/provider-card.tsx` | `docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]` |
| 1.3  | `apps/chat/src/lib/settings-snapshot.ts`     | `docs/specs/218-app-chat-provider-settings/design.md [DES-DATA]`         |
| 1.4  | `apps/chat/src/lib/settings-copy.ts`         | `docs/specs/218-app-chat-provider-settings/design.md [DES-UI]`           |

---

## Open Technical Questions

| #   | Question                                                                 | Status |
| --- | ------------------------------------------------------------------------ | ------ |
| 1   | Should subscription plan labels be displayed after safe metadata exists? | Open   |
