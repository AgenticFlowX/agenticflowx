/**
 * Composer Intent shared types and slot helpers.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-4]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-3]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
 */
import type { WorkspaceMode } from "./types";

export type IntentParentMode = Extract<WorkspaceMode, "code" | "explore">;
export type IntentSlot = 1 | 2 | 3 | 4;
export type ComposerIntentId = "default" | "ask" | "architect" | "code" | "prd";

export interface ComposerIntentState {
  slot: IntentSlot;
  minimized: boolean;
}

export interface IntentPromptEntry {
  id: ComposerIntentId;
  slot: IntentSlot;
  label: string;
  description: string;
  prefix: string;
  estimatedTokens: number;
  parents: readonly IntentParentMode[];
  icon: string;
}

export function normalizeIntentSlot(value: unknown): IntentSlot {
  return value === 2 || value === 3 || value === 4 ? value : 1;
}

export function isIntentParentMode(mode: WorkspaceMode): mode is IntentParentMode {
  return mode === "code" || mode === "explore";
}
