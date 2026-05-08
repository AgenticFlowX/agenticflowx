/**
 * API-key source input — masked input + Source dropdown for `vscode-secret`,
 * `env-var`, `shell-cmd`, or no key. The literal-on-disk mode is intentionally
 * absent (escape via Open models.json on the Pi RPC track).
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9] [FR-10] [NFR-1]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-MOCKUP-CUSTOM-PROVIDER-FORM]
 */
import { useState } from "react";

import { Eye, EyeOff } from "lucide-react";

import type { CustomProviderApiKeySource } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Input } from "@afx/ui/components/input";
import { Label } from "@afx/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@afx/ui/components/native-select";

import { MODELS } from "../lib/settings-copy";

export interface ApiKeySourceValue {
  source: CustomProviderApiKeySource;
  /** For `env-var` / `shell-cmd`: literal label. For `vscode-secret`: derived env-var name (informational). For `none`: empty. */
  label?: string;
  /**
   * Plaintext secret captured by the user when source === "vscode-secret".
   * Component clears this on submit; never persists in component state once dispatched.
   */
  apiKeyValue?: string;
}

export interface ApiKeySourceInputProps {
  providerId: string;
  value: ApiKeySourceValue;
  onChange: (next: ApiKeySourceValue) => void;
  /** Suggested env-var name for the vscode-secret indirection display. */
  suggestedEnvVar: string;
}

/**
 * Source selector + masked secret input. Hides the secret value and provides a
 * clear-after-submit affordance via the parent's reset of `value.apiKeyValue`.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-10] [NFR-1]
 */
export function ApiKeySourceInput({
  providerId,
  value,
  onChange,
  suggestedEnvVar,
}: ApiKeySourceInputProps) {
  const [reveal, setReveal] = useState(false);
  // Derived: when the parent clears the captured secret (after submit), force the masked view.
  const effectiveReveal = reveal && Boolean(value.apiKeyValue);

  const sourceOptions: Array<{ value: CustomProviderApiKeySource; label: string }> = [
    { value: "vscode-secret", label: MODELS.customSdkApiKeySourceVscode },
    { value: "env-var", label: MODELS.customSdkApiKeySourceEnv },
    { value: "shell-cmd", label: MODELS.customSdkApiKeySourceShell },
    { value: "none", label: MODELS.customSdkApiKeySourceNone },
  ];

  function setSource(next: CustomProviderApiKeySource): void {
    if (next === "vscode-secret") {
      onChange({ source: next, label: suggestedEnvVar, apiKeyValue: "" });
    } else if (next === "none") {
      onChange({ source: next });
    } else {
      onChange({ source: next, label: value.label ?? "" });
    }
  }

  const labelControlId = `custom-${providerId}-key-source`;
  const inputControlId = `custom-${providerId}-key-input`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Label htmlFor={labelControlId} className="text-[10px] font-medium">
          {MODELS.customSdkApiKeySourceLabel}
        </Label>
        <NativeSelect
          id={labelControlId}
          value={value.source}
          onChange={(e) => setSource(e.currentTarget.value as CustomProviderApiKeySource)}
          className="h-7 text-[11px]"
          aria-label={MODELS.customSdkApiKeySourceLabel}
        >
          {sourceOptions.map((opt) => (
            <NativeSelectOption key={opt.value} value={opt.value}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {value.source === "vscode-secret" ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Input
              id={inputControlId}
              type={effectiveReveal ? "text" : "password"}
              value={value.apiKeyValue ?? ""}
              onChange={(e) => onChange({ ...value, apiKeyValue: e.currentTarget.value })}
              placeholder="paste your API key"
              autoComplete="off"
              data-clarity-mask="true"
              aria-label={MODELS.customSdkApiKeyLabel}
              className="h-7 flex-1 text-[11px]"
            />
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setReveal((r) => !r)}
              aria-label={effectiveReveal ? "Hide key" : "Show key"}
            >
              {effectiveReveal ? <EyeOff size={11} /> : <Eye size={11} />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {MODELS.customSdkVscodeSecretHint.replace("{envVar}", suggestedEnvVar)}
          </p>
        </div>
      ) : null}

      {value.source === "env-var" ? (
        <div className="flex flex-col gap-1">
          <Input
            id={inputControlId}
            value={value.label ?? ""}
            onChange={(e) => onChange({ ...value, label: e.currentTarget.value })}
            placeholder="MY_API_KEY"
            aria-label="Env var name"
            className="h-7 text-[11px]"
          />
          <p className="text-[10px] text-muted-foreground">{MODELS.customSdkEnvVarHint}</p>
        </div>
      ) : null}

      {value.source === "shell-cmd" ? (
        <div className="flex flex-col gap-1">
          <Input
            id={inputControlId}
            value={value.label ?? ""}
            onChange={(e) => onChange({ ...value, label: e.currentTarget.value })}
            placeholder="security find-generic-password -s my-key -w"
            aria-label="Shell command"
            className="h-7 text-[11px]"
          />
          <p className="text-[10px] text-muted-foreground">{MODELS.customSdkShellCmdHint}</p>
        </div>
      ) : null}
    </div>
  );
}
