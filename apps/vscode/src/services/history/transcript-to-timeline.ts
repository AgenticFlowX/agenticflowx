/**
 * Compatibility export for the VS Code host. The canonical mapper lives in
 * `@afx/shared` so the History preview and reopen path cannot drift apart.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-16]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-FLOW] [DES-PERSISTENT-BRIDGE]
 */
export { transcriptToTimeline } from "@afx/shared";
