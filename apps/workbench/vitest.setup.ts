/**
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-13] [DES-TEST]
 */
import "@testing-library/jest-dom/vitest";
import failOnConsole from "vitest-fail-on-console";

// Mock ResizeObserver for react-resizable-panels
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver;

failOnConsole({ shouldFailOnError: true, shouldFailOnWarn: true });
