/**
 * Built-in OAuth provider registry for AFX-managed subscription accounts. Keeps
 * provider descriptors centralized so OAuthService, Settings snapshots, and SDK
 * injection all read the same provider metadata. v1 registers Anthropic, OpenAI
 * Codex, and GitHub Copilot.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-3] [FR-4] [FR-5] [FR-7]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PROVIDERS]
 */
import { anthropicOAuthProvider } from "./anthropic";
import { githubCopilotOAuthProvider } from "./github-copilot";
import { openaiCodexOAuthProvider } from "./openai-codex";
import type { OAuthProviderDescriptor, OAuthProviderId } from "./types";

export * from "./types";

/** Built-in subscription OAuth providers exposed by AFX. */
export const BUILT_IN_OAUTH_PROVIDERS: readonly OAuthProviderDescriptor[] = [
  anthropicOAuthProvider,
  githubCopilotOAuthProvider,
  openaiCodexOAuthProvider,
];

const registry = new Map<string, OAuthProviderDescriptor>(
  BUILT_IN_OAUTH_PROVIDERS.map((provider) => [provider.id, provider]),
);

/** Get a built-in OAuth provider descriptor by id, or `undefined` if unknown. */
export function getOAuthProvider(id: OAuthProviderId): OAuthProviderDescriptor | undefined {
  return registry.get(id);
}
