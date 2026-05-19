/**
 * User-facing Composer Intent copy helpers shared by host and webviews.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-1]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-13] [FR-14] [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-UI]
 */

/** Returns the compact label shown in tight Intent controls. */
export function formatIntentPromptBadge(estimatedTokens: number): string | null {
  return estimatedTokens > 0 ? "Intent guide" : null;
}

/** Returns a human label for prompt overhead without token shorthand. */
export function formatIntentTokenEstimate(estimatedTokens: number): string {
  return estimatedTokens > 0 ? `About ${estimatedTokens} tokens` : "No intent guidance";
}

/** Returns the explanatory label for previews and tooltips. */
export function formatIntentPromptDetail(estimatedTokens: number): string {
  return estimatedTokens > 0
    ? `Short intent guidance - about ${estimatedTokens} tokens`
    : "No intent guidance";
}

/** Returns the full hover title for compact Intent controls. */
export function formatIntentPromptTitle(estimatedTokens: number): string {
  return estimatedTokens > 0
    ? `Adds short intent guidance before your message. ${formatIntentTokenEstimate(estimatedTokens)}.`
    : "No Intent guidance is added.";
}
