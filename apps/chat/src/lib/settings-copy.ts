/**
 * Settings copy — single source-of-truth for all labels, descriptions, and
 * tooltip text shown in the Settings view.
 *
 * Pi-runtime values (Thinking enum, retryBackoff, compaction thresholds) are
 * verified against pi-mono/packages/coding-agent/src/core/settings-manager.ts
 * and pi-mono/packages/ai/src/types.ts. Do not modify without re-verifying.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [NFR-3]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COPY]
 */

// ─── Workspace group ─────────────────────────────────────────────────────────

export const WORKSPACE = {
  groupTitle: "Workspace",
  groupDescription: "How AFX behaves in this workspace, across all runtimes.",

  modeLabel: "Mode",
  modeDescription:
    "Permission gate applied before tool calls reach any runtime. Code is full-access; Explore is read-only; Spec is for Spec-Driven Development (docs only).",

  codeName: "Code",
  codeDescription: "Full access. Runtimes can read, write, run shells, and edit.",
  codeTooltip:
    "Default. The agent has the same permissions as you. Source: afx.mode.active, saved globally unless this workspace already has an override.",

  exploreName: "Explore",
  exploreDescription:
    "Read-only. Tool calls that would modify files or run shell commands are blocked by AFX before they execute.",
  exploreTooltip:
    "AFX-host-side guardrail (not a runtime setting). AFX intercepts tool calls and rejects file-write / shell-execute before they reach any runtime. Useful for reviewing unfamiliar codebases or planning.",

  specName: "Spec",
  specDescription:
    "Spec-Driven Development. The agent refines specs, designs, tasks, journals, ADRs, and research — but never your source code. Shell-read commands stay open so it can gather context.",
  specTooltip:
    "AFX host-side guardrail for SDD. Writes are scoped to docs/specs/**, docs/research/**, docs/adr/**, .afx/**, and tasks.md. Powers the SDD loop — Shape → Design → Slice → Build → Verify → Ship → Evolve. Pair with /afx-spec, /afx-design, /afx-task, /afx-sprint, /afx-adr, /afx-research.",

  fileCtxLabel: "Active-file context",
  fileCtxDescription:
    "Include the file you're editing in the prompt context. Default: on. Mirrored in the chat composer toolbar.",
  fileCtxTooltip:
    "Workspace default. The composer toolbar lets you flip per-message without changing this default. Setting key: afx.context.includeActiveFileContext.",

  intentLabel: "Composer Intent",
  intentDescription:
    "Default thinking style for the next turn. Slots 1–3 are shared; slot 4 is Code in Code mode and PRD in Explore mode.",
  intentTooltip:
    "Intent is a lightweight prompt-control layer shown above the composer in Code and Explore modes. Default adds zero Intent tokens; non-default Intents add a static one-turn control block.",
  intentMinimizedLabel: "Minimize Intent strip",
  intentMinimizedDescription: "Collapse the Intent strip to a compact one-line chip by default.",
  intentMinimizedTooltip:
    "Only affects the Intent strip. It does not collapse doc-actions or the Spec stepper.",
} as const;

// ─── Runtimes group ──────────────────────────────────────────────────────────

export const RUNTIMES = {
  groupTitle: "Runtimes",
  groupDescription:
    "Coding-agent instances available in this workspace. You can run more than one; pick which to use per chat from the composer model picker.",

  // SDK card
  sdkCardTitle: "API Providers (bundled SDK)",
  sdkCardDescription:
    "In-process. Calls cloud APIs (Anthropic, OpenAI, …) from inside this extension using your saved keys.",
  sdkCardTooltip:
    "This runtime is the in-process Pi SDK. Always available when at least one provider key is configured.",
  sdkRestartTooltip:
    "Re-init the in-process SDK client. In-flight requests are cancelled; provider sessions reset.",
  sdkManageNote: "Manage credentials in the Models tab.",

  // RPC card
  rpcCardTitle: "Pi RPC (subprocess)",
  rpcCardDescription:
    "Out-of-process. Runs the Pi binary as a subprocess. Use to expose Pi's local CLI workflow inside chat — Pi skills, Pi sessions, Pi's own model catalog.",

  rpcEnableLabel: "Enable Pi RPC",
  rpcEnableDescription:
    "Default: off. Turn on to add Pi RPC as a second runtime alongside the SDK.",
  rpcEnableTooltip:
    "Adds the Pi binary as a second runtime alongside the SDK. When on, Pi-RPC models appear in the composer model picker under 'External Agents'. Setting: afx.rpc.enabled (default false).",

  rpcRestartTooltip:
    "Kill the Pi subprocess and start it again. In-flight tool calls cancelled. Session state preserved unless 'Ephemeral session' is on.",
  rpcReconnectTooltip:
    "Re-attach to the running Pi subprocess without killing it. Try this first if streaming drops but Pi is still alive.",
  rpcReloadTooltip: "Reload the entire chat webview. Last resort — clears in-flight UI state.",

  rpcEphemeralLabel: "Ephemeral session",
  rpcEphemeralDescription: "Don't persist conversation to disk. Default: off.",
  rpcEphemeralTooltip:
    "When on, Pi runs with --no-session and skips writing JSONL to ~/.pi/sessions/. Useful for sensitive sessions or one-off questions. Restart required to take effect.",

  // Behaviour card — applies to active instance only
  behaviourCardTitle: "Behaviour",
  behaviourCardDescription: "How the agent reasons, queues, and recovers.",
  behaviourScopePrefix: "Active:",
  behaviourScopeNote:
    "Settings here apply to the runtime that owns your currently selected model. Switch model in the composer to target a different runtime.",
  behaviourCardTooltip:
    "These settings target the runtime that owns the currently active model. Each runtime keeps its own copy internally, so values may differ across runtimes — switching model can change what's in effect.",

  // Thinking
  thinkingLabel: "Thinking level",
  thinkingSublabel: "(also in composer)",
  thinkingDescription:
    "Workspace default for extended-thinking budget. The composer model picker can override this per turn.",
  thinkingTooltip:
    "Maps to provider-side extended thinking (Anthropic extended_thinking, Google thinking content, OpenAI o-series reasoning). Higher levels = more deliberation, slower, more tokens. Default: off. Two-way sync: changing Thinking in the composer model picker also updates this value.",

  // Thinking options — verified against pi-mono/packages/ai/src/types.ts:53
  thinkingOff: {
    value: "off" as const,
    label: "off",
    description: "No extended thinking (default).",
  },
  thinkingMinimal: {
    value: "minimal" as const,
    label: "minimal",
    description: "~1k tokens. Quick reasoning.",
  },
  thinkingLow: { value: "low" as const, label: "low", description: "~2k tokens." },
  thinkingMedium: {
    value: "medium" as const,
    label: "medium",
    description: "~8k tokens. Good default for hard tasks.",
  },
  thinkingHigh: {
    value: "high" as const,
    label: "high",
    description: "~16k tokens. Deep reasoning, slower.",
  },
  thinkingXhigh: { value: "xhigh" as const, label: "xhigh", description: "Same as high (alias)." },

  // Steering — verified against pi-mono/packages/agent/src/agent.ts:55,200
  steeringLabel: "Steering mode",
  steeringSublabel: "(settings only)",
  steeringDescription: "How mid-loop steering messages are processed.",
  steeringTooltip:
    "When you send a message while the agent is mid-loop, it queues. 'one-at-a-time' lets the agent finish its current tool call, then processes one steering message before continuing. Settings-only — no composer override.",
  steeringAll: {
    value: "all" as const,
    label: "all",
    description: "Drain all queued steering messages.",
  },
  steeringOne: {
    value: "one-at-a-time" as const,
    label: "one-at-a-time",
    description: "One per yield, wait for reply. (default)",
  },

  // Follow-up — verified against pi-mono/packages/agent/src/agent.ts:162,201
  followUpLabel: "Follow-up mode",
  followUpSublabel: "(settings only)",
  followUpDescription: "How messages sent after the agent finishes are processed.",
  followUpTooltip:
    "Distinct from steering: follow-ups apply once the agent loop has completed. Settings-only — no composer override.",
  followUpAll: {
    value: "all" as const,
    label: "all",
    description: "Process all queued follow-ups in order.",
  },
  followUpOne: {
    value: "one-at-a-time" as const,
    label: "one-at-a-time",
    description: "One, wait, next. (default)",
  },

  // Auto-compaction — verified against pi-mono/packages/coding-agent/src/core/settings-manager.ts:8-12
  compactionLabel: "Auto-compaction",
  compactionSublabel: "(settings only)",
  compactionDescription: "Summarise older messages when context fills up. Default: on.",
  compactionTooltip:
    "Triggered when context exceeds reserveTokens (16384) + keepRecentTokens (20000). Pi summarises the oldest messages with the LLM and prunes them. Recent messages are kept verbatim.",

  // Auto-retry — verified against pi-mono/packages/coding-agent/src/core/settings-manager.ts:19-30
  retryLabel: "Auto-retry",
  retrySublabel: "(settings only)",
  retryDescription:
    "Retry transient provider errors automatically. Default: on. 3 retries, 2s/4s/8s exponential backoff.",
  retryTooltip:
    "Retries on transport timeouts, 5xx, and rate-limit errors. Does NOT retry validation errors or 4xx — those fail immediately.",

  // Troubleshoot disclosure
  troubleshootLabel: "Troubleshoot",
} as const;

// ─── Models group ─────────────────────────────────────────────────────────────

export const MODELS = {
  groupTitle: "Models",
  groupDescription:
    "API providers and credentials. Used by the API SDK runtime. Pi RPC has its own model catalog (see Runtimes tab).",

  builtinTabLabel: "Built-in",
  customTabLabel: "Custom Models",

  searchPlaceholder: "Find provider or model…",
  searchLabel: "Find provider or model",

  providerActiveTooltip:
    "API key configured and currently active for new chats (the composer's selected model lives in this provider).",
  providerReadyTooltip: "API key configured. Available to switch to from the composer.",
  providerNeedsKeyTooltip: "API key not set. Click to configure.",

  apiKeyLabel: "API key",
  apiKeyDescription: "Stored in VS Code SecretStore. Never logged or echoed.",
  apiKeyTooltip:
    "Paste a key from the provider's console. Stored encrypted in VS Code SecretStorage. Cleared by Remove.",

  defaultModelLabel: "Default model",
  defaultModelDescription: "Used when starting a new chat from this provider.",
  defaultModelTooltip: "Per-chat overrides are still possible from the composer model picker.",

  removeKeyLabel: "Remove",
  removeKeyTooltip:
    "Deletes the saved key. The provider returns to 'Needs key'. Confirms before deletion.",

  // Custom Models sub-tab
  customTitle: "Custom Models",
  customDescription:
    "Custom providers (DeepSeek, Ollama, OpenAI-compat, proxies, …) are configured per runtime, because each runtime resolves them differently.",
  customTrackTooltip:
    "Custom providers are runtime-specific. Pi SDK uses an AFX-managed config with secrets in VSCode SecretStorage. Pi RPC uses Pi's own ~/.pi/agent/models.json file. Pick the track that matches the runtime you use.",

  customSdkTrackLabel: "Pi SDK",
  customSdkTitle: "AFX-managed custom providers (Pi SDK)",
  customSdkDescription:
    "Stored in VSCode SecretStorage. Injected into the Pi SDK runtime in-process — your ~/.pi/agent/models.json is never modified.",
  customSdkAddLabel: "Add Provider",
  customSdkEmpty:
    "No AFX-managed custom providers yet. Click Add Provider to start with a preset (Ollama, OpenRouter, Moonshot…).",
  customSdkBadge: "AFX-managed",
  customSdkEditLabel: "Edit",
  customSdkRemoveLabel: "Remove",
  customSdkPresetTitle: "Choose a preset to start with",
  customSdkPresetSubtitle:
    "Each preset fills baseUrl, api type, and sensible compatibility defaults. You provide URL, key, and at least one model.",
  customSdkProviderIdLabel: "Provider id",
  customSdkProviderIdHint:
    "Lowercase letters, digits, hyphens, underscores. Used internally and as the env-var slug for VSCode-secret keys.",
  customSdkDisplayNameLabel: "Display name",
  customSdkBaseUrlLabel: "Base URL",
  customSdkApiKindLabel: "API type",
  customSdkApiKeyLabel: "API key",
  customSdkApiKeySourceLabel: "Source",
  customSdkApiKeySourceVscode: "VSCode Secret",
  customSdkApiKeySourceEnv: "Env var",
  customSdkApiKeySourceShell: "Shell cmd",
  customSdkApiKeySourceNone: "No key",
  customSdkVscodeSecretHint: "Stored in OS keychain · injected as {envVar} at runtime",
  customSdkEnvVarHint: "Reads from process env var with the given name at runtime.",
  customSdkShellCmdHint: "Pi runs the command per request and uses stdout as the key.",
  customSdkModelsLabel: "Models",
  customSdkAddModelLabel: "Add Model",
  customSdkSaveLabel: "Save",
  customSdkCancelLabel: "Cancel",

  customRpcTrackLabel: "Pi RPC",
  customRpcTitle: "Pi-native custom providers (Pi RPC)",
  customRpcDescription:
    "Pi reads and reloads ~/.pi/agent/models.json directly. AFX doesn't manage it — keys, baseUrls, and all schema fields go into the file as Pi documents.",
  customRpcOpenLabel: "Open models.json",
  customRpcOpenTooltip:
    "Opens ~/.pi/agent/models.json in VSCode for direct editing. Pi reads/reloads this file natively; no AFX restart needed (Pi reloads on /model). Path can be overridden via the PI_CODING_AGENT_DIR env var.",
  customRpcRpcOff:
    "Pi RPC is currently disabled. Enable it in the Runtimes tab to use Pi-native custom models.",
} as const;

// ─── Look group ───────────────────────────────────────────────────────────────

export const LOOK = {
  groupTitle: "Look",
  groupDescription: "Theme and visual treatment for the chat webview.",

  themeLabel: "Theme",
  themeDescription: "Color palette for chat surfaces.",
  themeTooltip:
    "More themes coming soon. Setting key: afx.theme. Until a second theme ships, this renders as a static label.",

  styleLabel: "Style",
  styleDescription: "Visual treatment: density, corners, shadows.",
  styleTooltip: "More styles coming soon. Setting key: afx.style.",

  settingNote:
    "VS Code chrome colors come from your editor theme. These controls only affect the chat panel surfaces.",
} as const;

// ─── Support group ────────────────────────────────────────────────────────────

export const SUPPORT = {
  groupTitle: "Support",
  groupDescription: "Skills, diagnostics, privacy, version.",

  skillsTitle: "Skills & commands",
  skillsDescription: "Slash commands available in the composer.",

  afxSkillsLabel: "AFX skills",
  afxSkillsTooltip: "Skills installed via /afx-* commands. Provided by the AFX host.",

  piSkillsLabel: "Pi skills",
  piSkillsTooltip:
    "Skills loaded by Pi from its packages array (npm/git) and local extensions/skills/prompts/themes arrays.",

  extensionCommandsLabel: "Extension commands",
  extensionCommandsTooltip: "Built-in AFX actions like /new, /abort, /help.",

  promptTemplatesLabel: "Prompt templates",
  promptTemplatesTooltip: "Reusable prompts you've saved. Manage via .afx/prompts/.",

  newSessionLabel: "/new",
  newSessionTooltip: "Start a fresh conversation.",

  abortLabel: "/abort",
  abortTooltip:
    "Cancel the current agent turn immediately. Stream stops; in-flight tool calls are not auto-cancelled.",

  diagnosticsTitle: "Diagnostics",
  diagnosticsDescription: "Tools for inspecting and reporting agent issues.",

  logLevelLabel: "Log level",
  logLevelDescription: "Verbosity of the AFX host log. Higher = more detail.",
  logLevelTooltip:
    "Set to 'debug' or 'trace' when reporting a bug. Return to 'info' for normal use.",

  outputLogLabel: "Open AgenticFlowX output",
  outputLogTooltip:
    "Open VS Code's Output panel with the AgenticFlowX channel selected. Use this when reporting runtime or extension issues.",

  privacyTitle: "Privacy",

  telemetryLabel: "Anonymous UI analytics",
  telemetryDescription: "On by default. Helps improve AFX with anonymous UI events.",
  telemetryTooltip: "Uses Microsoft Clarity. You can turn it off anytime.",
  telemetryDisabledByVscodeDescription:
    "VS Code telemetry is off, so AFX analytics is disabled here.",
  telemetryStatusLabel: "Analytics status",
  telemetryStatusHint:
    "Active only when this switch, VS Code telemetry, and Do Not Track all allow it.",
  telemetryStatusDisabledByVscodeHint: "VS Code telemetry is off, so analytics is disabled.",

  aboutTitle: "About",
  piTelemetryNote:
    "Pi telemetry: install/update ping only — no usage data. Toggle via PI_TELEMETRY env var.",
  piTelemetryTooltip:
    "Pi sends an anonymous version/update ping after major changelog releases. No session, prompt, or usage data.",
  reportIssueLabel: "Report an issue",
} as const;

// ─── Header strip ─────────────────────────────────────────────────────────────

export const HEADER = {
  title: "Settings",
  subtitle: "Configure AFX in this workspace.",

  sdkPillLabel: "API SDK",
  sdkPillOnTooltip: "API Providers (bundled SDK). Click to manage in Runtimes.",
  sdkPillOffTooltip: "API SDK not configured — no provider keys set.",

  rpcPillLabel: "Pi RPC",
  rpcPillOnTooltip: "Pi RPC subprocess. Connected. Click to manage in Runtimes.",
  rpcPillOffTooltip: "Pi RPC is off. Enable in the Runtimes tab to add it as a second runtime.",

  notConfiguredLabel: "Not configured",
  notConfiguredTooltip:
    "No runtime can run yet. Configure a provider API key or enable Pi RPC in the Runtimes tab.",

  restartActiveLabel: "Restart",
  restartActiveTooltip:
    "Restart the active runtime (the one that owns the currently selected model). For per-runtime restart, see the Runtimes tab.",

  fileCtxLabel: "File ctx",
  fileCtxOnTooltip:
    "Include the active editor file in prompt context. Workspace default; mirrored in the composer toolbar where you can flip per message.",
  fileCtxOffTooltip:
    "Active-file context is off. Toggle here or in the Workspace tab to turn it on.",

  activeLineTooltip:
    "The runtime that will receive your next message — determined by the model selected in the composer. Behaviour knobs in the Runtimes tab apply to this runtime.",
} as const;
