/**
 * useLocalStorage — typed wrapper with safe JSON parse fallback.
 *
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-2]
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-FILTERS]
 */
import { useCallback, useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota errors
    }
  }, [key, value]);

  const set = useCallback((next: T) => setValue(next), []);
  return [value, set];
}
