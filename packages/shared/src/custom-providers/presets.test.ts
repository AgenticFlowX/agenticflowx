/**
 * Preset catalog shape tests.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-MOCKUP-CUSTOM-PRESET]
 */
import { describe, expect, it } from "vitest";

import {
  CUSTOM_PROVIDER_PRESETS,
  PRESET_CUSTOM_BLANK,
  PRESET_OLLAMA,
  PRESET_OPENROUTER,
} from "./presets";

describe("preset catalog", () => {
  it("is non-empty and contains 9 presets", () => {
    expect(CUSTOM_PROVIDER_PRESETS).toHaveLength(9);
  });

  it("has unique presetIds", () => {
    const ids = CUSTOM_PROVIDER_PRESETS.map((p) => p.presetId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("local presets default to no api key", () => {
    expect(PRESET_OLLAMA.defaultApiKeySource).toBe("none");
    expect(PRESET_OLLAMA.defaultBaseUrl).toMatch(/^https?:\/\//);
  });

  it("cloud presets default to vscode-secret api key", () => {
    expect(PRESET_OPENROUTER.defaultApiKeySource).toBe("vscode-secret");
  });

  it("custom-blank has empty baseUrl so the form requires user input", () => {
    expect(PRESET_CUSTOM_BLANK.defaultBaseUrl).toBe("");
  });
});
