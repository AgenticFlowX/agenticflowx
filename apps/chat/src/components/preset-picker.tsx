/**
 * Preset picker — surfaces the canonical custom-provider preset catalog as a grid.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-MOCKUP-CUSTOM-PRESET]
 */
import type { CustomProviderPreset } from "@afx/shared";
import { CUSTOM_PROVIDER_PRESETS } from "@afx/shared";
import { Button } from "@afx/ui/components/button";

import { MODELS } from "../lib/settings-copy";

export interface PresetPickerProps {
  onSelect: (preset: CustomProviderPreset) => void;
  onCancel: () => void;
}

/**
 * Renders the 9 canonical presets in a responsive grid. Selecting a preset
 * passes it to the parent so the parent can seed the form.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
 */
export function PresetPicker({ onSelect, onCancel }: PresetPickerProps) {
  return (
    <div
      className="rounded-md border bg-muted/20 p-3"
      role="dialog"
      aria-label={MODELS.customSdkPresetTitle}
    >
      <p className="text-[11px] font-semibold text-foreground">{MODELS.customSdkPresetTitle}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
        {MODELS.customSdkPresetSubtitle}
      </p>
      <div className="mt-2 grid gap-1.5 @[280px]:grid-cols-2 @[420px]:grid-cols-3">
        {CUSTOM_PROVIDER_PRESETS.map((preset) => (
          <button
            key={preset.presetId}
            type="button"
            onClick={() => onSelect(preset)}
            className="flex flex-col items-start gap-0.5 rounded-md border bg-card/40 px-2 py-1.5 text-left transition-colors hover:bg-card/70"
            aria-label={`Use ${preset.label} preset`}
          >
            <span className="text-[11px] font-medium text-foreground">{preset.label}</span>
            <span className="text-[10px] text-muted-foreground">{preset.subtitle}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" size="xs" variant="outline" onClick={onCancel}>
          {MODELS.customSdkCancelLabel}
        </Button>
      </div>
    </div>
  );
}
