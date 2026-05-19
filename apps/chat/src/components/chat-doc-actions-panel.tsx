/**
 * ChatDocActionsPanel — subtle AFX document command rail for the chat composer.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { type ReactElement, useLayoutEffect, useMemo, useRef, useState } from "react";

import { BadgeCheck, ChevronDown, MoreHorizontal, PenLine, Scissors, Zap } from "lucide-react";

import type { PhaseRow, SignOffSummary, WorkspaceMode } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@afx/ui/components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import {
  AFX_COMMAND_CATALOG,
  type AfxCommandFamily,
  type AfxCommandGroup,
  type SupportedAfxCommand,
} from "../lib/command-catalog";
import type { ResolvedContextPreset } from "../lib/context-presets";
import {
  type ActiveDocCtx,
  type DocAction,
  type MemoryCatalogItem,
  describeDoc,
  resolveDocActions,
} from "../lib/doc-actions";
import { ChatCommandPresetSubmenu } from "./chat-command-preset-submenu";
import { docKindVisual } from "./chat-doc-kind-visual";
import { ChatMemoryMenuButton } from "./chat-memory-menu-button";
import { SpecStepper, type SpecStepperSegmentKey } from "./spec-stepper";

const DOC_ACTION_ROW_BUTTON_CLASS =
  "!h-5 !min-h-5 gap-0.5 !px-1.5 !py-0 !text-[10px] !font-normal font-mono leading-none";
const DOC_ACTION_FLAT_BUTTON_CLASS = DOC_ACTION_ROW_BUTTON_CLASS;
const DOC_ACTION_MENU_BUTTON_CLASS = cn(DOC_ACTION_ROW_BUTTON_CLASS, "!pr-1");

export interface ChatDocActionsPanelProps {
  workspaceMode: WorkspaceMode;
  docContext: ActiveDocCtx;
  dismissed: boolean;
  onDismiss: () => void;
  /** Insert the slash command into the composer draft (default for dialogic verbs). */
  onInsert: (text: string) => void;
  /** Send the slash command immediately, bypassing the draft (deterministic verbs). */
  onAutoSend: (text: string) => void;
  /**
   * Dispatch a host-side document mutation triggered from the panel; currently
   * only `tasks.signOff` (Work Sessions Human column tick + status promotion).
   * Optional so existing call sites and tests can omit it; the Sign Off button
   * is hidden when the prop is missing.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  onHostAction?: (action: "tasks.signOff", uri: string) => void;
  /**
   * Selection callback for the panel-header Memory control. Optional call
   * sites omit it and the header skips the trigger.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-18]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
   */
  onMemorySelect?: (item: MemoryCatalogItem) => void;
  /**
   * Open a workspace file at an optional 1-indexed line. Required by the spec
   * stepper for per-step navigation. Optional so call sites and tests
   * keep compiling — when omitted the stepper still renders but every pill is
   * non-interactive.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
   */
  onOpenFile?: (path: string, line?: number) => void;
}

/**
 * Body-only doc-actions content. Mounted by `ComposerPanelStack` through the
 * controller's `composerPanelStackConfig`. Chrome (title, dismiss, header
 * extras) comes from `ComposerPanel`.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA]
 */
export type ChatDocActionsPanelBodyProps = Omit<
  ChatDocActionsPanelProps,
  "dismissed" | "onDismiss"
>;

export function ChatDocActionsPanelBody({
  workspaceMode,
  docContext,
  onInsert,
  onAutoSend,
  onHostAction,
  onOpenFile,
}: ChatDocActionsPanelBodyProps): ReactElement | null {
  if (!docContext.docKind) return null;
  const actions = resolveDocActions(docContext).slice(0, 5);
  if (actions.length === 0) return null;
  return (
    <DocActionsBodyContent
      workspaceMode={workspaceMode}
      docContext={docContext}
      actions={actions}
      onInsert={onInsert}
      onAutoSend={onAutoSend}
      onHostAction={onHostAction}
      onOpenFile={onOpenFile}
    />
  );
}

/**
 * Header-extras slot for the doc-actions panel. ChatWindow embeds this in the
 * `ComposerPanelDefinition.headerExtras` field when memory selection is wired.
 */
export function ChatDocActionsPanelHeaderExtras({
  onMemorySelect,
}: {
  onMemorySelect?: (item: MemoryCatalogItem) => void;
}): ReactElement | null {
  if (!onMemorySelect) return null;
  return <ChatMemoryMenuButton onSelect={onMemorySelect} side="top" align="end" />;
}

/**
 * Header title slot for the doc-actions panel.
 */
export function ChatDocActionsPanelTitle({
  docContext,
}: {
  docContext: ActiveDocCtx;
}): ReactElement | null {
  if (!docContext.docKind) return null;
  const docLabel = describeDoc(docContext);
  const status = docContext.approvalStatus
    ? docContext.approvalStatus.charAt(0).toUpperCase() + docContext.approvalStatus.slice(1)
    : null;
  const { icon: DocIcon, accent } = docKindVisual(docContext.docKind);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <DocIcon size={11} className={cn("shrink-0", accent)} aria-hidden />
      <span className="min-w-0 truncate">{docLabel}</span>
      {status ? (
        <span className="hidden shrink-0 text-muted-foreground/60 @[320px]:inline">· {status}</span>
      ) : null}
    </span>
  );
}

/**
 * Body renderer for `ChatDocActionsPanelBody`. Inline so the body and the
 * computation that drives it stay in one place.
 */
function DocActionsBodyContent({
  workspaceMode,
  docContext,
  actions,
  onInsert,
  onAutoSend,
  onHostAction,
  onOpenFile,
}: {
  workspaceMode: WorkspaceMode;
  docContext: ActiveDocCtx;
  actions: DocAction[];
  onInsert: (text: string) => void;
  onAutoSend: (text: string) => void;
  onHostAction?: (action: "tasks.signOff", uri: string) => void;
  onOpenFile?: (path: string, line?: number) => void;
}): ReactElement {
  // Loosened visibility: surface the button whenever there is at least one
  // pending Human cell, even if body tasks or Agent rows are still incomplete.
  // The popover surfaces warnings for the unmet conditions; the host action
  // only promotes `status` to Living when `signOff.ready` is true.
  const showSignOff = Boolean(
    onHostAction &&
    docContext.docKind === "tasks" &&
    docContext.filePath &&
    (docContext.signOff?.signable || docContext.signOff?.ready),
  );
  const breadcrumbSegments = buildBreadcrumbSegments(docContext);
  const stepperKinds: Array<NonNullable<ActiveDocCtx["docKind"]>> = [
    "spec",
    "design",
    "tasks",
    "journal",
  ];
  const hasWorkflowStepperContext =
    docContext.docKind !== "journal" ||
    Boolean(
      docContext.feature ||
      docContext.siblingPaths?.spec ||
      docContext.siblingPaths?.design ||
      docContext.siblingPaths?.tasks ||
      docContext.sectionOffsets?.sessions,
    );
  const showStepper =
    docContext.docKind != null &&
    stepperKinds.includes(docContext.docKind) &&
    hasWorkflowStepperContext &&
    breadcrumbSegments.length > 0;
  const activeStepperKey = resolveActiveStepperKey(docContext);
  const journalActive = docContext.docKind === "journal";
  const docLabel = describeDoc(docContext);
  const primaryActions = useMemo(
    () => selectPrimaryActions(actions, docContext, workspaceMode),
    [actions, docContext, workspaceMode],
  );
  const actionRowRef = useRef<HTMLDivElement>(null);
  const [visiblePrimaryCount, setVisiblePrimaryCount] = useState(primaryActions.length);
  const boundedVisiblePrimaryCount = Math.min(visiblePrimaryCount, primaryActions.length);
  const visiblePrimaryActions = primaryActions.slice(0, boundedVisiblePrimaryCount);
  const hiddenPrimaryActions = primaryActions.slice(boundedVisiblePrimaryCount);
  const actionGroups = groupPrimaryActions(visiblePrimaryActions, docContext);
  // The More menu owns command presets and secondary actions that never appear
  // as primary buttons, so it stays available even when the visible row fits.
  const showMore = actions.length > 0;
  const overflowGroups = overflowCatalogGroups(docContext);

  useLayoutEffect(() => {
    const node = actionRowRef.current;
    if (!node) {
      setVisiblePrimaryCount(primaryActions.length);
      return;
    }

    const updateVisibleActions = () => {
      const width = node.getBoundingClientRect().width;
      setVisiblePrimaryCount(
        computeVisiblePrimaryActionCount(width, primaryActions, docContext, {
          reserveMore: false,
          reserveSignOff: showSignOff,
        }),
      );
    };
    const scheduleVisibleActionsUpdate = () => {
      updateVisibleActions();
      window.requestAnimationFrame(updateVisibleActions);
    };

    scheduleVisibleActionsUpdate();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(scheduleVisibleActionsUpdate);
      observer.observe(node);
      window.addEventListener("resize", scheduleVisibleActionsUpdate);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", scheduleVisibleActionsUpdate);
      };
    }

    window.addEventListener("resize", scheduleVisibleActionsUpdate);
    return () => window.removeEventListener("resize", scheduleVisibleActionsUpdate);
  }, [docContext, primaryActions, showSignOff]);

  function runAction(action: DocAction) {
    if (action.autoSend) onAutoSend(action.command);
    else onInsert(action.command);
  }
  function runPreset(preset: ResolvedContextPreset) {
    if (preset.autoSend) onAutoSend(preset.command);
    else onInsert(preset.command);
  }

  return (
    <TooltipProvider delayDuration={250}>
      {showStepper ? (
        <div className="mb-2">
          <SpecStepper
            segments={breadcrumbSegments}
            active={activeStepperKey}
            format={docContext.format}
            filePath={docContext.filePath ?? null}
            siblingPaths={docContext.siblingPaths}
            sectionOffsets={docContext.sectionOffsets}
            journalActive={journalActive}
            tasksCompleted={docContext.tasksCompleted}
            tasksTotal={docContext.tasksTotal}
            workSessionsTotal={docContext.workSessionsTotal}
            workSessionsSigned={docContext.workSessionsSigned}
            onOpenFile={(path, line) => {
              if (onOpenFile) onOpenFile(path, line);
            }}
            onInsertDraft={onInsert}
          />
        </div>
      ) : null}
      {/* Layout contract: primary actions spend the available row width first;
          More is trailing support chrome for presets and true overflow. */}
      <div
        className="flex w-full min-w-0 flex-nowrap items-center gap-1"
        data-testid="doc-actions-row"
      >
        <div
          // Keep primary buttons to one physical line. Width measurement
          // decides how many remain visible before the rest moves to More.
          // The More trigger itself sits outside this clipped strip so it can
          // never be eaten by primary-action overflow.
          ref={actionRowRef}
          className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden"
          data-testid="doc-actions-primary-row"
        >
          {actionGroups.map((group, index) => (
            <ActionCluster
              key={group.group}
              actions={group.actions}
              docContext={docContext}
              group={group.group}
              showDivider={index > 0}
              onRun={runAction}
              onInsert={onInsert}
              onAutoSend={onAutoSend}
            />
          ))}
          {showSignOff && docContext.signOff && docContext.filePath && onHostAction ? (
            <SignOffActionButton
              summary={docContext.signOff}
              uri={docContext.filePath}
              onConfirm={onHostAction}
            />
          ) : null}
        </div>
        {showMore ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="More document actions"
                    data-testid="doc-actions-more-trigger"
                    className="ml-auto shrink-0 text-muted-foreground/80 hover:text-foreground data-[state=open]:text-foreground"
                  >
                    <MoreHorizontal size={12} aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" align="end" className="max-w-[220px] text-left">
                More AFX actions, focus targets, and command presets.
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              side="top"
              align="end"
              sideOffset={8}
              collisionPadding={12}
              className="max-h-[min(28rem,calc(100vh-2rem))] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto"
            >
              <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
                {docLabel} Commands
              </DropdownMenuLabel>
              {hiddenPrimaryActions.length > 0 ? (
                <>
                  <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
                    Hidden Row Actions
                  </DropdownMenuLabel>
                  {hiddenPrimaryActions.map((action) => {
                    const help = actionHelp(action);
                    return (
                      <DropdownRowTooltip
                        key={`compact-${action.command}`}
                        title={action.label}
                        description={help.description}
                        command={action.command}
                        modeLabel={help.modeLabel}
                      >
                        <DropdownMenuItem
                          className="items-start gap-2 px-2 py-2"
                          onSelect={() => runAction(action)}
                        >
                          {action.autoSend ? (
                            <Zap size={11} className="mt-0.5 text-amber-500" aria-hidden />
                          ) : (
                            <PenLine
                              size={11}
                              className="mt-0.5 text-muted-foreground"
                              aria-hidden
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-medium">
                              {action.label}
                            </span>
                            <span className="block truncate text-[10px] leading-snug text-muted-foreground">
                              {help.description}
                            </span>
                            <span className="block truncate font-mono text-[10px] text-muted-foreground">
                              {action.command}
                            </span>
                          </span>
                          <span className="font-mono text-[9px] uppercase text-muted-foreground">
                            {action.autoSend ? "Auto" : "Draft"}
                          </span>
                        </DropdownMenuItem>
                      </DropdownRowTooltip>
                    );
                  })}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {docContext.parsedFocuses?.length ? (
                <>
                  <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
                    Compose
                  </DropdownMenuLabel>
                  {docContext.parsedFocuses.slice(0, 8).map((focus) => {
                    const focusAction = preferredFocusAction(actions, docContext.docKind);
                    if (!focusAction) return null;
                    const command = `${focusAction.command} ${
                      focus.commandSuffix ?? focus.slug
                    }`.trim();
                    return (
                      <DropdownRowTooltip
                        key={focus.id}
                        title={focus.label}
                        line={focus.line}
                        description={focus.excerpt}
                        command={command}
                        modeLabel="Draft"
                      >
                        <DropdownMenuItem
                          className="items-start gap-2 px-2 py-2"
                          onSelect={() => onInsert(command)}
                        >
                          <Scissors size={11} className="mt-0.5 text-afx-brand-soft" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-medium">
                              {focus.label}
                            </span>
                            <span className="block font-mono text-[10px] text-muted-foreground">
                              Line {focus.line}
                            </span>
                          </span>
                        </DropdownMenuItem>
                      </DropdownRowTooltip>
                    );
                  })}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {overflowGroups.map((group, groupIndex) => (
                <DropdownMenuGroup key={group.group}>
                  {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
                    {group.label}
                  </DropdownMenuLabel>
                  {group.items.map((item) => (
                    <DropdownRowTooltip
                      key={item.command}
                      title={item.label}
                      description={item.description}
                      command={item.command}
                      modeLabel={item.autoSend ? "Auto" : "Draft"}
                    >
                      <DropdownMenuItem
                        className="items-start gap-2 px-2 py-2"
                        onSelect={() =>
                          item.autoSend ? onAutoSend(item.command) : onInsert(item.command)
                        }
                      >
                        {item.autoSend ? (
                          <Zap size={11} className="mt-0.5 text-amber-500" aria-hidden />
                        ) : (
                          <PenLine size={11} className="mt-0.5 text-muted-foreground" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-medium">
                            {item.label}
                          </span>
                          <span className="block truncate text-[10px] leading-snug text-muted-foreground">
                            {item.description}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-muted-foreground">
                            {item.command}
                          </span>
                        </span>
                        <span className="font-mono text-[9px] uppercase text-muted-foreground">
                          {item.autoSend ? "Auto" : "Draft"}
                        </span>
                      </DropdownMenuItem>
                    </DropdownRowTooltip>
                  ))}
                </DropdownMenuGroup>
              ))}
              <DropdownMenuSeparator />
              {actions.map((action) => (
                <ChatCommandPresetSubmenu
                  key={`preset-${action.command}`}
                  baseCommand={baseAfxCommand(action.command)}
                  docContext={toPresetContext(docContext)}
                  triggerLabel={`${action.label} presets`}
                  onSelect={runPreset}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function ActionCluster({
  actions,
  docContext,
  group,
  showDivider,
  onRun,
  onInsert,
  onAutoSend,
}: {
  actions: readonly DocAction[];
  docContext: ActiveDocCtx;
  group: PrimaryActionGroup;
  showDivider: boolean;
  onRun: (action: DocAction) => void;
  onInsert: (text: string) => void;
  onAutoSend: (text: string) => void;
}) {
  if (actions.length === 0) return null;

  return (
    <>
      {showDivider ? (
        <span
          aria-hidden
          className="mx-0.5 shrink-0 select-none font-mono text-[11px] text-muted-foreground/60"
          data-testid="doc-actions-intent-separator"
        >
          |
        </span>
      ) : null}
      <span
        className="inline-flex shrink-0 flex-nowrap items-center gap-1"
        data-testid={`doc-actions-${group}-group`}
      >
        {actions.map((action) => (
          <ActionButton
            key={action.command}
            action={action}
            docContext={docContext}
            onRun={onRun}
            onInsert={onInsert}
            onAutoSend={onAutoSend}
          />
        ))}
      </span>
    </>
  );
}

function ActionButton({
  action,
  docContext,
  className,
  onRun,
  onInsert,
  onAutoSend,
}: {
  action: DocAction;
  docContext: ActiveDocCtx;
  className?: string;
  onRun: (action: DocAction) => void;
  onInsert: (text: string) => void;
  onAutoSend: (text: string) => void;
}) {
  const help = actionHelp(action);
  const taskTargets = taskActionTargets(action, docContext);
  const focusTargets = focusActionTargets(action, docContext);

  if (isTaskMenuAction(action, docContext)) {
    return (
      <TaskMenuActionButton
        action={action}
        docContext={docContext}
        targets={taskTargets}
        className={className}
        onInsert={onInsert}
        onAutoSend={onAutoSend}
      />
    );
  }

  if (focusTargets.length > 0) {
    return (
      <FocusMenuActionButton
        action={action}
        docContext={docContext}
        targets={focusTargets}
        className={className}
        onInsert={onInsert}
      />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="xs"
          variant="outline"
          aria-label={`${action.label}: ${help.modeLabel}`}
          onClick={() => onRun(action)}
          className={cn(DOC_ACTION_FLAT_BUTTON_CLASS, className)}
        >
          {action.autoSend ? (
            <Zap size={10} className="shrink-0 text-amber-500" aria-hidden />
          ) : (
            <PenLine size={10} className="shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span>{action.label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[240px] text-left">
        <span className="flex flex-col gap-1">
          <span className="font-medium">{action.label}</span>
          <span className="text-[11px] leading-snug opacity-85">{help.description}</span>
          <span className="font-mono text-[10px] opacity-75">{action.command}</span>
          <span className="font-mono text-[9px] uppercase opacity-70">{help.modeLabel}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function DropdownRowTooltip({
  children,
  title,
  line,
  description,
  command,
  modeLabel,
}: {
  children: ReactElement;
  title: string;
  line?: number;
  description?: string;
  command?: string;
  modeLabel?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        align="start"
        sideOffset={8}
        className="max-w-[300px] flex-col items-start gap-1 text-left"
      >
        <span className="font-medium leading-snug">{title}</span>
        {line ? <span className="font-mono text-[10px] opacity-75">Line {line}</span> : null}
        {description ? (
          <span className="text-[11px] leading-snug opacity-85">{description}</span>
        ) : null}
        {command ? <span className="font-mono text-[10px] opacity-75">{command}</span> : null}
        {modeLabel ? (
          <span className="font-mono text-[9px] uppercase opacity-70">{modeLabel}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function FocusMenuActionButton({
  action,
  docContext,
  targets,
  className,
  onInsert,
}: {
  action: DocAction;
  docContext: ActiveDocCtx;
  targets: readonly FocusActionTarget[];
  className?: string;
  onInsert: (text: string) => void;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className={cn(DOC_ACTION_MENU_BUTTON_CLASS, className)}
              aria-label={`${action.label} options`}
              data-testid="doc-actions-focus-menu"
            >
              <PenLine size={10} className="shrink-0 text-muted-foreground" aria-hidden />
              <span>{action.label}</span>
              <ChevronDown size={10} className="text-muted-foreground" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-[240px] text-left">
          <span className="flex flex-col gap-1">
            <span className="font-medium">{action.label}</span>
            <span className="text-[11px] leading-snug opacity-85">
              Choose a document focus and insert the command into the chat box.
            </span>
            <span className="font-mono text-[10px] opacity-75">{action.command}</span>
            <span className="font-mono text-[9px] uppercase opacity-70">Draft first</span>
          </span>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="max-h-[min(28rem,calc(100vh-2rem))] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto"
      >
        <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
          Insert In Chat Box
        </DropdownMenuLabel>
        <DropdownMenuItem
          className="items-start gap-2 px-2 py-2"
          onSelect={() => onInsert(action.command)}
        >
          <PenLine size={11} className="mt-0.5 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium">{`${action.label} all`}</span>
            <span className="block text-[10px] leading-snug text-muted-foreground">
              Use the whole active document.
            </span>
            <span className="block truncate font-mono text-[10px] text-muted-foreground">
              {action.command}
            </span>
          </span>
          <span className="font-mono text-[9px] uppercase text-muted-foreground">Draft</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
          From This Doc
        </DropdownMenuLabel>
        {targets
          .filter((target) => target.origin === "parsed")
          .map((target) => (
            <DropdownRowTooltip
              key={target.id}
              title={target.label}
              line={target.line}
              description={target.excerpt ?? target.description}
              command={focusCommand(action, target)}
              modeLabel="Draft"
            >
              <DropdownMenuItem
                className="items-start gap-2 px-2 py-2"
                onSelect={() => onInsert(focusCommand(action, target))}
              >
                <Scissors size={11} className="mt-0.5 text-afx-brand-soft" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium">{target.label}</span>
                  <span className="block text-[10px] leading-snug text-muted-foreground">
                    {target.description}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">
                    {focusCommand(action, target)}
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownRowTooltip>
          ))}
        {targets.some((target) => target.origin === "common") ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
              Common Focuses
            </DropdownMenuLabel>
            {targets
              .filter((target) => target.origin === "common")
              .map((target) => (
                <DropdownRowTooltip
                  key={target.id}
                  title={target.label}
                  description={target.description}
                  command={focusCommand(action, target)}
                  modeLabel="Draft"
                >
                  <DropdownMenuItem
                    className="items-start gap-2 px-2 py-2"
                    onSelect={() => onInsert(focusCommand(action, target))}
                  >
                    <Scissors size={11} className="mt-0.5 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium">{target.label}</span>
                      <span className="block text-[10px] leading-snug text-muted-foreground">
                        {target.description}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {focusCommand(action, target)}
                      </span>
                    </span>
                  </DropdownMenuItem>
                </DropdownRowTooltip>
              ))}
          </>
        ) : null}
        {docContext.docKind === "spec" && docContext.format !== "sprint" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="items-start gap-2 px-2 py-2"
              onSelect={() => onInsert(`/afx-spec discuss${featureSuffix(docContext)}`)}
            >
              <PenLine size={11} className="mt-0.5 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium">Discuss</span>
                <span className="block text-[10px] leading-snug text-muted-foreground">
                  Open a guided spec discussion.
                </span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {`/afx-spec discuss${featureSuffix(docContext)}`}
                </span>
              </span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskMenuActionButton({
  action,
  docContext,
  targets,
  className,
  onInsert,
  onAutoSend,
}: {
  action: DocAction;
  docContext: ActiveDocCtx;
  targets: readonly TaskActionTarget[];
  className?: string;
  onInsert: (text: string) => void;
  onAutoSend: (text: string) => void;
}) {
  const verb = actionVerb(action);
  const menuMode = action.autoSend ? "Run Now" : "Insert In Chat Box";
  const modeLabel = action.autoSend ? "Auto" : "Draft";
  const ModeIcon = action.autoSend ? Zap : PenLine;
  const modeIconClassName = action.autoSend ? "text-amber-500" : "text-muted-foreground";
  const showAllTarget = verb === "code";

  function selectCommand(command: string) {
    if (action.autoSend) {
      onAutoSend(command);
    } else {
      onInsert(command);
    }
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className={cn(DOC_ACTION_MENU_BUTTON_CLASS, className)}
              aria-label={`${action.label} options`}
              data-testid={`doc-actions-${verb}-menu`}
            >
              <ModeIcon size={10} className={cn("shrink-0", modeIconClassName)} aria-hidden />
              <span>{action.label}</span>
              <ChevronDown size={10} className="text-muted-foreground" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-[240px] text-left">
          <span className="flex flex-col gap-1">
            <span className="font-medium">{action.label}</span>
            <span className="text-[11px] leading-snug opacity-85">
              {action.autoSend
                ? "Choose a WBS item and run it now."
                : "Choose all open tasks or a WBS item and insert the command into the chat box."}
            </span>
            <span className="font-mono text-[10px] opacity-75">{action.command}</span>
            <span className="font-mono text-[9px] uppercase opacity-70">
              {action.autoSend ? "Auto-send" : "Draft first"}
            </span>
          </span>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="max-h-[min(28rem,calc(100vh-2rem))] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto"
      >
        <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
          {menuMode}
        </DropdownMenuLabel>
        {showAllTarget ? (
          <>
            <DropdownRowTooltip
              title={`${action.label} all`}
              description="Use all open tasks in the active tasks document."
              command={action.command}
              modeLabel={modeLabel}
            >
              <DropdownMenuItem
                className="items-start gap-2 px-2 py-2"
                onSelect={() => selectCommand(action.command)}
              >
                <ModeIcon size={11} className={cn("mt-0.5", modeIconClassName)} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium">
                    {`${action.label} all`}
                  </span>
                  <span className="block truncate text-[10px] leading-snug text-muted-foreground">
                    Use all open tasks in the active tasks document.
                  </span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">
                    {action.command}
                  </span>
                </span>
                <span className="font-mono text-[9px] uppercase text-muted-foreground">
                  {modeLabel}
                </span>
              </DropdownMenuItem>
            </DropdownRowTooltip>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {docContext.taskPhases?.map((phase) => {
          const phaseTargets = targets.filter((target) => target.phaseNumber === phase.number);
          if (phaseTargets.length === 0) return null;
          return (
            <DropdownMenuGroup key={phase.number}>
              <DropdownMenuLabel className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
                {`Phase ${phase.number}: ${phase.name}`}
              </DropdownMenuLabel>
              {phaseTargets.slice(0, 8).map((target) => {
                const command = taskCommand(action, docContext, target);
                return (
                  <DropdownRowTooltip
                    key={`${verb}-${target.wbsId}`}
                    title={`${action.label} ${target.wbsId}`}
                    line={target.line}
                    description={target.text}
                    command={command}
                    modeLabel={modeLabel}
                  >
                    <DropdownMenuItem
                      className="items-start gap-2 px-2 py-2"
                      onSelect={() => selectCommand(command)}
                    >
                      <ModeIcon
                        size={11}
                        className={cn(
                          "mt-0.5",
                          action.autoSend ? "text-amber-500" : "text-afx-brand-soft",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium">
                          {`${action.label} ${target.wbsId}`}
                        </span>
                        <span className="block truncate text-[10px] leading-snug text-muted-foreground">
                          {target.text}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">
                          {command}
                        </span>
                      </span>
                      <span className="font-mono text-[9px] uppercase text-muted-foreground">
                        {modeLabel}
                      </span>
                    </DropdownMenuItem>
                  </DropdownRowTooltip>
                );
              })}
              {phaseTargets.length > 8 ? (
                <DropdownMenuItem disabled className="px-2 py-1.5 text-[10px]">
                  {`+${phaseTargets.length - 8} more tasks in this phase`}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Brass-accented Sign Off action — surfaces only when every body checkbox is
 * `[x]`, every Work Sessions Agent cell is `[x]`, and at least one Human cell
 * is unticked. Clicking opens a confirm popover that previews the atomic edit
 * (rows ticked + optional status promotion + updated_at bump). Confirming
 * dispatches `chat/hostAction { action: "tasks.signOff", uri }` through the
 * parent so the host can run a single WorkspaceEdit that lands as one undo
 * entry on the editor stack.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-19]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
function SignOffActionButton({
  summary,
  uri,
  onConfirm,
}: {
  summary: SignOffSummary;
  uri: string;
  onConfirm: (action: "tasks.signOff", uri: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Status promotion happens host-side only when `summary.ready` is true. When
  // signable-but-not-ready (relaxed mode), Sign Off ticks Human cells but
  // leaves the file at its current status until body tasks + Agent rows are
  // also complete.
  const willPromoteStatus = summary.ready && !summary.alreadyLiving;
  const hasWarnings = summary.signable && !summary.ready;

  function confirm() {
    setOpen(false);
    onConfirm("tasks.signOff", uri);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-label={`Sign Off Work Sessions — tick ${summary.pendingHumanRows} Human cell${
            summary.pendingHumanRows === 1 ? "" : "s"
          }${hasWarnings ? " (status promotion blocked — see preview)" : ""}`}
          data-testid="doc-actions-sign-off-button"
          data-warn={hasWarnings ? "true" : "false"}
          className={cn(
            DOC_ACTION_MENU_BUTTON_CLASS,
            hasWarnings
              ? "border-muted-foreground/40 text-muted-foreground hover:bg-muted/40"
              : "border-amber-500/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15",
          )}
        >
          <BadgeCheck size={10} className="shrink-0" aria-hidden />
          <span>Sign Off</span>
          <ChevronDown size={10} className="text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-72 max-w-[calc(100vw-1.5rem)] border border-border bg-popover p-3 shadow-md"
        data-testid="doc-actions-sign-off-popover"
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Sign Off — tasks.md
        </div>
        {hasWarnings ? (
          <div
            className="mt-2 rounded-sm border border-amber-500/40 bg-amber-500/5 px-2 py-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-300"
            data-testid="doc-actions-sign-off-warning"
          >
            <p className="font-medium">Sign Off allowed, status promotion blocked.</p>
            <ul className="mt-1 space-y-0.5">
              {summary.pendingTasks > 0 ? (
                <li>
                  · {summary.pendingTasks} task{summary.pendingTasks === 1 ? "" : "s"} still
                  unchecked
                </li>
              ) : null}
              {summary.pendingAgentRows > 0 ? (
                <li>
                  · {summary.pendingAgentRows} Work Sessions Agent row
                  {summary.pendingAgentRows === 1 ? "" : "s"} not yet `[x]`
                </li>
              ) : null}
              <li>· status will stay at its current value until both are clean</li>
            </ul>
          </div>
        ) : null}
        <p className="mt-2 text-[11px] leading-snug">This will atomically:</p>
        <ul className="mt-1.5 space-y-1 text-[11px] leading-snug">
          <li className="flex items-start gap-2">
            <BadgeCheck size={11} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
            <span>
              Tick {summary.pendingHumanRows} Human cell
              {summary.pendingHumanRows === 1 ? "" : "s"}
            </span>
          </li>
          {willPromoteStatus ? (
            <li className="flex items-start gap-2">
              <BadgeCheck size={11} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
              <span>Promote status to Living</span>
            </li>
          ) : summary.alreadyLiving ? (
            <li className="flex items-start gap-2 text-muted-foreground">
              <BadgeCheck size={11} className="mt-0.5 shrink-0" aria-hidden />
              <span>Status already Living — keep as-is</span>
            </li>
          ) : (
            <li className="flex items-start gap-2 text-muted-foreground">
              <BadgeCheck size={11} className="mt-0.5 shrink-0" aria-hidden />
              <span>Status stays unchanged — promote later when work is fully complete</span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <BadgeCheck size={11} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
            <span>Update updated_at to now</span>
          </li>
        </ul>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground/80">
          ⌘Z reverts in one step.
        </p>
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setOpen(false)}
            data-testid="doc-actions-sign-off-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="xs"
            onClick={confirm}
            data-testid="doc-actions-sign-off-confirm"
            className="font-mono"
          >
            Confirm Sign Off
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Spec-stepper segment shape — derived client-side from
 * `ctx.{specStatus, designStatus, tasksStatus, tasksCompleted, tasksTotal,
 * workSessionsSigned, workSessionsTotal}` so the stepper renders
 * `[1 Spec] [2 Design] [3 Tasks 3/8] [4 Work 1/2]` without an extra bridge
 * call. The terminal `Code` pseudo-segment was dropped — the action row
 * already covers implementation commands via Code/Verify/Pick.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-17]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
type BreadcrumbSegment = {
  key: "spec" | "design" | "tasks" | "work";
  label: "Spec" | "Design" | "Tasks" | "Work";
  glyph: string;
  status: "approved" | "draft" | "blocked" | "progress" | "pending";
  hint: string;
};

// Status lives in tone + tooltip; visible stepper labels stay navigation-only.
const STATUS_GLYPH: Record<BreadcrumbSegment["status"], string> = {
  approved: "",
  draft: "",
  blocked: "",
  progress: "",
  pending: "",
};

function buildBreadcrumbSegments(ctx: ActiveDocCtx): BreadcrumbSegment[] {
  const specStatus = mapApprovalStatus(ctx.specStatus);
  const designStatus = mapApprovalStatus(ctx.designStatus);
  const tasksStatus = mapApprovalStatus(ctx.tasksStatus);
  const taskProgressGlyph =
    typeof ctx.tasksCompleted === "number" &&
    typeof ctx.tasksTotal === "number" &&
    ctx.tasksTotal > 0
      ? `${ctx.tasksCompleted}/${ctx.tasksTotal}`
      : null;
  const workProgressGlyph =
    typeof ctx.workSessionsSigned === "number" &&
    typeof ctx.workSessionsTotal === "number" &&
    ctx.workSessionsTotal > 0
      ? `${ctx.workSessionsSigned}/${ctx.workSessionsTotal}`
      : null;
  const workComplete =
    typeof ctx.workSessionsSigned === "number" &&
    typeof ctx.workSessionsTotal === "number" &&
    ctx.workSessionsTotal > 0 &&
    ctx.workSessionsSigned >= ctx.workSessionsTotal;

  return [
    {
      key: "spec",
      label: "Spec",
      glyph: STATUS_GLYPH[specStatus],
      status: specStatus,
      hint: hintForSegment("Spec", ctx.specStatus),
    },
    {
      key: "design",
      label: "Design",
      glyph: STATUS_GLYPH[designStatus],
      status: designStatus,
      hint: hintForSegment("Design", ctx.designStatus),
    },
    {
      key: "tasks",
      label: "Tasks",
      glyph: taskProgressGlyph ?? STATUS_GLYPH[tasksStatus],
      status: taskProgressGlyph ? "progress" : tasksStatus,
      hint: taskProgressGlyph
        ? `Tasks: ${taskProgressGlyph} done`
        : hintForSegment("Tasks", ctx.tasksStatus),
    },
    {
      key: "work",
      label: "Work",
      glyph: workProgressGlyph ?? "",
      status: workProgressGlyph ? (workComplete ? "approved" : "progress") : "pending",
      hint: workProgressGlyph
        ? `Work Sessions: ${workProgressGlyph} signed`
        : "Work Sessions: no rows yet",
    },
  ];
}

/**
 * Map the active doc context to which spec-stepper segment should carry the
 * ring halo. Sprint files use the in-file `section` (`SPEC` / `DESIGN` /
 * `TASKS` / `SESSIONS`); standard 4-file mode uses `docKind`. Journal active
 * returns null so the stepper stays "no main step active" while the Spec-mode
 * label names the journal context.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
 */
function resolveActiveStepperKey(ctx: ActiveDocCtx): SpecStepperSegmentKey | null {
  if (ctx.format === "sprint") {
    if (ctx.section === "SPEC") return "spec";
    if (ctx.section === "DESIGN") return "design";
    if (ctx.section === "TASKS") return "tasks";
    if (ctx.section === "SESSIONS") return "work";
    return null;
  }
  if (ctx.docKind === "spec" || ctx.docKind === "design" || ctx.docKind === "tasks") {
    return ctx.docKind;
  }
  return null;
}

function mapApprovalStatus(raw: string | null | undefined): BreadcrumbSegment["status"] {
  if (!raw) return "pending";
  const normalized = raw.toLowerCase();
  if (normalized === "approved" || normalized === "living") return "approved";
  if (normalized === "blocked") return "blocked";
  if (normalized === "draft") return "draft";
  return "pending";
}

function hintForSegment(
  label: "Spec" | "Design" | "Tasks" | "Work",
  raw: string | null | undefined,
): string {
  if (!raw) return `${label}: not started`;
  return `${label}: ${raw}`;
}

function actionHelp(action: DocAction): { description: string; modeLabel: string } {
  const command = action.command.toLowerCase();
  const modeLabel = action.autoSend ? "Auto-send" : "Draft first";
  const descriptions: Array<[RegExp, string]> = [
    [/\/afx-task pick/, "Selects the next task candidate without editing code."],
    [/\/afx-task status/, "Summarizes task progress and blockers."],
    [/\/afx-task verify/, "Runs a task verification pass."],
    [/\/afx-task code|\/afx-sprint code/, "Opens a coding task draft you can adjust."],
    [
      /\/afx-spec validate|\/afx-design validate/,
      "Checks document structure and required sections.",
    ],
    [/\/afx-design author/, "Authors design.md from the approved spec."],
    [/\/afx-task plan/, "Authors tasks.md from the approved design."],
    [/\/afx-sprint design/, "Authors the sprint Design section from the approved Spec."],
    [/\/afx-sprint task/, "Authors the sprint Tasks section from the approved Design."],
    [/\/afx-spec review|\/afx-design review/, "Reviews the document for gaps and risks."],
    [/\/afx-spec approve|\/afx-design approve|--approve/, "Approves the current SDD stage."],
    [/\/afx-sprint verify/, "Verifies the sprint document and task traceability."],
    [/\/afx-session recap/, "Recaps the recent discussion."],
    [/\/afx-adr list/, "Lists architecture decisions."],
    [/\/afx-context load|\/afx-context history/, "Reads saved context without changing files."],
  ];
  const matched = descriptions.find(([pattern]) => pattern.test(command));
  if (matched) return { description: matched[1], modeLabel };
  return {
    description: action.autoSend
      ? "Runs immediately because the action is deterministic."
      : "Opens in the composer so you can edit before sending.",
    modeLabel,
  };
}

type PrimaryActionGroup = "compose" | "run";
type CatalogIntentGroup = Extract<AfxCommandGroup, "quality" | "state" | "action">;
type OverflowModeGroup = "compose" | "run";

type GroupedPrimaryActions = {
  group: PrimaryActionGroup;
  actions: DocAction[];
};

type TaskActionTarget = {
  phaseNumber: number;
  wbsId: string;
  text: string;
  line: number;
};

type FocusActionTarget = {
  id: string;
  label: string;
  suffix: string;
  description: string;
  line?: number;
  excerpt?: string;
  origin: "parsed" | "common";
};

type OverflowCatalogItem = {
  label: string;
  command: string;
  description: string;
  autoSend: boolean;
  intentGroup: CatalogIntentGroup;
  modeGroup: OverflowModeGroup;
};

type OverflowCatalogGroup = {
  group: OverflowModeGroup;
  label: string;
  items: OverflowCatalogItem[];
};

const OVERFLOW_MODE_ORDER: readonly OverflowModeGroup[] = ["compose", "run"];
const CATALOG_INTENT_ORDER: readonly CatalogIntentGroup[] = ["quality", "state", "action"];

function computeVisiblePrimaryActionCount(
  width: number,
  actions: readonly DocAction[],
  docContext: ActiveDocCtx,
  options: { reserveMore: boolean; reserveSignOff: boolean },
): number {
  if (actions.length === 0) return 0;
  if (!Number.isFinite(width) || width <= 0) return actions.length;

  const reserved = (options.reserveMore ? 28 : 0) + (options.reserveSignOff ? 92 : 0);
  const available = Math.max(0, width - reserved);
  let used = 0;
  let count = 0;
  let previousMode: PrimaryActionGroup | null = null;

  for (const action of actions) {
    const mode = actionInteractionMode(action, docContext);
    const divider = previousMode && previousMode !== mode ? 14 : 0;
    const gap = count > 0 ? 4 : 0;
    const next = estimatePrimaryActionWidth(action, docContext) + divider + gap;
    if (count > 0 && used + next > available) break;
    used += next;
    previousMode = mode;
    count += 1;
  }

  return Math.max(1, Math.min(count, actions.length));
}

function estimatePrimaryActionWidth(action: DocAction, docContext: ActiveDocCtx): number {
  const hasMenu =
    isTaskMenuAction(action, docContext) || focusActionTargets(action, docContext).length > 0;
  return 26 + action.label.length * 6 + (hasMenu ? 8 : 0);
}

/**
 * Select the visible primary action set per docKind + workspace mode. Spec
 * mode keeps the full spec/design lifecycle set defined by `resolveDocActions`; Code /
 * Explore mode trims to the per-docKind compact set documented by the
 * compact-mode primary table in the canonical composer design:
 *
 *   spec / design  → [Refine|▾] [Validate]
 *   tasks          → [Code|▾] [Review|▾] | [Verify] [Pick|▾] (4 buttons; the
 *                    visible row stays bounded but mirrors the full Spec strip
 *                    so behavior groups stay consistent)
 *   journal        → [Note] [Recap]
 *   adr            → [Review] [List]
 *   research       → [Compare] [Finalize]
 *   context        → unchanged from full
 *
 * Anything not in the compact set falls into the More overflow.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
function selectPrimaryActions(
  actions: readonly DocAction[],
  docContext: ActiveDocCtx,
  workspaceMode: WorkspaceMode,
): DocAction[] {
  if (workspaceMode === "spec") {
    if (docContext.docKind === "spec" || docContext.docKind === "design") {
      return actions.slice(0, 5);
    }
    if (docContext.docKind === "tasks") return actions.slice(0, 4);
    return actions.slice(0, 5);
  }

  const labelsByKind: Partial<Record<NonNullable<ActiveDocCtx["docKind"]>, string[]>> = {
    spec: ["Refine", "Validate"],
    design: ["Refine", "Validate"],
    tasks: ["Code", "Review", "Verify", "Pick"],
    journal: ["Note", "Recap"],
    adr: ["Review", "List"],
    research: ["Compare", "Finalize"],
  };

  const wanted = docContext.docKind ? labelsByKind[docContext.docKind] : null;
  if (!wanted) return actions.slice(0, 2);

  const compact = wanted
    .map((label) => actions.find((action) => action.label === label))
    .filter((action): action is DocAction => action != null);

  // Defensive — if the resolveDocActions output drifts and we'd render zero
  // primary actions, fall back to the first two so the strip stays useful.
  return compact.length > 0 ? compact : actions.slice(0, 2);
}

function groupPrimaryActions(
  actions: readonly DocAction[],
  docContext: ActiveDocCtx,
): GroupedPrimaryActions[] {
  return [
    {
      group: "compose" as const,
      actions: actions.filter((action) => actionInteractionMode(action, docContext) === "compose"),
    },
    {
      group: "run" as const,
      actions: actions.filter((action) => actionInteractionMode(action, docContext) === "run"),
    },
  ].filter((entry) => entry.actions.length > 0);
}

function actionInteractionMode(action: DocAction, docContext: ActiveDocCtx): PrimaryActionGroup {
  if (!action.autoSend) return "compose";
  if (isFocusSplitAction(action, docContext)) return "compose";
  return "run";
}

function taskActionTargets(
  action: DocAction,
  docContext: ActiveDocCtx,
): readonly TaskActionTarget[] {
  if (docContext.docKind !== "tasks") return [];
  const verb = actionVerb(action);
  if (verb !== "code" && verb !== "pick") return [];
  return collectTaskTargets(docContext.taskPhases, { includeCompleted: false });
}

function isTaskMenuAction(action: DocAction, docContext: ActiveDocCtx): boolean {
  if (docContext.docKind !== "tasks") return false;
  const verb = actionVerb(action);
  if (verb === "code") return true;
  return verb === "pick" && taskActionTargets(action, docContext).length > 0;
}

function collectTaskTargets(
  phases: readonly PhaseRow[] | undefined,
  options: { includeCompleted: boolean },
): TaskActionTarget[] {
  if (!phases?.length) return [];

  return phases.flatMap((phase) =>
    phase.items
      .map((item, index) => ({
        phaseNumber: phase.number,
        wbsId: item.wbsId?.trim() || fallbackWbsId(phase, index),
        text: item.text,
        line: item.line,
        completed: item.completed,
      }))
      .filter((target) => (options.includeCompleted || !target.completed) && Boolean(target.wbsId))
      .map(({ completed: _completed, ...target }) => target),
  );
}

function fallbackWbsId(phase: PhaseRow, index: number): string {
  return `${phase.number}.${Math.max(index, 0) + 1}`;
}

function actionVerb(action: DocAction): string | null {
  return (
    action.command
      .trim()
      .match(/^\/afx-[a-z]+\s+([a-z][a-z-]*)/i)?.[1]
      ?.toLowerCase() ?? null
  );
}

function taskCommand(
  action: DocAction,
  docContext: ActiveDocCtx,
  target: TaskActionTarget,
): string {
  const verb = actionVerb(action);
  if (docContext.format === "sprint" && verb === "code") {
    return ["/afx-sprint code", docContext.feature, target.wbsId].filter(Boolean).join(" ");
  }
  return [`/afx-task ${verb ?? "code"}`, target.wbsId].join(" ");
}

function focusActionTargets(
  action: DocAction,
  docContext: ActiveDocCtx,
): readonly FocusActionTarget[] {
  if (!isFocusSplitAction(action, docContext)) return [];

  const parsed = (docContext.parsedFocuses ?? []).slice(0, 8).map((focus) => ({
    id: focus.id,
    label: focus.label,
    suffix: focus.commandSuffix ?? focus.slug,
    description: focus.line ? `Line ${focus.line}` : "Parsed from the active document.",
    line: focus.line,
    excerpt: focus.excerpt,
    origin: "parsed" as const,
  }));
  const parsedSuffixes = new Set(parsed.map((focus) => focus.suffix.toLowerCase()));
  const common = commonFocusTargets(docContext).filter(
    (focus) => !parsedSuffixes.has(focus.suffix.toLowerCase()),
  );

  return [...parsed, ...common];
}

function isFocusSplitAction(action: DocAction, docContext: ActiveDocCtx): boolean {
  if (
    action.label === "Refine" &&
    (docContext.docKind === "spec" || docContext.docKind === "design")
  ) {
    return true;
  }
  return action.label === "Review" && docContext.docKind === "tasks";
}

function commonFocusTargets(docContext: ActiveDocCtx): FocusActionTarget[] {
  switch (docContext.docKind) {
    case "spec":
      return [
        commonFocus("requirements", "Requirements", "Clarify functional requirements."),
        commonFocus("acceptance-criteria", "Acceptance Criteria", "Tighten pass/fail checks."),
        commonFocus("risks", "Risks", "Surface ambiguities and risk areas."),
      ];
    case "design":
      return [
        commonFocus("des-data", "Data Model", "Review state and data movement."),
        commonFocus("des-err", "Error Handling", "Review failure and recovery paths."),
        commonFocus("des-trace", "Traceability", "Check code/spec coverage anchors."),
      ];
    case "tasks":
      return [
        commonFocus("phase-grouping", "Phase Grouping", "Review task slicing by phase."),
        commonFocus("dependencies", "Dependencies", "Review sequencing and blockers."),
        commonFocus("acceptance-hooks", "Acceptance Hooks", "Check task-to-test coverage."),
      ];
    case "journal":
    case "adr":
    case "research":
    case "context":
    case null:
      return [];
  }
}

function commonFocus(suffix: string, label: string, description: string): FocusActionTarget {
  return { id: `common-${suffix}`, label, suffix, description, origin: "common" };
}

function focusCommand(action: DocAction, target: FocusActionTarget): string {
  return `${action.command} ${target.suffix}`.trim();
}

function featureSuffix(docContext: ActiveDocCtx): string {
  return docContext.feature ? ` ${docContext.feature}` : "";
}

function overflowCatalogGroups(docContext: ActiveDocCtx): OverflowCatalogGroup[] {
  const family = overflowFamily(docContext);
  if (!family) return [];
  const entries = AFX_COMMAND_CATALOG[family] ?? [];
  const items = entries
    .map((entry) => overflowCatalogItem(entry, docContext))
    .filter((item): item is OverflowCatalogItem => item != null);

  return OVERFLOW_MODE_ORDER.map((group) => ({
    group,
    label: groupLabel(group),
    items: items
      .filter((item) => item.modeGroup === group)
      .sort((a, b) => intentRank(a.intentGroup) - intentRank(b.intentGroup)),
  })).filter((group) => group.items.length > 0);
}

function overflowFamily(docContext: ActiveDocCtx): AfxCommandFamily | null {
  if (docContext.format === "sprint" && docContext.docKind !== "journal") return "afx-sprint";
  switch (docContext.docKind) {
    case "spec":
      return "afx-spec";
    case "design":
      return "afx-design";
    case "tasks":
      return "afx-task";
    case "journal":
      return "afx-session";
    case "adr":
      return "afx-adr";
    case "research":
      return "afx-research";
    case "context":
      return "afx-context";
    case null:
      return null;
  }
}

function overflowCatalogItem(
  entry: SupportedAfxCommand,
  docContext: ActiveDocCtx,
): OverflowCatalogItem | null {
  if (entry.group !== "quality" && entry.group !== "state" && entry.group !== "action") {
    return null;
  }
  const resolved = overflowCommand(entry, docContext);

  return {
    label: resolved.label,
    command: resolved.command,
    description: overflowDescription(entry),
    autoSend: resolved.autoSend,
    intentGroup: entry.group,
    modeGroup: resolved.autoSend ? "run" : "compose",
  };
}

function overflowCommand(
  entry: SupportedAfxCommand,
  docContext: ActiveDocCtx,
): Pick<OverflowCatalogItem, "label" | "command" | "autoSend"> {
  const suffix = featureSuffix(docContext);

  if (entry.family === "afx-sprint") {
    if (entry.subcommand === "spec") {
      return { label: "Refine Spec", command: `${entry.command}${suffix}`.trim(), autoSend: false };
    }
    if (entry.subcommand === "design") {
      return {
        label: "Refine Design",
        command: `${entry.command}${suffix}`.trim(),
        autoSend: false,
      };
    }
    if (entry.subcommand === "task") {
      return {
        label: "Refine Tasks",
        command: `${entry.command}${suffix}`.trim(),
        autoSend: false,
      };
    }
  }

  if (entry.family === "afx-task") {
    if (entry.subcommand === "code") {
      return {
        label: "Code all",
        command: `${entry.command} all${suffix}`.trim(),
        autoSend: false,
      };
    }
    if (entry.subcommand === "verify") {
      return {
        label: "Verify all",
        command: `${entry.command} all${suffix}`.trim(),
        autoSend: true,
      };
    }
    if (entry.subcommand === "brief" || entry.subcommand === "complete") {
      return {
        label: entry.label,
        command: `${entry.command} <task-id>`,
        autoSend: false,
      };
    }
    if (entry.subcommand === "pick") {
      return {
        label: entry.label,
        command: entry.command,
        autoSend: entry.autoSend,
      };
    }
  }

  return {
    label: entry.label,
    command: `${entry.command}${suffix}`.trim(),
    autoSend: entry.autoSend,
  };
}

function overflowDescription(entry: SupportedAfxCommand): string {
  if (entry.autoSend) return "Runs immediately when the command needs no extra wording.";
  return "Opens in draft so you can add context before sending.";
}

function groupLabel(group: OverflowModeGroup): string {
  switch (group) {
    case "compose":
      return "Compose";
    case "run":
      return "Run Now";
  }
}

function intentRank(group: CatalogIntentGroup): number {
  return CATALOG_INTENT_ORDER.indexOf(group);
}

function baseAfxCommand(command: string): string {
  const match = command.trim().match(/^(\/afx-[a-z]+)(?:\s+([a-z][a-z-]*))?/i);
  if (!match) return command.trim();
  return [match[1], match[2]].filter(Boolean).join(" ").toLowerCase();
}

function preferredFocusAction(
  actions: readonly DocAction[],
  docKind: ActiveDocCtx["docKind"],
): DocAction | null {
  const preferredLabel = docKind === "tasks" ? "Code" : "Refine";
  return (
    actions.find((action) => action.label === preferredLabel) ??
    actions.find((action) => !action.autoSend) ??
    actions[0] ??
    null
  );
}

function toPresetContext(docContext: ActiveDocCtx) {
  const firstFocus = docContext.parsedFocuses?.[0];
  const taskFocus =
    docContext.docKind === "tasks"
      ? (docContext.parsedFocuses?.find((focus) => focus.commandSuffix?.startsWith("phase-")) ??
        firstFocus)
      : null;

  return {
    ...docContext,
    featurePath: docContext.feature,
    filePath: docContext.filePath,
    topic: docContext.feature,
    WBS: taskFocus?.commandSuffix ?? taskFocus?.slug ?? null,
    desId:
      docContext.docKind === "design"
        ? (firstFocus?.commandSuffix?.toUpperCase() ?? firstFocus?.slug ?? null)
        : null,
    change: null,
  };
}
