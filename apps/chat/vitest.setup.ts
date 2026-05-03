/**
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-13] [DES-TEST]
 */
import "@testing-library/jest-dom/vitest";
import failOnConsole from "vitest-fail-on-console";

failOnConsole({
  shouldFailOnError: true,
  shouldFailOnWarn: true,
  // Silence React 18 "not wrapped in act(...)" warnings emitted by Radix
  // primitives during transition state updates — known noise pattern.
  silenceMessage: (message) =>
    /not wrapped in act\(/.test(message) ||
    // Silence React StrictMode double-render warnings for simple component tests
    /Warning: An update to/.test(message),
});

// jsdom doesn't implement layout/scroll/observer APIs; stub the ones our components
// (and Radix primitives used by shadcn) touch at runtime.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
