/**
 * Reserved chat-history load/export slots.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-HISTORY] [DES-FILES]
 * @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-QUESTIONS]
 */
import { CHAT_HISTORY_PANEL_ID } from "./chat.types";

/** Stable panel slot id reserved for the future ComposerPanelStack history panel. */
export const CHAT_HISTORY_PANEL_SLOT_ID = CHAT_HISTORY_PANEL_ID;

export function ChatHistoryPanel() {
  return null;
}
ChatHistoryPanel.panelId = CHAT_HISTORY_PANEL_SLOT_ID;

export function ChatHistoryLoadAction() {
  return null;
}

export function ChatHistoryExportAction() {
  return null;
}
