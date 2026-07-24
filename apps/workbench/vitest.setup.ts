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

// Radix Select and dnd-kit rely on pointer-capture methods that JSDOM does not
// implement. The no-op shim preserves browser behavior boundaries in tests.
HTMLElement.prototype.hasPointerCapture ??= () => false;
HTMLElement.prototype.setPointerCapture ??= () => {};
HTMLElement.prototype.releasePointerCapture ??= () => {};
HTMLElement.prototype.scrollIntoView ??= () => {};

failOnConsole({ shouldFailOnError: true, shouldFailOnWarn: true });
