/**
 * PKCE (Proof Key for Code Exchange) helpers — S256 verifier/challenge.
 *
 * AFX uses Web Crypto (`crypto.getRandomValues` + `crypto.subtle.digest`) so this
 * module stays runtime-agnostic and easy to exercise in host tests. No secrets are
 * logged here — callers must never log the verifier.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-7] [NFR-1]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PKCE] [DES-SEC]
 */

/** A PKCE verifier/challenge pair. The verifier is secret; the challenge is public. */
export interface PkcePair {
  /** High-entropy random secret. Sent only in the token exchange, never logged. */
  readonly verifier: string;
  /** base64url(SHA-256(verifier)). Sent in the authorize URL. */
  readonly challenge: string;
  /** Always "S256" for this implementation. */
  readonly method: "S256";
}

/** Encode raw bytes as an unpadded base64url string (RFC 7636 §A). */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Generate `length` cryptographically random bytes via Web Crypto. */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Generate a PKCE verifier/challenge pair using S256.
 *
 * The verifier is 32 random bytes (43 base64url chars). The challenge is the
 * base64url-encoded SHA-256 digest of that verifier.
 */
export async function generatePkce(): Promise<PkcePair> {
  const verifier = base64urlEncode(randomBytes(32));
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const challenge = base64urlEncode(new Uint8Array(digest));
  return { verifier, challenge, method: "S256" };
}

/**
 * Generate a random OAuth `state` value (hex). Anthropic reuses the PKCE verifier
 * as state; OpenAI Codex uses a separate 16-byte random hex state. This helper
 * covers the latter case.
 */
export function generateState(byteLength = 16): string {
  return Array.from(randomBytes(byteLength))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time-ish equality for OAuth `state`/`verifier` comparison. Avoids a
 * short-circuit length/character leak; OAuth state is not a long-lived secret,
 * but equality validation is required before token exchange.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
