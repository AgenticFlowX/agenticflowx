---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-05-04T08:25:51.000Z"
updated_at: "2026-05-05T07:29:30.000Z"
tags: ["app", "chat", "messages", "streaming", "journal"]
---

# Journal - App Chat Messages

<!-- prefix: CM -->

> Quick captures and discussion history for AI-assisted development sessions.

## Captures

<!-- Quick notes during active chat - cleared when recorded -->

- `2026-05-04T08:25:51.000Z` `/afx-dev debug`: production timeline bug where empty assistant placeholders rendered as repeated blank `AFX` rows while the runtime was thinking. Fixed timeline flattening to suppress assistant rows with no visible content and render one expandable `Working` thinking row with the live reasoning preview instead. Added regression coverage in `apps/chat/src/app.test.tsx`. `[FR-1] [FR-2] [DES-MESSAGES-MOCKUP-THINKING] [DES-MESSAGES-COMPONENT-TIMELINE]`
- `2026-05-04T08:49:39.000Z` `/afx-dev debug`: follow-up UX issue where the timeline `Working` row duplicated the composer activity strip. Reverted message timeline thinking rendering: thinking/working state stays only in the composer activity strip, while the timeline suppresses empty assistant placeholders and remains clean until real assistant text/tool/system content appears. Updated regression coverage accordingly. `[FR-1] [FR-2] [DES-MESSAGES-MOCKUP-THINKING] [DES-MESSAGES-COMPONENT-TIMELINE]`
- `2026-05-05T07:29:30.000Z` `/afx-dev debug`: P0 ordering bug where tool table rows (`READ`/`OUT`) sorted to the top of the transcript because tool timeline events used time `0`. Fixed tool events to inherit their parent assistant timestamp so sorting keeps them below the triggering user/parent message instead of inserting at the top of chat history. Added regression coverage for DOM order. `[FR-1] [FR-4] [DES-MESSAGES-COMPONENT-TIMELINE] [DES-MESSAGES-COMPONENT-TOOL-EVENT]`

---

## Discussions

<!-- Recorded discussions with IDs: CM-D001, CM-D002, etc. -->

---

## Prompt Captures

<!-- Verbatim user prompts + agent reply excerpts at pivotal moments. -->
