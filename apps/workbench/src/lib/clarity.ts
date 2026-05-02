/**
 * Microsoft Clarity loader for the workbench webview.
 *
 * @see docs/specs/vscode-clarity-telemetry/vscode-clarity-telemetry.md [FR-1] [FR-3] [FR-4]
 * @see docs/specs/vscode-clarity-telemetry/vscode-clarity-telemetry.md [DES-API]
 */
import { consoleSink, createLogger } from "@afx/shared";

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

const log = createLogger({ scope: "workbench:clarity", level: "info", sinks: [consoleSink()] });

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

const CLARITY_PROJECT_ID = "w6orgkccwz";

let bootstrapped = false;

export function setClarityEnabled(enabled: boolean): void {
  if (!enabled || isDoNotTrackEnabled()) {
    stopClarity();
    return;
  }

  bootstrapClarity();
  tagSession();
}

function isDoNotTrackEnabled(): boolean {
  const nav = navigator as unknown as Record<string, unknown>;
  const win = window as unknown as Record<string, unknown>;
  const raw =
    (navigator as unknown as { doNotTrack?: unknown }).doNotTrack ??
    nav["msDoNotTrack"] ??
    win["doNotTrack"];
  const value =
    typeof raw === "string"
      ? raw.toLowerCase()
      : typeof raw === "number"
        ? String(raw)
        : typeof raw === "boolean"
          ? raw
            ? "1"
            : "0"
          : "";
  return value === "1" || value === "yes";
}

function bootstrapClarity(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  try {
    const queue: unknown[][] = [];
    if (typeof window.clarity !== "function") {
      const clarityFn: ClarityFn = Object.assign((...args: unknown[]) => {
        queue.push(args);
      }, {});
      clarityFn.q = queue;
      window.clarity = clarityFn;
    }

    const src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = src;

    const firstScript = document.getElementsByTagName("script")[0] ?? null;
    const parent = firstScript?.parentNode;
    if (parent) {
      parent.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  } catch (err) {
    bootstrapped = false;
    log.warn("Clarity bootstrap failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

function tagSession(): void {
  if (typeof window.clarity !== "function") return;

  try {
    window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    window.clarity("set", "afx_app", "workbench");
    window.clarity("set", "afx_surface", "panel");
  } catch (err) {
    log.warn("Clarity tagging failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

function stopClarity(): void {
  if (typeof window.clarity !== "function") return;

  try {
    window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" });
    window.clarity("consent", false);
  } catch (err) {
    log.warn("Clarity stop failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
