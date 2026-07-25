/**
 * Usage-warning thresholds persisted in webview localStorage. Deliberately
 * settings-local (not round-tripped through the host) — the warning is a
 * lightweight chat-surface aid, mirroring the SDD guide dismissal storage.
 *
 * @see docs/specs/900-fleet/17-release-hardening-pi-features/17-release-hardening-pi-features.md [FR-25]
 */

export const USAGE_WARNING_STORAGE_KEY = "afx.chat.usageWarning.v1";

export interface UsageWarningConfig {
  enabled: boolean;
  /** Session cost threshold in USD; null disables the cost check. */
  costUsd: number | null;
  /** Context-window usage threshold in percent; null disables the context check. */
  contextPercent: number | null;
}

export const DEFAULT_USAGE_WARNING_CONFIG: UsageWarningConfig = {
  enabled: false,
  costUsd: null,
  contextPercent: null,
};

export function readUsageWarningConfig(): UsageWarningConfig {
  try {
    const raw = globalThis.localStorage?.getItem(USAGE_WARNING_STORAGE_KEY);
    if (!raw) return DEFAULT_USAGE_WARNING_CONFIG;
    const parsed = JSON.parse(raw) as Partial<UsageWarningConfig>;
    return {
      enabled: parsed.enabled === true,
      costUsd: normalizeThreshold(parsed.costUsd),
      contextPercent: normalizeThreshold(parsed.contextPercent),
    };
  } catch {
    return DEFAULT_USAGE_WARNING_CONFIG;
  }
}

export function writeUsageWarningConfig(config: UsageWarningConfig): void {
  try {
    globalThis.localStorage?.setItem(USAGE_WARNING_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage may be unavailable in restricted webview environments.
  }
}

function normalizeThreshold(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** Which enabled thresholds the given usage sample crosses. */
export function crossedUsageThresholds(
  config: UsageWarningConfig,
  usage: { cost: number; contextPercent: number | null },
): { cost: boolean; context: boolean } {
  if (!config.enabled) return { cost: false, context: false };
  return {
    cost: config.costUsd != null && usage.cost >= config.costUsd,
    context:
      config.contextPercent != null &&
      usage.contextPercent != null &&
      usage.contextPercent >= config.contextPercent,
  };
}
