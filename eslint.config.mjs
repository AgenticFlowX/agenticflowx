/**
 * Root ESLint flat config (v9).
 * Shared rules for all workspaces — TypeScript strict, React, Prettier compat,
 * filename kebab-case enforcement (C-4), import ordering via Prettier plugin (C-3),
 * architecture-boundary `no-restricted-imports` per package (DES-LINT).
 *
 * @see docs/specs/410-dx-quality/spec.md [FR-1] [FR-2]
 * @see docs/specs/410-dx-quality/design.md [DES-ARCH] [DES-FILES]
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-4] [FR-23] [DES-LINT] [DES-SHADCN]
 */
import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import checkFilePlugin from "eslint-plugin-check-file";
import importPlugin from "eslint-plugin-import";
import noSecretsPlugin from "eslint-plugin-no-secrets";
import noUnsanitizedPlugin from "eslint-plugin-no-unsanitized";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import securityPlugin from "eslint-plugin-security";
import unicornPlugin from "eslint-plugin-unicorn";
import vitestPlugin from "eslint-plugin-vitest";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/.vscode-test/**",
      "**/.turbo/**",
      "**/coverage/**",
      "apps/vscode/resources/pi-sdk/**",
      "pnpm-lock.yaml",
      // Shadcn-generated files — owned by the registry, regenerated via `shadcn add`.
      // Lint and filename rules don't apply; manual edits should stay minimal.
      "packages/ui/src/components/**",
      "packages/ui/src/hooks/**",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules — applied to all TS/TSX files
  ...tseslint.configs.recommended,

  // Type-aware rules — scoped to source TS/TSX (configs/setup files run untyped).
  // Uses `projectService` (tseslint v8+) to auto-discover the nearest tsconfig per file.
  // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-10] [DES-LINT]
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "**/dist/**",
      "**/out/**",
      "packages/ui/src/components/**",
      "packages/ui/src/hooks/**",
      // Outside any tsconfig include — project-service can't type-check these.
      // Untyped lint still applies via the recommended preset above.
      "**/vitest.config.*",
      "**/vitest.workspace.*",
      "**/vitest.setup.*",
      "**/vite.config.*",
      "**/playwright.config.*",
      "scripts/conventions/**",
      "apps/vscode/__mocks__/**",
      "apps/chat/e2e/**",
      "apps/workbench/e2e/**",
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    extends: [...tseslint.configs.recommendedTypeChecked],
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },

  // Import hygiene — cycle detection + extraneous-deps guard.
  // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-11] [DES-LINT]
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "**/dist/**",
      "**/out/**",
      "packages/ui/src/components/**",
      "packages/ui/src/hooks/**",
    ],
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      "import/no-cycle": ["error", { maxDepth: 10 }],
      "import/no-extraneous-dependencies": [
        "error",
        {
          // Workspace root + per-package + nested-package package.json files
          // are all consulted — devDeps hoisted to root are visible to leaves.
          packageDir: [
            ".",
            "apps/chat",
            "apps/workbench",
            "apps/vscode",
            "apps/vscode-e2e",
            "packages/shared",
            "packages/parsers",
            "packages/transport",
            "packages/ui",
            "packages/agent/pi",
            "packages/agent/pi-sdk",
          ],
          devDependencies: [
            "**/*.{test,spec}.{ts,tsx}",
            "**/__fixtures__/**",
            "**/__mocks__/**",
            "**/vitest.config.*",
            "**/vitest.setup.*",
            "**/vitest.workspace.*",
            "**/vite.config.*",
            "**/playwright.config.*",
            "scripts/conventions/**",
            "scripts/**",
            "**/.vscode-test.mjs",
            "eslint.config.mjs",
          ],
        },
      ],
    },
  },

  // Variable naming convention — module-level non-function const must be UPPER_CASE.
  // Function-bound consts (anonymous arrow / function expression / React component)
  // keep camelCase / PascalCase; type-likes keep PascalCase.
  // Lands as `warn` per FR-33 rollout; flips to `error` after the warn-period sweep.
  // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-33] [DES-VARS]
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "**/dist/**",
      "**/out/**",
      "packages/ui/src/components/**",
      "packages/ui/src/hooks/**",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/__fixtures__/**",
      "**/__mocks__/**",
      "scripts/conventions/**",
      "**/vitest.config.*",
      "**/vitest.setup.*",
      "**/vitest.workspace.*",
      "**/vite.config.*",
      "**/playwright.config.*",
    ],
    rules: {
      "@typescript-eslint/naming-convention": [
        "warn",
        // Module-level non-function consts → UPPER_CASE.
        {
          selector: "variable",
          modifiers: ["const", "global"],
          types: ["boolean", "string", "number", "array"],
          format: ["UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        // Module-level consts bound to a function (anonymous arrow / function expression) → camelCase.
        {
          selector: "variable",
          modifiers: ["const", "global"],
          types: ["function"],
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allow",
        },
        // Anything else local: camelCase or PascalCase.
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        // Type-likes stay PascalCase.
        { selector: "typeLike", format: ["PascalCase"] },
      ],
    },
  },

  // Vitest plugin — guards against committed `.only` / `.skip` / no-assertion tests.
  // Excludes apps/vscode-e2e (uses Mocha + node:assert, not Vitest).
  // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-12] [DES-LINT]
  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    ignores: ["apps/vscode-e2e/**", "apps/chat/e2e/**", "apps/workbench/e2e/**"],
    plugins: { vitest: vitestPlugin },
    rules: {
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "error",
      "vitest/expect-expect": "error",
    },
  },

  // Type-aware rules: relax common noise in test/fixture code.
  // Test doubles and mocks legitimately produce `any` shapes and async funcs
  // without awaits — keeping these as errors creates churn without finding bugs.
  {
    files: ["**/*.test.{ts,tsx}", "**/__fixtures__/**", "**/e2e/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },

  // Allow `_`-prefixed unused args/vars (test helpers, intentionally-unused mock params)
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },

  // Node scripts (build/maintenance) — allow node globals + relax browser checks
  {
    files: ["scripts/**/*.{js,mjs,cjs}", "apps/*/scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
  },

  // Playwright/page.evaluate scripts also use browser globals (document, window).
  {
    files: ["apps/*/scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        document: "readonly",
        window: "readonly",
      },
    },
  },

  // React rules for webview apps
  {
    files: [
      "apps/chat/**/*.{ts,tsx}",
      "apps/workbench/**/*.{ts,tsx}",
      "packages/ui/**/*.{ts,tsx}",
      "packages/transport/**/*.{ts,tsx}",
    ],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // React 17+ new JSX transform
      "react/prop-types": "off", // TypeScript covers this
    },
    settings: {
      react: { version: "detect" },
    },
  },

  // Unicorn — filename kebab-case (C-4) across all source files
  {
    plugins: { unicorn: unicornPlugin },
    rules: {
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
          ignore: [
            // Repo-level UPPER_SNAKE / standard files (C-4 allowlist)
            "README\\.md",
            "CLAUDE\\.md",
            "AGENTS\\.md",
            "GEMINI\\.md",
            "CONTRIBUTING\\.md",
            "SECURITY\\.md",
            "CODEOWNERS",
            "LICENSE",
            "CHANGELOG\\.md",
          ],
        },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  // Architecture-boundary lint
  // Each block forbids imports that violate AGENTS.md "Architecture boundaries".
  // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-4] [DES-LINT]
  // ────────────────────────────────────────────────────────────────────────

  // apps/vscode — extension host: no React, no webview-only packages, no agent adapters.
  // (apps/vscode/src/agent-factory.ts is the ONE file allowed to import the adapter — see exception below.)
  {
    files: ["apps/vscode/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "apps/vscode is the extension host; no React in the host process.",
            },
            { name: "react-dom" },
          ],
          patterns: [
            {
              group: ["@afx/ui", "@afx/ui/*", "@afx/transport", "@afx/transport/*"],
              message: "apps/vscode is the extension host — webview-only packages forbidden.",
            },
            {
              group: ["@afx/agent-*"],
              message:
                "Use AgentManager from @afx/shared; do not import adapters directly. Only apps/vscode/src/agent-factory.ts may import @afx/agent-*.",
            },
          ],
        },
      ],
    },
  },
  // Exception: agent-factory.ts is the single seam where the adapter is selected.
  {
    files: ["apps/vscode/src/agent-factory.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  // apps/chat & apps/workbench — webviews: no extension host API, no agent adapters, no Node FS/process.
  // Scoped to `src/**` only — package-root config files (vite/playwright/vitest configs) run in Node and are exempt.
  // Test files are exempt because architectural-guard tests legitimately need node:fs/node:path to walk the source tree.
  {
    files: ["apps/chat/src/**/*.{ts,tsx}", "apps/workbench/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/__tests__/**", "**/__fixtures__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "vscode", message: "Webviews cannot import the vscode extension host API." },
          ],
          patterns: [
            {
              group: ["@afx/agent-*", "@earendil-works/*"],
              message: "Webviews must not import agent adapters; route through @afx/transport.",
            },
            {
              group: [
                "node:child_process",
                "node:fs",
                "node:fs/*",
                "node:path",
                "child_process",
                "fs",
                "fs/promises",
              ],
              message: "Webviews run in a sandboxed iframe — no Node FS/process/path access.",
            },
          ],
        },
      ],
    },
  },

  // packages/agent/** — Node-only adapters: no vscode, no React.
  {
    files: ["packages/agent/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "vscode",
              message: "Agent adapters must not import vscode; config is injected.",
            },
            { name: "react", message: "Agent adapters are Node-only; no React." },
            { name: "react-dom" },
          ],
        },
      ],
    },
  },

  // packages/{shared,parsers} — pure: no vscode, no React.
  {
    files: ["packages/shared/**/*.{ts,tsx}", "packages/parsers/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "vscode" }, { name: "react" }, { name: "react-dom" }],
        },
      ],
    },
  },

  // process.env access restriction — bootstrap files only.
  // Forces the rest of the codebase to receive config via factory parameters.
  // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-23] [DES-LINT]
  // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [DES-SHADCN] (shadcn ignores)
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "apps/vscode/src/extension.ts",
      "apps/vscode/src/agent-factory.ts",
      "packages/agent/pi-sdk/bootstrap/**",
      "scripts/**",
      "**/vitest.config.*",
      "**/vitest.setup.ts",
      "**/vite.config.*",
      "**/playwright.config.*",
      "**/.vscode-test.mjs",
      "**/*.test.{ts,tsx}",
      // Shadcn-generated — see docs/specs/430-dx-enforcement/430-dx-enforcement.md [DES-SHADCN]
      "packages/ui/src/components/**",
      "packages/ui/src/hooks/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            "Direct process.env access is restricted. Inject config via factory parameters. See docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-23].",
        },
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Direct process.env access is restricted. Inject config via factory parameters. See docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-23].",
        },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  // Folder + filename naming (lowercase kebab-case + e2e suffix mapping)
  // KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/ — lowercase, hyphenated, any length.
  // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5] [FR-7] [DES-NAMING]
  // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [DES-SHADCN] (shadcn ignores)
  // ────────────────────────────────────────────────────────────────────────
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    ignores: [
      // Shadcn-generated — see docs/specs/430-dx-enforcement/430-dx-enforcement.md [DES-SHADCN]
      "packages/ui/src/components/**",
      "packages/ui/src/hooks/**",
      // Managed/tool/dotfile dirs (already kebab where applicable; some are vendor-named)
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.vscode-test/**",
      "**/.husky/**",
      "**/.github/**",
      "**/.vscode/**",
      "**/.afx/**",
      "**/.claude/**",
      "**/.agents/**",
      // Double-underscore conventions (test fixtures, mocks, snapshots)
      "**/__fixtures__/**",
      "**/__mocks__/**",
      "**/__snapshots__/**",
    ],
    plugins: { "check-file": checkFilePlugin },
    rules: {
      "check-file/folder-naming-convention": [
        "error",
        {
          // Every folder under linted globs must be lowercase kebab-case.
          "**/*": "KEBAB_CASE",
        },
      ],
      // Filename basename casing is enforced by `unicorn/filename-case` (see block above).
      // The `.spec.ts` vs `.test.ts` directory placement is enforced by the naming-guard
      // test at `scripts/conventions/test-naming-and-folders.test.ts` — covers what
      // `check-file/filename-naming-convention` requires placeholders for, more clearly.
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  // Application-code security (Phases 6 + 8)
  // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-15] [FR-21] [DES-APPSEC]
  // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [DES-SHADCN] (shadcn ignores)
  // ────────────────────────────────────────────────────────────────────────

  // eslint-plugin-no-secrets — entropy-based secret detection (FR-15).
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    ignores: [
      "**/__fixtures__/**",
      "**/__mocks__/**",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "packages/ui/src/components/**", // shadcn-generated (DES-SHADCN)
      "packages/ui/src/hooks/**",
    ],
    plugins: { "no-secrets": noSecretsPlugin },
    rules: {
      "no-secrets/no-secrets": [
        "error",
        {
          tolerance: 4.5,
          ignoreContent: [
            "sk-test-",
            "<token>",
            // CSP nonce charset (deliberate constant used by webview-html.ts to generate nonces).
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
          ],
        },
      ],
    },
  },

  // eslint-plugin-security — heuristic security rules.
  // High-value rules at `error`; known-noisy false-positive rules at `off`
  // (per FR-21 warn-then-error: keeping useful signal, dropping noise).
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    ignores: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "packages/ui/src/components/**", // shadcn-generated (DES-SHADCN)
      "packages/ui/src/hooks/**",
      "scripts/**", // build scripts have legitimate fs/regex patterns
    ],
    plugins: { security: securityPlugin },
    rules: {
      // High-value rules — actual security risks.
      "security/detect-eval-with-expression": "error",
      "security/detect-non-literal-require": "error",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-bidi-characters": "error",
      "security/detect-buffer-noassert": "error",
      // Heuristic rules with high false-positive rates in legitimate Node code — disabled.
      // Re-evaluate per rule in a follow-up PR if a real incident motivates it.
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-regexp": "off",
      "security/detect-object-injection": "off",
      "security/detect-unsafe-regex": "off",
      "security/detect-possible-timing-attacks": "off",
      "security/detect-no-csrf-before-method-override": "off",
      "security/detect-disable-mustache-escape": "off",
      "security/detect-child-process": "off", // we legitimately spawn pi via @afx/agent-pi
      "security/detect-new-buffer": "error",
    },
  },

  // eslint-plugin-no-unsanitized — webview XSS prevention (FR-21).
  // Risk for shadcn dirs is ACCEPTED with CSP (FR-22) as the offsetting control.
  {
    files: ["apps/chat/**/*.{ts,tsx}", "apps/workbench/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    ignores: [
      "packages/ui/src/components/**", // shadcn-generated (DES-SHADCN); CSP is the offsetting control
      "packages/ui/src/hooks/**",
    ],
    plugins: { "no-unsanitized": noUnsanitizedPlugin },
    rules: {
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
    },
  },

  // Prettier compat — disables rules that Prettier manages
  prettierConfig,
);
