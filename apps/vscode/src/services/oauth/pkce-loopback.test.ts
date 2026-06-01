import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockLogger } from "../../__fixtures__/mock-logger";
import { OAuthCancelledError, runPkceLoopback } from "./pkce-loopback";

const config = {
  provider: "anthropic",
  authorizeUrl: "https://claude.ai/oauth/authorize",
  clientId: "client",
  scope: "scope",
  callbackPort: 0,
  callbackPath: "/callback",
  redirectUri: "http://localhost:53692/callback",
  stateIsVerifier: false,
};

describe("PKCE loopback OAuth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects pasted callbacks with mismatched state before exchange", async () => {
    const { logger } = createMockLogger();

    await expect(
      runPkceLoopback({
        config,
        logger,
        callbacks: {
          onAuthUrl: vi.fn(),
          onManualCode: vi.fn(async () => "code=auth-code&state=wrong-state"),
        },
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow("OAuth state mismatch");
  });

  it("times out when neither loopback nor paste capture completes", async () => {
    const { logger } = createMockLogger();

    await expect(
      runPkceLoopback({
        config,
        logger,
        callbacks: {
          onAuthUrl: vi.fn(),
        },
        timeoutMs: 1,
      }),
    ).rejects.toBeInstanceOf(OAuthCancelledError);
  });
});
