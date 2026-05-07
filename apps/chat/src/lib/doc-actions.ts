/**
 * Doc-action routing for the Spec mode composer strip and welcome card.
 *
 * Maps an active AFX document (sprint single-file or standard 4-file plus
 * journal/ADR/research/context) to a 3-action SDD intent set. Pure function —
 * no React, no transport, easy to unit-test.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-12]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */

export type ActiveDocCtx = {
  format: "sprint" | "standard" | null;
  section: "SPEC" | "DESIGN" | "TASKS" | null;
  docKind: "spec" | "design" | "tasks" | "journal" | "adr" | "research" | "context" | null;
  feature: string | null;
  approvalStatus: string | null;
};

export const EMPTY_DOC_CTX: ActiveDocCtx = {
  format: null,
  section: null,
  docKind: null,
  feature: null,
  approvalStatus: null,
};

export type DocAction = {
  label: string;
  command: string;
  /**
   * When true, clicking the button fires `chat/send` (or `chat/followUp` while
   * streaming) immediately. When false, the command is inserted into the
   * composer draft so the user can refine before sending. Auto-send is
   * reserved for deterministic verbs that don't need user-supplied content
   * (validate, approve, verify, pick, list, load, save, recap).
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
   */
  autoSend: boolean;
};

/**
 * Resolve up to 3 SDD intent actions for the active AFX doc. Sprint-section
 * docs route through `/afx-sprint`; standard 4-file specs route through their
 * canonical command family (`/afx-spec`, `/afx-design`, `/afx-task`). Other
 * AFX file types (journal, ADR, research, context) route to their own
 * command families.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 */
export function resolveDocActions(docContext: ActiveDocCtx): DocAction[] {
  const isSprint = docContext.format === "sprint";
  const featureArg = docContext.feature ? ` ${docContext.feature}` : "";

  switch (docContext.docKind) {
    case "spec":
      // Standard 4-file spec.md exposes the full Refine→Validate→Review→Approve
      // pipeline. Sprint sections collapse Validate+Review into a single
      // `verify` subcommand, so the sprint variant has 3 buttons instead of 4.
      return isSprint
        ? [
            {
              label: "Refine",
              command: `/afx-sprint spec${featureArg}`,
              autoSend: false,
            },
            {
              label: "Verify",
              command: `/afx-sprint verify${featureArg}`,
              autoSend: true,
            },
            {
              label: "Approve",
              command: `/afx-sprint spec${featureArg} --approve`,
              autoSend: true,
            },
          ]
        : [
            { label: "Refine", command: `/afx-spec refine${featureArg}`, autoSend: false },
            { label: "Validate", command: `/afx-spec validate${featureArg}`, autoSend: true },
            { label: "Review", command: `/afx-spec review${featureArg}`, autoSend: true },
            { label: "Approve", command: `/afx-spec approve${featureArg}`, autoSend: true },
          ];
    case "design":
      return isSprint
        ? [
            {
              label: "Refine",
              command: `/afx-sprint design${featureArg}`,
              autoSend: false,
            },
            {
              label: "Verify",
              command: `/afx-sprint verify${featureArg}`,
              autoSend: true,
            },
            {
              label: "Approve",
              command: `/afx-sprint design${featureArg} --approve`,
              autoSend: true,
            },
          ]
        : [
            { label: "Refine", command: `/afx-design refine${featureArg}`, autoSend: false },
            { label: "Validate", command: `/afx-design validate${featureArg}`, autoSend: true },
            { label: "Review", command: `/afx-design review${featureArg}`, autoSend: true },
            { label: "Approve", command: `/afx-design approve${featureArg}`, autoSend: true },
          ];
    case "tasks":
      return [
        { label: "Pick", command: `/afx-task pick${featureArg}`, autoSend: true },
        {
          label: "Code",
          command: isSprint ? `/afx-sprint code${featureArg}` : `/afx-task code${featureArg}`,
          autoSend: false,
        },
        {
          label: "Verify",
          command: isSprint ? `/afx-sprint verify${featureArg}` : `/afx-task verify${featureArg}`,
          autoSend: true,
        },
        { label: "Status", command: `/afx-task status${featureArg}`, autoSend: true },
      ];
    case "journal":
      // Note + Promote are dialogic (need body / discussion ID). Log saves the
      // current session deterministically; Recap synthesizes; Active lists
      // open discussions — all read/write but no extra user input needed.
      return [
        { label: "Note", command: `/afx-session note${featureArg}`, autoSend: false },
        { label: "Log", command: `/afx-session log${featureArg}`, autoSend: true },
        { label: "Recap", command: `/afx-session recap${featureArg}`, autoSend: true },
        { label: "Active", command: `/afx-session active${featureArg}`, autoSend: true },
        { label: "Promote", command: `/afx-session promote${featureArg}`, autoSend: false },
      ];
    case "adr":
      // Review + Supersede stay draft because we don't currently plumb the ADR
      // filename into the bridge payload — without an ID, the agent can't act.
      // List takes no args and runs deterministically.
      return [
        { label: "Review", command: `/afx-adr review${featureArg}`, autoSend: false },
        { label: "Supersede", command: `/afx-adr supersede${featureArg}`, autoSend: false },
        { label: "List", command: `/afx-adr list${featureArg}`, autoSend: true },
      ];
    case "research":
      // Research is inherently dialogic — every verb takes a topic. Subcommand
      // names here mirror the canonical /afx-research API (`explore`,
      // `compare`, `summarize`, `finalize`).
      return [
        { label: "Explore", command: `/afx-research explore${featureArg}`, autoSend: false },
        { label: "Compare", command: `/afx-research compare${featureArg}`, autoSend: false },
        {
          label: "Summarize",
          command: `/afx-research summarize${featureArg}`,
          autoSend: false,
        },
        { label: "Finalize", command: `/afx-research finalize${featureArg}`, autoSend: false },
      ];
    case "context":
      // `.afx/context.md` is the canonical agent-handoff bundle. Load reads the
      // bundle deterministically; Save regenerates from the current git/session
      // state; History shows spec-evolution timeline; Impact needs a free-text
      // change spec.
      return [
        { label: "Load", command: `/afx-context load`, autoSend: true },
        { label: "Save", command: `/afx-context save${featureArg}`, autoSend: true },
        { label: "History", command: `/afx-context history${featureArg}`, autoSend: true },
        { label: "Impact", command: `/afx-context impact`, autoSend: false },
      ];
    case null:
    default:
      return [];
  }
}

/**
 * Friendly label for the active AFX doc — used as the strip title and in the
 * mode-suggest hint.
 *
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export function describeDoc(docContext: ActiveDocCtx): string {
  switch (docContext.docKind) {
    case "spec":
      return "spec.md";
    case "design":
      return "design.md";
    case "tasks":
      return "tasks.md";
    case "journal":
      return "journal.md";
    case "adr":
      return "ADR";
    case "research":
      return "research note";
    case "context":
      return ".afx/context.md";
    case null:
    default:
      return docContext.format === "sprint" ? `${docContext.feature ?? "sprint"}.md` : "AFX doc";
  }
}
