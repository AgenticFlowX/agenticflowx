/**
 * output-card — component unit tests.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-9]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-SYSTEM-COMMAND]
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OutputCard } from "./output-card";

describe("OutputCard", () => {
  it("renders stdout output", () => {
    render(<OutputCard stdout="hello\nworld" />);
    expect(screen.getByText(/hello/)).toBeInTheDocument();
    expect(screen.getByText(/world/)).toBeInTheDocument();
  });

  it("renders stderr output in red", () => {
    render(<OutputCard stdout="ok" stderr="error: something failed" />);
    expect(screen.getByText("error: something failed")).toBeInTheDocument();
  });

  it("renders exit code badge with green for zero", () => {
    render(<OutputCard stdout="ok" exitCode={0} />);
    expect(screen.getByText("exit 0")).toBeInTheDocument();
  });

  it("renders exit code badge with amber for non-zero", () => {
    render(<OutputCard stdout="failed" exitCode={1} />);
    expect(screen.getByText("exit 1")).toBeInTheDocument();
  });

  it("renders error message in red", () => {
    render(<OutputCard error="ENOENT: file not found" />);
    expect(screen.getByText("ENOENT: file not found")).toBeInTheDocument();
  });

  it("renders Shell Output header", () => {
    render(<OutputCard stdout="test" />);
    expect(screen.getByText("Shell Output")).toBeInTheDocument();
  });

  it("renders the command above the output", () => {
    render(<OutputCard command="ls -la" stdout="test" />);
    expect(screen.getByText("ls -la")).toBeInTheDocument();
  });
});
