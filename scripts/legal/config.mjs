/**
 * Legal inventory policy for the extension artifact.
 *
 * Bundle groups are required: a legal check against an unbuilt checkout must
 * fail instead of silently producing an incomplete notice. Copied assets are
 * listed separately because source maps cannot account for fonts and vendored
 * runtime files.
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-18] [DES-SUPPLY]
 */

export const allowedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "CC-BY-4.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "OFL-1.1",
  "Python-2.0",
  "Unlicense",
]);

export const bundleGroups = [
  {
    label: "VS Code extension host",
    files: ["apps/vscode/out/extension.js.map"],
  },
  {
    label: "Pi SDK bootstrap and providers",
    files: [
      "packages/agent/pi-sdk/dist/bootstrap.js.map",
      "packages/agent/pi-sdk/dist/api/bedrock-converse-stream.js.map",
    ],
  },
  {
    label: "Chat webview",
    directory: "apps/chat/dist",
    suffix: ".map",
  },
  {
    label: "Workbench webview",
    directory: "apps/workbench/dist",
    suffix: ".map",
  },
];

export const copiedAssets = [
  {
    label: "JetBrains Mono webfonts in Chat",
    directory: "apps/chat/dist/assets",
    namePattern: /^jetbrains-mono-.*\.woff2$/,
    packageJson: "packages/ui/node_modules/@fontsource-variable/jetbrains-mono/package.json",
  },
  {
    label: "JetBrains Mono webfonts in Workbench",
    directory: "apps/workbench/dist/assets",
    namePattern: /^jetbrains-mono-.*\.woff2$/,
    packageJson: "packages/ui/node_modules/@fontsource-variable/jetbrains-mono/package.json",
  },
  {
    label: "Pi export templates",
    files: [
      "packages/agent/pi-sdk/dist/core/export-html/template.css",
      "packages/agent/pi-sdk/dist/core/export-html/template.html",
      "packages/agent/pi-sdk/dist/core/export-html/template.js",
    ],
    packageJson: "packages/agent/pi-sdk/node_modules/@earendil-works/pi-coding-agent/package.json",
  },
  {
    label: "Pi interactive themes and assets",
    directory: "packages/agent/pi-sdk/dist/modes",
    packageJson: "packages/agent/pi-sdk/node_modules/@earendil-works/pi-coding-agent/package.json",
  },
  {
    label: "Marked export runtime",
    files: ["packages/agent/pi-sdk/dist/core/export-html/vendor/marked.min.js"],
    component: {
      name: "marked",
      version: "18.0.5",
      license: "MIT",
      repository: "https://github.com/markedjs/marked",
      licenseFiles: ["scripts/legal/licenses/marked-mit.txt"],
      reason:
        "Pi ships Marked as a prebuilt browser runtime rather than an installed runtime package.",
    },
    versionPattern: /marked v(?<version>\d+\.\d+\.\d+)/,
  },
  {
    label: "Highlight.js export runtime",
    files: ["packages/agent/pi-sdk/dist/core/export-html/vendor/highlight.min.js"],
    component: {
      name: "highlight.js",
      version: "11.9.0",
      license: "BSD-3-Clause",
      repository: "https://github.com/highlightjs/highlight.js",
      licenseFiles: ["scripts/legal/licenses/highlight-js-bsd-3.txt"],
      reason:
        "Pi ships a prebuilt Highlight.js 11.9.0 browser runtime whose version differs from its Node dependency.",
    },
    versionPattern: /Highlight\.js v(?<version>\d+\.\d+\.\d+)/,
  },
];

/**
 * Exact, version-bound evidence used only when published npm artifacts omit a
 * LICENSE file. A package upgrade intentionally makes the legal check fail
 * until this audit is reviewed and updated.
 */
export const auditedOverrides = [
  ...[
    "@earendil-works/pi-agent-core",
    "@earendil-works/pi-ai",
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-tui",
  ].map((name) => ({
    name,
    version: "0.82.0",
    license: "MIT",
    repository: "https://github.com/earendil-works/pi",
    licenseFiles: ["scripts/legal/licenses/pi-mit.txt"],
    reason:
      "The Pi npm package declares MIT but omits the monorepo root LICENSE from the published package.",
    source: "https://github.com/earendil-works/pi/blob/v0.82.0/LICENSE",
  })),
  ...[
    ["@aws-sdk/credential-provider-http", "3.972.46"],
    ["@aws-sdk/credential-provider-login", "3.972.49"],
    ["@aws-sdk/nested-clients", "3.997.17"],
  ].map(([name, version]) => ({
    name,
    version,
    license: "Apache-2.0",
    repository: "https://github.com/aws/aws-sdk-js-v3",
    licenseFiles: ["node_modules/.pnpm/@aws-sdk+core@3.974.18/node_modules/@aws-sdk/core/LICENSE"],
    reason:
      "This internal AWS SDK package declares Apache-2.0 but omits the monorepo root LICENSE from its npm artifact.",
    source: "https://github.com/aws/aws-sdk-js-v3/blob/v3.974.0/LICENSE",
  })),
  {
    name: "data-uri-to-buffer",
    version: "4.0.1",
    license: "MIT",
    repository: "https://github.com/TooTallNate/node-data-uri-to-buffer",
    packageLicenseSections: [{ file: "README.md", start: "(The MIT License)", end: "\n[rfc]:" }],
    reason:
      "The npm artifact carries its exact MIT license in README.md rather than a LICENSE file.",
    source: "https://github.com/TooTallNate/node-data-uri-to-buffer/blob/v4.0.1/README.md#license",
  },
  {
    name: "react-remove-scroll-bar",
    version: "2.3.8",
    license: "MIT",
    repository: "https://github.com/theKashey/react-remove-scroll-bar",
    licenseFiles: ["scripts/legal/licenses/react-remove-scroll-bar-mit.txt"],
    reason:
      "The npm artifact declares MIT but includes only a short README marker; the audited fallback is the upstream repository MIT file added after this release.",
    source:
      "https://github.com/theKashey/react-remove-scroll-bar/blob/7301c160fda44cb8cf2b9fdfde61efad35736196/LICENSE",
  },
  {
    name: "@radix-ui/react-compose-refs",
    version: "1.1.2",
    license: "MIT",
    repository: "https://github.com/radix-ui/primitives",
    licenseFiles: ["scripts/legal/licenses/radix-ui-react-compose-refs-mit.txt"],
    reason:
      "The npm artifact for this exact Radix UI version omits its MIT LICENSE file; the audited license text is preserved locally.",
    source: "https://github.com/radix-ui/primitives/blob/main/LICENSE",
  },
  ...[
    ["@radix-ui/react-context", "1.1.2"],
    ["@radix-ui/react-id", "1.1.1"],
    ["@radix-ui/react-use-callback-ref", "1.1.1"],
    ["@radix-ui/react-use-escape-keydown", "1.1.1"],
    ["@radix-ui/react-use-layout-effect", "1.1.1"],
  ].map(([name, version]) => ({
    name,
    version,
    license: "MIT",
    repository: "https://github.com/radix-ui/primitives",
    licenseFiles: ["scripts/legal/licenses/radix-ui-react-compose-refs-mit.txt"],
    reason:
      "The npm artifact for this exact Radix UI version omits its MIT LICENSE file; the audited license text is preserved locally.",
    source: "https://github.com/radix-ui/primitives/blob/main/LICENSE",
  })),
];

export const projectAcknowledgments = [
  {
    title: "Pi",
    packagePrefixes: ["@earendil-works/pi-"],
    text: "Agent runtime and coding-agent SDK by Mario Zechner and Pi contributors.",
    url: "https://github.com/earendil-works/pi",
  },
  {
    title: "React Flow",
    packageNames: ["@xyflow/react", "reactflow"],
    text: "Node-based canvas interaction and rendering by the React Flow contributors.",
    url: "https://reactflow.dev/",
  },
  {
    title: "dnd kit",
    packagePrefixes: ["@dnd-kit/"],
    text: "Accessible drag-and-drop primitives by the dnd kit contributors.",
    url: "https://dndkit.com/",
  },
  {
    title: "JetBrains Mono",
    packageNames: ["@fontsource-variable/jetbrains-mono"],
    text: "JetBrains Mono font software by the JetBrains Mono Project Authors.",
    url: "https://www.jetbrains.com/lp/mono/",
  },
  {
    title: "Lucide and Feather",
    packageNames: ["lucide", "lucide-react"],
    text: "Icons by the Lucide contributors, including icons derived from Feather by Cole Bemis.",
    url: "https://lucide.dev/",
  },
];

export const standardsAcknowledgments = [
  {
    title: "JSON Canvas",
    text: "AFX reads and writes the open JSON Canvas file format; no JSON Canvas runtime is bundled.",
    url: "https://jsoncanvas.org/",
  },
];
