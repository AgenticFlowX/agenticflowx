/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-43] [FR-44]
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  canvasCommands,
  readCanvasMode,
  readCanvasProfile,
  writeCanvasMode,
  writeCanvasProfile,
} from "./canvas-command-registry";

const allCapabilities = { afx: true, architecture: true, canExport: true };

describe("Canvas command registry", () => {
  beforeEach(() => globalThis.localStorage.clear());

  it("defaults each document to the beginner Essentials profile", () => {
    expect(readCanvasProfile("root/project.canvas")).toBe("essentials");
  });

  it("persists profiles per document without touching canvas content", () => {
    writeCanvasProfile("root/one.canvas", "architecture");
    writeCanvasProfile("root/two.canvas", "afx");

    expect(readCanvasProfile("root/one.canvas")).toBe("architecture");
    expect(readCanvasProfile("root/two.canvas")).toBe("afx");
    expect(readCanvasProfile("root/three.canvas")).toBe("essentials");
  });

  it("keeps Freeform and Spec Map mode per document", () => {
    writeCanvasMode("root/spec-map.canvas", "spec-map");

    expect(readCanvasMode("root/spec-map.canvas")).toBe("spec-map");
    expect(readCanvasMode("root/freeform.canvas")).toBe("freeform");
  });

  it("promotes a small universal set in Essentials", () => {
    const commands = canvasCommands("essentials", allCapabilities);

    expect(commands.map((command) => command.id)).toEqual(
      expect.arrayContaining(["add-card", "add-file", "add-link", "fit-view", "search", "export"]),
    );
    expect(commands.map((command) => command.id)).not.toContain("refresh-dependencies");
    expect(commands.map((command) => command.id)).not.toContain("auto-layout");
  });

  it("promotes topology and composition tools in Architecture", () => {
    const ids = canvasCommands("architecture", allCapabilities).map((command) => command.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "auto-layout",
        "align",
        "distribute",
        "architecture-explorer",
        "presentation",
      ]),
    );
    expect(ids).not.toContain("attach-board");
  });

  it("promotes AFX integrations only in the AFX profile", () => {
    const ids = canvasCommands("afx", allCapabilities).map((command) => command.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "refresh-dependencies",
        "attach-note",
        "attach-board",
        "send-chat",
        "prepare-spec",
      ]),
    );
  });

  it("searches hidden commands without silently enabling missing capabilities", () => {
    const [match] = canvasCommands(
      "essentials",
      { afx: false, architecture: false, canExport: true },
      "dependency",
    ).filter((command) => command.id === "refresh-dependencies");

    expect(match).toMatchObject({ promoted: false, available: false });
    expect(match?.unavailableReason).toContain("AFX workspace");
  });

  it("does not make universal commands depend on AFX", () => {
    const commands = canvasCommands("essentials", {
      afx: false,
      architecture: false,
      canExport: true,
    });

    expect(commands.filter((command) => !command.available).map((command) => command.id)).toEqual(
      [],
    );
  });
});
