/**
 * Chat route shell — delegates the Chat tab body to ChatWindow.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-API] [DES-ROLLOUT]
 */
import { type ChatProps, ChatWindow } from "../components/chat/chat-window";

export type { ChatProps } from "../components/chat/chat-window";

export default function Chat(props: ChatProps) {
  return <ChatWindow {...props} />;
}
