/**
 * Vitest setup for @afx/agent-pi — fails tests that emit console.warn/error.
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-13] [DES-TEST]
 */
import failOnConsole from "vitest-fail-on-console";

failOnConsole({ shouldFailOnError: true, shouldFailOnWarn: true });
