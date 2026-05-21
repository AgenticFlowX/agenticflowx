/**
 * ChatWindow — composition root for the chat tab.
 *
 * Owns ONLY composer-local UI state (slash/mention popovers, prompt-history
 * cursor, textarea/scroll/composer DOM refs, the textarea KeyboardEvent
 * routing) plus the JSX composition. All cross-region state, bridge handlers,
 * action callbacks, derived flags, region slices, and the composer panel-stack
 * configuration live in `chat-controller.tsx`.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-ARCH] [DES-UI] [DES-STATE] [DES-API] [DES-DATA]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-2] [FR-10] [FR-11]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-MOCKUP-IDLE] [DES-COMPOSER-MOCKUP-RUNTIME-MENU] [DES-COMPOSER-MOCKUP-STREAMING] [DES-COMPOSER-MOCKUP-COMPACTING] [DES-COMPOSER-MOCKUP-MODE-COLLAPSED] [DES-COMPOSER-MOCKUP-MODE-DROPDOWN] [DES-COMPOSER-MOCKUP-BLOCKED-COMMAND] [DES-COMPOSER-FLOW] [DES-COMPOSER-CONTEXT] [DES-COMPOSER-RUNTIME] [DES-COMPOSER-KEYS]
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-2] [FR-8]
 */
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AgentRuntimeStatus } from "@afx/shared";

import type { ComposerTrigger } from "../../lib/composer-detect";
import { detectComposerTrigger } from "../../lib/composer-detect";
import type { AgentRecoveryActions } from "../agent-recovery-card";
import { MentionPopup } from "../mention-popup";
import { SlashPopup } from "../slash-popup";
import {
  type ComposerLocalCallbacks,
  collectPromptHistory,
  createChatUid,
  useChatController,
  useStableCallback,
} from "./chat-controller";
import { ChatTopBar } from "./chat-top-bar";
import type { ChatWindowFlags } from "./chat.types";
import { ComposerActions } from "./composer-actions";
import { ComposerActivityBar } from "./composer-activity-bar";
import { ComposerAttachmentTray } from "./composer-attachment-tray";
import { ComposerDock } from "./composer-dock";
import { ComposerFooter } from "./composer-footer";
import { ComposerInput, getComposerPlaceholder } from "./composer-input";
import { ComposerPanelStack } from "./composer-panel-stack";
import { ComposerToolbar } from "./composer-toolbar";
import {
  AgentSetupState,
  EmptyState,
  SpecModeWelcome,
  WelcomeShell,
} from "./conversation-empty-states";
import { ConversationPane } from "./conversation-pane";
import { ConversationTimeline } from "./conversation-timeline";

const COMPOSER_FOOTER_HINT_ID = "afx-chat-composer-hint";

function shouldReplaceDraftWithCommand(command: string): boolean {
  return /^\/afx-[\w-]+(?:\s|$)/.test(command.trim());
}

function formatDraftCommandForComposer(value: string): string {
  const trimmed = value.trim();
  return shouldReplaceDraftWithCommand(trimmed) ? `${trimmed} ` : value;
}

/**
 * Props for the Chat root component.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-2] [FR-10] [FR-11] [FR-12] [FR-13]
 */
export interface ChatProps {
  agentStatus?: AgentRuntimeStatus;
  recoveryActions?: AgentRecoveryActions;
  insertCommand?: string | null;
  isCheckingAgent?: boolean;
  onCommandInserted?: () => void;
  onOpenSettings?: () => void;
  /** Draft text — managed by the parent (App) so it persists across tab switches. */
  draft: string;
  /** Update the draft. Accepts a string or a functional updater (like React setState). */
  onDraftChange: (value: string | ((prev: string) => string)) => void;
  /** Recently submitted prompts, owned by App so model/runtime switches do not reset recall. */
  promptHistory: readonly string[];
  /** Records a submitted prompt for ArrowUp/ArrowDown composer recall. */
  onPromptHistoryAppend: (prompt: string) => void;
}

export interface ChatWindowProps extends ChatProps {
  flags?: Partial<ChatWindowFlags>;
}

export function ChatWindow({
  agentStatus: externalAgentStatus,
  recoveryActions,
  insertCommand,
  isCheckingAgent = false,
  onCommandInserted,
  onOpenSettings,
  draft,
  onDraftChange,
  promptHistory,
  onPromptHistoryAppend,
  flags,
}: ChatWindowProps) {
  // Composer-local state stays here; shared or bridge-sourced state lives in
  // chat-controller.
  // @see docs/specs/216-app-chat-window-componentization/design.md [DES-STATE]
  const [slashOpen, setSlashOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<ComposerTrigger | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // DOM refs for scroll pinning, composer focus, inserted-command dedupe, and
  // prompt-history recall.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  // Prevents double-inserting the same command (handles React 18 StrictMode double-effect).
  const insertedCommandRef = useRef<string | null>(null);
  const historyCursorRef = useRef<number | null>(null);
  const draftBeforeHistoryRef = useRef("");

  // Built before useChatController so controller actions can call back into
  // composer-local focus, draft, popover, and scroll behavior.
  const getTextarea = useCallback(() => composerRef.current?.querySelector("textarea") ?? null, []);
  const focusComposer = useCallback(() => {
    const focusAtEnd = () => {
      const input = getTextarea();
      if (!input) return;
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    };
    window.requestAnimationFrame(focusAtEnd);
    window.setTimeout(focusAtEnd, 0);
  }, [getTextarea]);
  const closePopovers = useCallback(() => {
    setSlashOpen(false);
    setMentionOpen(false);
    setActiveTrigger(null);
  }, []);
  const clearDraft = useCallback(() => onDraftChange(""), [onDraftChange]);
  const setDraftDirect = useCallback(
    (value: string) => {
      onDraftChange(formatDraftCommandForComposer(value));
      focusComposer();
    },
    [focusComposer, onDraftChange],
  );
  const resetScroll = useCallback(() => setUserScrolledUp(false), []);
  const resetPromptHistoryCursor = useCallback(() => {
    historyCursorRef.current = null;
    draftBeforeHistoryRef.current = "";
  }, []);

  /** Composer-local callbacks bundle. Passed into the controller for panel actions. */
  const composerLocal = useMemo<ComposerLocalCallbacks>(
    () => ({
      clearDraft,
      setDraft: setDraftDirect,
      closePopovers,
      focusComposer,
      resetScroll,
      resetPromptHistoryCursor,
    }),
    [
      clearDraft,
      closePopovers,
      focusComposer,
      resetPromptHistoryCursor,
      resetScroll,
      setDraftDirect,
    ],
  );

  const controller = useChatController({
    flags,
    externalAgentStatus,
    recoveryActions,
    isCheckingAgent,
    onPromptHistoryAppend,
    composerLocal,
  });
  const { flags: chatWindowFlags, slices, actions, derived, state } = controller;

  // Composer-local derived flags. `isSystemCommand` (draft starts with `!`)
  // and `canSend`/`isComposerDisabled` depend on the current draft string,
  // which is composer-local, so they're computed here rather than in the
  // controller. The placeholder text is derived for the same reason.
  const isSystemCommand = draft.startsWith("!");
  const isComposerDisabled =
    isCheckingAgent || derived.isCompacting || (!isSystemCommand && derived.runtimeUnavailable);
  const hasDraft = draft.trim().length > 0;
  const canSend = hasDraft && !isComposerDisabled;
  const composerPlaceholder = getComposerPlaceholder({
    isCheckingAgent,
    runtimeUnconfigured: derived.runtimeUnconfigured,
    rpcEnabled: derived.rpcEnabled,
    runtimeUnavailable: derived.runtimeUnavailable,
    isCompacting: derived.isCompacting,
    isStreaming: derived.isStreaming,
    workspaceMode: state.workspaceMode,
  });

  // Scroll behavior — the pane auto-pins to the bottom whenever new messages
  // arrive UNLESS the user has scrolled up. `handleScroll` flips
  // `userScrolledUp` to true the moment they're not at the bottom (with an 80px
  // tolerance); clicking the scroll-to-latest button or sending a new message
  // flips it back to false.
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setUserScrolledUp(!atBottom);
  }, []);
  useEffect(() => {
    if (!userScrolledUp) scrollToBottom("instant");
  }, [state.messages, userScrolledUp, scrollToBottom]);

  // Focus management — when the agent transitions out of streaming/checking
  // and no element inside the composer is focused, snap focus back to the
  // textarea so the user can keep typing without clicking.
  useEffect(() => {
    if (!isCheckingAgent && !derived.isStreaming) {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body || composerRef.current?.contains(active)) {
        getTextarea()?.focus();
      }
    }
  }, [derived.isStreaming, getTextarea, isCheckingAgent]);

  // Command-insertion from the sidebar — App passes `insertCommand` to forward
  // a slash command from the History/Settings sidebar into the composer draft.
  // The ref-guarded queueMicrotask defends against React 18 StrictMode's
  // double-invocation of effects (otherwise we'd insert the same command twice
  // on every dev-mode mount).
  useEffect(() => {
    if (!insertCommand) {
      insertedCommandRef.current = null;
      return;
    }
    if (insertedCommandRef.current === insertCommand) return;
    insertedCommandRef.current = insertCommand;
    queueMicrotask(() => {
      onDraftChange((prev) =>
        shouldReplaceDraftWithCommand(insertCommand)
          ? `${insertCommand} `
          : prev.trim().length > 0
            ? `${prev.trimEnd()} ${insertCommand} `
            : `${insertCommand} `,
      );
      closePopovers();
      focusComposer();
      onCommandInserted?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDraftChange is stable (useCallback in App).
  }, [insertCommand, onCommandInserted, closePopovers, focusComposer]);

  // Composer event handlers and action wrappers. Every handler that gets
  // passed to a memoized child uses `useStableCallback` so its identity stays
  // stable across draft/state changes — this is what keeps ChatTopBar,
  // ComposerFooter, ComposerActions, and ConversationTimeline from
  // re-rendering on each keystroke.
  //
  // @see docs/specs/216-app-chat-window-componentization/design.md [DES-PERF]
  const handleDraftChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.currentTarget.value;
      const caret = e.currentTarget.selectionStart ?? next.length;
      historyCursorRef.current = null;
      draftBeforeHistoryRef.current = "";
      onDraftChange(next);
      const trigger = detectComposerTrigger(next, caret);
      setActiveTrigger(trigger);
      setSlashOpen(trigger?.kind === "slash");
      setMentionOpen(trigger?.kind === "mention");
      if (trigger?.kind === "mention") {
        controller.bridge.send({ type: "chat/listFiles", requestId: createChatUid(), limit: 200 });
      }
    },
    [controller.bridge, onDraftChange],
  );

  const applyHistoryDraft = useCallback(
    (value: string) => {
      onDraftChange(value);
      window.requestAnimationFrame(() => {
        const input = getTextarea();
        const end = value.length;
        input?.focus();
        input?.setSelectionRange(end, end);
      });
    },
    [getTextarea, onDraftChange],
  );

  const navigatePromptHistory = useCallback(
    (textarea: HTMLTextAreaElement, direction: "previous" | "next"): boolean => {
      const history = collectPromptHistory(state.messages, promptHistory);
      if (history.length === 0) return false;
      const selectionStart = textarea.selectionStart ?? draft.length;
      const selectionEnd = textarea.selectionEnd ?? draft.length;
      if (direction === "previous") {
        const current = historyCursorRef.current;
        if (current === null && (selectionStart !== 0 || selectionEnd !== 0)) return false;
        if (current === null) {
          draftBeforeHistoryRef.current = draft;
          historyCursorRef.current = history.length - 1;
        } else {
          historyCursorRef.current = Math.max(0, current - 1);
        }
        applyHistoryDraft(history[historyCursorRef.current] ?? "");
        return true;
      }
      if (historyCursorRef.current === null) return false;
      if (selectionStart !== draft.length || selectionEnd !== draft.length) return false;
      if (historyCursorRef.current < history.length - 1) {
        historyCursorRef.current += 1;
        applyHistoryDraft(history[historyCursorRef.current] ?? "");
        return true;
      }
      historyCursorRef.current = null;
      applyHistoryDraft(draftBeforeHistoryRef.current);
      draftBeforeHistoryRef.current = "";
      return true;
    },
    [applyHistoryDraft, draft, promptHistory, state.messages],
  );

  // Stable handlers — close over `draft` and `composerLocal` via a ref, so
  // memoized children (ComposerActions etc.) don't rerender when draft changes.
  const handleSubmit = useStableCallback((followUp?: boolean) => {
    actions.submit({ draft, followUp, composer: composerLocal });
  });
  const handleSend = useStableCallback(() => handleSubmit());
  const handleQueueFollowUp = useStableCallback(() => handleSubmit(true));
  const handleSteer = useStableCallback(() => handleSubmit(false));

  const handleSaveAsNote = useStableCallback(() => {
    actions.saveAsNote({ draft, composer: composerLocal });
  });

  const handleSendCommand = useStableCallback((text: string) =>
    actions.sendNow(text, composerLocal),
  );
  const handleAutoSendWelcome = useStableCallback((text: string) =>
    actions.sendNow(text, composerLocal),
  );
  const handleSwitchToSpec = useStableCallback(() => actions.setMode("spec"));
  const handleScrollToLatest = useStableCallback(() => {
    setUserScrolledUp(false);
    scrollToBottom("smooth");
  });

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (slashOpen || mentionOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          closePopovers();
          return;
        }
        if (e.key === "Tab" && slashOpen) {
          const firstItem = document.querySelector<HTMLElement>("[cmdk-item]");
          if (firstItem) {
            e.preventDefault();
            firstItem.focus();
            return;
          }
        }
        if (
          e.key === "ArrowDown" ||
          e.key === "ArrowUp" ||
          e.key === "Home" ||
          e.key === "End" ||
          (e.key === "Enter" && !e.shiftKey && !(e.metaKey || e.ctrlKey))
        ) {
          const root = document.querySelector("[cmdk-root]");
          if (root) {
            e.preventDefault();
            root.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: e.key,
                code: e.code,
                bubbles: true,
                cancelable: true,
              }),
            );
            return;
          }
        }
      }
      if (
        (e.key === "ArrowUp" || e.key === "ArrowDown") &&
        navigatePromptHistory(e.currentTarget, e.key === "ArrowUp" ? "previous" : "next")
      ) {
        e.preventDefault();
        return;
      }
      if (e.key === "Enter") {
        if (e.shiftKey && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          handleSaveAsNote();
          return;
        }
        if (e.shiftKey) return; // newline — let the textarea handle it
        e.preventDefault();
        const isInterrupt = e.metaKey || e.ctrlKey;
        handleSubmit(derived.isStreaming && !isInterrupt);
      }
    },
    [
      closePopovers,
      derived.isStreaming,
      handleSaveAsNote,
      handleSubmit,
      mentionOpen,
      navigatePromptHistory,
      slashOpen,
    ],
  );

  // Popover selection — when the user picks an item from the slash or mention
  // popover, replace the trigger prefix + query in the draft with the chosen
  // value. The caret is moved to just after the inserted value so the user
  // can keep typing immediately.
  //
  //   draft:  "hello /afx-ne|"          (caret at |)
  //   pick:   /afx-next
  //   result: "hello /afx-next |"       (caret moves to space)
  const insertAtTrigger = useCallback(
    (value: string) => {
      const textarea = getTextarea();
      const caret = textarea?.selectionStart ?? draft.length;
      const trigger = activeTrigger;
      const start = trigger?.start ?? caret;
      const replaceEnd = trigger ? start + 1 + trigger.query.length : caret;
      const next = `${draft.slice(0, start)}${value} ${draft.slice(replaceEnd)}`;
      onDraftChange(next);
      closePopovers();
      window.requestAnimationFrame(() => {
        const input = getTextarea();
        input?.focus();
        const nextCaret = start + value.length + 1;
        input?.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [activeTrigger, closePopovers, draft, getTextarea, onDraftChange],
  );

  const selectCommand = useCallback(
    (commandText: string) => insertAtTrigger(commandText),
    [insertAtTrigger],
  );
  const selectMention = useCallback(
    (filePath: string) => insertAtTrigger(`@${filePath}`),
    [insertAtTrigger],
  );
  const selectSlashAction = useCallback(
    (action: "chat/newSession" | "chat/abort") => {
      const trigger = activeTrigger;
      if (trigger) {
        const replaceEnd = trigger.start + 1 + trigger.query.length;
        onDraftChange((d) => `${d.slice(0, trigger.start)}${d.slice(replaceEnd)}`);
      }
      closePopovers();
      actions.dispatchSlashAction(action);
      focusComposer();
    },
    [actions, activeTrigger, closePopovers, focusComposer, onDraftChange],
  );

  const openMentionPicker = useCallback(() => {
    setActiveTrigger({ kind: "mention", start: draft.length, query: "" });
    setMentionOpen(true);
    setSlashOpen(false);
    controller.bridge.send({ type: "chat/listFiles", requestId: createChatUid(), limit: 200 });
  }, [controller.bridge, draft.length]);

  // Wrappers that fold composerLocal into action calls (stable identity).
  const handleAbortClick = useStableCallback(() => {
    if (!derived.isStreaming) return;
    actions.abort();
    focusComposer();
  });
  const handleCompactClick = useStableCallback(() => actions.startCompact(composerLocal));
  const handleNewSession = useStableCallback(() =>
    actions.startNewSession({ composer: composerLocal }),
  );
  const handleRestartAgent = useStableCallback(() => actions.restartAgent(composerLocal));
  const handleMemorySelect = useStableCallback(
    (item: Parameters<typeof actions.handleMemorySelect>[0]["item"]) =>
      actions.handleMemorySelect({ item, composer: composerLocal }),
  );
  const handleToggleActiveFileContext = useStableCallback(() =>
    actions.toggleIncludeActiveFileContext(composerLocal),
  );
  const handleSelectModel = useStableCallback((model: Parameters<typeof actions.selectModel>[0]) =>
    actions.selectModel(model, composerLocal),
  );

  // Visual composition. The layout is:
  //
  //   ┌─────────────────────────────────────────┐
  //   │ ChatTopBar                              │
  //   ├─────────────────────────────────────────┤
  //   │                                         │
  //   │ ConversationPane                        │
  //   │   (timeline OR empty/welcome state)     │
  //   │                                         │
  //   ├─────────────────────────────────────────┤
  //   │ ComposerActivityBar                     │
  //   ├─────────────────────────────────────────┤
  //   │ ComposerDock                            │
  //   │   ComposerPanelStack (registry-driven)  │
  //   │   ComposerAttachmentTray                │
  //   │   ComposerInput                         │
  //   │     ComposerToolbar | ComposerActions   │
  //   │   ComposerFooter                        │
  //   └─────────────────────────────────────────┘
  //
  // Each region is independently flag-gated so tests can mount a subset.
  return (
    <section
      role="region"
      aria-label="Chat window"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
    >
      {/* Surface: [ChatWindow.TopBar] */}
      {chatWindowFlags.topBar ? (
        <ChatTopBar
          checking={isCheckingAgent}
          status={derived.agentStatus}
          runtime={state.runtime}
          onNewSession={handleNewSession}
          onCompact={handleCompactClick}
          onMemorySelect={handleMemorySelect}
          onRestartAgent={handleRestartAgent}
        />
      ) : null}

      {/* Surface: [Conversation.Pane] */}
      {chatWindowFlags.conversationPane ? (
        <ConversationPane
          ref={scrollContainerRef}
          onScroll={handleScroll}
          showScrollButton={userScrolledUp}
          onScrollToLatest={handleScrollToLatest}
        >
          <div className="px-2 py-3">
            {slices.conversation.messages.length > 0 ||
            slices.conversation.commandOutputs.length > 0 ||
            slices.conversation.noteEvents.length > 0 ? (
              <ConversationTimeline
                messages={slices.conversation.messages as never[]}
                noteEvents={slices.conversation.noteEvents as never[]}
                commandOutputs={slices.conversation.commandOutputs as never[]}
                onSendCommand={handleSendCommand}
                onInsertCommand={setDraftDirect}
              />
            ) : !slices.conversation.hasReceivedStateSnapshot ? (
              <AgentSetupState />
            ) : !slices.conversation.hasReceivedSettingsSnapshot ? (
              <WelcomeShell />
            ) : slices.conversation.workspaceMode === "spec" ? (
              <SpecModeWelcome
                docContext={slices.conversation.activeDocContext}
                onInsert={setDraftDirect}
                onAutoSend={handleAutoSendWelcome}
              />
            ) : (
              <EmptyState
                workspaceMode={slices.conversation.workspaceMode}
                runtimeUnconfigured={slices.conversation.runtimeUnconfigured}
                rpcEnabled={slices.conversation.rpcEnabled}
                onOpenSettings={onOpenSettings}
                onSwitchToSpec={handleSwitchToSpec}
                onInsert={setDraftDirect}
              />
            )}
            <div ref={bottomRef} className="h-3 shrink-0" />
          </div>
        </ConversationPane>
      ) : null}

      {/* Surface: [Composer.ActivityBar] */}
      {chatWindowFlags.composerActivityBar ? (
        <ComposerActivityBar
          thinking={slices.composerActivity.thinking}
          isStreaming={slices.composerActivity.isStreaming}
          isSystemCommand={isSystemCommand}
        />
      ) : null}

      {/* Surface: [Composer.Dock] */}
      {chatWindowFlags.composerDock ? (
        <ComposerDock>
          <div ref={composerRef}>
            {chatWindowFlags.composerPanelStack ? (
              <ComposerPanelStack
                config={controller.composerPanelStackConfig}
                onDismissPanel={controller.actions.dismissComposerPanel}
              />
            ) : null}
            {chatWindowFlags.composerAttachmentTray ? (
              <ComposerAttachmentTray attachments={[]} />
            ) : null}
            <ComposerInput
              workspaceMode={slices.composer.workspaceMode}
              draft={draft}
              onChange={handleDraftChange}
              onKeyDown={onKeyDown}
              placeholder={composerPlaceholder}
              disabled={isComposerDisabled}
              isSystemCommand={isSystemCommand}
              describedBy={COMPOSER_FOOTER_HINT_ID}
              helpers={
                <>
                  {chatWindowFlags.slashCommandPopover ? (
                    <SlashPopup
                      open={slashOpen}
                      commands={slices.composer.commands}
                      filterQuery={activeTrigger?.query ?? ""}
                      onOpenChange={setSlashOpen}
                      onSelect={selectCommand}
                      onAction={selectSlashAction}
                    />
                  ) : null}
                  {chatWindowFlags.fileMentionPopover ? (
                    <MentionPopup
                      open={mentionOpen}
                      files={slices.composer.files}
                      onOpenChange={setMentionOpen}
                      onSelect={selectMention}
                    />
                  ) : null}
                </>
              }
            >
              <ComposerToolbar
                isSystemCommand={isSystemCommand}
                disabled={isComposerDisabled}
                models={slices.composer.models}
                selectedModel={slices.composer.selectedModel}
                thinkingLevel={slices.composer.thinkingLevel}
                workspaceMode={slices.composer.workspaceMode}
                includeActiveFileContext={slices.composer.includeActiveFileContext}
                activeFileDisplayName={slices.composer.activeFileDisplayName}
                activeFileDisplayPath={slices.composer.activeFileDisplayPath}
                customProviderLabels={slices.composer.customProviderLabels}
                onOpenMentionPicker={openMentionPicker}
                onSelectModel={handleSelectModel}
                onSelectThinkingLevel={actions.setThinkingLevel}
                onOpenSettings={onOpenSettings}
                onWorkspaceModeChange={actions.setMode}
                onToggleActiveFileContext={handleToggleActiveFileContext}
              />
              <ComposerActions
                disabled={isComposerDisabled}
                isStreaming={derived.isStreaming}
                canSend={canSend}
                onMemorySelect={handleMemorySelect}
                onSend={handleSend}
                onQueueFollowUp={handleQueueFollowUp}
                onSteer={handleSteer}
                onStop={handleAbortClick}
              />
            </ComposerInput>
          </div>
          <ComposerFooter
            hintId={COMPOSER_FOOTER_HINT_ID}
            usage={slices.footer.usageStatsEnabled ? slices.footer.usage : null}
            isCheckingAgent={isCheckingAgent}
            runtimeUnavailable={slices.footer.runtimeUnavailable}
            runtimeUnconfigured={slices.footer.runtimeUnconfigured}
            isStreaming={slices.footer.isStreaming}
            rpcEnabled={slices.footer.rpcEnabled}
            agentPhase={slices.footer.agentPhase}
            onPiWarningClick={slices.footer.onPiWarningClick}
            isSystemCommand={isSystemCommand}
            workspaceMode={slices.footer.workspaceMode}
            intentLabel={slices.footer.intentLabel}
          />
        </ComposerDock>
      ) : null}
    </section>
  );
}
