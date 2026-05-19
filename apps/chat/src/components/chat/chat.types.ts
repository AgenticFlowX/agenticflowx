/**
 * Shared chat-window componentization contracts.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-STATE]
 */
import type { ComponentType, ReactNode } from "react";

export interface ChatWindowFlags {
  topBar: boolean;
  conversationPane: boolean;
  composerDock: boolean;
  composerActivityBar: boolean;
  composerAttachmentTray: boolean;
  composerPanelStack: boolean;
  slashCommandPopover: boolean;
  fileMentionPopover: boolean;
  composerFooterUsageStats: boolean;
  chatHistory: boolean;
}

export const DEFAULT_CHAT_WINDOW_FLAGS: ChatWindowFlags = {
  topBar: true,
  conversationPane: true,
  composerDock: true,
  composerActivityBar: true,
  composerAttachmentTray: true,
  composerPanelStack: true,
  slashCommandPopover: true,
  fileMentionPopover: true,
  composerFooterUsageStats: true,
  chatHistory: false,
};

export type ComposerPanelZone = "context" | "workflow" | "feedback" | "debug";

export const CHAT_HISTORY_PANEL_ID = "history";

export type ComposerPanelTone = "neutral" | "brand" | "warning";

export interface ComposerPanelDefinition<P = unknown> {
  id: string;
  zone: ComposerPanelZone;
  title: ReactNode;
  before?: string;
  after?: string;
  visible: boolean;
  collapsible?: boolean;
  /** Initial collapsed state when `collapsible`. Default false (expanded). */
  defaultCollapsed?: boolean;
  /**
   * Re-apply default collapse when the source of that default changes, e.g. a
   * late settings snapshot confirms persisted minimized state.
   */
  defaultCollapsedKey?: string;
  /** Visually compact this panel because another workflow panel owns the row. */
  forcedCollapsed?: boolean;
  /** Optional side effect when the panel collapse state changes. */
  onCollapsedChange?: (collapsed: boolean) => void;
  dismissible?: boolean;
  /** Optional numeric badge rendered next to the title (e.g. queue count). */
  count?: number;
  /** Border tone — neutral / brand / warning. */
  tone?: ComposerPanelTone;
  /**
   * Optional header actions slot rendered between the title and the
   * collapse/dismiss controls. Useful for panel-scoped buttons like "Clear all"
   * on the queue panel.
   */
  actions?: ReactNode;
  /** Inline header content placed between the title and the actions slot. */
  headerExtras?: ReactNode | ((state: { collapsed: boolean }) => ReactNode);
  /** Use the panel-default mono-uppercase title styling. Default true. */
  monoHeader?: boolean;
  component: ComponentType<P>;
  props?: P;
}

export interface ComposerPanelStackConfig {
  panels: ComposerPanelDefinition[];
  defaultZoneOrder?: ComposerPanelZone[];
}

export interface ComposerAttachmentItem {
  id: string;
  kind: "file" | "image";
  name: string;
  path?: string;
  mimeType?: string;
  previewUrl?: string;
}

export interface ChatHistorySession {
  id: string;
  createdAt: number;
  updatedAt: number;
  title?: string;
  events: unknown[];
}

export interface ChatHistoryStore {
  listSessions(): Promise<ChatHistorySession[]>;
  getSession(id: string): Promise<ChatHistorySession | null>;
  saveSession(session: ChatHistorySession): Promise<void>;
  exportSession(session: ChatHistorySession): Promise<void>;
}
