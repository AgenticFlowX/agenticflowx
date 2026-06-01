import { describe, expect, it } from "vitest";

import { generatePkce, generateState, timingSafeEqualString } from "./pkce";

describe("PKCE helpers", () => {
  it("generates S256 verifier/challenge pairs and hex states", async () => {
    const pkce = await generatePkce();

    expect(pkce.method).toBe("S256");
    expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateState()).toMatch(/^[a-f0-9]{32}$/);
  });

  it("compares OAuth state values without short-circuiting equal-length strings", () => {
    expect(timingSafeEqualString("state", "state")).toBe(true);
    expect(timingSafeEqualString("state", "statz")).toBe(false);
    expect(timingSafeEqualString("state", "different-length")).toBe(false);
  });
});
