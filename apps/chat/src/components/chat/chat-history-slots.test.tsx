/**
 * Reserved chat-history slot tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-HISTORY]
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ChatHistoryExportAction,
  ChatHistoryLoadAction,
  ChatHistoryPanel,
} from "./chat-history-slots";

describe("chat history reserved slots", () => {
  it("exports non-rendering placeholders for future load/export surfaces", () => {
    const { container, rerender } = render(<ChatHistoryPanel />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ChatHistoryLoadAction />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ChatHistoryExportAction />);
    expect(container).toBeEmptyDOMElement();
  });
});
