import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "./use-mobile";

type Listener = () => void;

function installMatchMedia(initialWidth: number) {
  const listeners = new Set<Listener>();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: initialWidth,
  });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: window.innerWidth < 768,
    media: query,
    addEventListener: (_evt: string, l: Listener) => listeners.add(l),
    removeEventListener: (_evt: string, l: Listener) => listeners.delete(l),
    dispatchEvent: () => false,
    onchange: null,
    addListener: (l: Listener) => listeners.add(l),
    removeListener: (l: Listener) => listeners.delete(l),
  }));
  return {
    fire(width: number) {
      (window as unknown as { innerWidth: number }).innerWidth = width;
      for (const l of listeners) l();
    },
  };
}

describe("useIsMobile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false on desktop widths", () => {
    installMatchMedia(1280);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true on narrow widths", () => {
    installMatchMedia(500);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("reacts to viewport changes", () => {
    const mql = installMatchMedia(1280);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      mql.fire(400);
    });
    expect(result.current).toBe(true);
  });
});
