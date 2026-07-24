/**
 * Extension settings manifest contract.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-14]
 * @see docs/specs/200-app-vscode/design.md [DES-SIDEBAR-FIRST-RESPONSE-WATCHDOG]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-13]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-1] [FR-32]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type ConfigurationProperty = {
  default?: unknown;
  description?: string;
  maximum?: number;
  minimum?: number;
  type?: string;
};

type ExtensionManifest = {
  contributes: {
    configuration: {
      properties: Record<string, ConfigurationProperty>;
    };
    commands?: Array<{ command: string }>;
    customEditors?: Array<{
      viewType: string;
      priority: string;
      selector: Array<{ filenamePattern: string }>;
    }>;
  };
};

function readManifest(): ExtensionManifest {
  return JSON.parse(
    readFileSync(resolve(__dirname, "../package.json"), "utf8"),
  ) as ExtensionManifest;
}

describe("extension configuration manifest", () => {
  it("contributes the full model-selection identity setting", () => {
    const setting =
      readManifest().contributes.configuration.properties["afx.model.defaultSelection"];

    expect(setting, "afx.model.defaultSelection must be contributed").toBeDefined();
    if (!setting) return;

    expect(setting).toMatchObject({
      type: "string",
      default: "",
    });
    expect(setting.description).toContain("versioned JSON");
  });

  it("contributes the model warm-up timeout opened from Chat settings", () => {
    const setting =
      readManifest().contributes.configuration.properties["afx.runtime.responseStartTimeoutMs"];

    expect(setting, "afx.runtime.responseStartTimeoutMs must be contributed").toBeDefined();
    if (!setting) return;

    expect(setting).toMatchObject({
      type: "number",
      default: 60_000,
      minimum: 5_000,
      maximum: 600_000,
    });
    expect(setting.description).toContain("first model response");
  });

  it("contributes the experimental canvas setting disabled by default", () => {
    const setting = readManifest().contributes.configuration.properties["afx.experimental.canvas"];

    expect(setting, "afx.experimental.canvas must be contributed").toBeDefined();
    if (!setting) return;

    expect(setting).toMatchObject({
      type: "boolean",
      default: false,
    });
    expect(setting.description).toContain("JSON Canvas");
  });

  it("contributes AFX Canvas as an explicit optional editor", () => {
    const manifest = readManifest();
    expect(manifest.contributes.customEditors).toContainEqual(
      expect.objectContaining({
        viewType: "afx.canvasEditor",
        priority: "option",
        selector: [{ filenamePattern: "*.canvas" }],
      }),
    );
    expect(manifest.contributes.commands).toContainEqual(
      expect.objectContaining({ command: "afx.openCanvasEditor" }),
    );
  });
});
