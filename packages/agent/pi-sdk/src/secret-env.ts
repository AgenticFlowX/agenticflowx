/**
 * Secret env-var naming for AFX-managed custom providers. The bootstrap reads
 * these env vars and overlays them into pi-mono's existing env-resolution path.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-5]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
 */

const VALID_SLUG = /^[A-Z][A-Z0-9_]*$/;

/**
 * Translate a custom-provider id to its `AFX_<SLUG>_KEY` env var name.
 * The slug is uppercased; non-alphanumeric becomes `_`; a leading digit is prefixed with `_`.
 * The result is validated against `VALID_SLUG`.
 *
 * Examples: `openrouter` → `AFX_OPENROUTER_KEY`; `my-anthropic-proxy` → `AFX_MY_ANTHROPIC_PROXY_KEY`.
 */
export function secretEnvVarFor(providerId: string): string {
  if (typeof providerId !== "string" || providerId.length === 0) {
    throw new Error("secretEnvVarFor: providerId must be a non-empty string");
  }
  const upper = providerId.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const slug = /^[A-Z]/.test(upper) ? upper : `_${upper}`;
  if (!VALID_SLUG.test(slug)) {
    throw new Error(`secretEnvVarFor: derived slug "${slug}" is not a valid env-var component`);
  }
  return `AFX_${slug}_KEY`;
}
