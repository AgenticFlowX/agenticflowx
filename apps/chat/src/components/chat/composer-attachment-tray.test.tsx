/**
 * ComposerAttachmentTray tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-FILES]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComposerAttachmentTray } from "./composer-attachment-tray";

describe("ComposerAttachmentTray", () => {
  it("renders nothing when there are no attachments", () => {
    const { container } = render(<ComposerAttachmentTray attachments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders file/image attachment chips and remove callbacks", () => {
    const onRemove = vi.fn();

    render(
      <ComposerAttachmentTray
        attachments={[
          { id: "file-1", kind: "file", name: "chat.tsx", path: "src/chat.tsx" },
          { id: "image-1", kind: "image", name: "screenshot.png", mimeType: "image/png" },
        ]}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByLabelText("Selected attachments")).toBeInTheDocument();
    expect(screen.getByText("chat.tsx")).toBeInTheDocument();
    expect(screen.getByText("screenshot.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove screenshot.png" }));
    expect(onRemove).toHaveBeenCalledWith("image-1");
  });
});
