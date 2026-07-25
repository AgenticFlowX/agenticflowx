/**
 * API Provider settings card — full expanded form and compact tile variant.
 *
 * Renders the API-key credential form plus the AFX-owned OAuth subscription
 * surfaces (method chooser, sign-in actions, signing-in / device-code panels,
 * and the connected state). OAuth props are optional: when absent the card
 * renders today's API-key-only experience.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-12] [NFR-3]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-PROVIDER-CARD] [DES-SETTINGS-MOCKUP-MODELS] [DES-SETTINGS-ONBOARDING]
 * @see docs/specs/352-agent-managed-oauth/design.md [DES-POLICY]
 * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
 * @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
 */
import { useEffect, useRef, useState } from "react";

import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Copy,
  ExternalLink,
  Key,
  KeyRound,
  Loader2,
  TriangleAlert,
} from "lucide-react";

import type {
  AgentModel,
  ProviderAuthMethod,
  ProviderConfigField,
  ProviderConnectionState,
  ProviderOAuthFlow,
} from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@afx/ui/components/card";
import { Input } from "@afx/ui/components/input";
import { Label } from "@afx/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@afx/ui/components/native-select";
import { cn } from "@afx/ui/lib/utils";

import { MODELS } from "../lib/settings-copy";

/**
 * Coarse in-flight sign-in phase mirrored from the host `oauth/progress` event.
 * Drives the signing-in / paste-code / device-code panels. `idle` means no
 * sign-in is running (default).
 *
 * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
 * @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
 */
export type ProviderOAuthPhase =
  | "idle"
  | "starting"
  | "awaiting-browser"
  | "paste-code"
  | "device-code"
  | "exchanging"
  | "done"
  | "cancelled"
  | "error";

export interface ProviderCardProps {
  provider: string;
  displayName: string;
  modelHint: string;
  state: ProviderConnectionState;
  configuredModelCount?: number;
  defaultModel?: string;
  modelOptions?: readonly AgentModel[];
  helpUrl?: string;
  configFields?: readonly ProviderConfigField[];
  configuredConfigFields?: readonly string[];
  /** When true the card renders as a compact tile showing name + badge + model count.
   *  Clicking the tile calls onExpand to let the parent toggle expanded state. */
  compact?: boolean;
  focusKeyInput?: boolean;
  // ─── OAuth: redacted snapshot flags (from SettingsProviderSnapshot) ─────────
  /**
   * Provider supports AFX-owned OAuth subscription sign-in.
   *
   * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1]
   */
  oauthCapable?: boolean;
  /** OAuth flow kind when oauthCapable; drives the sign-in surface. */
  oauthFlow?: ProviderOAuthFlow;
  /** True only for a single id serving BOTH methods (Anthropic) -> show chooser. */
  dualMethod?: boolean;
  /** Persisted active credential method, when known. */
  activeMethod?: ProviderAuthMethod;
  /** True when an afx.oauth.{provider} record exists; connected via subscription. */
  subscriptionConnected?: boolean;
  // ─── OAuth: in-flight sign-in state (from host oauth/progress) ──────────────
  /** Coarse phase of an in-flight sign-in; absent/`idle` means no flow running. */
  oauthPhase?: ProviderOAuthPhase;
  /** Device-code user code to display (Copilot). Non-secret. */
  oauthUserCode?: string;
  /** Device-code verification URL to open. Non-secret. */
  oauthVerificationUri?: string;
  /** Short non-secret status/error message for the card. */
  oauthMessage?: string;
  onExpand?: () => void;
  onSaveKey: (key: string | undefined, config?: Record<string, string>) => Promise<void>;
  onClearKey: () => Promise<void>;
  onChangeDefault: (modelId: string) => Promise<void>;
  // ─── OAuth callbacks (wired to bridge oauth/* messages in settings.tsx) ─────
  /** Start sign-in. `enterpriseDomain` is the optional Copilot enterprise host. */
  onOAuthSignIn?: (enterpriseDomain?: string) => Promise<void> | void;
  /** Sign out of the subscription; deletes the OAuth record host-side. */
  onOAuthSignOut?: () => Promise<void> | void;
  /** Switch the active credential method on a dual-method provider. */
  onOAuthSetMethod?: (method: ProviderAuthMethod) => Promise<void> | void;
  /** Paste-code fallback: submit the user-pasted code / redirect URL. */
  onOAuthSubmitCode?: (code: string) => Promise<void> | void;
  /** Cancel the in-flight sign-in. */
  onOAuthCancel?: () => Promise<void> | void;
}

/**
 * Renders one API provider card.
 *
 * When compact=true renders a tile (name + status badge + model count) — clicking calls onExpand.
 * When compact=false renders the full credential/model form, including OAuth surfaces
 * for OAuth-capable providers.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-12] [NFR-3]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-PROVIDER-CARD] [DES-SETTINGS-ONBOARDING]
 * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
 * @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
 */
export function ProviderCard({
  provider,
  displayName,
  modelHint,
  state,
  configuredModelCount = 0,
  defaultModel,
  modelOptions = [],
  helpUrl,
  configFields = [],
  configuredConfigFields = [],
  compact = false,
  focusKeyInput = false,
  oauthCapable = false,
  oauthFlow,
  dualMethod = false,
  activeMethod,
  subscriptionConnected = false,
  oauthPhase = "idle",
  oauthUserCode,
  oauthVerificationUri,
  oauthMessage,
  onExpand,
  onSaveKey,
  onClearKey,
  onChangeDefault,
  onOAuthSignIn,
  onOAuthSignOut,
  onOAuthSetMethod,
  onOAuthSubmitCode,
  onOAuthCancel,
}: ProviderCardProps) {
  const [keyValue, setKeyValue] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const keyInputRef = useRef<HTMLInputElement | null>(null);
  const configured = state === "configured" || state === "invalid";
  const noKeyNeeded = state === "no-key-needed";
  const panelId = `provider-details-${provider}`;

  // OAuth is only wired when the provider is capable AND the host gave us a sign-in
  // callback (browser mock / non-OAuth providers omit it → render today's UX).
  const oauthWired = oauthCapable && Boolean(onOAuthSignIn);
  // Dual-method providers (Anthropic) show the chooser; subscription-only ones
  // (openai-codex, github-copilot) render a single sign-in action.
  // @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2]
  const showChooser = oauthWired && dualMethod;
  // When no method is persisted yet, default the chooser to subscription so the
  // sign-in action is the primary affordance for OAuth-capable providers.
  const selectedMethod: ProviderAuthMethod = activeMethod ?? "subscription";
  const defaultModelOptions = dedupeModelOptions(modelOptions);
  // A flow is in progress when the host has emitted a non-terminal progress phase.
  const signingIn =
    oauthPhase === "starting" ||
    oauthPhase === "awaiting-browser" ||
    oauthPhase === "paste-code" ||
    oauthPhase === "device-code" ||
    oauthPhase === "exchanging";
  const isDeviceCode = oauthFlow === "device-code";
  const configuredConfigIds = new Set(configuredConfigFields);
  const missingRequiredConfig = configFields.some(
    (field) =>
      field.required !== false &&
      !configuredConfigIds.has(field.id) &&
      !configValues[field.id]?.trim(),
  );
  // Subscription surface is active when this provider is OAuth-wired and either
  // there is no chooser (subscription-only) or the chooser sits on subscription.
  const subscriptionSelected = oauthWired && (!showChooser || selectedMethod === "subscription");
  const connectionUi = getProviderConnectionUi({
    state,
    count: configuredModelCount,
    selectedMethod,
    subscriptionSelected,
    subscriptionConnected,
    missingRequiredConfig,
  });
  const connectedViaOAuth = connectionUi.connectedViaOAuth;
  const keyRequiredForSave = !configured && !noKeyNeeded;

  useEffect(() => {
    if (!focusKeyInput || compact || noKeyNeeded) return;
    if (subscriptionSelected && !signingIn) return; // key input not shown
    keyInputRef.current?.focus();
  }, [compact, focusKeyInput, noKeyNeeded, signingIn, subscriptionSelected]);

  async function saveKey(): Promise<void> {
    const trimmed = keyValue.trim();
    if ((keyRequiredForSave && !trimmed) || missingRequiredConfig) return;
    const config = Object.fromEntries(
      configFields
        .map((field) => [field.envVar, configValues[field.id]?.trim() ?? ""] as const)
        .filter(([, value]) => value.length > 0),
    );
    setPending(true);
    try {
      if (Object.keys(config).length > 0) {
        await onSaveKey(trimmed || undefined, config);
      } else {
        await onSaveKey(trimmed || undefined);
      }
      setKeyValue("");
      setConfigValues({});
    } finally {
      setPending(false);
    }
  }

  async function clearKey(): Promise<void> {
    setPending(true);
    try {
      await onClearKey();
      setKeyValue("");
      setConfigValues({});
    } finally {
      setPending(false);
    }
  }

  // ─── Compact tile variant (used in the 2-column grid) ─────────────────────
  if (compact) {
    return (
      <button
        type="button"
        aria-label={`${displayName} — ${connectionUi.actionLabel}`}
        aria-expanded={false}
        aria-controls={panelId}
        title={connectionUi.tooltip}
        onClick={onExpand}
        className="flex min-h-[3rem] w-full flex-col gap-1 rounded-md border bg-card/40 px-2.5 py-2 text-left transition-colors hover:bg-card/70"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border bg-muted/30">
            <Key size={10} className="text-afx-brand-soft" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
            {displayName}
          </span>
          <ProviderBadge ui={connectionUi} />
          <ChevronRight size={11} className="shrink-0 text-muted-foreground" />
        </div>
        <span className="truncate pl-5.5 text-[9px] text-muted-foreground">{modelHint}</span>
        <span className="pl-5.5 font-mono text-[9px] uppercase tracking-[0.08em] text-afx-brand-soft">
          {connectionUi.actionLabel}
        </span>
      </button>
    );
  }

  // ─── Full expanded form ────────────────────────────────────────────────────
  return (
    <Card size="sm" className="bg-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-start gap-2 text-[12px]">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-muted/30">
            <Key size={12} className="text-afx-brand-soft" />
          </span>
          <span className="min-w-[6rem] flex-1">
            <span className="block truncate">{displayName}</span>
            <CardDescription className="mt-0.5">{modelHint}</CardDescription>
          </span>
          <ProviderBadge ui={connectionUi} />
          {onExpand && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="h-6 px-1.5 text-[10px]"
              aria-label={`Collapse ${displayName}`}
              aria-expanded={true}
              aria-controls={panelId}
              onClick={onExpand}
            >
              Collapse
              <ChevronDown size={12} className="rotate-180 transition-transform" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent id={panelId} className="flex flex-col gap-2">
        {/* ── OAuth subscription surfaces (OAuth-capable providers only) ────── */}
        {oauthWired ? (
          <OAuthSection
            provider={provider}
            displayName={displayName}
            dualMethod={dualMethod}
            showChooser={showChooser}
            selectedMethod={selectedMethod}
            subscriptionSelected={subscriptionSelected}
            subscriptionConnected={subscriptionConnected}
            connectedViaOAuth={connectedViaOAuth}
            signingIn={signingIn}
            isDeviceCode={isDeviceCode}
            phase={oauthPhase}
            userCode={oauthUserCode}
            verificationUri={oauthVerificationUri}
            message={oauthMessage}
            onSetMethod={onOAuthSetMethod}
            onSignIn={onOAuthSignIn}
            onSignOut={onOAuthSignOut}
            onSubmitCode={onOAuthSubmitCode}
            onCancel={onOAuthCancel}
          />
        ) : null}

        {/* ── API-key credential form ───────────────────────────────────────
            Hidden while the subscription method is active on an OAuth provider;
            the chooser's "API key" branch re-enables it. */}
        {subscriptionSelected ? null : (
          <>
            {configured ? (
              <div
                className="flex items-center justify-between gap-2 rounded-sm border bg-muted/30 px-2 py-1.5"
                data-clarity-mask="true"
              >
                <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  {state === "invalid" ? (
                    <TriangleAlert size={12} className="text-afx-warning" />
                  ) : (
                    <CircleCheck size={12} className="text-afx-success" />
                  )}
                  <span className="truncate">•••••••••• saved</span>
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px]"
                  aria-label={`Remove ${displayName} key`}
                  title={MODELS.removeKeyTooltip}
                  disabled={pending}
                  onClick={() => void clearKey()}
                >
                  {MODELS.removeKeyLabel}
                </Button>
              </div>
            ) : null}

            {noKeyNeeded ? (
              <p className="rounded-sm border bg-muted/30 px-2 py-2 text-[11px] text-muted-foreground">
                Local models are discovered from the configured base URL. No provider key is stored
                in VS Code.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1">
                  <Label
                    htmlFor={`provider-key-${provider}`}
                    className="text-[10px] text-muted-foreground"
                  >
                    {configured ? "Paste replacement key" : MODELS.apiKeyLabel}
                  </Label>
                  <span className="text-[9px] text-muted-foreground" title={MODELS.apiKeyTooltip}>
                    [?]
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  {MODELS.apiKeyDescription}
                </p>
                {configFields.length > 0 ? (
                  <div className="grid gap-1.5">
                    {configFields.map((field) => {
                      const fieldConfigured = configuredConfigIds.has(field.id);
                      return (
                        <div key={field.id} className="grid gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <Label
                              htmlFor={`provider-config-${provider}-${field.id}`}
                              className="text-[10px] text-muted-foreground"
                            >
                              {field.label}
                            </Label>
                            {fieldConfigured ? (
                              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-afx-success">
                                Saved
                              </span>
                            ) : null}
                          </div>
                          <Input
                            id={`provider-config-${provider}-${field.id}`}
                            data-clarity-mask={field.secret ? "true" : undefined}
                            type={field.secret ? "password" : "text"}
                            value={configValues[field.id] ?? ""}
                            placeholder={
                              fieldConfigured
                                ? `Replace ${field.label.toLowerCase()}`
                                : field.placeholder
                            }
                            autoComplete="off"
                            className="h-7 text-[11px]"
                            onChange={(event) => {
                              const nextValue = event.currentTarget.value;
                              setConfigValues((current) => ({
                                ...current,
                                [field.id]: nextValue,
                              }));
                            }}
                          />
                          <p className="text-[9px] leading-relaxed text-muted-foreground">
                            {field.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  <Input
                    ref={keyInputRef}
                    id={`provider-key-${provider}`}
                    data-clarity-mask="true"
                    type="password"
                    value={keyValue}
                    placeholder={configured ? "Paste replacement key" : "Paste provider key"}
                    autoComplete="off"
                    className="min-w-[6rem] flex-1"
                    onChange={(event) => setKeyValue(event.currentTarget.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    disabled={
                      pending ||
                      missingRequiredConfig ||
                      (keyRequiredForSave && keyValue.trim().length === 0)
                    }
                    onClick={() => void saveKey()}
                  >
                    {configured && !keyValue.trim()
                      ? "Save setup"
                      : configured
                        ? "Update key"
                        : "Save key"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {defaultModelOptions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Label
                htmlFor={`provider-default-${provider}`}
                className="text-[10px] text-muted-foreground"
              >
                {MODELS.defaultModelLabel}
              </Label>
              <span className="text-[9px] text-muted-foreground" title={MODELS.defaultModelTooltip}>
                [?]
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">{MODELS.defaultModelDescription}</p>
            <NativeSelect
              id={`provider-default-${provider}`}
              size="sm"
              className="w-full"
              value={defaultModel ?? defaultModelOptions[0]?.id ?? ""}
              onChange={(event) => void onChangeDefault(event.currentTarget.value)}
            >
              {defaultModelOptions.map((model) => (
                <NativeSelectOption key={model.id} value={model.id}>
                  {model.name || model.id}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        {helpUrl && !subscriptionSelected ? (
          <Button asChild size="xs" variant="link" className="self-start px-0">
            <a href={helpUrl} target="_blank" rel="noreferrer">
              Get a key
              <ExternalLink size={11} />
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface OAuthSectionProps {
  provider: string;
  displayName: string;
  dualMethod: boolean;
  showChooser: boolean;
  selectedMethod: ProviderAuthMethod;
  subscriptionSelected: boolean;
  subscriptionConnected: boolean;
  connectedViaOAuth: boolean;
  signingIn: boolean;
  isDeviceCode: boolean;
  phase: ProviderOAuthPhase;
  userCode?: string;
  verificationUri?: string;
  message?: string;
  onSetMethod?: (method: ProviderAuthMethod) => Promise<void> | void;
  onSignIn?: (enterpriseDomain?: string) => Promise<void> | void;
  onSignOut?: () => Promise<void> | void;
  onSubmitCode?: (code: string) => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
}

/**
 * OAuth subscription surfaces for one provider card: method chooser (dual-method
 * only), sign-in action, signing-in / paste-code / device-code panels, and the
 * connected state. All user-facing copy avoids OAuth/SDK/token jargon.
 *
 * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
 * @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
 */
function OAuthSection({
  provider,
  displayName,
  showChooser,
  selectedMethod,
  subscriptionSelected,
  subscriptionConnected,
  connectedViaOAuth,
  signingIn,
  isDeviceCode,
  phase,
  userCode,
  verificationUri,
  message,
  onSetMethod,
  onSignIn,
  onSignOut,
  onSubmitCode,
  onCancel,
}: OAuthSectionProps) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const [enterpriseValue, setEnterpriseValue] = useState("");
  const chooserName = `provider-auth-method-${provider}`;
  const supportsEnterpriseDomain = provider === "github-copilot";

  function copy(text: string): void {
    void navigator.clipboard?.writeText(text);
  }

  // ── Connected (subscription) ───────────────────────────────────────────────
  if (connectedViaOAuth && !signingIn) {
    return (
      <div className="flex flex-col gap-1.5 rounded-sm border bg-afx-success/10 px-2 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-foreground">
            <CircleCheck size={13} className="shrink-0 text-afx-success" />
            <span className="truncate">Signed in · Subscription</span>
          </span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="h-6 px-1.5 text-[10px]"
            aria-label={`Sign out of ${displayName}`}
            onClick={() => void onSignOut?.()}
          >
            Sign out
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Stays signed in · refreshes automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* ── Method chooser (dual-method providers only) ───────────────────── */}
      {showChooser ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[10px] text-muted-foreground">Connect with</legend>
          <div
            className="grid grid-cols-2 gap-1.5"
            role="radiogroup"
            aria-label="Connection method"
          >
            <MethodOption
              name={chooserName}
              value="subscription"
              checked={selectedMethod === "subscription"}
              title="Subscription"
              hint="Claude Pro / Max"
              disabled={signingIn}
              onSelect={() => void onSetMethod?.("subscription")}
            />
            <MethodOption
              name={chooserName}
              value="api-key"
              checked={selectedMethod === "api-key"}
              title="API key"
              hint="sk-ant-…"
              disabled={signingIn}
              onSelect={() => void onSetMethod?.("api-key")}
            />
          </div>
        </fieldset>
      ) : null}

      {/* ── Subscription branch (single action OR chooser→subscription) ────── */}
      {subscriptionSelected ? (
        signingIn ? (
          isDeviceCode ? (
            // ── Device-code panel (GitHub Copilot) ────────────────────────
            <div className="flex flex-col gap-1.5 rounded-sm border bg-muted/30 px-2 py-2">
              <p className="text-[10px] text-muted-foreground">
                To finish, open the page and enter this code:
              </p>
              <div className="flex items-center justify-between gap-2 rounded-sm border bg-card/60 px-2 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                    Code
                  </span>
                  <span
                    className="truncate font-mono text-[13px] font-semibold tracking-[0.12em] text-foreground"
                    data-clarity-mask="true"
                  >
                    {userCode ?? "————————"}
                  </span>
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px]"
                  aria-label="Copy code"
                  disabled={!userCode}
                  onClick={() => userCode && copy(userCode)}
                >
                  <Copy size={11} />
                  Copy
                </Button>
              </div>
              {verificationUri ? (
                <Button asChild size="xs" variant="outline" className="h-6 self-start text-[10px]">
                  <a href={verificationUri} target="_blank" rel="noreferrer">
                    <ExternalLink size={11} />
                    Open page
                  </a>
                </Button>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  Waiting for you to authorize…
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px]"
                  onClick={() => void onCancel?.()}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // ── PKCE signing-in panel + paste-code fallback ───────────────
            <div className="flex flex-col gap-1.5 rounded-sm border bg-muted/30 px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] text-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  Waiting for browser sign-in…
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px]"
                  onClick={() => void onCancel?.()}
                >
                  Cancel
                </Button>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                We opened your browser. Approve access, then return here — this finishes
                automatically.
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Didn’t open?</span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="h-6 text-[10px]"
                  onClick={() => setPasteOpen((open) => !open)}
                >
                  Paste code
                  <ChevronRight
                    size={11}
                    className={cn("transition-transform", pasteOpen && "rotate-90")}
                  />
                </Button>
              </div>
              {pasteOpen || phase === "paste-code" ? (
                <div className="flex flex-wrap gap-1.5">
                  <Input
                    id={`provider-paste-${provider}`}
                    data-clarity-mask="true"
                    value={pasteValue}
                    placeholder="Paste the code or redirect URL"
                    autoComplete="off"
                    className="min-w-[6rem] flex-1 text-[11px]"
                    onChange={(event) => setPasteValue(event.currentTarget.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    disabled={pasteValue.trim().length === 0}
                    onClick={() => {
                      const trimmed = pasteValue.trim();
                      if (!trimmed) return;
                      void onSubmitCode?.(trimmed);
                      setPasteValue("");
                    }}
                  >
                    Finish
                  </Button>
                </div>
              ) : null}
            </div>
          )
        ) : (
          // ── Not connected: single sign-in action ──────────────────────────
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={!onSignIn}
              onClick={() => void onSignIn?.(enterpriseValue.trim() || undefined)}
            >
              <KeyRound size={13} />
              {signInLabel(provider, displayName)}
              <ChevronRight size={13} className="ml-auto" />
            </Button>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {signInHint(provider)}
            </p>
            {/* Enterprise URL (GitHub Copilot device-code only) */}
            {supportsEnterpriseDomain ? (
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  size="xs"
                  variant="link"
                  className="self-start px-0 text-[10px]"
                  onClick={() => setEnterpriseOpen((open) => !open)}
                >
                  Use a GitHub Enterprise URL
                  <ChevronRight
                    size={11}
                    className={cn("transition-transform", enterpriseOpen && "rotate-90")}
                  />
                </Button>
                {enterpriseOpen ? (
                  <Input
                    id={`provider-enterprise-${provider}`}
                    value={enterpriseValue}
                    placeholder="github.example.com"
                    autoComplete="off"
                    className="text-[11px]"
                    onChange={(event) => setEnterpriseValue(event.currentTarget.value)}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        )
      ) : null}

      {/* ── Status / error message from host progress (non-secret) ────────── */}
      {message && (phase === "error" || phase === "cancelled") ? (
        <p className="flex items-center gap-1.5 text-[10px] text-afx-warning">
          <TriangleAlert size={11} className="shrink-0" />
          {message}
        </p>
      ) : null}

      {/* ── Subscription connected but a non-subscription method is active ──
          (e.g. dual-method on API key while still signed in) — let the user
          sign out without leaving the API-key branch. */}
      {subscriptionConnected && !connectedViaOAuth && !signingIn ? (
        <Button
          type="button"
          size="xs"
          variant="link"
          className="self-start px-0 text-[10px]"
          onClick={() => void onSignOut?.()}
        >
          Sign out of subscription
        </Button>
      ) : null}
    </div>
  );
}

/**
 * One segmented radio option in the Subscription / API key method chooser.
 *
 * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
 * @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
 */
function MethodOption({
  name,
  value,
  checked,
  title,
  hint,
  disabled,
  onSelect,
}: {
  name: string;
  value: ProviderAuthMethod;
  checked: boolean;
  title: string;
  hint: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 rounded-sm border px-2 py-1.5 transition-colors",
        checked ? "border-afx-brand-soft bg-afx-brand-soft/10" : "bg-card/40 hover:bg-card/70",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="flex items-center gap-1.5">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          className="size-3 accent-afx-brand-soft"
          onChange={onSelect}
        />
        <span className="text-[11px] font-medium text-foreground">{title}</span>
      </span>
      <span className="pl-5 font-mono text-[9px] text-muted-foreground">{hint}</span>
    </label>
  );
}

function dedupeModelOptions(models: readonly AgentModel[]): AgentModel[] {
  const byId = new Map<string, AgentModel>();
  for (const model of models) {
    if (!byId.has(model.id)) byId.set(model.id, model);
  }
  return [...byId.values()];
}

/**
 * Provider-specific sign-in button label with no OAuth jargon.
 *
 * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
 * @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
 */
function signInLabel(provider: string, displayName: string): string {
  if (provider === "anthropic") return "Sign in with Claude";
  if (provider === "openai-codex") return "Sign in with ChatGPT";
  if (provider === "github-copilot") return "Sign in with GitHub";
  return `Sign in with ${displayName}`;
}

/**
 * Provider-specific sign-in helper copy.
 *
 * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
 * @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
 */
function signInHint(provider: string): string {
  if (provider === "anthropic")
    return "Opens your browser. Uses your Claude plan — no API credits are charged.";
  if (provider === "openai-codex")
    return "Uses your ChatGPT Plus/Pro plan — no API credits. Prefer an API key? Use the OpenAI card.";
  if (provider === "github-copilot")
    return "Opens GitHub to authorize Copilot. Uses your Copilot subscription.";
  return "Opens your browser to sign in. Uses your subscription — no API credits.";
}

/**
 * Maps provider connection state to the compact status badge shown in ProviderCard.
 * An OAuth subscription connection reads as ready even without an API key.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [NFR-3]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-PROVIDER-CARD]
 * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
 * @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
 */
interface ProviderConnectionUi {
  connectedViaOAuth: boolean;
  needsSubscriptionSignIn: boolean;
  actionLabel: string;
  tooltip: string;
  badgeLabel: string;
  badgeVariant: "destructive" | "secondary" | "outline";
  badgeClassName?: string;
}

/**
 * Single source of truth for provider tile/header presentation.
 * Keeps OAuth subscription state from falling back to API-key wording.
 *
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-PROVIDER-CARD]
 * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
 * @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
 */
function getProviderConnectionUi({
  state,
  count,
  selectedMethod,
  subscriptionSelected,
  subscriptionConnected,
  missingRequiredConfig,
}: {
  state: ProviderConnectionState;
  count: number;
  selectedMethod: ProviderAuthMethod;
  subscriptionSelected: boolean;
  subscriptionConnected: boolean;
  missingRequiredConfig: boolean;
}): ProviderConnectionUi {
  const connectedViaOAuth = subscriptionConnected && selectedMethod === "subscription";
  const needsSubscriptionSignIn = subscriptionSelected && !subscriptionConnected;

  if (connectedViaOAuth) {
    return {
      connectedViaOAuth,
      needsSubscriptionSignIn,
      actionLabel: MODELS.providerManageLabel,
      tooltip: MODELS.providerSubscriptionReadyTooltip,
      badgeLabel: "Subscription",
      badgeVariant: "secondary",
      badgeClassName: "bg-afx-success/15 text-afx-success",
    };
  }

  if (needsSubscriptionSignIn) {
    return {
      connectedViaOAuth,
      needsSubscriptionSignIn,
      actionLabel: MODELS.providerSignInLabel,
      tooltip: MODELS.providerNeedsSignInTooltip,
      badgeLabel: "Sign in",
      badgeVariant: "outline",
      badgeClassName: "text-afx-brand-soft",
    };
  }

  if (state === "configured") {
    return {
      connectedViaOAuth,
      needsSubscriptionSignIn,
      actionLabel: MODELS.providerManageLabel,
      tooltip: MODELS.providerReadyTooltip,
      badgeLabel: `${count} models`,
      badgeVariant: "secondary",
      badgeClassName: "bg-afx-success/15",
    };
  }

  if (missingRequiredConfig) {
    return {
      connectedViaOAuth,
      needsSubscriptionSignIn,
      actionLabel: MODELS.providerSetupLabel,
      tooltip: MODELS.providerNeedsSetupTooltip,
      badgeLabel: "Needs setup",
      badgeVariant: "outline",
      badgeClassName: "text-afx-warning",
    };
  }

  if (state === "invalid") {
    return {
      connectedViaOAuth,
      needsSubscriptionSignIn,
      actionLabel: MODELS.providerPasteKeyLabel,
      tooltip: MODELS.providerNeedsKeyTooltip,
      badgeLabel: "Invalid",
      badgeVariant: "destructive",
    };
  }

  if (state === "no-key-needed") {
    return {
      connectedViaOAuth,
      needsSubscriptionSignIn,
      actionLabel: MODELS.providerManageLabel,
      tooltip: MODELS.providerActiveTooltip,
      badgeLabel: `${count} local`,
      badgeVariant: "secondary",
      badgeClassName: "bg-afx-success/15 text-afx-success",
    };
  }

  return {
    connectedViaOAuth,
    needsSubscriptionSignIn,
    actionLabel: MODELS.providerPasteKeyLabel,
    tooltip: MODELS.providerNeedsKeyTooltip,
    badgeLabel: "Needs key",
    badgeVariant: "outline",
  };
}

function ProviderBadge({ ui }: { ui: ProviderConnectionUi }) {
  return (
    <Badge variant={ui.badgeVariant} className={cn("shrink-0 text-[9px]", ui.badgeClassName)}>
      {ui.badgeLabel}
    </Badge>
  );
}
