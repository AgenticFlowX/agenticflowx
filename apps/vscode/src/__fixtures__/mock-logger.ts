/**
 * Reusable Logger test double — backed by memorySink for assertable records.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-6]
 * @see docs/specs/200-app-vscode/design.md [DES-TEST]
 */
import { type Logger, createLogger, memorySink } from "@afx/shared";

export interface MockLogger {
  logger: Logger;
  records: () => unknown[];
  clear: () => void;
}

export function createMockLogger(scope = "test"): MockLogger {
  const sink = memorySink();
  const logger = createLogger({ scope, level: "trace", sinks: [sink] });
  return {
    logger,
    records: () => sink.records().slice(),
    clear: () => sink.clear(),
  };
}
