import { PROVIDER_API_KEY_ENV_ALIASES } from "@afx/shared";

export function providerEnvKey(provider: string): string {
  return provider.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
}

export function getApiKey(
  provider: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const providerKey = providerEnvKey(provider);
  return (
    env[`AFX_API_KEY_${providerKey}`] ??
    providerApiKeyEnvAliases(provider)
      .map((key) => env[key])
      .find((value): value is string => Boolean(value)) ??
    env[`${providerKey}_API_KEY`] ??
    env["AFX_API_KEY"] ??
    env["API_KEY"]
  );
}

export function applyProviderEnv(
  provider: string,
  apiKey: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const key of providerApiKeyEnvAliases(provider)) {
    env[key] ??= apiKey;
  }
}

export function providerApiKeyEnvAliases(provider: string): string[] {
  const normalized = provider.toLowerCase();
  const aliases =
    PROVIDER_API_KEY_ENV_ALIASES[normalized as keyof typeof PROVIDER_API_KEY_ENV_ALIASES] ?? [];
  return [...new Set([`${providerEnvKey(provider)}_API_KEY`, ...aliases])];
}
