/**
 * Shared Canvas document shell used by Workbench and editor-area boot modes.
 *
 * @see docs/specs/229-app-workbench-canvas/tasks.md [9.1] [10.1] [11.1] [12.1]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE] [DES-CANVAS-INTERACTIONS]
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Boxes,
  CopyPlus,
  FilePlus2,
  FileText,
  FolderOpen,
  GitFork,
  LayoutTemplate,
  MessageSquareQuote,
  MoreHorizontal,
  Plus,
  Save,
  StickyNote,
  Tag,
  Trash2,
} from "lucide-react";

import {
  type CanvasTemplateId,
  createCanvasTemplate,
  emptyCanvas,
  parseJSONCanvas,
  serializeJSONCanvas,
} from "@afx/canvas-engine";
import type {
  CanvasActionMetadata,
  CanvasContentPreviewPayload,
  CanvasDescriptor,
  CanvasDocIndexEntry,
  CanvasDocumentSnapshot,
  CanvasEdge,
  CanvasEditResult,
  CanvasFileNode,
  CanvasNode,
  CanvasViewState,
  JSONCanvas,
  SddDocumentKind,
  WorkbenchMutationResult,
  WorkbenchSourceIdentity,
  WorkbenchSourceRevision,
} from "@afx/shared";
import { canvasWorkspaceRootHint, isMarkdownPath } from "@afx/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@afx/ui/components/alert-dialog";
import { Button } from "@afx/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@afx/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@afx/ui/components/dropdown-menu";
import { Input } from "@afx/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";

import { useWorkbench } from "../../context/workbench-context";
import { workbenchOn } from "../../lib/bridge";
import { canvasActionConfirmation } from "./afx-actions";
import {
  CanvasAttachMenu,
  type CanvasAttachSource,
  normalizeCanvasUrl,
} from "./canvas-attach-menu";
import { CanvasCommandMenu } from "./canvas-command-menu";
import {
  type CanvasCommandId,
  type CanvasMode,
  type CanvasProfile,
  hasStoredCanvasProfile,
  readCanvasMode,
  readCanvasProfile,
  writeCanvasMode,
  writeCanvasProfile,
} from "./canvas-command-registry";
import { CanvasStarterGallery } from "./canvas-starter-gallery";
import type { CanvasNodePreview } from "./nodes/canvas-flow-node";
import {
  type CanvasSurfaceCommand,
  type CanvasSurfaceCommandRequest,
  ReactFlowCanvas,
} from "./react-flow-canvas";
import {
  addFileNode,
  addFileNodes,
  addGroupNode,
  addLabelNode,
  addLinkNode,
  addTextNode,
} from "./use-canvas-model";

interface CanvasAppProps {
  editorClientId?: string;
  editorDocument?: CanvasDocumentSnapshot;
  editorViewState?: CanvasViewState;
}

interface PendingCanvasOperation {
  requestId: string;
  label: string;
  target: WorkbenchSourceIdentity;
  /** Marks the Spec Map dependency refresh so live edges can animate (FR-47). */
  kind?: "refresh-dependencies";
}

/**
 * Watchdog window for host-bound document operations. The host guarantees a
 * terminal afxMutationResult on every branch, but a dropped message must not
 * lock create/rename/duplicate/delete/refresh forever.
 */
const CANVAS_OPERATION_TIMEOUT_MS = 30_000;

/**
 * Webview-safe replacement for window.prompt/confirm — VS Code webviews do
 * not implement either, so every flow that relied on them silently no-oped.
 */
type CanvasDialogState =
  | {
      kind: "input";
      title: string;
      description?: string;
      label: string;
      initial: string;
      submitLabel: string;
      /** Optional secondary boolean choice rendered as a checkbox. */
      checkbox?: { label: string };
      validate?: (value: string) => string | undefined;
      onSubmit: (value: string, checked: boolean) => void;
    }
  | {
      kind: "confirm";
      title: string;
      body: string;
      confirmLabel: string;
      destructive?: boolean;
      onConfirm: () => void;
    }
  | {
      kind: "choice";
      title: string;
      body?: string;
      options: { label: string; description?: string; onSelect: () => void }[];
    };

interface PendingCanvasSave {
  requestId: string;
  sessionId: string;
  sequence: number;
  documentKey: string;
  content: string;
}

interface CanvasDocumentClientState {
  hostDocument?: CanvasDocumentSnapshot;
  localCanvas: JSONCanvas;
  mode: CanvasMode;
  profile: CanvasProfile;
  acceptedContent: string;
  dirty: boolean;
  parseError?: string;
  conflictContent?: string;
  pendingSave?: PendingCanvasSave;
  lastResult?: WorkbenchMutationResult | CanvasEditResult;
  acknowledgedRevision?: CanvasDocumentSnapshot["revision"];
  saveError?: string;
  lastIncoming: string;
}

interface ReferencedPreviewEntry extends CanvasNodePreview {
  requestId: string;
}

interface MountedContentReference {
  nodeId: string;
  owner: WorkbenchSourceIdentity;
  key: string;
}

export function CanvasApp({ editorClientId, editorDocument, editorViewState }: CanvasAppProps) {
  const { canvasEnabled, canvas: legacyCanvas, kanban, notesSources, send } = useWorkbench();
  const initialContent = editorDocument?.content ?? legacyCanvas?.content ?? "";
  const [initialDocumentKey] = useState(
    () =>
      editorDocument?.documentId ??
      legacyCanvas?.documentId ??
      legacyCanvas?.path ??
      ".afx/project.canvas",
  );
  const [initialDocumentState] = useState(() =>
    createDocumentClientState(
      initialDocumentKey,
      initialContent,
      editorDocument,
      editorDocument?.parseError,
    ),
  );
  const [library, setLibrary] = useState<CanvasDescriptor[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const selectedIdRef = useRef<string | undefined>(undefined);
  const documentStates = useRef(
    new Map<string, CanvasDocumentClientState>([[initialDocumentKey, initialDocumentState]]),
  );
  const activeDocumentKeyRef = useRef(initialDocumentKey);
  const [activeDocumentKey, setActiveDocumentKey] = useState(initialDocumentKey);
  const activeDocumentStateRef = useRef(initialDocumentState);
  const [documentState, setDocumentState] = useState(initialDocumentState);
  const [template, setTemplate] = useState<CanvasTemplateId>("ideas");
  const [switchWarning, setSwitchWarning] = useState<string>();
  const [pendingOperation, setPendingOperation] = useState<PendingCanvasOperation>();
  // Compact AFX-doc index for the "Add spec" picker and dependency badges (230).
  const [docIndex, setDocIndex] = useState<CanvasDocIndexEntry[]>([]);
  const [specPickerOpen, setSpecPickerOpen] = useState(false);
  const [specPickerQuery, setSpecPickerQuery] = useState("");
  const [dialog, setDialog] = useState<CanvasDialogState>();
  const [dialogValue, setDialogValue] = useState("");
  const [dialogChecked, setDialogChecked] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  function openDialog(next: CanvasDialogState): void {
    setDialogValue(next.kind === "input" ? next.initial : "");
    setDialogChecked(false);
    setDialogError(undefined);
    setDialog(next);
  }
  function submitDialog(): void {
    if (!dialog) return;
    if (dialog.kind === "input") {
      const value = dialogValue.trim();
      if (!value) return;
      const problem = dialog.validate?.(value);
      if (problem) {
        setDialogError(problem);
        return;
      }
      setDialog(undefined);
      dialog.onSubmit(value, dialogChecked);
      return;
    }
    if (dialog.kind === "confirm") {
      setDialog(undefined);
      dialog.onConfirm();
    }
    // "choice" dialogs resolve through their own per-option buttons.
  }
  const [operationResult, setOperationResult] = useState<WorkbenchMutationResult>();
  // Any change to pendingOperation (result arrived, next op started) clears the
  // timer via effect cleanup, so a fired timeout always refers to the live op.
  useEffect(() => {
    if (!pendingOperation) return;
    const { requestId, label, target } = pendingOperation;
    const timer = setTimeout(() => {
      setPendingOperation(undefined);
      setOperationResult({
        type: "afxMutationResult",
        requestId,
        outcome: "error",
        target,
        code: "write-failed",
        message: `${label} timed out waiting for the host. The document is unlocked - retry when VS Code responds.`,
        retryable: true,
      });
    }, CANVAS_OPERATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pendingOperation]);
  const [pendingActionRequestId, setPendingActionRequestId] = useState<string>();
  const [actionResult, setActionResult] = useState<WorkbenchMutationResult>();
  const [referencedPreviews, setReferencedPreviews] = useState<
    Record<string, ReferencedPreviewEntry>
  >({});
  const [urlPreviews, setUrlPreviews] = useState<Record<string, ReferencedPreviewEntry>>({});
  const [showGuide, setShowGuide] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [surfaceCommand, setSurfaceCommand] = useState<CanvasSurfaceCommandRequest>();
  const [pendingExport, setPendingExport] = useState<{ requestId: string; label: string }>();
  const [exportStatus, setExportStatus] = useState<{
    tone: "success" | "error";
    message: string;
  }>();
  // Success feedback auto-dismisses — only failures wait for the user.
  useEffect(() => {
    if (operationResult?.outcome !== "success") return;
    const timer = setTimeout(() => setOperationResult(undefined), 4000);
    return () => clearTimeout(timer);
  }, [operationResult]);
  useEffect(() => {
    if (actionResult?.outcome !== "success") return;
    const timer = setTimeout(() => setActionResult(undefined), 4000);
    return () => clearTimeout(timer);
  }, [actionResult]);
  useEffect(() => {
    if (!exportStatus || exportStatus.tone === "error") return;
    const timer = setTimeout(() => setExportStatus(undefined), 4000);
    return () => clearTimeout(timer);
  }, [exportStatus]);
  const localCanvasRef = useRef(initialDocumentState.localCanvas);
  const [editSessionId] = useState(() => editorClientId ?? uid());
  const nextEditSequence = useRef(0);
  const mountedContent = useRef(new Map<string, MountedContentReference>());
  const pendingContentRequests = useRef(new Map<string, string>());
  const loadedContentKeys = useRef(new Set<string>());
  const referencedPreviewsRef = useRef<Record<string, ReferencedPreviewEntry>>({});
  const pendingUrlRequests = useRef(new Map<string, string>());
  const pendingReferenceRequestId = useRef<string | undefined>(undefined);
  const previewDocumentKey = useRef<string | undefined>(undefined);
  // Latest-value refs so the once-registered live re-sync subscription (FR-14)
  // reads current state and calls the current refreshDependencies closure.
  const liveResyncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingOperationRef = useRef<PendingCanvasOperation | undefined>(undefined);
  const refreshDependenciesRef = useRef<() => void>(() => {});
  useEffect(() => () => clearTimeout(liveResyncTimer.current), []);

  const commitDocumentState = useCallback(
    (documentKey: string, next: CanvasDocumentClientState): void => {
      documentStates.current.set(documentKey, next);
      if (activeDocumentKeyRef.current !== documentKey) return;
      activeDocumentStateRef.current = next;
      localCanvasRef.current = next.localCanvas;
      setCommandMenuOpen(false);
      setAttachmentMenuOpen(false);
      setDocumentState(next);
    },
    [],
  );

  const updateDocumentState = useCallback(
    (
      documentKey: string,
      updateState: (current: CanvasDocumentClientState) => CanvasDocumentClientState,
    ): void => {
      const current = documentStates.current.get(documentKey);
      if (!current) return;
      commitDocumentState(documentKey, updateState(current));
    },
    [commitDocumentState],
  );

  const activateDocumentState = useCallback(
    (documentKey: string, next: CanvasDocumentClientState): void => {
      activeDocumentKeyRef.current = documentKey;
      setActiveDocumentKey(documentKey);
      documentStates.current.set(documentKey, next);
      activeDocumentStateRef.current = next;
      localCanvasRef.current = next.localCanvas;
      setDocumentState(next);
    },
    [],
  );

  const {
    hostDocument,
    localCanvas,
    mode,
    profile,
    acceptedContent,
    dirty,
    parseError,
    conflictContent,
    pendingSave,
    lastResult,
    acknowledgedRevision,
    saveError,
  } = documentState;
  const pendingRequestId = pendingSave?.requestId;

  const activeDocument = hostDocument ?? editorDocument;
  const activeSource = activeDocument?.source ?? legacyCanvas?.source;
  const documentKey = activeDocumentKey;
  const activeRevision = acknowledgedRevision ?? activeDocument?.revision ?? legacyCanvas?.revision;
  const activeDocumentLabel =
    activeDocument?.descriptor.label ??
    library.find((item) => item.id === selectedId)?.label ??
    fileLabel(documentKey);
  const sourceEditorDirty = Boolean(activeRevision?.dirty);
  const hasUnsavedDocumentWork = dirty || Boolean(pendingRequestId);
  const documentOperationLocked = hasUnsavedDocumentWork || Boolean(pendingOperation);
  const saveState = parseError
    ? "Invalid"
    : saveError
      ? "Save failed"
      : conflictContent !== undefined
        ? "Conflict"
        : pendingRequestId
          ? "Saving…"
          : lastResult?.outcome === "error" || lastResult?.outcome === "conflict"
            ? "Save failed"
            : dirty && sourceEditorDirty
              ? "Canvas + editor unsaved"
              : dirty
                ? "Unsaved"
                : sourceEditorDirty
                  ? "Editor has unsaved changes"
                  : "Saved";
  const attachmentSources = useMemo<CanvasAttachSource[]>(() => {
    const notes = notesSources.map((snapshot) => ({
      id: `note:${snapshot.source.rootUri}:${snapshot.source.relativePath}`,
      label: `${snapshot.source.rootName} · ${fileLabel(snapshot.source.relativePath)}`,
      kind: "note" as const,
      source: snapshot.source,
    }));
    const boards = (kanban?.boards ?? []).flatMap((board) =>
      board.source
        ? [
            {
              id: `board:${board.source.rootUri}:${board.source.relativePath}`,
              label: `${board.source.rootName} · ${board.meta?.title ?? board.name}`,
              kind: "board" as const,
              source: board.source,
            },
          ]
        : [],
    );
    return [...notes, ...boards].sort(
      (left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label),
    );
  }, [kanban?.boards, notesSources]);
  const canvasCapabilities = useMemo(
    () => ({
      afx: Boolean(
        attachmentSources.length > 0 ||
        activeSource?.relativePath.replace(/\\/g, "/").includes(".afx/"),
      ),
      architecture: true,
      canExport: true,
    }),
    [activeSource?.relativePath, attachmentSources.length],
  );

  // Picker list: specs + sprints by default; typing searches every afx kind by
  // id/title (the kind toggle), capped so a large repo never floods the list.
  const specPickerEntries = useMemo(() => {
    const entries = docIndex ?? [];
    const query = specPickerQuery.trim().toLowerCase();
    const base = query
      ? entries
      : entries.filter((entry) => entry.kind === "spec" || entry.kind === "sprint");
    const filtered = query
      ? base.filter((entry) =>
          `${entry.id} ${entry.title} ${entry.kind}`.toLowerCase().includes(query),
        )
      : base;
    return [...filtered].sort((left, right) => left.title.localeCompare(right.title)).slice(0, 50);
  }, [docIndex, specPickerQuery]);

  // Dependency badges (230 FR-2): for each loaded doc node, the declared targets
  // that are not yet on the canvas — the "expand to load" set.
  const docIndexById = useMemo(
    () => new Map((docIndex ?? []).map((entry) => [entry.id, entry])),
    [docIndex],
  );
  const expandableByNodeId = useMemo(() => {
    const nodes = localCanvas.nodes ?? [];
    const loaded = new Set(
      nodes.map((node) => docNodeIdOf(node)).filter((id): id is string => Boolean(id)),
    );
    const out: Record<string, CanvasDocIndexEntry[]> = {};
    for (const node of nodes) {
      const id = docNodeIdOf(node);
      const entry = id ? docIndexById.get(id) : undefined;
      if (!entry) continue;
      const targetIds = new Set<string>();
      for (const relationship of ["depends_on", "supersedes", "relates_to"] as const) {
        for (const target of entry.relationships[relationship] ?? []) targetIds.add(target);
      }
      const unloaded = [...targetIds]
        .filter((target) => !loaded.has(target))
        .map((target) => docIndexById.get(target))
        .filter((candidate): candidate is CanvasDocIndexEntry => Boolean(candidate));
      if (unloaded.length > 0) out[node.id] = unloaded;
    }
    return out;
  }, [localCanvas.nodes, docIndexById]);

  const expandableCountById = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [nodeId, entries] of Object.entries(expandableByNodeId))
      out[nodeId] = entries.length;
    return out;
  }, [expandableByNodeId]);

  // AFX-capable workspaces surface the full toolset by default; state-only so
  // the default stays adaptive until the user explicitly picks a profile.
  useEffect(() => {
    if (!canvasCapabilities.afx || documentState.profile !== "essentials") return;
    if (hasStoredCanvasProfile(documentKey)) return;
    updateDocumentState(documentKey, (current) =>
      current.profile === "essentials" ? { ...current, profile: "afx" } : current,
    );
  }, [canvasCapabilities.afx, documentKey, documentState.profile, updateDocumentState]);

  const applyIncomingContent = useCallback(
    (content: string) => {
      const activeKey = activeDocumentKeyRef.current;
      updateDocumentState(activeKey, (current) => applyIncomingCanvasContent(current, content));
    },
    [updateDocumentState],
  );

  const receiveDocument = useCallback(
    (document: CanvasDocumentSnapshot): boolean => {
      const documentKey = document.documentId;
      const current = documentStates.current.get(documentKey);
      const next = mergeIncomingCanvasDocument(current, document);
      if (selectedIdRef.current !== undefined && selectedIdRef.current !== document.descriptor.id) {
        documentStates.current.set(documentKey, next);
        return false;
      }
      activateDocumentState(documentKey, next);
      selectedIdRef.current = document.descriptor.id;
      setSelectedId(document.descriptor.id);
      return true;
    },
    [activateDocumentState],
  );

  const updateReferencedPreviews = useCallback(
    (
      update: (
        current: Record<string, ReferencedPreviewEntry>,
      ) => Record<string, ReferencedPreviewEntry>,
    ): void => {
      setReferencedPreviews((current) => {
        const next = update(current);
        referencedPreviewsRef.current = next;
        return next;
      });
    },
    [],
  );

  const requestReferencedPreview = useCallback(
    (reference: MountedContentReference, force = false): void => {
      if (
        !force &&
        (pendingContentRequests.current.has(reference.key) ||
          loadedContentKeys.current.has(reference.key))
      ) {
        return;
      }
      const requestId = uid();
      const existing = referencedPreviewsRef.current[reference.key];
      pendingContentRequests.current.set(reference.key, requestId);
      updateReferencedPreviews((current) => ({
        ...current,
        [reference.key]: {
          requestId,
          state: existing?.payload ? "stale" : "loading",
          payload: existing?.payload,
          revision: existing?.revision,
        },
      }));
      send({
        type: "afxCanvasContentPreviewRequest",
        requestId,
        owner: reference.owner,
        knownRevision: existing?.revision?.contentRevision,
      });
    },
    [send, updateReferencedPreviews],
  );

  const mountReferencedContent = useCallback(
    (node: CanvasFileNode): void | (() => void) => {
      const owner = referencedPreviewOwner(node, activeSource);
      if (!owner) return;
      const reference: MountedContentReference = {
        nodeId: node.id,
        owner,
        key: referencedDocumentKey(owner),
      };
      mountedContent.current.set(node.id, reference);
      requestReferencedPreview(reference);
      return () => {
        if (mountedContent.current.get(node.id)?.key === reference.key) {
          mountedContent.current.delete(node.id);
        }
      };
    },
    [activeSource, requestReferencedPreview],
  );

  const nodePreviews = useMemo(() => {
    const previews: Record<string, CanvasNodePreview> = {};
    for (const node of localCanvas.nodes ?? []) {
      if (node.type === "file") {
        const owner = referencedPreviewOwner(node, activeSource);
        if (!owner) continue;
        const entry = referencedPreviews[referencedDocumentKey(owner)];
        if (entry) previews[node.id] = entry;
      } else if (node.type === "link") {
        const entry = urlPreviews[urlPreviewKey(node.url)];
        if (entry) previews[node.id] = entry;
      }
    }
    return previews;
  }, [activeSource, localCanvas.nodes, referencedPreviews, urlPreviews]);

  const fileContents = useMemo(() => {
    const contents: Record<string, string> = {};
    for (const node of localCanvas.nodes ?? []) {
      if (node.type !== "file") continue;
      const owner = referencedPreviewOwner(node, activeSource);
      if (!owner) continue;
      const payload = referencedPreviews[referencedDocumentKey(owner)]?.payload;
      if (payload && "kind" in payload) {
        const content = previewContext(payload);
        if (content) contents[node.id] = content;
      }
    }
    return contents;
  }, [activeSource, localCanvas.nodes, referencedPreviews]);

  const requestUrlPreview = useCallback(
    (url: string): void => {
      const key = urlPreviewKey(url);
      const requestId = uid();
      pendingUrlRequests.current.set(key, requestId);
      setUrlPreviews((current) => ({
        ...current,
        [key]: {
          requestId,
          state: current[key]?.payload ? "stale" : "loading",
          payload: current[key]?.payload,
        },
      }));
      send({ type: "afxCanvasUrlPreviewRequest", requestId, url, allowNetwork: true });
    },
    [send],
  );

  useEffect(() => {
    if (previewDocumentKey.current === undefined) {
      previewDocumentKey.current = documentKey;
      return;
    }
    if (previewDocumentKey.current === documentKey) return;
    previewDocumentKey.current = documentKey;
    mountedContent.current.clear();
    pendingContentRequests.current.clear();
    loadedContentKeys.current.clear();
    pendingUrlRequests.current.clear();
    referencedPreviewsRef.current = {};
    setReferencedPreviews({});
    setUrlPreviews({});
  }, [documentKey]);

  const stageEdit = useCallback(
    (next: JSONCanvas): void => {
      if (conflictContent !== undefined || parseError) return;
      const content = serializeJSONCanvas(next);
      if (!activeSource) {
        updateDocumentState(documentKey, (current) => ({
          ...current,
          saveError: "Canvas cannot be saved until the host provides a workspace file identity.",
        }));
        return;
      }
      const requestId = uid();
      const sequence = ++nextEditSequence.current;
      const nextPendingSave = {
        requestId,
        sessionId: editSessionId,
        sequence,
        documentKey,
        content,
      };
      updateDocumentState(documentKey, (current) => ({
        ...current,
        pendingSave: nextPendingSave,
      }));
      send({
        type: "afxCanvasEdit",
        requestId,
        sessionId: editSessionId,
        sequence,
        documentId: documentKey,
        target: activeSource,
        baseRevision: activeRevision?.contentRevision,
        content,
      });
    },
    [
      activeRevision?.contentRevision,
      activeSource,
      conflictContent,
      documentKey,
      editSessionId,
      parseError,
      send,
      updateDocumentState,
    ],
  );

  const update = useCallback(
    (next: JSONCanvas, options?: { persist?: boolean }): void => {
      // Intermediate geometry ticks (a node/selection drag, persist === false)
      // fire at animation-frame rate. React Flow already renders the gesture
      // from its own internal node state, so stash the latest geometry into the
      // refs/map WITHOUT a setState — a full canvas-app re-render on every
      // mouse-move is what made large boards lag. The committing tick below does
      // the single setState and stages the save.
      if (options?.persist === false) {
        const current = documentStates.current.get(documentKey);
        if (!current) return;
        const staged: CanvasDocumentClientState = {
          ...current,
          localCanvas: next,
          dirty: true,
          saveError: undefined,
          lastResult: undefined,
        };
        documentStates.current.set(documentKey, staged);
        if (activeDocumentKeyRef.current === documentKey) {
          activeDocumentStateRef.current = staged;
          localCanvasRef.current = next;
        }
        return;
      }
      updateDocumentState(documentKey, (current) => ({
        ...current,
        localCanvas: next,
        dirty: true,
        saveError: undefined,
        lastResult: undefined,
      }));
      stageEdit(next);
    },
    [documentKey, stageEdit, updateDocumentState],
  );

  useEffect(() => {
    if (editorClientId) {
      send({ type: "afxCanvasEditorReady", clientId: editorClientId, documentId: documentKey });
    }
    // Both hosts serve the canvas library; the editor uses it for the file
    // switcher and New/Rename/Duplicate/Delete (results open as editor tabs).
    send({ type: "afxCanvasList" });
  }, [documentKey, editorClientId, send]);

  useEffect(() => {
    const disposables = [
      workbenchOn("afxCanvasLibrary", (message) => {
        setLibrary(message.canvases);
        setOperationResult(undefined);
        const nextSelectedId = message.selectedId ?? message.canvases[0]?.id;
        if (nextSelectedId) {
          selectedIdRef.current = nextSelectedId;
          setSelectedId(nextSelectedId);
        }
      }),
      // Bidirectional live re-sync (230 FR-14): a doc changed on disk (human or
      // agent). In Spec Map mode, reconcile the graph — debounced, and deferred
      // while the canvas is dirty or busy so background edits never clobber
      // in-flight work (the conflict-aware refresh handles the rest).
      workbenchOn("afxCanvasDocIndex", (message) => {
        setDocIndex(message.entries ?? []);
      }),
      workbenchOn("afxDocContentInvalidated", () => {
        const state = activeDocumentStateRef.current;
        // Keep the doc index fresh so the picker and badges track disk changes.
        if (state.mode === "spec-map") send({ type: "afxCanvasDocIndex", requestId: uid() });
        if (state.mode !== "spec-map" || state.dirty || state.pendingSave) return;
        if (liveResyncTimer.current) clearTimeout(liveResyncTimer.current);
        liveResyncTimer.current = setTimeout(() => {
          liveResyncTimer.current = undefined;
          if (!pendingOperationRef.current) refreshDependenciesRef.current();
        }, 250);
      }),
      workbenchOn("afxCanvasDocument", (message) => {
        if (!receiveDocument(message.document)) return;
        setOperationResult(undefined);
        setSwitchWarning(undefined);
      }),
      workbenchOn("afxCanvasEditorDocument", (message) => {
        if (!editorClientId || message.clientId === editorClientId) {
          receiveDocument(message.document);
        }
      }),
      workbenchOn("afxUpdate", (message) => {
        if (!activeDocumentStateRef.current.hostDocument && message.canvas?.content !== undefined) {
          applyIncomingContent(message.canvas.content);
        }
      }),
      workbenchOn("afxMutationResult", (message) => {
        if (message.requestId === pendingOperation?.requestId) {
          setPendingOperation(undefined);
          // A user-cancelled host dialog is a quiet dismissal, not an error.
          const cancelled = message.outcome !== "success" && message.code === "cancelled";
          setOperationResult(cancelled ? undefined : message);
          return;
        }
        if (message.requestId === pendingActionRequestId) {
          setPendingActionRequestId(undefined);
          setActionResult(message);
          return;
        }
      }),
      workbenchOn("afxCanvasEditResult", (message) => {
        const matched = [...documentStates.current.entries()].find(([, state]) => {
          const pending = state.pendingSave;
          return (
            pending?.sessionId === message.sessionId &&
            pending.requestId === message.requestId &&
            pending.sequence === message.sequence
          );
        });
        if (!matched || message.sessionId !== editSessionId) return;
        if (message.outcome === "superseded") return;
        const [acknowledgedDocumentKey] = matched;
        updateDocumentState(acknowledgedDocumentKey, (current) => {
          const acknowledgedSave = current.pendingSave;
          if (!acknowledgedSave) return current;
          if (message.outcome !== "success") {
            return {
              ...current,
              pendingSave: undefined,
              saveError: message.message,
              lastResult: message,
            };
          }
          const currentContent = serializeJSONCanvas(current.localCanvas);
          return {
            ...current,
            pendingSave: undefined,
            saveError: undefined,
            lastResult: message,
            dirty: currentContent !== acknowledgedSave.content,
            acceptedContent: acknowledgedSave.content,
            lastIncoming: acknowledgedSave.content,
            acknowledgedRevision: message.revision,
            hostDocument:
              current.hostDocument?.documentId === acknowledgedSave.documentKey
                ? {
                    ...current.hostDocument,
                    content: acknowledgedSave.content,
                    revision: message.revision,
                  }
                : current.hostDocument,
          };
        });
        if (activeDocumentKeyRef.current === acknowledgedDocumentKey) {
          setSwitchWarning(undefined);
        }
      }),
      workbenchOn("afxCanvasContentPreviewResult", (message) => {
        const key = referencedDocumentKey(message.owner);
        if (pendingContentRequests.current.get(key) !== message.requestId) return;
        pendingContentRequests.current.delete(key);
        loadedContentKeys.current.add(key);
        updateReferencedPreviews((current) => ({
          ...current,
          [key]: {
            requestId: message.requestId,
            state: message.preview.state,
            payload: message.preview,
            revision: message.revision,
          },
        }));
      }),
      workbenchOn("afxCanvasContentPreviewInvalidated", (message) => {
        const invalidatedKey = referencedDocumentKey(message.owner);
        const requested = new Set<string>();
        for (const reference of mountedContent.current.values()) {
          if (reference.key !== invalidatedKey || requested.has(reference.key)) continue;
          requested.add(reference.key);
          requestReferencedPreview(reference, true);
        }
      }),
      workbenchOn("afxCanvasUrlPreviewResult", (message) => {
        const key = urlPreviewKey(message.url);
        if (pendingUrlRequests.current.get(key) !== message.requestId) return;
        pendingUrlRequests.current.delete(key);
        setUrlPreviews((current) => ({
          ...current,
          [key]: {
            requestId: message.requestId,
            state: message.preview.state,
            payload: message.preview,
          },
        }));
      }),
      workbenchOn("afxMarkdownFilePicked", (message) => {
        const current = localCanvasRef.current;
        update(addFileNode(current, message.filePath, insertPoint(current.nodes?.length ?? 0)));
      }),
      workbenchOn("afxCanvasReferencesPicked", (message) => {
        if (pendingReferenceRequestId.current !== message.requestId) return;
        pendingReferenceRequestId.current = undefined;
        if (message.outcome === "error") {
          // A failed host picker must be visible — silence reads as a dead button.
          setSwitchWarning(message.message ?? "Attaching files failed in the host.");
          return;
        }
        if (message.references.length === 0) return;
        const current = localCanvasRef.current;
        update(
          addFileNodes(
            current,
            message.references.map((reference) => ({
              file: reference.filePath,
              source: reference.source,
            })),
            insertPoint(current.nodes?.length ?? 0),
          ),
        );
      }),
      workbenchOn("afxCanvasExportResult", (message) => {
        if (pendingExport?.requestId !== message.requestId) return;
        setPendingExport(undefined);
        if (message.outcome === "success") {
          setExportStatus({
            tone: "success",
            message: `Exported ${message.targetName ?? pendingExport.label}.`,
          });
        } else if (message.outcome === "error") {
          setExportStatus({ tone: "error", message: message.message });
        }
      }),
    ];
    return () => disposables.forEach((disposable) => disposable());
  }, [
    applyIncomingContent,
    editSessionId,
    editorClientId,
    pendingActionRequestId,
    pendingOperation,
    pendingExport,
    receiveDocument,
    requestReferencedPreview,
    send,
    updateDocumentState,
    updateReferencedPreviews,
    update,
  ]);

  function save(): void {
    if (!dirty || pendingRequestId || conflictContent !== undefined || parseError) return;
    stageEdit(localCanvasRef.current);
  }

  function add(kind: "text" | "note" | "label" | "group" | "annotation"): void {
    const at = insertPoint(localCanvas.nodes?.length ?? 0);
    update(
      kind === "group"
        ? addGroupNode(localCanvas, at)
        : kind === "label"
          ? addLabelNode(localCanvas, at)
          : addTextNode(
              localCanvas,
              at,
              kind === "note"
                ? "# Note\n\n"
                : kind === "annotation"
                  ? "Point the arrow at what this explains."
                  : "## New thought\n\n",
              undefined,
              kind === "note" ? "3" : undefined,
              kind === "note" ? "note" : kind === "annotation" ? "annotation" : undefined,
            ),
    );
  }

  function createNamedCanvas(): void {
    if (documentOperationLocked || !activeSource) return;
    const source = activeSource;
    const chosenTemplate = template;
    openDialog({
      kind: "input",
      title: "New canvas",
      description: "Creates a canvas file in this workspace. Default location: .afx/canvases/.",
      label: "Canvas name",
      initial: "Feature plan",
      submitLabel: "Create",
      checkbox: { label: "Choose a folder instead of .afx/canvases/" },
      onSubmit: (name, pickLocation) => {
        const requestId = uid();
        setOperationResult(undefined);
        setPendingOperation({ requestId, label: "Creating Canvas", target: source });
        send({
          type: "afxCanvasCreate",
          requestId,
          targetRootUri: source.rootUri,
          name,
          template: chosenTemplate,
          ...(pickLocation ? { pickLocation: true } : {}),
        });
      },
    });
  }

  function renameCanvas(): void {
    if (documentOperationLocked || !activeSource || !activeRevision) return;
    const source = activeSource;
    const revision = activeRevision;
    openDialog({
      kind: "input",
      title: "Rename canvas",
      label: "New name",
      initial: activeDocument?.descriptor.label ?? "",
      submitLabel: "Rename",
      onSubmit: (name) => {
        const requestId = uid();
        setOperationResult(undefined);
        setPendingOperation({ requestId, label: "Renaming Canvas", target: source });
        send({
          type: "afxCanvasRename",
          requestId,
          target: source,
          expectedRevision: revision.contentRevision,
          name,
        });
      },
    });
  }

  function duplicateCanvas(): void {
    if (documentOperationLocked || !activeSource || !activeRevision) return;
    const source = activeSource;
    const revision = activeRevision;
    openDialog({
      kind: "input",
      title: "Duplicate canvas",
      label: "Duplicate as",
      initial: `${activeDocument?.descriptor.label ?? "Canvas"} copy`,
      submitLabel: "Duplicate",
      onSubmit: (name) => {
        const requestId = uid();
        setOperationResult(undefined);
        setPendingOperation({ requestId, label: "Duplicating Canvas", target: source });
        send({
          type: "afxCanvasDuplicate",
          requestId,
          target: source,
          expectedRevision: revision.contentRevision,
          name,
        });
      },
    });
  }

  function deleteCanvas(): void {
    if (
      documentOperationLocked ||
      !activeSource ||
      !activeRevision ||
      activeDocument?.descriptor.kind === "project"
    )
      return;
    const source = activeSource;
    const revision = activeRevision;
    openDialog({
      kind: "confirm",
      title: "Delete canvas",
      body: `Delete ${activeDocument?.descriptor.label ?? "this canvas"}? The file is removed from the workspace.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => {
        const requestId = uid();
        setOperationResult(undefined);
        setPendingOperation({ requestId, label: "Deleting Canvas", target: source });
        send({
          type: "afxCanvasDelete",
          requestId,
          target: source,
          expectedRevision: revision.contentRevision,
        });
      },
    });
  }

  function refreshDependencies(): void {
    if (documentOperationLocked || !activeSource || !activeRevision) return;
    const requestId = uid();
    setOperationResult(undefined);
    setPendingOperation({
      requestId,
      label: "Refreshing dependencies",
      target: activeSource,
      kind: "refresh-dependencies",
    });
    send({
      type: "afxCanvasRefreshDependencies",
      requestId,
      target: activeSource,
      expectedRevision: activeRevision.contentRevision,
    });
  }
  // Keep the live re-sync subscription pointed at the current closures/state.
  useEffect(() => {
    refreshDependenciesRef.current = refreshDependencies;
    pendingOperationRef.current = pendingOperation;
  });

  function sendAuthorRelationship(
    sourceNode: CanvasNode,
    targetId: string,
    relationship: DocRelationship,
    remove: boolean,
    declaredToken?: string,
  ): void {
    const docSource = sourceNode.type === "file" ? sourceNode.afxSource : undefined;
    if (!docSource || !activeSource) return;
    const requestId = uid();
    setOperationResult(undefined);
    setPendingOperation({
      requestId,
      label: remove ? "Removing relationship" : "Authoring relationship",
      target: activeSource,
      kind: "refresh-dependencies",
    });
    send({
      type: "afxCanvasAuthorRelationship",
      requestId,
      source: docSource,
      targetId,
      ...(declaredToken ? { declaredToken } : {}),
      relationship,
      remove,
      canvasTarget: activeSource,
      canvasExpectedRevision: activeRevision?.contentRevision,
    });
  }

  /** Draw-to-author: returns true when the connection is handled as authoring. */
  function authorRelationship(sourceNode: CanvasNode, targetNode: CanvasNode): boolean {
    if (documentOperationLocked || !activeSource) return false;
    const source = docNodeInfo(sourceNode);
    const target = docNodeInfo(targetNode);
    // Both endpoints must be authoring-eligible afx docs; a journal (FR-13) or
    // non-afx node (FR-7) falls through to a free-form manual edge.
    if (!source || !target) return false;
    const options = relationshipsForPair(source.kind, target.kind);
    if (options.length === 0) return false;
    const commit = (relationship: DocRelationship): void => {
      openDialog({
        kind: "confirm",
        title: "Author relationship",
        body: `Add \`${target.token}\` to ${source.label}'s ${relationship}? This writes to ${source.relativePath}.`,
        confirmLabel: "Author",
        onConfirm: () => sendAuthorRelationship(sourceNode, target.id, relationship, false),
      });
    };
    if (options.length === 1 && options[0]) {
      commit(options[0]);
    } else {
      openDialog({
        kind: "choice",
        title: "Choose a relationship",
        body: `How does ${source.label} relate to ${target.token}?`,
        options: options.map((relationship) => ({
          label: RELATIONSHIP_LABEL[relationship],
          description: `Writes ${relationship} in ${source.relativePath}`,
          onSelect: () => commit(relationship),
        })),
      });
    }
    return true;
  }

  /** Delete-to-remove: returns true when the edge deletion is handled here. */
  function removeRelationshipEdge(edge: CanvasEdge): boolean {
    if (documentOperationLocked || !activeSource) return false;
    const provenance = edge.afxProvenance;
    if (!provenance) return false;
    const relationship: DocRelationship =
      provenance.kind === "declared-dependency"
        ? "depends_on"
        : (provenance.relationship ?? "relates_to");
    const nodes = localCanvasRef.current.nodes ?? [];
    const sourceNode = nodes.find((node) => node.id === edge.fromNode);
    const targetNode = nodes.find((node) => node.id === edge.toNode);
    const target = targetNode ? docNodeInfo(targetNode) : undefined;
    if (!sourceNode || sourceNode.type !== "file" || !sourceNode.afxSource || !target) return false;
    openDialog({
      kind: "choice",
      title: "Remove relationship",
      body: `Remove ${relationship} \`${target.token}\` — from the source frontmatter, or just detach it on the canvas?`,
      options: [
        {
          label: "Remove from frontmatter",
          description: `Deletes the entry in the source document`,
          onSelect: () =>
            sendAuthorRelationship(
              sourceNode,
              target.id,
              relationship,
              true,
              provenance.declaredToken,
            ),
        },
        {
          label: "Detach only",
          description: "Keeps the frontmatter; hides the edge on this canvas",
          onSelect: () => detachEdgeOnCanvas(edge.id),
        },
      ],
    });
    return true;
  }

  function detachEdgeOnCanvas(edgeId: string): void {
    const current = localCanvasRef.current;
    update({
      ...current,
      edges: (current.edges ?? []).map((edge) =>
        edge.id === edgeId && edge.afxProvenance
          ? { ...edge, afxProvenance: { ...edge.afxProvenance, detached: true } }
          : edge,
      ),
    });
  }

  function runStarter(selectedTemplate = template): void {
    const apply = (): void => {
      setTemplate(selectedTemplate);
      update(createCanvasTemplate(selectedTemplate));
      setShowGuide(false);
    };
    if ((localCanvas.nodes?.length ?? 0) === 0) {
      apply();
      return;
    }
    openDialog({
      kind: "confirm",
      title: "Replace canvas contents",
      body: "Replace this canvas with the selected starter? Your current nodes are replaced (undo restores them).",
      confirmLabel: "Replace",
      onConfirm: apply,
    });
  }

  function changeMode(next: CanvasMode): void {
    updateDocumentState(documentKey, (current) => ({ ...current, mode: next }));
    writeCanvasMode(documentKey, next);
    // Load the spec-aware index for the "Add spec" picker + badges on entry.
    if (next === "spec-map") send({ type: "afxCanvasDocIndex", requestId: uid() });
  }

  function docNodeFile(entry: CanvasDocIndexEntry): string {
    return activeSource && entry.source.rootUri === activeSource.rootUri
      ? entry.source.relativePath
      : `${entry.source.rootName}/${entry.source.relativePath}`;
  }

  function addDocNode(entry: CanvasDocIndexEntry): void {
    const current = localCanvasRef.current;
    // Already loaded? Don't duplicate — just close the picker.
    const already = (current.nodes ?? []).some(
      (node) => node.type === "file" && node.afxSource?.relativePath === entry.source.relativePath,
    );
    setSpecPickerOpen(false);
    setSpecPickerQuery("");
    if (already) return;
    const id = uid();
    const withNode = addFileNode(
      current,
      docNodeFile(entry),
      insertPoint(current.nodes?.length ?? 0),
      id,
      entry.source,
    );
    update({
      ...withNode,
      nodes: (withNode.nodes ?? []).map((node) =>
        node.id === id
          ? {
              ...node,
              afxLabel: entry.title,
              afxDoc: {
                version: 1,
                kind: entry.kind,
                id: entry.id,
                token: entry.token,
                ...(entry.status ? { status: entry.status } : {}),
              },
            }
          : node,
      ),
    });
  }

  function addAllSpecs(): void {
    const CAP = 40;
    const current = localCanvasRef.current;
    const loaded = new Set((current.nodes ?? []).map((node) => docNodeIdOf(node)).filter(Boolean));
    const all = (docIndex ?? []).filter(
      (entry) => (entry.kind === "spec" || entry.kind === "sprint") && !loaded.has(entry.id),
    );
    const toAdd = all.slice(0, CAP);
    setSpecPickerOpen(false);
    setSpecPickerQuery("");
    if (toAdd.length === 0) return;
    let next = current;
    for (const entry of toAdd) {
      const id = uid();
      next = addFileNode(
        next,
        docNodeFile(entry),
        insertPoint(next.nodes?.length ?? 0),
        id,
        entry.source,
      );
      next = {
        ...next,
        nodes: (next.nodes ?? []).map((node) =>
          node.id === id
            ? {
                ...node,
                afxLabel: entry.title,
                afxDoc: {
                  version: 1,
                  kind: entry.kind,
                  id: entry.id,
                  token: entry.token,
                  ...(entry.status ? { status: entry.status } : {}),
                },
              }
            : node,
        ),
      };
    }
    update(next);
    if (all.length > toAdd.length) {
      setSwitchWarning(
        `Added ${toAdd.length} of ${all.length} specs (capped). Expand from a node or filter to load the rest.`,
      );
    }
  }

  function expandNode(nodeId: string): void {
    const entries = expandableByNodeId[nodeId];
    if (!entries || entries.length === 0) return;
    openDialog({
      kind: "choice",
      title: "Load dependencies",
      body: `This spec has ${entries.length} unloaded ${
        entries.length === 1 ? "dependency" : "dependencies"
      } — load all, or pick one.`,
      options: [
        ...(entries.length > 1
          ? [
              {
                label: `Load all ${entries.length}`,
                description: "Add every dependency to the map",
                onSelect: () => entries.forEach((entry) => addDocNode(entry)),
              },
            ]
          : []),
        ...entries.map((entry) => ({
          label: entry.title,
          description: `Load ${entry.id.split(":").pop() ?? entry.id}`,
          onSelect: () => addDocNode(entry),
        })),
      ],
    });
  }

  function changeProfile(next: CanvasProfile): void {
    updateDocumentState(documentKey, (current) => ({ ...current, profile: next }));
    writeCanvasProfile(documentKey, next);
  }

  function requestSurfaceCommand(command: CanvasSurfaceCommand): void {
    setSurfaceCommand((current) => ({ id: (current?.id ?? 0) + 1, command }));
  }

  function addUrl(url: string): void {
    const normalized = normalizeCanvasUrl(url);
    if (!normalized.ok) return;
    const current = localCanvasRef.current;
    update(addLinkNode(current, normalized.url, insertPoint(current.nodes?.length ?? 0)));
  }

  function attachSource(source: CanvasAttachSource): void {
    const current = localCanvasRef.current;
    update(
      addFileNode(
        current,
        source.source.relativePath,
        insertPoint(current.nodes?.length ?? 0),
        undefined,
        source.source,
      ),
    );
  }

  function runCanvasCommand(command: CanvasCommandId): void {
    if (command === "add-card") return add("text");
    if (command === "add-note") return add("note");
    if (command === "add-label") return add("label");
    if (command === "add-annotation") return add("annotation");
    if (command === "add-group") return add("group");
    if (command === "add-file") {
      setAttachmentMenuOpen(true);
      return;
    }
    if (command === "add-link") {
      openDialog({
        kind: "input",
        title: "Attach URL",
        label: "URL",
        initial: "https://",
        submitLabel: "Attach",
        validate: (value) => {
          const normalized = normalizeCanvasUrl(value);
          return normalized.ok ? undefined : normalized.message;
        },
        onSubmit: (value) => {
          const normalized = normalizeCanvasUrl(value);
          if (normalized.ok) addUrl(normalized.url);
        },
      });
      return;
    }
    if (
      command === "fit-view" ||
      command === "search" ||
      command === "undo" ||
      command === "redo"
    ) {
      requestSurfaceCommand(command);
      return;
    }
    if (command === "align" || command === "distribute" || command === "style-selection") {
      requestSurfaceCommand("composition");
      return;
    }
    if (command === "auto-layout") return requestSurfaceCommand("auto-layout");
    if (command === "architecture-explorer") return requestSurfaceCommand("architecture-explorer");
    if (command === "export") return requestSurfaceCommand("export");
    if (command === "presentation") return requestSurfaceCommand("presentation");
    if (command === "refresh-dependencies") return refreshDependencies();
    if (command === "attach-note" || command === "attach-board") {
      setAttachmentMenuOpen(true);
      return;
    }
    if (command === "send-chat") return requestSurfaceCommand("send-chat");
    if (command === "prepare-spec" || command === "prepare-sprint") {
      const exact =
        command === "prepare-spec"
          ? `/afx-spec refine ${activeDocumentLabel ?? "next-feature"}`
          : `/afx-sprint ${activeDocumentLabel ?? "next-feature"}`;
      openDialog({
        kind: "confirm",
        title: "Send to Chat",
        body: `Insert this exact planning handoff in Chat?\n\n${exact}`,
        confirmLabel: "Insert in Chat",
        onConfirm: () => send({ type: "afxOpenChatCommand", command: exact, mode: "insert" }),
      });
    }
  }

  function sendSelectionToChat(nodes: readonly CanvasNode[]): void {
    if (nodes.length === 0) return;
    const context = nodes.map((node) => nodeContext(node, fileContents)).join("\n\n---\n\n");
    send({ type: "afxOpenChatCommand", command: context, mode: "send" });
  }

  function nodeAction(
    node: CanvasNode,
    action: "open" | "preview" | "loadPreview" | "chat" | "note" | "delete" | "expand",
  ): void {
    if (action === "delete") return;
    if (action === "expand") return expandNode(node.id);
    if (action === "loadPreview" && node.type === "file") {
      const owner = referencedPreviewOwner(node, activeSource);
      if (owner) {
        requestReferencedPreview(
          { nodeId: node.id, owner, key: referencedDocumentKey(owner) },
          true,
        );
      }
      return;
    }
    if (action === "loadPreview" && node.type === "link") {
      requestUrlPreview(node.url);
      return;
    }
    if (action === "open" && node.type === "link") {
      send({ type: "afxOpenExternalUrl", url: node.url });
      return;
    }
    if (action === "open" && node.type === "file") {
      const owner = node.afxSource ?? activeSource;
      send({
        type: "afxOpenFile",
        path: node.file,
        mode: "editor",
        owner,
        subpath: node.subpath,
      });
      return;
    }
    if (action === "preview" && node.type === "file" && isMarkdownPath(node.file)) {
      const owner = node.afxSource ?? activeSource;
      send({
        type: "afxOpenFile",
        path: node.file,
        mode: "afxPreview",
        owner,
        subpath: node.subpath,
      });
      return;
    }
    const context = nodeContext(node, fileContents);
    if (action === "note") send({ type: "afxAppendNote", text: context });
    if (action === "chat") send({ type: "afxOpenChatCommand", command: context, mode: "send" });
  }

  function runCanvasAction(node: CanvasNode, action: CanvasActionMetadata): void {
    if (!activeSource || !activeRevision || pendingActionRequestId) return;
    const source = activeSource;
    const revision = activeRevision;
    openDialog({
      kind: "confirm",
      title: "Run canvas action",
      body: canvasActionConfirmation(source.relativePath, [node.id], action),
      confirmLabel: "Run action",
      onConfirm: () => runCanvasActionConfirmed(node, action, source, revision),
    });
  }

  function runCanvasActionConfirmed(
    node: CanvasNode,
    action: CanvasActionMetadata,
    source: WorkbenchSourceIdentity,
    revision: WorkbenchSourceRevision,
  ): void {
    const requestId = uid();
    setActionResult(undefined);
    setPendingActionRequestId(requestId);
    send({
      type: "afxCanvasRunAction",
      requestId,
      target: source,
      expectedRevision: revision.contentRevision,
      action,
      nodeIds: [node.id],
      confirmed: true,
    });
  }

  if (!canvasEnabled && !editorClientId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Canvas experiment disabled.
      </div>
    );
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          setCommandMenuOpen(true);
        }
      }}
    >
      <div
        data-testid="canvas-toolbar"
        className="afx-scrollbar-none @container/dtb relative flex h-8 min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b px-1.5"
      >
        {/* Library operations work in both hosts; the editor host opens
            create/duplicate/select results as separate editor tabs because a
            custom editor is bound to exactly one document (FR-3). */}
        <select
          aria-label="Canvas file"
          value={selectedId ?? ""}
          disabled={Boolean(pendingOperation)}
          title={
            pendingOperation
              ? "Wait for the current Canvas library operation to finish."
              : "Canvas file"
          }
          onChange={(event) => {
            if (pendingOperation) {
              setSwitchWarning("Wait for the current Canvas library operation to finish.");
              return;
            }
            selectedIdRef.current = event.target.value;
            setSelectedId(event.target.value);
            setSwitchWarning(undefined);
            send({ type: "afxCanvasSelect", canvasId: event.target.value });
          }}
          className="h-6 max-w-44 shrink-0 rounded-sm border bg-background px-1.5 text-[11px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {library.length === 0 ? <option value="">Project Canvas</option> : null}
          {library.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <IconButton
          label="New canvas"
          shortLabel="New"
          disabled={documentOperationLocked}
          onClick={createNamedCanvas}
        >
          <FilePlus2 size={13} />
        </IconButton>
        <IconButton
          label="Rename canvas"
          shortLabel="Rename"
          className="@max-[46rem]/dtb:hidden"
          disabled={documentOperationLocked}
          onClick={renameCanvas}
        >
          <FileText size={13} />
        </IconButton>
        <IconButton
          label="Duplicate canvas"
          shortLabel="Duplicate"
          className="@max-[46rem]/dtb:hidden"
          disabled={documentOperationLocked}
          onClick={duplicateCanvas}
        >
          <CopyPlus size={13} />
        </IconButton>
        <IconButton
          label="Delete canvas"
          shortLabel="Delete"
          className="@max-[46rem]/dtb:hidden"
          disabled={documentOperationLocked || activeDocument?.descriptor.kind === "project"}
          onClick={deleteCanvas}
        >
          <Trash2 size={13} />
        </IconButton>
        <span className="mx-0.5 h-5 w-px bg-border" />
        {/* Mode is a single segmented choice — one look, two clear options. */}
        <div
          role="group"
          aria-label="Canvas mode"
          className="flex shrink-0 items-center overflow-hidden rounded-sm border"
        >
          <button
            type="button"
            aria-pressed={mode === "freeform"}
            title="Freeform — sketch and plan with cards, notes, and arrows"
            className={modeButton(mode === "freeform")}
            onClick={() => changeMode("freeform")}
          >
            Freeform
          </button>
          <button
            type="button"
            aria-pressed={mode === "spec-map"}
            title="Spec Map — see how your specs depend on each other, generated from each spec's depends_on"
            className={modeButton(mode === "spec-map")}
            onClick={() => changeMode("spec-map")}
          >
            <GitFork size={12} /> Spec Map
          </button>
        </div>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <IconButton label="Add card" shortLabel="Card" onClick={() => add("text")}>
          <Plus size={13} />
        </IconButton>
        <IconButton
          label="Add sticky note"
          shortLabel="Sticky"
          className="@max-[46rem]/dtb:hidden"
          onClick={() => add("note")}
        >
          <StickyNote size={13} />
        </IconButton>
        <IconButton
          label="Add annotation"
          shortLabel="Annotate"
          className="@max-[46rem]/dtb:hidden"
          onClick={() => add("annotation")}
        >
          <MessageSquareQuote size={13} />
        </IconButton>
        <IconButton
          label="Add label"
          shortLabel="Label"
          className="@max-[46rem]/dtb:hidden"
          onClick={() => add("label")}
        >
          <Tag size={13} />
        </IconButton>
        <IconButton
          label="Add frame"
          shortLabel="Frame"
          className="@max-[46rem]/dtb:hidden"
          onClick={() => add("group")}
        >
          <Boxes size={13} />
        </IconButton>
        <CanvasAttachMenu
          profile={profile}
          sources={attachmentSources}
          open={attachmentMenuOpen}
          onOpenChange={setAttachmentMenuOpen}
          onPickFiles={(kind) => {
            const requestId = uid();
            pendingReferenceRequestId.current = requestId;
            send({
              type: "afxCanvasPickReferences",
              requestId,
              owner: activeSource,
              kind,
              allowMultiple: true,
            });
          }}
          onAddUrl={addUrl}
          onAttachSource={attachSource}
        />
        {mode === "spec-map" ? (
          <Popover
            open={specPickerOpen}
            onOpenChange={(open) => {
              setSpecPickerOpen(open);
              if (open) send({ type: "afxCanvasDocIndex", requestId: uid() });
              else setSpecPickerQuery("");
            }}
          >
            <PopoverTrigger asChild>
              <Button size="xs" variant="outline" title="Add a spec to the map by name">
                <FilePlus2 size={12} /> Add spec
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2" aria-label="Add spec to map">
              <Input
                autoFocus
                aria-label="Find a spec"
                placeholder="Find a spec by id or title…"
                value={specPickerQuery}
                onChange={(event) => setSpecPickerQuery(event.target.value)}
                className="mb-1.5 h-7 text-xs"
              />
              <div className="max-h-64 overflow-y-auto">
                {specPickerEntries.length === 0 ? (
                  <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                    {(docIndex ?? []).length === 0 ? "No specs found in docs/." : "No match."}
                  </p>
                ) : (
                  specPickerEntries.map((entry) => (
                    <button
                      key={`${entry.source.rootUri}:${entry.source.relativePath}`}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => addDocNode(entry)}
                    >
                      <span className="shrink-0 rounded-sm border px-1 font-mono text-[8px] uppercase text-muted-foreground">
                        {entry.kind}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px]">{entry.title}</span>
                      <span className="shrink-0 truncate font-mono text-[9px] text-muted-foreground">
                        {entry.id.split(":").pop()}
                      </span>
                    </button>
                  ))
                )}
              </div>
              {(docIndex ?? []).some(
                (entry) => entry.kind === "spec" || entry.kind === "sprint",
              ) ? (
                <button
                  type="button"
                  className="mt-1.5 w-full rounded-sm border px-2 py-1 text-center text-[10px] text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={addAllSpecs}
                >
                  Add all specs (capped at 40)
                </button>
              ) : null}
            </PopoverContent>
          </Popover>
        ) : null}
        {mode === "spec-map" && activeSource && activeRevision ? (
          <Button
            size="xs"
            variant="outline"
            title="Redraw the dependency arrows among the specs on this map from their depends_on frontmatter"
            disabled={documentOperationLocked}
            onClick={refreshDependencies}
          >
            <GitFork size={12} /> Sync specs
          </Button>
        ) : null}
        {/* Narrow panels: tier-2 actions collapse into this overflow menu.
            The trigger only renders below the same container width that hides
            them, so wide layouts never show a redundant menu. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More canvas actions"
              title="More canvas actions"
              className="hidden h-6 min-w-6 shrink-0 items-center justify-center rounded-sm px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @max-[46rem]/dtb:flex"
            >
              <MoreHorizontal size={13} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-52">
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em]">
              Insert
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => add("note")}>
              <StickyNote size={12} /> Add sticky note
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("annotation")}>
              <MessageSquareQuote size={12} /> Add annotation
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("label")}>
              <Tag size={12} /> Add label
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("group")}>
              <Boxes size={12} /> Add frame
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em]">
              Canvas file
            </DropdownMenuLabel>
            <DropdownMenuItem disabled={documentOperationLocked} onSelect={renameCanvas}>
              <FileText size={12} /> Rename canvas
            </DropdownMenuItem>
            <DropdownMenuItem disabled={documentOperationLocked} onSelect={duplicateCanvas}>
              <CopyPlus size={12} /> Duplicate canvas
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={documentOperationLocked || activeDocument?.descriptor.kind === "project"}
              onSelect={deleteCanvas}
            >
              <Trash2 size={12} /> Delete canvas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <CanvasCommandMenu
            profile={profile}
            capabilities={canvasCapabilities}
            onProfileChange={changeProfile}
            onCommand={runCanvasCommand}
            open={commandMenuOpen}
            onOpenChange={setCommandMenuOpen}
          />
          <span className="mx-0.5 h-5 w-px bg-border" />
          <span
            className={`text-[10px] ${saveState === "Saved" || saveState === "Editor has unsaved changes" ? "text-muted-foreground" : saveState === "Conflict" || saveState === "Save failed" || saveState === "Invalid" ? "text-destructive" : "text-afx-brand-soft"}`}
          >
            {saveState}
          </span>
          <IconButton
            label="Save canvas"
            shortLabel="Save"
            disabled={!dirty || Boolean(pendingRequestId)}
            onClick={save}
          >
            <Save size={13} />
          </IconButton>
          <IconButton
            label="Planning guide"
            shortLabel="Guide"
            active={showGuide}
            onClick={() => setShowGuide((value) => !value)}
          >
            <LayoutTemplate size={13} />
          </IconButton>
          {activeSource && !editorClientId ? (
            <IconButton
              label="Open in Canvas editor"
              shortLabel="Editor"
              onClick={() => send({ type: "afxOpenCanvasEditor", target: activeSource })}
            >
              <FolderOpen size={13} />
            </IconButton>
          ) : null}
        </div>
      </div>

      {showGuide ? (
        <div className="flex min-w-0 items-center gap-1 border-b bg-muted/20 px-2 py-1.5 text-[11px]">
          <div className="min-w-0 flex-1">
            <CanvasStarterGallery compact onApply={runStarter} />
          </div>
          {profile === "afx" ? (
            <>
              <Button size="xs" variant="ghost" onClick={() => runCanvasCommand("prepare-sprint")}>
                Prepare Sprint…
              </Button>
              <Button size="xs" variant="ghost" onClick={() => runCanvasCommand("prepare-spec")}>
                Prepare Spec…
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {mode === "spec-map" &&
        !pendingOperation &&
        // Clear once any spec is loaded (a file node with afx-doc metadata) or a
        // declared edge exists — the map is being built, not empty.
        !(localCanvas.edges ?? []).some(
          (edge) =>
            edge.afxProvenance?.kind === "declared-dependency" ||
            edge.afxProvenance?.kind === "declared-relationship",
        ) &&
        !(localCanvas.nodes ?? []).some(
          (node) => node.type === "file" && ((node as { afxDoc?: unknown }).afxDoc || node.afxSpec),
        ) ? (
          <div
            data-testid="canvas-spec-map-empty"
            className="pointer-events-none absolute inset-x-0 top-10 z-10 flex justify-center px-2"
          >
            <div className="pointer-events-auto max-w-md rounded-md border bg-background/95 p-3 text-[11px] text-muted-foreground shadow-lg backdrop-blur">
              <p className="font-medium text-foreground">Build your spec map</p>
              <p className="mt-1">
                <strong className="font-medium text-foreground">Add a spec</strong> to drop it on
                the canvas. If it declares dependencies, its card shows a badge — expand to load
                them, or pick which to bring in. Draw an arrow between two specs to author a new
                dependency into frontmatter.
              </p>
              <p className="mt-1.5">
                Dependencies come from each spec&apos;s <code>depends_on</code> frontmatter (folder
                ids under <code>docs/specs/</code>), e.g.{" "}
                <code>depends_on: [110-cart, 130-payments]</code>.
              </p>
              {activeSource && activeRevision ? (
                <Button
                  size="xs"
                  variant="outline"
                  className="mt-2"
                  disabled={documentOperationLocked}
                  onClick={() => setSpecPickerOpen(true)}
                >
                  <FilePlus2 size={12} /> Add a spec
                </Button>
              ) : (
                <p className="mt-1">
                  Save this canvas in the workspace first — the spec index needs a workspace file.
                </p>
              )}
            </div>
          </div>
        ) : null}
        {/* Transient status floats over the surface — appearing/disappearing
            feedback must never change the canvas layout (FR-45). */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex flex-col items-center gap-1 px-2"
          data-testid="canvas-status-overlay"
        >
          {switchWarning ? <StatusBanner tone="warning">{switchWarning}</StatusBanner> : null}
          {pendingOperation ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-auto rounded-md border bg-background/95 px-3 py-1 text-[11px] text-muted-foreground shadow-lg backdrop-blur"
            >
              {pendingOperation.label}…
            </div>
          ) : operationResult?.outcome === "success" ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-auto rounded-md border bg-background/95 px-3 py-1 text-[11px] text-muted-foreground shadow-lg backdrop-blur"
            >
              Canvas operation completed.
            </div>
          ) : operationResult ? (
            <StatusBanner tone="error">{operationResult.message}</StatusBanner>
          ) : null}
          {parseError ? (
            <StatusBanner tone="error">
              Manual JSON is invalid: {parseError}. The last valid graph remains visible.
            </StatusBanner>
          ) : null}
          {saveError ? <StatusBanner tone="error">{saveError}</StatusBanner> : null}
          {actionResult?.outcome === "success" ? (
            <div
              role="status"
              className="pointer-events-auto rounded-md border bg-background/95 px-3 py-1 text-[11px] text-muted-foreground shadow-lg backdrop-blur"
            >
              Canvas action completed.
            </div>
          ) : actionResult ? (
            <StatusBanner tone="error">{actionResult.message}</StatusBanner>
          ) : pendingActionRequestId ? (
            <div
              role="status"
              className="pointer-events-auto rounded-md border bg-background/95 px-3 py-1 text-[11px] text-muted-foreground shadow-lg backdrop-blur"
            >
              Running confirmed Canvas action…
            </div>
          ) : null}
          {conflictContent !== undefined ? (
            <StatusBanner tone="warning">
              The file changed while this canvas had unsaved work.
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  const parsed = parseSafe(conflictContent);
                  if (!parsed.error) {
                    updateDocumentState(documentKey, (current) => ({
                      ...current,
                      localCanvas: parsed.canvas,
                      acceptedContent: conflictContent,
                      dirty: false,
                      parseError: undefined,
                      conflictContent: undefined,
                      pendingSave: undefined,
                      lastResult: undefined,
                      saveError: undefined,
                      lastIncoming: conflictContent,
                    }));
                  }
                }}
              >
                Reload external
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  activeSource &&
                  send({
                    type: "afxOpenFile",
                    path: activeSource.relativePath,
                    mode: "editor",
                    owner: activeSource,
                  })
                }
              >
                Open as text
              </Button>
            </StatusBanner>
          ) : null}

          {pendingExport ? (
            <div
              role="status"
              className="pointer-events-auto rounded-md border bg-background/95 px-3 py-1 text-[10px] text-muted-foreground shadow-lg backdrop-blur"
            >
              Saving {pendingExport.label}…
            </div>
          ) : exportStatus ? (
            <div
              role={exportStatus.tone === "error" ? "alert" : "status"}
              className={`pointer-events-auto rounded-md border bg-background/95 px-3 py-1 text-[10px] shadow-lg backdrop-blur ${exportStatus.tone === "error" ? "border-destructive/40 text-destructive" : "text-muted-foreground"}`}
            >
              {exportStatus.message}
            </div>
          ) : null}
        </div>
        <ReactFlowCanvas
          canvas={localCanvas}
          documentKey={documentKey}
          dependenciesRefreshing={pendingOperation?.kind === "refresh-dependencies"}
          viewState={editorViewState}
          onViewStateChange={
            editorClientId
              ? (viewState) =>
                  send({ type: "afxCanvasEditorSetViewState", clientId: editorClientId, viewState })
              : undefined
          }
          fileContents={fileContents}
          nodePreviews={nodePreviews}
          canRunCanvasActions={Boolean(activeSource && activeRevision && !pendingActionRequestId)}
          profile={profile}
          documentLabel={activeDocumentLabel}
          commandRequest={surfaceCommand}
          onChange={update}
          onNodeAction={nodeAction}
          expandableCountById={expandableCountById}
          onRunCanvasAction={runCanvasAction}
          onFileContentMount={mountReferencedContent}
          onSelectionAction={(nodes) => sendSelectionToChat(nodes)}
          onAuthorRelationship={authorRelationship}
          onRemoveRelationship={removeRelationshipEdge}
          onExport={(request) => {
            const requestId = uid();
            setExportStatus(undefined);
            setPendingExport({ requestId, label: request.suggestedName });
            send({ type: "afxCanvasExport", requestId, ...request });
          }}
        />
        {(localCanvas.nodes?.length ?? 0) === 0 && !parseError ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/55 p-3 backdrop-blur-[1px]">
            <div className="pointer-events-auto w-[min(38rem,100%)] rounded-lg border bg-background/95 p-3 shadow-lg">
              <CanvasStarterGallery onApply={runStarter} />
            </div>
          </div>
        ) : null}
      </div>
      <span className="sr-only">Last accepted source size: {acceptedContent.length}</span>

      {/* Webview-safe prompt/confirm replacement — window.prompt/confirm do
          not exist inside VS Code webviews. */}
      <Dialog
        open={dialog?.kind === "input"}
        onOpenChange={(open) => {
          if (!open) setDialog(undefined);
        }}
      >
        {dialog?.kind === "input" ? (
          <DialogContent className="max-w-sm" data-testid="canvas-input-dialog">
            <DialogHeader>
              <DialogTitle>{dialog.title}</DialogTitle>
              {dialog.description ? (
                <DialogDescription>{dialog.description}</DialogDescription>
              ) : null}
            </DialogHeader>
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitDialog();
              }}
            >
              <label
                className="text-[11px] font-medium text-muted-foreground"
                htmlFor="canvas-dialog-input"
              >
                {dialog.label}
              </label>
              <input
                id="canvas-dialog-input"
                autoFocus
                value={dialogValue}
                onChange={(event) => {
                  setDialogValue(event.target.value);
                  setDialogError(undefined);
                }}
                className="h-7 rounded-sm border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {dialog.checkbox ? (
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={dialogChecked}
                    onChange={(event) => setDialogChecked(event.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--afx-brand)]"
                  />
                  {dialog.checkbox.label}
                </label>
              ) : null}
              {dialogError ? (
                <p role="alert" className="text-[11px] text-destructive">
                  {dialogError}
                </p>
              ) : null}
              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setDialog(undefined)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="xs" disabled={!dialogValue.trim()}>
                  {dialog.submitLabel}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
      <AlertDialog
        open={dialog?.kind === "confirm"}
        onOpenChange={(open) => {
          if (!open) setDialog(undefined);
        }}
      >
        {dialog?.kind === "confirm" ? (
          <AlertDialogContent className="max-w-sm" data-testid="canvas-confirm-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
              <AlertDialogDescription className="whitespace-pre-wrap">
                {dialog.body}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={
                  dialog.destructive
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined
                }
                onClick={submitDialog}
              >
                {dialog.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
      <AlertDialog
        open={dialog?.kind === "choice"}
        onOpenChange={(open) => {
          if (!open) setDialog(undefined);
        }}
      >
        {dialog?.kind === "choice" ? (
          <AlertDialogContent className="max-w-sm" data-testid="canvas-choice-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
              {dialog.body ? (
                <AlertDialogDescription className="whitespace-pre-wrap">
                  {dialog.body}
                </AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>
            <div className="flex flex-col gap-1.5">
              {dialog.options.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className="rounded-sm border px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    setDialog(undefined);
                    option.onSelect();
                  }}
                >
                  <span className="block text-xs font-medium text-foreground">{option.label}</span>
                  {option.description ? (
                    <span className="block text-[10px] text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </section>
  );
}

function createDocumentClientState(
  documentKey: string,
  content: string,
  hostDocument?: CanvasDocumentSnapshot,
  hostParseError?: string,
): CanvasDocumentClientState {
  const parsed = parseSafe(content);
  return {
    hostDocument,
    localCanvas: parsed.canvas,
    mode: readCanvasMode(documentKey),
    profile: readCanvasProfile(documentKey),
    acceptedContent: content,
    dirty: false,
    parseError: hostParseError ?? parsed.error,
    lastIncoming: content,
  };
}

function mergeIncomingCanvasDocument(
  current: CanvasDocumentClientState | undefined,
  hostDocument: CanvasDocumentSnapshot,
): CanvasDocumentClientState {
  if (!current) {
    return createDocumentClientState(
      hostDocument.documentId,
      hostDocument.content,
      hostDocument,
      hostDocument.parseError,
    );
  }
  const next = applyIncomingCanvasContent({ ...current, hostDocument }, hostDocument.content);
  return hostDocument.parseError ? { ...next, parseError: hostDocument.parseError } : next;
}

function applyIncomingCanvasContent(
  current: CanvasDocumentClientState,
  content: string,
): CanvasDocumentClientState {
  if (content === current.lastIncoming) return current;
  const parsed = parseSafe(content);
  if (parsed.error) {
    return { ...current, lastIncoming: content, parseError: parsed.error };
  }
  const next = {
    ...current,
    lastIncoming: content,
    parseError: undefined,
    saveError: undefined,
  };
  const localContent = serializeJSONCanvas(current.localCanvas);
  if ((current.dirty || current.pendingSave) && content === localContent) {
    return { ...next, acceptedContent: content };
  }
  if (current.dirty || current.pendingSave) {
    return { ...next, conflictContent: content };
  }
  return {
    ...next,
    localCanvas: parsed.canvas,
    acceptedContent: content,
    conflictContent: undefined,
    lastResult: undefined,
    acknowledgedRevision: undefined,
  };
}

function parseSafe(content: string): { canvas: JSONCanvas; error?: string } {
  try {
    return { canvas: parseJSONCanvas(content) };
  } catch (error) {
    return {
      canvas: emptyCanvas(),
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

function insertPoint(index: number): { x: number; y: number } {
  return { x: 64 + (index % 4) * 340, y: 72 + Math.floor(index / 4) * 220 };
}

function fileLabel(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/\/$/, "");
  return normalized.split("/").pop() || "Canvas";
}

function uid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `canvas-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

type DocRelationship = "depends_on" | "supersedes" | "relates_to";

const RELATIONSHIP_LABEL: Record<DocRelationship, string> = {
  depends_on: "depends on",
  supersedes: "supersedes",
  relates_to: "relates to",
};

interface DocNodeInfo {
  kind: SddDocumentKind;
  /** Root-qualified canvas identity (CanvasDocIndexEntry.id) — internal only. */
  id: string;
  /** Bare frontmatter reference token — the value authoring writes into YAML. */
  token: string;
  label: string;
  relativePath: string;
}

/**
 * Best-effort bare token for a legacy node whose afxDoc predates `token`. The
 * root-qualified id is `${rootUri}:${stem}`; the stem is everything after the
 * final colon. Prevents an old canvas from re-authoring a `file://…` value.
 */
function bareTokenFromId(id: string): string {
  const colon = id.lastIndexOf(":");
  return colon >= 0 ? id.slice(colon + 1) : id;
}

/** The afx-doc index id a node represents, if any (matches CanvasDocIndexEntry.id). */
function docNodeIdOf(node: CanvasNode): string | undefined {
  if (node.type !== "file") return undefined;
  const meta = (node as { afxDoc?: unknown }).afxDoc;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const id = (meta as Record<string, unknown>)["id"];
  return typeof id === "string" ? id : undefined;
}

/**
 * Reads the generated afx-document metadata off a node. Returns undefined for
 * non-document nodes and for journals, which are never authoring participants
 * (230 FR-13).
 */
function docNodeInfo(node: CanvasNode): DocNodeInfo | undefined {
  if (node.type !== "file") return undefined;
  const meta = (node as { afxDoc?: unknown }).afxDoc;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const record = meta as Record<string, unknown>;
  const kind = record["kind"];
  const id = record["id"];
  if (typeof kind !== "string" || typeof id !== "string") return undefined;
  if (kind === "journal") return undefined;
  const rawToken = record["token"];
  const token = typeof rawToken === "string" && rawToken ? rawToken : bareTokenFromId(id);
  const label = typeof node.afxLabel === "string" && node.afxLabel ? node.afxLabel : token;
  const relativePath =
    typeof node.afxSource?.relativePath === "string" ? node.afxSource.relativePath : node.file;
  return { kind: kind as SddDocumentKind, id, token, label, relativePath };
}

/**
 * The relationships a drawn edge between two doc kinds may author (230 Appendix).
 * A specific relationship wins over the generic `relates_to`; more than one
 * specific match (spec → spec) drives the picker (FR-5).
 */
function relationshipsForPair(source: SddDocumentKind, target: SddDocumentKind): DocRelationship[] {
  const specific: DocRelationship[] = [];
  if ((source === "spec" || source === "sprint") && target === "spec") specific.push("depends_on");
  if (source === "spec" && target === "spec") specific.push("supersedes");
  if (source === "adr" && target === "adr") specific.push("supersedes");
  return specific.length > 0 ? [...new Set(specific)] : ["relates_to"];
}

function referencedPreviewOwner(
  node: CanvasFileNode,
  activeSource: WorkbenchSourceIdentity | undefined,
): WorkbenchSourceIdentity | undefined {
  if (node.afxSource) return node.afxSource;
  if (!activeSource) return undefined;
  const normalized = node.file.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/");
  const rootPrefix = `${activeSource.rootName.replace(/\\/g, "/")}/`;
  const relativePath = normalized.startsWith(rootPrefix)
    ? normalized.slice(rootPrefix.length)
    : normalized;
  return { ...activeSource, relativePath };
}

function referencedDocumentKey(owner: WorkbenchSourceIdentity): string {
  const relativePath = owner.relativePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");
  const rootHint = canvasWorkspaceRootHint(owner) ?? owner.rootName;
  return `${rootHint}\u0000${relativePath}`;
}

function urlPreviewKey(url: string): string {
  return url.trim();
}

function previewContext(payload: CanvasContentPreviewPayload): string {
  if (payload.kind === "markdown") return payload.content ?? "";
  if (payload.kind === "file") return payload.excerpt ?? "";
  if (payload.kind === "notes") {
    return payload.summary && "items" in payload.summary
      ? payload.summary.items.map((item) => `${item.timestamp} ${item.text}`).join("\n")
      : "";
  }
  if (payload.kind === "board") {
    return payload.summary && "columns" in payload.summary
      ? payload.summary.columns.flatMap((column) => [column.title, ...column.items]).join("\n")
      : "";
  }
  return "";
}

function nodeContext(node: CanvasNode, fileContents: Readonly<Record<string, string>>): string {
  if (node.type === "text") return node.text;
  if (node.type === "file") return `File: ${node.file}\n\n${fileContents[node.id] ?? ""}`.trim();
  if (node.type === "link") return `Link: ${node.url}`;
  return `Group: ${node.label ?? "Untitled"}`;
}

function modeButton(active: boolean): string {
  return `inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-1 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-afx-brand/60 bg-afx-brand/10 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"}`;
}

function IconButton({
  label,
  shortLabel,
  disabled,
  active,
  onClick,
  children,
  className,
}: {
  label: string;
  shortLabel?: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Responsive tier classes, e.g. hide below a container width. */
  className?: string;
}) {
  const visibleLabel = shortLabel ?? label;
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={`flex h-6 min-w-6 shrink-0 items-center justify-center gap-1 rounded-sm px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 ${active ? "bg-muted text-foreground" : ""} ${className ?? ""}`}
          >
            {children}
            <span className="hidden max-w-24 truncate text-[10px] @[64rem]/dtb:inline">
              {visibleLabel}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StatusBanner({
  tone,
  children,
}: {
  tone: "warning" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className={`pointer-events-auto flex max-w-[min(44rem,100%)] flex-wrap items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] shadow-lg backdrop-blur ${tone === "error" ? "border-destructive/40 bg-destructive/15 text-destructive" : "border-amber-500/40 bg-amber-500/15 text-amber-200"}`}
    >
      {children}
    </div>
  );
}
