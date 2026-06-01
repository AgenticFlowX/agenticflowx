/**
 * PKCE (S256) utilities for AFX-owned OAuth provider descriptors. Uses Web Crypto
 * so verifier/challenge generation is available in the VS Code host tests and in
 * browser-compatible runtimes.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-4] [FR-7]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PROVIDERS]
 */

/** Encode bytes as a base64url string (no padding). */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generate a PKCE code verifier and its S256 challenge:
 * 32 random bytes → base64url verifier; SHA-256(verifier) → base64url challenge.
 */
export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64urlEncode(verifierBytes);

  const data = new TextEncoder().encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const challenge = base64urlEncode(new Uint8Array(hashBuffer));

  return { verifier, challenge };
}

/** Generate a random hex state token (16 bytes). */
export function createRandomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
