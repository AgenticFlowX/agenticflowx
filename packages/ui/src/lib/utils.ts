/**
 * `cn()` utility — merges Tailwind class names with clsx + tailwind-merge.
 *
 * @see docs/specs/130-package-ui/spec.md [FR-4]
 * @see docs/specs/130-package-ui/design.md [DES-API]
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
