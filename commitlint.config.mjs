/**
 * Commitlint configuration.
 * Extends @commitlint/config-conventional with project-specific scope-enum (C-1, C-2).
 *
 * @see docs/specs/400-dx-conventions/spec.md [FR-1]
 * @see docs/specs/320-infra-scripts/design.md [DES-OVR]
 */
import scopes from "./scripts/generate-scope-enum.mjs";

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // C-1: scope is required and restricted to the enum
    "scope-empty": [2, "never"],
    "scope-enum": [2, "always", scopes],
    // Header max length (inherited default is 100; make explicit)
    "header-max-length": [2, "always", 100],
  },
};
