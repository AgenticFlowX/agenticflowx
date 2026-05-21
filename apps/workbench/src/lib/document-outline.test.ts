/**
 * Workbench document outline tests.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-6] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-READER] [DES-DOCS-HELPERS] [DES-TEST]
 */
import { describe, expect, it } from "vitest";

import { extractOutline } from "./document-outline";

describe("extractOutline", () => {
  it("cleans trace IDs from headings and ignores fenced headings", () => {
    const outline = extractOutline(`# [DES-OVR] Overview

\`\`\`md
## [FR-1] Not visible
\`\`\`

## [FR-2] Requirements
### [DES-API] API Contracts
`);

    expect(outline.map((item) => item.text)).toEqual(["Overview", "Requirements", "API Contracts"]);
    expect(outline.map((item) => item.slug)).toEqual(["overview", "requirements", "api-contracts"]);
  });
});
