<!-- markdownlint-disable MD060 -->

# Plan: AFX Hybrid Engine — API Providers + External Agents

> Surgical implementation plan for API-provider runtimes, external-agent routing, and bundled Pi integration.

## Repository Roots

| Role                                      | Scope            | Notes                                                                                                                         |
| ----------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **AFX repository**                        | this repo        | All `apps/`, `packages/`, `docs/` paths in this plan are relative to the repository root unless stated otherwise              |
| **Pi packages and public source surface** | external project | We import published npm builds (`@mariozechner/pi-agent-core ^0.70.2`, `@mariozechner/pi-ai ^0.70.2`) and mirror RPC behavior |

---

## 0. Decision Recap (one paragraph)

AFX gains a second adapter alongside `@afx/agent-pi`. Both adapters expose the same `AgentManager` contract from `@afx/shared`. The user picks any model in the composer; the chat routes to the owning runtime instance via a thin multiplexer. Internally, the new adapter spawns an **AFX-bundled Node bootstrap** (`packages/agent/pi-sdk/dist/bootstrap.js`) that imports `@mariozechner/pi-agent-core` + `@mariozechner/pi-ai` and exposes the **verbatim Pi `--mode rpc` protocol** on stdin/stdout. This gives us per-runtime process isolation (RPC-grade performance), zero user-side install, API keys via VSCode `SecretStorage` → env-var, and **true continuity** across runtimes by sharing a Pi session directory and switching both runtimes to the same session file on model switches (see §5.2.1). User-facing labels are **API Providers** (default) and **External Agents** — never "SDK", "RPC", "subprocess", "engine", or "adapter".

---

## 1. UI Stack — non-negotiable rules

| Rule                          | What it means                                                                                              | Reference                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Shadcn primitives only**    | Import from `@afx/ui/components/{name}` — no new component invention                                       | Inventory in §1.1          |
| **Lucide icons only**         | Import from `lucide-react`. Prefer icons already used in `apps/chat/`.                                     | Inventory in §1.2          |
| **Meridian tokens only**      | Use semantic CSS variables from `packages/ui/src/styles/meridian.tokens.css` — no hex literals             | Inventory in §1.3          |
| **No string forbidden in UI** | "SDK", "RPC", "Direct", "subprocess", "adapter", "engine" — code/comments fine; rendered strings forbidden | Verified by §10 copy audit |

### 1.4 Model identity + routing (non-negotiable)

To prevent ambiguous routing (the same `<provider>:<modelId>` may exist in multiple runtimes), model identity is a 3‑tuple:

`ModelRef = { instanceId: string; provider: string; modelId: string }`

Rules:

- Host returns models tagged with `instanceId` + `source` (and optional `instanceLabel` for UI grouping).
- Webview selects a model by sending `chat/setModel` with `instanceId` (back-compat: optional, but becomes required once multiple instances exist).
- Host routing uses `AgentManager.setModel({ provider, modelId, instanceId? })` (optional field is backwards compatible for adapters).
- Multiplexer forwards chat timeline events only from the **active** instance (no event interleaving).

### 1.1 Shadcn primitives we will use (all already in `packages/ui/src/components/`)

| Component                                                               | File                                           | Used for                                              |
| ----------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `Tabs` (+ `TabsList`, `TabsTrigger`, `TabsContent`)                     | `packages/ui/src/components/tabs.tsx`          | Settings split: API Providers ⇄ External Agents       |
| `Card` (+ `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`)  | `packages/ui/src/components/card.tsx`          | Provider cards, agent cards                           |
| `Accordion` (+ `AccordionItem`, `AccordionTrigger`, `AccordionContent`) | `packages/ui/src/components/accordion.tsx`     | Collapsible "External Agents" section in model picker |
| `Combobox` (existing pattern)                                           | `packages/ui/src/components/combobox.tsx`      | Model picker (extend existing)                        |
| `Button`                                                                | `packages/ui/src/components/button.tsx`        | All actions                                           |
| `Badge`                                                                 | `packages/ui/src/components/badge.tsx`         | Status pills (Configured / Invalid / Coming soon)     |
| `Input`                                                                 | `packages/ui/src/components/input.tsx`         | API key paste field (type="password")                 |
| `Label`                                                                 | `packages/ui/src/components/label.tsx`         | Form labels                                           |
| `Switch`                                                                | `packages/ui/src/components/switch.tsx`        | Ephemeral toggle, etc.                                |
| `NativeSelect`, `NativeSelectOption`                                    | `packages/ui/src/components/native-select.tsx` | Default-model dropdown per provider                   |

**No new primitives required.** If something can't be built from these, that's a sign to back up.

### 1.2 Lucide icons we will use (already in the chat bundle)

Already imported in `apps/chat/src/views/settings.tsx` lines 9-25 — reuse these:

`Activity, Brain, Brush, CircleCheck, Cpu, ExternalLink, FileText, Folder, Info, Key, LoaderCircle, PlugZap, Settings2, SwatchBook`

Already in `apps/chat/src/components/model-combobox.tsx` line 4: `Sparkles`

**New lucide imports we add (also stable, all stock lucide icons)**:

| Icon            | Use                                      | Why                                                                                                                                        |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Plus`          | "Add Key" trigger on empty provider card | Standard create affordance                                                                                                                 |
| `X`             | Clear-key button                         | Standard remove affordance                                                                                                                 |
| `TriangleAlert` | "Invalid key" badge                      | Standard warning glyph (confirm: lucide canonical name; falls back to `AlertTriangle` if needed)                                           |
| `Server`        | External Agents tab + section header     | Visually distinct from provider clouds                                                                                                     |
| `KeyRound`      | API Providers tab                        | Re-uses key motif but distinct from `Key` (which is reserved for the field icon) — if `KeyRound` not available, fallback to existing `Key` |

If any chosen icon is not in the installed `lucide-react` version, fall back to one of the already-imported icons above. Never invent.

### 1.3 Meridian semantic tokens (from `packages/ui/src/styles/meridian.tokens.css`)

| Semantic var                                             | Use case in this work                                     |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `--signal-success`, `--signal-success-soft`              | "✓ Configured" badges, connected dots                     |
| `--signal-warning`, `--signal-warning-soft`              | "⚠ Invalid key", "Add API key" call-out                   |
| `--signal-brand`, `--signal-brand-soft`                  | Currently-selected model emphasis                         |
| `--text-disabled`, `--text-subtle`                       | Disabled model rows in picker, "Coming soon" placeholders |
| `--dot-done`, `--dot-warn`, `--dot-active`, `--dot-idle` | Status dots on agent cards                                |

Use via `style={{ color: 'var(--signal-success)' }}` or, preferably, by composing `cn()` with utility classes that already reference these vars in `meridian.tokens.css`.

---

## 2. Frontend File Map (absolute paths, line ranges)

### 2.1 Files to MODIFY

| Absolute path                                 | Lines to touch                                                                                                                                                    | What changes                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/chat/src/views/chat.tsx`                | **716-823** (composer); **770-776** (model pill)                                                                                                                  | Update model pill label format to `{provider · model}` (default) or `{cli · model}` (external). Pull source tag from new `AgentModel.source` field.                                                                                                                          |
| `apps/chat/src/components/model-combobox.tsx` | **whole file** (small) — group computation **97-105**; trigger **54-55**                                                                                          | Add second-tier grouping: top section = API providers grouped by provider, bottom section = collapsible "External Agents" subgrouped by CLI. Use `Accordion` for the external section header. Add `KeyRound` provider header glyph + `Server` external-agents header glyph.  |
| `apps/chat/src/views/settings.tsx`            | Insert new `<Card>` block before the existing **Providers** card (currently lines 423-449); split that block into a `Tabs` container with two `TabsContent` panes | Replace today's read-only "Providers" card with a new **Provider Settings** card containing a `Tabs` primitive: "API Providers" (default) and "External Agents". Existing read-only provider/model count list moves into the External Agents tab as part of the Pi CLI card. |
| `apps/chat/src/lib/bridge.ts`                 | **29-35** (`ChatToAgent` send) and **38-47** (`AgentToChat` receive)                                                                                              | No structural change. Document that messages are now multiplexed by the host (bridge stays oblivious — host-side multiplexer routes by selected model).                                                                                                                      |
| `packages/transport/src/mock.ts`              | **end of file** (after the existing 25-scenario block)                                                                                                            | Add 5 new named scenarios — see §8.2                                                                                                                                                                                                                                         |
| `packages/shared/src/agent.ts`                | After `AgentModel` def at **lines 16-29**                                                                                                                         | Add optional `source?: AgentSource` field; export `AgentSource = "api-provider" \| "external-agent"` constant union. **Backwards compatible** — existing Pi adapter sets `source: "external-agent"`.                                                                         |
| `packages/shared/src/messages.ts`             | `ChatToAgent` union — `chat/setModel`                                                                                                                             | Extend `chat/setModel` to include `instanceId?: string` so routing is unambiguous once multiple runtime instances exist. Keep `provider`+`modelId` for backwards compatibility and logging.                                                                                  |

### 2.2 Files to CREATE (frontend)

| Absolute path                                           | Purpose                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/chat/src/components/provider-card.tsx`            | Reusable `<ProviderCard>` for the API Providers tab — encapsulates the configured/empty/invalid card states. Uses `Card`, `Badge`, `Button`, `Input`, `Label`, `NativeSelect`, lucide `Key`/`CircleCheck`/`TriangleAlert`/`X`/`Plus`/`ExternalLink`. |
| `apps/chat/src/components/external-agent-card.tsx`      | Reusable `<ExternalAgentCard>` for the External Agents tab — Pi CLI today, OpenCode/Crush placeholder. Uses `Card`, `Badge`, `Button`, `Input`, `Switch`, lucide `Server`/`PlugZap`/`CircleCheck`/`Folder`/`ExternalLink`.                           |
| `apps/chat/src/components/provider-card.test.tsx`       | Vitest + @testing-library/react: empty-state, configured-state, invalid-state, save flow                                                                                                                                                             |
| `apps/chat/src/components/external-agent-card.test.tsx` | Same pattern for the CLI card                                                                                                                                                                                                                        |
| `apps/chat/src/views/settings.providers.test.tsx`       | Tab integration: switch tabs, key save round-trip via `MockTransport`, cross-tab CTA links                                                                                                                                                           |

### 2.3 Existing primitives — exact import statements to reuse

```ts
// From @afx/ui (no new primitives needed)
// From lucide-react (verify each on first use; fall back to already-imported set on miss)
import {
  CircleCheck,
  ExternalLink,
  Folder,
  Key,
  KeyRound,
  LoaderCircle,
  PlugZap,
  Plus,
  Server,
  Settings2,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@afx/ui/components/accordion";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@afx/ui/components/card";
import { Input } from "@afx/ui/components/input";
import { Label } from "@afx/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@afx/ui/components/native-select";
import { Switch } from "@afx/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@afx/ui/components/tabs";
import { cn } from "@afx/ui/lib/utils";
```

---

## 3. Backend File Map (absolute paths, line ranges)

### 3.1 Files to MODIFY

| Absolute path                                | Lines / location                                                                                                                     | What changes                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/vscode/src/extension.ts`               | **86-115** (config read), **108** (factory call)                                                                                     | Read API-key state from `context.secrets`; resolve `AFX_SESSION_DIR` (from `afx.sessionDir` or extension storage); thread `SecretStore` + session dir into the factory call. Register `afx.setProviderApiKey`, `afx.clearProviderApiKey`. Subscribe to config + `secrets.onDidChange` to recreate the multiplexer.                                                                          |
| `apps/vscode/src/agent-factory.ts`           | **15-20** (`AgentInstance`), **22-29** (`AgentFactoryOptions`), **31-40** (factory body)                                             | Returns up to **2** `AgentInstance`s: Pi CLI (External Agents) + bundled runtime (API Providers). Both share `AFX_SESSION_DIR` (computed from `afx.sessionDir` or extension storage) and honor ephemeral/no-session setting. Add `secretStore` to `AgentFactoryOptions`. New helper `getConfiguredProviders(secretStore, KNOWN_PROVIDERS)`.                                                 |
| `apps/vscode/src/panels/sidebar-panel.ts`    | **62-78** (`SidebarState`), **130** (post fan-out), **641-750+** (dispatch)                                                          | Hold a `MultiplexedAgentManager` (new — see §5.2) instead of a single `AgentManager`. On runtime switches, keep continuity by calling `switchSession(sessionFile)` on the newly-active runtime (see §5.2.1). If ephemeral/no-session, fall back to a best-effort handoff preamble on next send.                                                                                             |
| `apps/vscode/package.json`                   | **`contributes.configuration.properties`** (currently afx.agentBinaryPath, afx.agentEphemeralSession, …); **`contributes.commands`** | Add `afx.sdk.enabled`, `afx.sdk.defaultModel`, `afx.sdk.ollamaBaseUrl`, `afx.sessionDir`, `afx.debugPerf`. Register `afx.setProviderApiKey`, `afx.clearProviderApiKey`. Ensure `afx.sessionDir` defaults to extension-managed storage for true continuity across runtimes.                                                                                                                  |
| `apps/vscode/esbuild.mjs`                    | **34** (`external`)                                                                                                                  | Add `"@mariozechner/pi-tui"` (defensive — pulled in transitively if anything reaches into `pi-coding-agent`). The bootstrap is built **separately** with a second esbuild entry; see §6.3.                                                                                                                                                                                                  |
| `packages/shared/src/agent.ts`               | **lines 16-29** (`AgentModel`); **AgentStatus** shape; **lines 339-371** (`AgentManager`)                                            | Extend `AgentModel` with `source?: AgentSource`, `instanceId?: string`, `instanceLabel?: string`. Add `AgentStatus.sessionFile?: string`. Export `AgentSource = "api-provider" \| "external-agent"`. Extend `AgentManager.setModel()` target to include `instanceId?: string`. Add optional `switchSession?: (sessionPath: string) => Promise<{ cancelled: boolean }>` for true continuity. |
| `packages/shared/src/messages.ts`            | `ChatToAgent` union — `chat/setModel`                                                                                                | Add `instanceId?: string` to `chat/setModel` so the host can route unambiguously when multiple instances expose the same `<provider>:<modelId>`.                                                                                                                                                                                                                                            |
| `eslint.config.mjs`                          | **lines 390-407** (`packages/agent/**` rules)                                                                                        | New package `packages/agent/pi-sdk/` inherits the same `no-vscode`, `no-react` rules — no rule changes needed unless the path glob is narrower than `packages/agent/**`. Verify glob and widen if necessary.                                                                                                                                                                                |
| `knip.config.ts` (or `knip.json`)            | wherever package list is registered                                                                                                  | Add `packages/agent/pi-sdk/` to workspaces — knip will otherwise flag the new package.                                                                                                                                                                                                                                                                                                      |
| `vitest.workspace.ts`                        | end of project list                                                                                                                  | Add `packages/agent/pi-sdk/vitest.config.ts`.                                                                                                                                                                                                                                                                                                                                               |
| `turbo.json`                                 | pipeline tasks if filtered                                                                                                           | Verify `build`, `test`, `check:types` cover `packages/agent/pi-sdk`.                                                                                                                                                                                                                                                                                                                        |
| `docs/adr/ADR-0001-pi-engine-integration.md` | frontmatter + top of doc                                                                                                             | Update `status: Accepted (partially superseded by ADR-0008)` — the "do not bundle Pi" clause is what's superseded for SDK mode only.                                                                                                                                                                                                                                                        |

### 3.2 Files to CREATE (backend)

| Absolute path                                       | Purpose                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/vscode/src/secret-store.ts`                   | Thin VSCode SecretStorage wrapper: `getApiKey(provider)`, `setApiKey(provider, value)`, `clearApiKey(provider)`, `onDidChange(listener)`. Single CRUD surface used by extension.ts and agent-factory.ts. Provider enumeration uses a fixed `KNOWN_PROVIDERS` list (no index). |
| `apps/vscode/src/secret-store.test.ts`              | Vitest with VSCode `secrets` API mocked                                                                                                                                                                                                                                       |
| `apps/vscode/src/multiplex-agent-manager.ts`        | `MultiplexedAgentManager implements AgentManager` — see §5.2                                                                                                                                                                                                                  |
| `apps/vscode/src/multiplex-agent-manager.test.ts`   | Vitest — model-routing, listener gating to active instance (no interleaving), disposal cascade, error isolation                                                                                                                                                               |
| `packages/agent/pi-sdk/package.json`                | New package `@afx/agent-pi-sdk`. Dependencies: `@afx/shared`, `@mariozechner/pi-agent-core ^0.70.2`, `@mariozechner/pi-ai ^0.70.2`. Mirrors `packages/agent/pi/package.json` shape.                                                                                           |
| `packages/agent/pi-sdk/tsconfig.json`               | Extends `tsconfig.base.json` — same as `packages/agent/pi/tsconfig.json`                                                                                                                                                                                                      |
| `packages/agent/pi-sdk/vitest.config.ts`            | Mirrors `packages/agent/pi/vitest.config.ts`                                                                                                                                                                                                                                  |
| `packages/agent/pi-sdk/src/index.ts`                | Re-exports adapter + factory                                                                                                                                                                                                                                                  |
| `packages/agent/pi-sdk/src/sdk-rpc-manager.ts`      | The adapter — implements `AgentManager`. **Reuses `createPiClient`** from `@afx/agent-pi/src/rpc-client.ts` (pointing at our bundled bootstrap binary instead of `pi`). Most of `rpc-manager.ts`'s normalization logic is reused — see §5.3.                                  |
| `packages/agent/pi-sdk/src/options.ts`              | `PiSdkManagerOptions` shape: `logger, bootstrapPath, provider, modelId, getApiKey, cwd?, additionalSkillPaths?, ollamaBaseUrl?`                                                                                                                                               |
| `packages/agent/pi-sdk/src/sdk-rpc-manager.test.ts` | Vitest — happy path, env wiring, normalization parity with Pi adapter                                                                                                                                                                                                         |
| `packages/agent/pi-sdk/bootstrap/bootstrap.ts`      | The Node script we ship — see §6                                                                                                                                                                                                                                              |
| `packages/agent/pi-sdk/bootstrap/jsonl.ts`          | Pi-compatible JSONL framing helpers                                                                                                                                                                                                                                           |
| `packages/agent/pi-sdk/bootstrap/rpc-types.ts`      | Pi-compatible RPC command and response types                                                                                                                                                                                                                                  |
| `packages/agent/pi-sdk/bootstrap/dispatch.ts`       | RPC command dispatch — switch over `RpcCommand`, calls `Agent` methods. See §6.2                                                                                                                                                                                              |
| `packages/agent/pi-sdk/bootstrap/auth.ts`           | `getApiKey(provider)` reading `AFX_API_KEY_<PROVIDER>` (and back-compat single-provider envs) — see §6.4                                                                                                                                                                      |
| `packages/agent/pi-sdk/bootstrap/dispatch.test.ts`  | Vitest — fixture-driven command/event round-trips                                                                                                                                                                                                                             |
| `packages/agent/pi-sdk/build.bootstrap.mjs`         | Second esbuild entry that produces `dist/bootstrap.js` (the runnable Node script we ship in the VSIX)                                                                                                                                                                         |
| `packages/agent/pi-sdk/test/perf.ts`                | Performance harness — see §8.3                                                                                                                                                                                                                                                |
| `packages/agent/pi-sdk/test/parity.test.ts`         | Mirror-test: the same fixture against `pi --mode rpc` (if available) and the bootstrap; event streams should be equivalent modulo timestamps/ids. Skipped if `pi` not installed.                                                                                              |
| `docs/adr/ADR-0008-pi-sdk-bundled-runtime.md`       | Records the hybrid decision. Note: ADR-0005, 0006, 0007 already exist (interactive UI, auto-approve safety, theme families) — we use **ADR-0008**, not ADR-0005.                                                                                                              |
| `docs/specs/305-infra-pi-sdk/spec.md`               | Functional + non-functional requirements                                                                                                                                                                                                                                      |
| `docs/specs/305-infra-pi-sdk/design.md`             | Architecture, file structure, API contracts. **Cross-link to §10 of this plan and to the Pi protocol surface**.                                                                                                                                                               |
| `docs/specs/305-infra-pi-sdk/tasks.md`              | Implementation tasks; matches phases in §11 of this plan                                                                                                                                                                                                                      |

---

## 4. Component-by-Component Plan (frontend, surgical)

### 4.1 Composer Model Pill

**File**: `apps/chat/src/views/chat.tsx` lines **770-776** (model selector area).

**Existing**: renders `<ModelCombobox>` with current selected model name.

**Change**: pass `currentModel.source` into the combobox trigger; trigger renders:

- `source === "api-provider"` → `{providerLabel} · {modelName}` (e.g., `Anthropic · claude-opus-4-5`)
- `source === "external-agent"` → `{cliName} · {modelName}` (e.g., `Pi CLI · claude-opus-4-5`)

Provider/CLI label resolution uses the same lookup the model picker uses (see §4.2). Icon prefix: existing `Sparkles` from `lucide-react` (already imported at `model-combobox.tsx:4`).

### 4.2 Model Combobox — two-tier grouping with `Accordion` for External Agents

**File**: `apps/chat/src/components/model-combobox.tsx`.

**Existing**: groups by `provider` only (lines 97-105).

**New shape**:

```tsx
<ComboboxContent>
  {/* Top tier: API Providers, grouped by provider */}
  {apiProviderGroups.map((g) => (
    <ComboboxGroup key={g.provider} label={g.provider}>
      {g.models.map(renderModelItem)}
    </ComboboxGroup>
  ))}

  {externalAgentInstances.length > 0 && (
    <Accordion type="single" collapsible defaultValue="external">
      <AccordionItem value="external">
        <AccordionTrigger>
          <Server className="h-3 w-3 mr-2" /> External Agents ({externalAgentInstances.length})
        </AccordionTrigger>
        <AccordionContent>
          {externalAgentInstances.map((inst) => (
            <ComboboxGroup key={inst.id} label={`${inst.label} · ${inst.versionLabel}`}>
              {inst.models.map(renderModelItem)}
            </ComboboxGroup>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )}

  <ComboboxSeparator />
  <Button variant="ghost" onClick={onOpenSettings}>
    <Settings2 className="h-3 w-3 mr-2" /> Manage providers and agents…
  </Button>
</ComboboxContent>
```

**Data**: the host returns `getAvailableModels()` enriched with `source` + `instanceId` (and `instanceLabel` for UI grouping). Grouping is computed client-side from those tags. **Selection dispatch must include `instanceId`** (via `chat/setModel`) to avoid ambiguity when multiple instances expose the same `<provider>:<modelId>`.

**Disabled rows**: when an API provider has no key, its models render with `aria-disabled` and `--text-disabled` token; clicking links to Settings → API Providers → that provider card.

### 4.3 Settings — Tabs primitive intro

**File**: `apps/chat/src/views/settings.tsx`.

**Existing**: button-based section nav at lines **270-284**; a read-only "Providers" `Card` at **423-449**.

**Change**: replace the existing Providers card with a new card that hosts a `Tabs` primitive:

```tsx
<Card id="providers">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <KeyRound className="h-4 w-4" /> Providers
    </CardTitle>
    <CardDescription>
      Connect models in two ways. Both work side-by-side; pick a model in the composer to switch.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Tabs defaultValue="api">
      <TabsList>
        <TabsTrigger value="api">
          <KeyRound className="h-3 w-3 mr-2" /> API Providers
        </TabsTrigger>
        <TabsTrigger value="external">
          <Server className="h-3 w-3 mr-2" /> External Agents
        </TabsTrigger>
      </TabsList>

      <TabsContent value="api">{/* List of <ProviderCard> — see §2.2 */}</TabsContent>

      <TabsContent value="external">
        {/* <ExternalAgentCard kind="pi-cli" /> + Coming-soon card */}
      </TabsContent>
    </Tabs>
  </CardContent>
</Card>
```

**Default tab**: `defaultValue="api"`. New users land here.

**Cross-tab CTA**: bottom of each `TabsContent`, a `Button variant="link"` linking to the other tab.

### 4.4 ProviderCard

**File**: `apps/chat/src/components/provider-card.tsx` (new).

Props (concrete):

```ts
interface ProviderCardProps {
  provider: string; // "anthropic" | "openai" | …
  displayName: string; // "Anthropic"
  modelHint: string; // "Claude Opus 4.5, Sonnet 4.6, …"
  state: "empty" | "configured" | "invalid" | "no-key-needed";
  configuredModelCount?: number;
  defaultModel?: string;
  modelOptions?: AgentModel[];
  getKeyHelpUrl?: string; // "https://console.anthropic.com/…"
  onSaveKey: (key: string) => Promise<void>;
  onClearKey: () => Promise<void>;
  onChangeDefault: (modelId: string) => Promise<void>;
}
```

States:

- **empty**: shows hint + `Input` (type=password) + "Save" Button + "Get a key →" `Button variant="link"` with `ExternalLink` icon
- **configured**: shows `••••••••• ✓ Configured` + `Update`/`X` buttons + `NativeSelect` for default model + model count `Badge`
- **invalid**: same as configured but `TriangleAlert` icon and `--signal-warning` color
- **no-key-needed**: special for Ollama / LM Studio — shows base URL `Input` + auto-discovered models count

Badge variants from `@afx/ui/components/badge` — confirm available variants in the file (`default, secondary, destructive, outline, ghost, link`). `secondary` for "Configured", `destructive` for "Invalid", `outline` for "No key needed".

### 4.5 ExternalAgentCard

**File**: `apps/chat/src/components/external-agent-card.tsx` (new).

Initial implementation handles **Pi CLI** only. `kind: "pi-cli" | "coming-soon"`.

For `pi-cli`:

- Status row: `PlugZap` icon + dot via `--dot-active` / `--dot-idle` + version label (from `agent/status` event)
- Binary path `Input` + "Auto-detect" `Button` (calls `afx.detectPiBinary` command)
- Auth note + "Open Pi auth docs" `Button variant="link"` + `ExternalLink`
- `Switch` for ephemeral session (global: affects both API Providers + External Agents; when enabled, true continuity via session files is unavailable and we fall back to the handoff preamble on switches)
- Model count `Badge`

For `coming-soon`:

- Disabled card with `--text-disabled` color
- Lists "OpenCode CLI · Crush · Aider" as future entries

---

## 5. Backend Implementation

### 5.1 SecretStore wrapper — `apps/vscode/src/secret-store.ts`

```ts
import * as vscode from "vscode";

export class SecretStore {
  constructor(private ctx: vscode.ExtensionContext) {}

  private k(provider: string) {
    return `afx.apiKey.${provider}`;
  }

  async getApiKey(provider: string) {
    return this.ctx.secrets.get(this.k(provider));
  }
  async setApiKey(provider: string, value: string) {
    await this.ctx.secrets.store(this.k(provider), value);
  }
  async clearApiKey(provider: string) {
    await this.ctx.secrets.delete(this.k(provider));
  }
  onDidChange(listener: (e: vscode.SecretStorageChangeEvent) => void) {
    return this.ctx.secrets.onDidChange(listener);
  }
}
```

`secrets` has no list/iterate API. Avoid a drift-prone index by defining supported provider ids in one place (e.g. `KNOWN_PROVIDERS = ["anthropic","openai",…]`) and checking presence via `await secretStore.getApiKey(provider)` when building instances.

### 5.2 MultiplexedAgentManager — `apps/vscode/src/multiplex-agent-manager.ts`

Implements `AgentManager` from `@afx/shared`. Holds `AgentInstance[]`. Routes by **currently-selected model**.

```ts
import type { AgentEvent /* … */, AgentManager, AgentModel } from "@afx/shared";

export class MultiplexedAgentManager implements AgentManager {
  private active: AgentInstance;
  constructor(
    private instances: AgentInstance[],
    initial?: { instanceId: string },
  ) {
    if (instances.length === 0) throw new Error("no agent instances configured");
    this.active = instances.find((i) => i.id === initial?.instanceId) ?? instances[0];
  }

  // — methods that route to the active instance —
  send(msg: string) {
    return this.active.manager.send(msg);
  }
  abort() {
    return this.active.manager.abort();
  }
  newSession() {
    return this.active.manager.newSession();
  }
  getStatus() {
    return this.active.manager.getStatus();
  }
  getUsage() {
    return this.active.manager.getUsage();
  }
  getCommands() {
    return this.active.manager.getCommands();
  }
  getStderr() {
    return this.active.manager.getStderr();
  }
  compact(i?: string) {
    return this.active.manager.compact(i);
  }
  steer(m: string) {
    return this.active.manager.steer(m);
  }
  followUp(m: string) {
    return this.active.manager.followUp(m);
  }
  setThinkingLevel(l) {
    return this.active.manager.setThinkingLevel(l);
  }
  setSteeringMode(m) {
    return this.active.manager.setSteeringMode(m);
  }
  setFollowUpMode(m) {
    return this.active.manager.setFollowUpMode(m);
  }
  setAutoCompaction(e) {
    return this.active.manager.setAutoCompaction(e);
  }
  setAutoRetry(e) {
    return this.active.manager.setAutoRetry(e);
  }
  respondToUiRequest(r) {
    return this.active.manager.respondToUiRequest(r);
  }

  // — model selection switches the active instance —
  async setModel(target: { provider: string; modelId: string; instanceId?: string }) {
    const next = target.instanceId
      ? this.instances.find((i) => i.id === target.instanceId)
      : this.findInstanceForModel(target);
    if (!next) throw new Error(`no instance for model ${target.provider}:${target.modelId}`);
    this.active = next;
    return next.manager.setModel(target);
  }

  // — aggregate models from all instances, tag with source —
  async getAvailableModels(): Promise<AgentModel[]> {
    const all = await Promise.all(
      this.instances.map(async (inst) => {
        const m = await inst.manager.getAvailableModels();
        return m.map((model) => ({
          ...model,
          source: inst.runtime === "pi" ? "external-agent" : "api-provider",
          instanceId: inst.id,
        }));
      }),
    );
    return all.flat();
  }

  // — fan-in subscriptions, but forward only from the active instance —
  // Avoids timeline interleaving without requiring the sidebar to resubscribe on model switches.
  onEvent(listener: (e: AgentEvent) => void) {
    const subs = this.instances.map((inst) =>
      inst.manager.onEvent((e) => {
        if (inst === this.active) listener(e);
      }),
    );
    return { dispose: () => subs.forEach((s) => s.dispose()) };
  }
  onStderr(listener: (chunk: string) => void) {
    const subs = this.instances.map((inst) =>
      inst.manager.onStderr((chunk) => {
        if (inst === this.active) listener(chunk);
      }),
    );
    return { dispose: () => subs.forEach((s) => s.dispose()) };
  }

  async stop() {
    await Promise.all(this.instances.map((i) => i.manager.stop()));
  }
  async dispose() {
    await Promise.all(this.instances.map((i) => i.manager.dispose()));
  }

  private findInstanceForModel(t: {
    provider: string;
    modelId: string;
  }): AgentInstance | undefined {
    return this.instances.find((i) =>
      i.cachedModels?.some((m) => m.provider === t.provider && m.id === t.modelId),
    );
  }
}
```

This wrapper is the **only** place the host needs to know about routing. `sidebar-panel.ts` keeps a single `AgentManager` reference. Non-active runtimes must not emit chat timeline events into the shared UI stream; they may still be polled for model availability/status snapshots.

#### 5.2.1 Single chat window + true continuity on model switch (v1)

The webview shows a **single chat timeline**. Model switching changes which runtime receives subsequent turns; it must not create a second visible chat UI.

Continuity requirement (true continuity, v1):

- AFX defines a **shared Pi session directory** `AFX_SESSION_DIR` owned by the extension (default: under `context.globalStorageUri`), used by both runtimes.
- Both runtimes are started/configured to persist sessions into `AFX_SESSION_DIR` (unless the user enables the ephemeral/no-session toggle).
- When switching between models owned by different `instanceId`s, the host keeps the chat continuous by switching the newly-active runtime to the current session file:
  - Read `sessionFile` from the old runtime (`get_state` / status snapshot).
  - Call `AgentManager.switchSession?.(sessionFile)` on the new runtime (host-level API), which maps to Pi RPC `switch_session`.

Fallback (ephemeral sessions / no session file):

- If the active session is ephemeral (no `sessionFile`), switching runtimes cannot transfer full state. In that case we use a compact **handoff preamble** on the first `chat/send` after the switch (token-capped, tool noise stripped).

Notes:

- Directory policy: `AFX_SESSION_DIR` must be stable across reloads so sessions survive restarts and are available when the user later installs Pi CLI.
- Security: session files may contain tool outputs; store under extension-managed storage by default (not a global `~/.pi/...` directory) unless the user explicitly configures otherwise.
- Default policy: persisted sessions are the default. The ephemeral/no-session toggle is an explicit opt-out because it disables true runtime-to-runtime continuity.

Fact check (Pi protocol capabilities that enable this):

- Pi RPC supports session switching via `switch_session` and state lookup via `get_state`.
- Pi CLI supports `--session-dir <dir>` for session storage and lookup.

#### 5.2.2 OS portability + Windows RPC launch hardening

The implementation must stay OS-agnostic across Windows, macOS, and Linux:

- Use `vscode.Uri.joinPath(...).fsPath`, `node:path`, and child-process APIs instead of hardcoded `/` path composition in runtime code.
- Do not assume shell-specific syntax, POSIX signals beyond best-effort termination, or Unix home-directory layout.
- Pi RPC process launch must support npm-installed Windows command shims (`pi.cmd` / PATH-resolved `pi`) by using a Windows shell only when needed; macOS/Linux keep direct spawn.
- Runtime health polling must not repeatedly spawn a failing Pi RPC process on every status tick. After a launch failure, apply a short retry cooldown/backoff and clear it only on explicit restart/stop or after the cooldown expires.
- This hardening applies to both External Agents (Pi CLI) and API Providers (bundled bootstrap), because both use the same JSONL process boundary.

### 5.3 New adapter — `packages/agent/pi-sdk/src/sdk-rpc-manager.ts`

**Reuses** `createPiClient` from `@afx/agent-pi/src/rpc-client.ts` (file: `packages/agent/pi/src/rpc-client.ts`, lines 75-86 for `PiClient` interface). The only differences from the existing Pi RPC manager:

| Aspect          | Pi adapter (`packages/agent/pi/`)                                                               | New SDK adapter (`packages/agent/pi-sdk/`)                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Binary spawned  | `pi` (or `binaryPath`)                                                                          | Bundled `bootstrap.js` shipped inside the VSIX                                                                                                                                      |
| Spawn args      | `["--mode","rpc","--session-dir", AFX_SESSION_DIR, ...(ephemeral ? ["--no-session"] : []) , …]` | `["--rpc"]` (bootstrap reads `AFX_SESSION_DIR`; ephemeral disables session persistence)                                                                                             |
| Env passed      | `process.env` only                                                                              | `process.env` + `AFX_API_KEY_<PROVIDER>` (per configured provider), `AFX_OLLAMA_BASE_URL`, `AFX_SESSION_DIR`, `AFX_LOG_LEVEL` (+ back-compat `AFX_PROVIDER`/`AFX_PROVIDER_API_KEY`) |
| Auth            | Pi reads `~/.pi/auth.json`                                                                      | Bootstrap reads env vars only                                                                                                                                                       |
| Skill rewriting | `/afx-` → `/skill:afx-` (rpc-manager.ts:629-631)                                                | **Same**, copy or import the helper                                                                                                                                                 |

**Implementation strategy**: extract the shared event-normalization + skill-rewrite + lazy-startup logic from `packages/agent/pi/src/rpc-manager.ts` (lines 138-273 normalization, 629-631 rewrite, 73-126 startup) into a small **shared internal module** under `packages/agent/pi/src/internal/` (re-exported from `packages/agent/pi`'s package.json `exports` field) that both adapters consume. This avoids duplication while respecting ADR-0004's "transport-explicit naming, per-adapter independence" rule — the **transport** is independent (different binaries, different env), the **normalization** is shared because the wire format is identical (we mirror Pi verbatim).

If the cross-package import is unwanted, the alternative is straight copy + version-pin doc; flag for spec review.

### 5.4 `agent-factory.ts` — concrete diff

`apps/vscode/src/agent-factory.ts`

**Before** (lines 31-40):

```ts
export function createConfiguredAgentInstances(opts: AgentFactoryOptions): AgentInstance[] {
  return [
    {
      id: "pi",
      label: "Pi",
      runtime: "pi",
      manager: createPiAgentManager(opts),
    },
  ];
}
```

**After**:

```ts
export async function createConfiguredAgentInstances(
  opts: AgentFactoryOptions,
): Promise<AgentInstance[]> {
  const instances: AgentInstance[] = [];
  const sessionDir = resolveAfxSessionDir(opts); // uses `afx.sessionDir` or extension-managed storage default

  // External Agents path — Pi CLI (existing)
  if (await rpcAvailable(opts)) {
    instances.push({
      id: "pi",
      label: "Pi CLI",
      runtime: "pi",
      manager: createPiAgentManager({
        ...opts,
        sessionDir, // maps to Pi CLI --session-dir
      }),
    });
  }

  // API Providers path — bundled bootstrap (new)
  const sdkEnabled = vscode.workspace.getConfiguration().get<boolean>("afx.sdk.enabled", true);
  const configuredProviders = await getConfiguredProviders(opts.secretStore, KNOWN_PROVIDERS);
  const ollamaConfigured = !!vscode.workspace
    .getConfiguration()
    .get<string>("afx.sdk.ollamaBaseUrl");
  if (sdkEnabled && (configuredProviders.length > 0 || ollamaConfigured)) {
    const [provider, modelId] = parseDefaultModel(
      vscode.workspace
        .getConfiguration()
        .get<string>("afx.sdk.defaultModel", "anthropic:claude-opus-4-5"),
    );
    instances.push({
      id: "pi-sdk",
      label: "API Providers",
      runtime: "pi-sdk",
      manager: createPiSdkAgentManager({
        logger: opts.logger.child("pi-sdk"),
        bootstrapPath: opts.bootstrapPath,
        provider,
        modelId,
        getApiKey: (p) => opts.secretStore.getApiKey(p),
        cwd: opts.cwd,
        additionalSkillPaths: opts.additionalSkillPaths,
        ollamaBaseUrl: vscode.workspace.getConfiguration().get<string>("afx.sdk.ollamaBaseUrl"),
        sessionDir, // exported as AFX_SESSION_DIR
      }),
    });
  }

  if (instances.length === 0) {
    throw new Error("no agent configured: install Pi CLI or add a provider API key");
  }
  return instances;
}
```

`AgentRuntime` type (in `packages/shared/src/agent.ts`) extends to `"pi" | "pi-sdk"`.

Helper (host-side): `resolveAfxSessionDir(opts)` returns `vscode.workspace.getConfiguration().get("afx.sessionDir")` when set, otherwise a directory under extension-managed storage (recommended default). This path is:

- Passed to Pi CLI via `--session-dir`
- Exported to the bootstrap as `AFX_SESSION_DIR`

### 5.5 Settings schema — exact JSON for `apps/vscode/package.json`

To insert under `contributes.configuration.properties`:

```jsonc
"afx.sdk.enabled": {
  "type": "boolean",
  "default": true,
  "description": "Use AFX-bundled runtime when an API key is configured."
},
"afx.sdk.defaultModel": {
  "type": "string",
  "default": "anthropic:claude-opus-4-5",
  "description": "Default model for the bundled runtime. Format: <provider>:<modelId>."
},
"afx.sdk.ollamaBaseUrl": {
  "type": "string",
  "default": "",
  "description": "Base URL for a local Ollama server (e.g., http://localhost:11434). Leave empty to disable."
},
"afx.sessionDir": {
  "type": "string",
  "default": "",
  "description": "Directory for session storage and lookup. Leave empty to use extension-managed storage (recommended)."
},
"afx.debugPerf": {
  "type": "boolean",
  "default": false,
  "description": "Show streaming performance KPIs in the chat status bar."
}
```

`contributes.commands` additions:

```jsonc
{ "command": "afx.setProviderApiKey",   "title": "AgenticFlowX: Set Provider API Key" },
{ "command": "afx.clearProviderApiKey", "title": "AgenticFlowX: Clear Provider API Key" },
{ "command": "afx.detectPiBinary",      "title": "AgenticFlowX: Auto-detect Pi CLI Binary" }
```

---

## 6. Bundled Runtime Bootstrap

### 6.1 Source mapping — Pi → AFX

| Pi capability area             | What it provides                                              | Decision                                                                                                                                                  | AFX destination                                |
| ------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| RPC mode                       | RPC entry, command dispatch pattern                           | Keep Pi session semantics (`get_state`, `switch_session`, `fork`, `clone`, `export_html`) by adopting the same session runtime concepts in the bootstrap. | `packages/agent/pi-sdk/bootstrap/dispatch.ts`  |
| JSONL framing                  | `serializeJsonLine`, `attachJsonlLineReader`                  | Provide Pi-compatible framing helpers.                                                                                                                    | `packages/agent/pi-sdk/bootstrap/jsonl.ts`     |
| RPC command and response types | `RpcCommand`, `RpcResponse`, `RpcExtensionUIRequest/Response` | Provide the command/response types required by the bundled bridge.                                                                                        | `packages/agent/pi-sdk/bootstrap/rpc-types.ts` |
| Client implementation          | JSONL RPC client behavior                                     | Keep AFX client ownership in `packages/agent/pi/src/rpc-client.ts`.                                                                                       | n/a                                            |
| Agent runtime                  | Agent class and model loop                                    | Import from published npm packages.                                                                                                                       | npm `@mariozechner/pi-agent-core`              |
| AI model lookup                | `getModel(provider, modelId)`                                 | Import from published npm packages.                                                                                                                       | npm `@mariozechner/pi-ai`                      |
| Streaming                      | Stream function passed to `Agent`                             | Import from published npm packages.                                                                                                                       | npm `@mariozechner/pi-ai`                      |
| Provider env names             | Env var → API key                                             | Import env-name lookup from npm; AFX supplies keys from VS Code SecretStorage-derived env vars.                                                           | npm `@mariozechner/pi-ai`                      |
| Built-in coding tools          | Read/write/edit/search/shell tools                            | Import factories from npm (`createReadTool`, `createBashTool`, etc.).                                                                                     | npm `@mariozechner/pi-coding-agent`            |
| High-level session class       | Session orchestration coupled to default Pi storage           | Keep bootstrap state thinner and avoid reading user-global auth files by default.                                                                         | n/a                                            |
| Session manager                | Session JSONL storage + switching + fork/clone                | Use published package APIs where available so bundled runtime preserves Pi session continuity.                                                            | npm `@mariozechner/pi-coding-agent` (import)   |
| Skill loader                   | Skill directory loading                                       | Import `loadSkillsFromDir`; call with the AFX skill paths the host injects via `--skill` flag.                                                            | npm `@mariozechner/pi-coding-agent`            |
| Auth storage                   | User-global auth reader                                       | Bootstrap uses env-based keys (`AFX_API_KEY_<PROVIDER>`) and does not read user-global auth files by default.                                             | `packages/agent/pi-sdk/bootstrap/auth.ts`      |
| Agent session runtime          | Runtime that can `switchSession()` / `fork()` / `export`      | Use published package APIs where available so bundled runtime keeps full session operations enabled.                                                      | npm `@mariozechner/pi-coding-agent` (import)   |

Estimated bootstrap LOC: **TBD after integration**.

### 6.2 Bootstrap command coverage

| RPC command                                                                | v1 status                               |
| -------------------------------------------------------------------------- | --------------------------------------- |
| `prompt`, `steer`, `follow_up`, `abort`, `new_session`                     | ✅                                      |
| `get_state`, `get_messages`, `get_last_assistant_text`                     | ✅                                      |
| `set_model`, `cycle_model`, `get_available_models`                         | ✅ (constrained to providers with keys) |
| `set_thinking_level`, `cycle_thinking_level`                               | ✅                                      |
| `set_steering_mode`, `set_follow_up_mode`                                  | ✅                                      |
| `bash`, `abort_bash`                                                       | ✅ (use `createBashTool` factory)       |
| `compact`, `set_auto_compaction`                                           | ✅                                      |
| `set_auto_retry`, `abort_retry`                                            | ✅                                      |
| `get_session_stats`, `export_html`                                         | ✅                                      |
| `switch_session`, `fork`, `clone`, `get_fork_messages`, `set_session_name` | ✅                                      |
| `get_commands`                                                             | ✅                                      |
| `extension_ui_request` / `extension_ui_response`                           | ✅ — full sub-protocol mirrored         |

### 6.3 Build & shipping

`packages/agent/pi-sdk/build.bootstrap.mjs`:

```js
import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["bootstrap/bootstrap.ts"],
  outfile: "dist/bootstrap.js",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["@mariozechner/pi-tui"],
  minify: true,
  sourcemap: true,
});
```

The VSIX packaging step copies `packages/agent/pi-sdk/dist/bootstrap.js` to `apps/vscode/resources/pi-sdk/bootstrap.js`. Resolution from the extension at runtime:

```ts
const bootstrapPath = path.join(context.extensionPath, "resources/pi-sdk/bootstrap.js");
```

`apps/vscode/scripts/prepare-webviews.mjs` is the precedent for resource-copying — extend it to include the bootstrap (or add a sibling `prepare-pi-sdk.mjs`).

### 6.4 Bootstrap auth — `bootstrap/auth.ts`

```ts
export function getApiKey(provider: string): string | undefined {
  // Preferred: multi-provider env mapping (one process supports many providers)
  const envKey = `AFX_API_KEY_${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const mapped = process.env[envKey];
  if (mapped) return mapped;

  // Back-compat: single-provider mode
  if (provider === process.env.AFX_PROVIDER) return process.env.AFX_PROVIDER_API_KEY;

  return undefined;
}
```

The host sets `AFX_API_KEY_<PROVIDER>` env vars for each configured provider (e.g. `AFX_API_KEY_ANTHROPIC`, `AFX_API_KEY_OPENAI`).

For Ollama: bootstrap reads `AFX_OLLAMA_BASE_URL` and passes it to `getModel`'s baseUrl override (verify exact pi-ai signature on first integration).

---

## 7. Performance Parity (refresh with absolute file:line refs)

**Risks**:

1. Agent listener loop may await handlers serially.
2. Per-delta message normalization may copy full message payloads.
3. Agent-session sync listener iteration may be hot during streaming.
4. Streaming JSON parsing may run per tool-call delta.
5. LLM conversion may run every turn uncached.

**Mitigations live inside the bootstrap** (the SDK's in-process layer). The adapter side only does JSONL ↔ `AgentEvent` normalization and stays fast naturally.

| Mitigation                                        | File in `packages/agent/pi-sdk/bootstrap/`                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| M1: setImmediate-batched event fan-out            | `dispatch.ts` (event subscription block)                                                           |
| M2: strip `partial:` from delta wire payload      | `dispatch.ts` (event normalization before write)                                                   |
| M3: listener watchdog (50ms warn / 250ms timeout) | n/a inside bootstrap (single stdout writer); revisit if host-side adapter grows multiple listeners |
| M4: per-toolCallId `parseStreamingJson` cache     | `dispatch.ts` (toolcall_delta handler)                                                             |
| M5: memoize `convertToLlm`                        | `dispatch.ts` (Agent options)                                                                      |
| M6: lazy provider-SDK loading                     | `dispatch.ts` (dynamic import on first stream) — verify pi-ai sub-export viability                 |

**KPIs and gates** — see §8.3.

---

## 8. Testing Strategy (NEW)

### 8.1 Unit tests

**Backend** — vitest, colocated, naming `*.test.ts`:

| File                                                | What it covers                                                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/vscode/src/secret-store.test.ts`              | get/set/clear round-trip; mock VSCode `secrets` API                                                                                                                                         |
| `apps/vscode/src/multiplex-agent-manager.test.ts`   | model-routing (correct instance receives `send`), event gating to active instance (no interleaving), disposal cascade, error isolation                                                      |
| `packages/agent/pi-sdk/src/sdk-rpc-manager.test.ts` | env wiring (API keys + session dir), event normalization parity with `packages/agent/pi/src/rpc-manager-send.test.ts`, skill rewriting, lazy startup, `switch_session` wiring               |
| `packages/agent/pi-sdk/bootstrap/dispatch.test.ts`  | RPC command coverage including `get_state.sessionFile` + `switch_session` round-trip; events emit correct StreamDelta shapes; abort cancels mid-stream; bash tool returns expected envelope |

Use the `rpc-manager-send.test.ts` pattern (mock `createPiClient` with `vi.fn()` spies) — canonical pattern in this repo.

**Frontend** — vitest + `@testing-library/react`, colocated `*.test.tsx`:

| File                                                    | What it covers                                                                                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/chat/src/components/provider-card.test.tsx`       | empty-state save submits & disables; configured-state Update/Clear actions; invalid-state shows `TriangleAlert`; "Get a key" link has `target=_blank rel=noopener`     |
| `apps/chat/src/components/external-agent-card.test.tsx` | Pi CLI status pill renders; binary-path Input + Auto-detect dispatches command; ephemeral toggle; "coming soon" card disabled                                          |
| `apps/chat/src/components/model-combobox.test.tsx`      | Two-tier grouping; External Agents accordion collapses; disabled rows for providers without keys; switching model dispatches `chat/setModel` with correct `instanceId` |
| `apps/chat/src/views/settings.providers.test.tsx`       | Tab default = "api"; switching tabs persists scroll; cross-tab CTA links work                                                                                          |

### 8.2 Mock transport scenarios

`packages/transport/src/mock.ts` — append at end of the existing 25-scenario block.

| New scenario name              | What it injects                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `providersEmpty`               | `agent/settingsSnapshot` with empty `providers` and SDK enabled — drives empty-state UI                                  |
| `providersAnthropicConfigured` | `agent/settingsSnapshot` with Anthropic configured + 4 models                                                            |
| `providersMultiConfigured`     | Anthropic + OpenAI + Ollama all green                                                                                    |
| `externalAgentOnly`            | No SDK keys, Pi CLI connected; Settings panel defaults to API Providers tab and shows the empty-state with cross-tab CTA |
| `bothConfigured`               | Pi CLI + Anthropic keys; model picker shows both sections                                                                |

### 8.3 Performance harness — `packages/agent/pi-sdk/test/perf.ts`

Goal: side-by-side comparison of bundled bootstrap vs `pi --mode rpc` (when installed) against a fixed prompt + tool sequence.

Approach:

- Spin both adapters with the same fixture
- Stream a deterministic mock provider (use a `MockApi` returning canned SSE; or cassette-recorded responses — start with mock for CI determinism)
- Capture FTL (first-token latency), sustained tokens/sec, host event-loop lag (`setImmediate` round-trip during stream), peak heap
- Print Markdown table; emit JSON to `perf-results/<timestamp>.json`

| KPI                                               | Target                                   | Gate                           |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------ |
| First-token latency (FTL)                         | ≤ baseline × 1.2                         | Block ship if > baseline × 1.5 |
| Sustained tokens/sec                              | ≥ baseline × 0.9                         | Block ship if < baseline × 0.7 |
| Extension host event-loop lag p99 (during stream) | < 10ms                                   | Block ship if > 25ms           |
| Per-event processing time                         | < 2ms message_update, < 10ms message_end | Warn                           |
| Heap growth per 1k-token response                 | < 50MB                                   | Investigate if > 100MB         |

CI gate: `pnpm verify:full` runs the harness in mock mode; thresholds fail the run.

### 8.4 Parity test — `packages/agent/pi-sdk/test/parity.test.ts`

Skipped if `pi` not on `PATH`. When present:

- Run the same prompt fixture against both
- Diff the JSONL event stream
- Whitelist of fields allowed to differ: `id` (per-process counters), timestamps, sessionId
- Anything else differing → test fails (we drifted from Pi)

### 8.5 E2E (deferred but registered)

Existing e2e harness lives at `apps/vscode-e2e/`. Add scenario stubs:

- `e2e/sdk-key-roundtrip.test.ts` — set key via command, model picker enables, send a message
- `e2e/mode-isolation.test.ts` — break the SDK key, RPC still works

These run under `pnpm test:e2e` and gate `verify:full`.

---

## 9. Implementation Phases (ordered, each phase verifiable)

### Phase 0 — Specs & ADRs

- Create `docs/adr/ADR-0008-pi-sdk-bundled-runtime.md`
- Update ADR-0001 frontmatter `status` to "Accepted (partially superseded by ADR-0008)"
- Run `/afx-scaffold spec 305-infra-pi-sdk` and write spec.md/design.md/tasks.md

### Phase 1 — Shared types

- Add `AgentSource` and extend `AgentModel` in `packages/shared/src/agent.ts` (`source`, `instanceId`, `instanceLabel`)
- Extend `AgentManager.setModel()` target in `packages/shared/src/agent.ts` to include `instanceId?: string`
- Add `AgentStatus.sessionFile?: string` in `packages/shared/src/agent.ts`
- Add optional `AgentManager.switchSession?(sessionPath)` in `packages/shared/src/agent.ts`
- Extend `chat/setModel` in `packages/shared/src/messages.ts` to include `instanceId?: string`
- Extend `AgentRuntime` to `"pi" | "pi-sdk"`
- Tests verifying type assignability

### Phase 2 — Backend infra

- `apps/vscode/src/secret-store.ts` + tests
- `apps/vscode/src/multiplex-agent-manager.ts` + tests
- Resolve `AFX_SESSION_DIR` (from `afx.sessionDir` or extension storage) and pass into both runtimes (`--session-dir` for Pi CLI; `AFX_SESSION_DIR` env for bootstrap)
- On cross-runtime model switch, call `switchSession(sessionFile)` to keep true continuity (fallback to handoff preamble only when ephemeral/no-session)
- Make Pi RPC launch OS-agnostic, including Windows command shims, and add launch-failure cooldown/backoff so polling does not repeatedly spawn a broken runtime.
- New commands `afx.setProviderApiKey`, `afx.clearProviderApiKey`, `afx.detectPiBinary` registered in extension.ts

### Phase 3 — New adapter package

- Scaffold `packages/agent/pi-sdk/` (package.json, tsconfig, vitest.config)
- Register in `pnpm-workspace.yaml`, `vitest.workspace.ts`, `knip.config.ts`
- Implement `sdk-rpc-manager.ts` reusing internals from `packages/agent/pi/`
- Adapter unit tests pass

### Phase 4 — Bundled bootstrap

- Copy verbatim: `bootstrap/jsonl.ts`, `bootstrap/rpc-types.ts`
- Implement `bootstrap/bootstrap.ts`, `bootstrap/dispatch.ts`, `bootstrap/auth.ts`
- `build.bootstrap.mjs` produces `dist/bootstrap.js`
- Dispatch tests pass; manual smoke: `node dist/bootstrap.js --rpc < fixtures/prompt.jsonl`

### Phase 5 — Extension wiring

- Update `apps/vscode/src/agent-factory.ts` to return both instances
- Wire `MultiplexedAgentManager` in sidebar-panel
- Update `package.json` settings + commands
- `apps/vscode/scripts/prepare-pi-sdk.mjs` bundles `bootstrap.js` into `resources/pi-sdk/`
- Esbuild externals (defensive)

### Phase 6 — Frontend UI

- Extend `model-combobox.tsx` (two-tier grouping)
- Update composer pill in `chat.tsx`
- Build `provider-card.tsx`, `external-agent-card.tsx` + tests
- Replace Settings "Providers" card with Tabs (defaultValue="api")
- Mock-transport scenarios added; DevOverlay buttons appear

### Phase 7 — Performance hardening

- Implement M1, M2, M4, M5 (M6 if dynamic import works) inside `bootstrap/dispatch.ts`
- Build `test/perf.ts`; capture RPC baseline against the same fixture; commit baseline JSON
- Wire `afx.debugPerf` overlay (chat status bar) to live KPIs

### Phase 8 — Verification

- `pnpm verify` then `pnpm verify:full`
- Run perf harness; check gates
- Copy audit (scan source UI copy for forbidden strings)
- Manual smoke: see verification list §10

---

## 10. Verification Gates

1. **External-agent only**: `pi` on PATH + no API keys → `getAvailableModels()` returns Pi CLI models only; settings tab=API Providers shows empty + CTA to External Agents
2. **API-provider only** (default new-user path): no `pi` binary, only Anthropic key → only bootstrap instance; Settings shows configured Anthropic card
3. **Both configured**: model picker shows both groups; switching routes correctly
4. **Mid-session swap**: send on an API Provider model, switch to a Pi CLI model, send — responses route correctly and the second runtime continues the same session by switching to the same `sessionFile` (per §5.2.1). If ephemeral/no-session is enabled, fall back to the handoff preamble.
   4.1 **Install Pi later**: start with API Providers only, build up a session, then install Pi CLI and let AFX detect it → switching to External Agents keeps continuity by switching the Pi runtime to the same `sessionFile` (per §5.2.1)
5. **Key storage**: key survives reload; not in `settings.json`; `[X]` clears cleanly; provider enumeration uses fixed `KNOWN_PROVIDERS` list (no drift-prone index)
6. **Invalid key**: bad key → first stream error → provider card flips to `Invalid` + `TriangleAlert`; chat shows remediation banner
7. **Ollama**: set base URL, no key needed → models auto-discovered by bootstrap; chat works
8. **Bundle build**: `pnpm verify:full` passes size-limit; `apps/vscode/out/extension.js` builds; `packages/agent/pi-sdk/dist/bootstrap.js` builds
9. **Live re-evaluation**: removing the last API key removes the API Providers instance from the multiplexer on next config-change event; adding `pi` to PATH adds the External Agents section without VSCode restart and shares the same `AFX_SESSION_DIR`
10. **Copy audit**: scan source UI copy (not bundle output) for forbidden UI strings (`SDK`, `RPC`, `Direct`, `subprocess`, `adapter`, `engine`) — fail build if found
11. **Perf gate**: harness shows FTL ≤ baseline×1.5, sustained tokens/sec ≥ baseline×0.7, host event-loop lag p99 < 25ms during stream
12. **Subjective parity**: run a 1k-token + tool-call response on both adapters back-to-back; typing in another file stays responsive; chat scrolls smoothly
13. **Parity test (when pi installed)**: `parity.test.ts` shows event-stream equivalence modulo whitelisted fields
14. **OS portability**: Windows npm command shims launch Pi RPC successfully; a failed launch is retried with cooldown/backoff rather than on every runtime-health poll; macOS/Linux direct spawn remains unchanged.

---

## 11. TODO carry-forward (deferred)

- [ ] Promote §6.1 mapping into a standalone `docs/research/v2/res-pi-rpc-protocol-mirror.md` once the spec lands
- [ ] Cross-link from `docs/specs/305-infra-pi-sdk/design.md` (DES-API)
- [ ] Generate TypeScript discriminated unions from the Pi RPC inventory — single source of truth for both adapters
- [ ] Diff inventory against `pi-mono` on each `@mariozechner/pi-coding-agent` version bump; track delta
- [ ] AFX namespace extensions (`afx.openSpec`, `afx.checkLinks`) — design as Pi extensions or host-side UI sub-protocol methods? Separate ADR
- [ ] Confirm tool-callback pattern works against `pi-agent-core` directly (without `pi-coding-agent`) — smoke test in Phase 3
- [ ] Verify bootstrap session persistence matches Pi CLI semantics (`--continue`, resume, fork/clone), and confirm HTML export output location policy under extension-managed storage
- [ ] Multi-provider policy: confirm provider-id normalization for `AFX_API_KEY_<PROVIDER>` mapping (today: intended to support multiple providers in one bootstrap via env mapping; verify against pi-ai provider ids)
- [ ] OpenCode SDK adapter (`packages/agent/opencode-sdk/`) once Pi-SDK is stable

---

## 12. Out-of-scope (explicit non-goals for this plan)

- Replacing or rewriting `packages/agent/pi/` — it stays as the External Agents path
- Introducing a workspace-layer `@afx/agent-rpc-core` shared package — ADR-0004 deferred this; keep deferred until ≥30% shared code is observed
- Multiple independent chat timelines in the UI — sidebar remains a single chat window; model switches keep one timeline (continuity via §5.2.1)
- MCP support — separately scoped
- Full Pi extension API surface — bootstrap stubs `extension_*` events that aren't in v1
