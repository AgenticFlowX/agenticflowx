import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockLogger } from "../../__fixtures__/mock-logger";
import { getCopilotBaseUrl, normalizeDomain, runDeviceCode } from "./device-code";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Failure",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("GitHub Copilot device-code OAuth", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("normalizes enterprise domains and derives Copilot base URLs", () => {
    expect(normalizeDomain("https://company.ghe.com/org")).toBe("company.ghe.com");
    expect(normalizeDomain("company.ghe.com")).toBe("company.ghe.com");
    expect(normalizeDomain("")).toBeNull();

    expect(getCopilotBaseUrl("tid=1;proxy-ep=proxy.company.ghe.com;")).toBe(
      "https://api.company.ghe.com",
    );
    expect(getCopilotBaseUrl("tid=1", "company.ghe.com")).toBe(
      "https://copilot-api.company.ghe.com",
    );
  });

  it("runs the device-code happy path without exposing secrets through callbacks", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          device_code: "device",
          user_code: "ABCD-EFGH",
          verification_uri: "https://github.com/login/device",
          interval: 0,
          expires_in: 60,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ access_token: "github-access" }))
      .mockResolvedValueOnce(
        jsonResponse({ token: "tid=1;proxy-ep=proxy.company.ghe.com;", expires_at: 2_000 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { logger } = createMockLogger();
    const onUserCode = vi.fn();
    const onProgress = vi.fn();

    const pending = runDeviceCode({
      logger,
      callbacks: { onUserCode, onProgress },
      enterpriseInput: "company.ghe.com",
      enableModels: false,
    });

    await vi.advanceTimersByTimeAsync(1_500);
    const credential = await pending;

    expect(onUserCode).toHaveBeenCalledWith({
      userCode: "ABCD-EFGH",
      verificationUri: "https://github.com/login/device",
      expiresInMs: 60_000,
    });
    expect(onProgress).toHaveBeenCalledWith("Connecting to Copilot…");
    expect(credential).toMatchObject({
      access: "tid=1;proxy-ep=proxy.company.ghe.com;",
      refresh: "github-access",
      enterpriseDomain: "company.ghe.com",
      copilotBaseUrl: "https://api.company.ghe.com",
    });
  });
});
