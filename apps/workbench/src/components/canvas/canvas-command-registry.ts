/**
 * Capability-aware Canvas command registry.
 *
 * Profiles only change which tools are promoted in the UI. They never change
 * the JSON Canvas document or make authored content unreadable.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-43] [FR-44]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-PROFILES]
 */
export const CANVAS_PROFILES = ["essentials", "architecture", "afx"] as const;

export type CanvasProfile = (typeof CANVAS_PROFILES)[number];
export type CanvasMode = "freeform" | "spec-map";

export type CanvasCommandId =
  | "add-card"
  | "add-note"
  | "add-label"
  | "add-annotation"
  | "add-group"
  | "add-file"
  | "add-link"
  | "fit-view"
  | "search"
  | "export"
  | "undo"
  | "redo"
  | "align"
  | "distribute"
  | "auto-layout"
  | "style-selection"
  | "presentation"
  | "architecture-explorer"
  | "refresh-dependencies"
  | "attach-note"
  | "attach-board"
  | "send-chat"
  | "prepare-spec"
  | "prepare-sprint";

export type CanvasCommandCategory =
  "Create" | "Navigate" | "Arrange" | "Share" | "Architecture" | "AFX";

export interface CanvasCapabilities {
  afx: boolean;
  architecture: boolean;
  canExport: boolean;
}

export interface CanvasCommandDefinition {
  id: CanvasCommandId;
  label: string;
  description: string;
  category: CanvasCommandCategory;
  promotedIn: readonly CanvasProfile[];
  keywords: readonly string[];
  shortcut?: string;
  capability?: keyof CanvasCapabilities;
}

export interface CanvasCommandMatch extends CanvasCommandDefinition {
  available: boolean;
  promoted: boolean;
  unavailableReason?: string;
}

const COMMANDS: readonly CanvasCommandDefinition[] = [
  command(
    "add-card",
    "Add card",
    "Create a general text card.",
    "Create",
    ["essentials", "architecture", "afx"],
    ["text", "idea"],
  ),
  command(
    "add-note",
    "Add sticky note",
    "Capture a short thought on the canvas.",
    "Create",
    ["essentials", "architecture", "afx"],
    ["sticky", "thought"],
  ),
  command(
    "add-label",
    "Add label",
    "Add a lightweight heading or annotation.",
    "Create",
    ["essentials", "architecture", "afx"],
    ["heading", "annotation"],
  ),
  command(
    "add-annotation",
    "Add annotation",
    "Drop a numbered callout that points at part of the canvas.",
    "Create",
    ["essentials", "architecture", "afx"],
    ["callout", "comment", "leader", "review"],
  ),
  command(
    "add-group",
    "Add frame",
    "Create a portable JSON Canvas group frame.",
    "Create",
    ["essentials", "architecture", "afx"],
    ["group", "section", "frame"],
  ),
  command(
    "add-file",
    "Attach file",
    "Link any workspace file without copying it into the canvas.",
    "Create",
    ["essentials", "architecture", "afx"],
    ["source", "markdown", "spec", "image"],
  ),
  command(
    "add-link",
    "Attach URL",
    "Create a portable JSON Canvas link card.",
    "Create",
    ["essentials", "architecture", "afx"],
    ["website", "reference", "url"],
  ),
  command(
    "fit-view",
    "Fit canvas",
    "Frame the current selection or the whole canvas.",
    "Navigate",
    ["essentials", "architecture", "afx"],
    ["zoom", "focus"],
    "F",
  ),
  command(
    "search",
    "Find on canvas",
    "Search nodes and focus a result.",
    "Navigate",
    ["essentials", "architecture", "afx"],
    ["filter", "locate"],
    "Ctrl+F",
  ),
  command(
    "undo",
    "Undo",
    "Undo the last canvas change.",
    "Navigate",
    ["essentials", "architecture", "afx"],
    ["history", "back"],
    "Ctrl+Z",
  ),
  command(
    "redo",
    "Redo",
    "Redo the last undone canvas change.",
    "Navigate",
    ["essentials", "architecture", "afx"],
    ["history", "forward"],
    "Ctrl+Shift+Z",
  ),
  command(
    "export",
    "Export canvas",
    "Preflight and export a portable canvas or safe image.",
    "Share",
    ["essentials", "architecture", "afx"],
    ["download", "svg", "json"],
    undefined,
    "canExport",
  ),
  command(
    "align",
    "Align selection",
    "Align selected nodes to a shared edge or center.",
    "Arrange",
    ["architecture", "afx"],
    ["left", "right", "center"],
  ),
  command(
    "distribute",
    "Distribute selection",
    "Space selected nodes evenly.",
    "Arrange",
    ["architecture", "afx"],
    ["spacing", "horizontal", "vertical"],
  ),
  command(
    "auto-layout",
    "Reformat canvas",
    "Preview a deterministic layout before applying it.",
    "Arrange",
    ["architecture", "afx"],
    ["layout", "hierarchy", "radial", "grid"],
    undefined,
    "architecture",
  ),
  command(
    "style-selection",
    "Style selection",
    "Edit colors, density, size, lock, and stacking.",
    "Arrange",
    ["architecture", "afx"],
    ["color", "palette", "lock", "z-order"],
  ),
  command(
    "presentation",
    "Presentation mode",
    "Navigate frames as a clean read-only presentation.",
    "Share",
    ["architecture", "afx"],
    ["slides", "frames", "read"],
  ),
  command(
    "architecture-explorer",
    "Architecture explorer",
    "Search and isolate workspace topology and dependencies.",
    "Architecture",
    ["architecture", "afx"],
    ["topology", "dependency", "three hop"],
    undefined,
    "architecture",
  ),
  command(
    "refresh-dependencies",
    "Sync specs",
    "Re-scan workspace specs and reconcile declared dependencies without moving manual content.",
    "AFX",
    ["afx"],
    ["spec map", "dependency", "depends_on"],
    undefined,
    "afx",
  ),
  command(
    "attach-note",
    "Attach AFX Note",
    "Attach a live file-backed AFX Note.",
    "AFX",
    ["afx"],
    ["journal", "memory"],
    undefined,
    "afx",
  ),
  command(
    "attach-board",
    "Attach AFX Board",
    "Attach a live file-backed AFX Board.",
    "AFX",
    ["afx"],
    ["kanban", "tasks"],
    undefined,
    "afx",
  ),
  command(
    "send-chat",
    "Send selection to Chat",
    "Send selected canvas context to AFX Chat.",
    "AFX",
    ["afx"],
    ["agent", "prompt", "context"],
    undefined,
    "afx",
  ),
  command(
    "prepare-spec",
    "Prepare a spec",
    "Preview an AFX spec handoff before sending it.",
    "AFX",
    ["afx"],
    ["sdd", "requirements"],
    undefined,
    "afx",
  ),
  command(
    "prepare-sprint",
    "Prepare a Sprint",
    "Preview an AFX Sprint handoff before sending it.",
    "AFX",
    ["afx"],
    ["sdd", "plan"],
    undefined,
    "afx",
  ),
];

export function canvasCommands(
  profile: CanvasProfile,
  capabilities: CanvasCapabilities,
  query = "",
): CanvasCommandMatch[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  return COMMANDS.map((definition) => {
    const available = definition.capability ? capabilities[definition.capability] : true;
    const promoted = definition.promotedIn.includes(profile);
    return {
      ...definition,
      available,
      promoted,
      ...(available ? {} : { unavailableReason: capabilityReason(definition.capability) }),
    };
  })
    .filter((definition) => {
      if (!normalizedQuery) return definition.promoted;
      const haystack = [
        definition.label,
        definition.description,
        definition.category,
        ...definition.keywords,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return queryTerms.every((term) => haystack.includes(term));
    })
    .sort((left, right) => {
      if (left.promoted !== right.promoted) return left.promoted ? -1 : 1;
      if (left.available !== right.available) return left.available ? -1 : 1;
      return left.label.localeCompare(right.label);
    });
}

export function canvasProfileLabel(profile: CanvasProfile): string {
  return profile === "afx"
    ? "AFX integrations"
    : profile === "architecture"
      ? "Architecture"
      : "Essentials";
}

/** True when the user has explicitly chosen a profile for this document. */
export function hasStoredCanvasProfile(documentKey: string): boolean {
  try {
    return isCanvasProfile(globalThis.localStorage?.getItem(profileStorageKey(documentKey)));
  } catch {
    return false;
  }
}

export function readCanvasProfile(documentKey: string): CanvasProfile {
  try {
    const value = globalThis.localStorage?.getItem(profileStorageKey(documentKey));
    return isCanvasProfile(value) ? value : "essentials";
  } catch {
    return "essentials";
  }
}

export function writeCanvasProfile(documentKey: string, profile: CanvasProfile): void {
  try {
    globalThis.localStorage?.setItem(profileStorageKey(documentKey), profile);
  } catch {
    // A profile is presentation-only; storage failure must never block editing.
  }
}

export function readCanvasMode(documentKey: string): CanvasMode {
  try {
    const value = globalThis.localStorage?.getItem(modeStorageKey(documentKey));
    return value === "spec-map" ? "spec-map" : "freeform";
  } catch {
    return "freeform";
  }
}

export function writeCanvasMode(documentKey: string, mode: CanvasMode): void {
  try {
    globalThis.localStorage?.setItem(modeStorageKey(documentKey), mode);
  } catch {
    // Mode changes tool exposure only; storage failure must not block editing.
  }
}

export function isCanvasProfile(value: unknown): value is CanvasProfile {
  return typeof value === "string" && CANVAS_PROFILES.includes(value as CanvasProfile);
}

function command(
  id: CanvasCommandId,
  label: string,
  description: string,
  category: CanvasCommandCategory,
  promotedIn: readonly CanvasProfile[],
  keywords: readonly string[],
  shortcut?: string,
  capability?: keyof CanvasCapabilities,
): CanvasCommandDefinition {
  return {
    id,
    label,
    description,
    category,
    promotedIn,
    keywords,
    ...(shortcut ? { shortcut } : {}),
    ...(capability ? { capability } : {}),
  };
}

function capabilityReason(capability: keyof CanvasCapabilities | undefined): string | undefined {
  if (capability === "afx") return "Available when AFX workspace capabilities are detected.";
  if (capability === "architecture") return "Architecture indexing is unavailable in this host.";
  if (capability === "canExport") return "Export is unavailable in this host.";
  return undefined;
}

function profileStorageKey(documentKey: string): string {
  return `afx.canvas.profile.v1:${documentKey}`;
}

function modeStorageKey(documentKey: string): string {
  return `afx.canvas.mode.v1:${documentKey}`;
}
