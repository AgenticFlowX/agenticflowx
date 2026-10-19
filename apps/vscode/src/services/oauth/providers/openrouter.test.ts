/**
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-7]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PROVIDERS]
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import { describe, expect, it, vi } from "vitest";

import { createLogger } from "@afx/shared";

import { openRouterOAuthProvider } from "./openrouter";

const http = vi.hoisted(() => ({
  handler: undefined as ((request: IncomingMessage, response: ServerResponse) => void) | undefined,
}));
vi.mock("node:http", () => ({
  createServer: (handler: typeof http.handler) => {
    http.handler = handler;
    return {
      on: vi.fn(),
      close: vi.fn(),
      address: () => ({ port: 12345 }),
      listen: (_port: number, _host: string, ready: () => void) => ready(),
    };
  },
}));

describe("OpenRouter callback error page", () => {
  it("HTML-escapes attacker-controlled authorization errors", async () => {
    const end = vi.fn();
    const response = { setHeader: vi.fn(), end } as unknown as ServerResponse;
    const result = openRouterOAuthProvider.begin!({
      providerId: "openrouter",
      signal: new AbortController().signal,
      logger: createLogger({ scope: "test", level: "silent", sinks: [] }),
      callbacks: {
        onAuthUrl: ({ url }) => {
          const callback = new URL(new URL(url).searchParams.get("callback_url")!);
          callback.searchParams.set("error", "denied");
          callback.searchParams.set("error_description", '<img src=x onerror="alert(1)">&');
          http.handler!(
            { method: "GET", url: callback.pathname + callback.search } as IncomingMessage,
            response,
          );
        },
      },
    });
    await expect(result).rejects.toThrow("OpenRouter authorization failed");
    expect(response.statusCode).toBe(400);
    expect(end).toHaveBeenCalledWith(
      expect.stringContaining("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;"),
    );
    expect(end.mock.calls[0]?.[0]).not.toContain("<img");
  });
});
