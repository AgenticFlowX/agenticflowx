/**
 * Workbench bridge — typed postMessage between workbench webview and extension host.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-1] [FR-4]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-BRIDGE]
 */
import {
  type WorkbenchInbound,
  type WorkbenchOutbound,
  consoleSink,
  createLogger,
} from "@afx/shared";

const log = createLogger({ scope: "workbench:bridge", level: "info", sinks: [consoleSink()] });

type AnyListener = (msg: WorkbenchInbound) => void;

let _send: ((msg: WorkbenchOutbound) => void) | null = null;
const _listeners = new Map<WorkbenchInbound["type"], Set<AnyListener>>();
let _initialized = false;
let _hasVsCodeApi = false;

interface VscodeApi {
  postMessage(msg: unknown): void;
}

interface WindowWithVscode extends Window {
  acquireVsCodeApi?: () => VscodeApi;
}

/**
 * Initializes the [Workbench.Bridge] transport once and sends `afxReady` to the
 * host when a real VSCode webview API is present.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-1] [FR-4]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-BRIDGE]
 */
export function initWorkbenchBridge(): void {
  if (_initialized) return;
  _initialized = true;

  const w = window as WindowWithVscode;
  if (typeof w.acquireVsCodeApi === "function") {
    const api = w.acquireVsCodeApi();
    _hasVsCodeApi = true;
    _send = (msg) => api.postMessage(msg);
    queueMicrotask(() => {
      _send?.({ type: "afxReady" });
    });
  } else {
    _hasVsCodeApi = false;
    _send = (msg) => window.parent.postMessage(msg, "*");
  }

  window.addEventListener("message", (e: MessageEvent) => {
    const msg = e.data as WorkbenchInbound | undefined;
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
    const set = _listeners.get(msg.type);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(msg);
      } catch (err) {
        log.error("listener threw", err instanceof Error ? err : undefined);
      }
    }
  });
}

/**
 * Sends typed Workbench outbound messages and supplies dev-only document
 * content when no VSCode bridge is available.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-4]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-BRIDGE]
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-4]
 */
export function workbenchSend(msg: WorkbenchOutbound): void {
  if (
    !_hasVsCodeApi &&
    import.meta.env.DEV &&
    import.meta.env.MODE !== "test" &&
    msg.type === "afxFetchDocContent"
  ) {
    queueMicrotask(() => {
      const set = _listeners.get("afxDocContent");
      if (!set) return;
      const content = mockDocContent(msg.filePath);
      for (const handler of set) {
        handler({ type: "afxDocContent", filePath: msg.filePath, content });
      }
    });
  }
  if (!_send) {
    return;
  }
  _send(msg);
}

/**
 * Subscribes to one typed Workbench inbound message channel.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-4]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-BRIDGE]
 */
export function workbenchOn<T extends WorkbenchInbound["type"]>(
  type: T,
  handler: (msg: Extract<WorkbenchInbound, { type: T }>) => void,
): () => void {
  let set = _listeners.get(type);
  if (!set) {
    set = new Set();
    _listeners.set(type, set);
  }
  const wrapped = handler as AnyListener;
  set.add(wrapped);
  return () => {
    set.delete(wrapped);
  };
}

/** True when the bridge resolved a real VSCode webview transport (not a browser dev iframe). */
export function isInVsCodeWebview(): boolean {
  return _hasVsCodeApi;
}

/** For tests only. */
export function _resetBridgeForTest(): void {
  _send = null;
  _listeners.clear();
  _initialized = false;
  _hasVsCodeApi = false;
}

function mockDocContent(filePath: string): string {
  const name = filePath.split("/").slice(-2).join(" / ");
  if (filePath.endsWith("tasks.md")) {
    if (filePath.includes("16-marketplace-asset-recovery")) {
      return `# ${name}

## Phase 1: Planning

### 1.1 Define recovery workflow

- [x] Define recovery workflow

### 1.2 Design API endpoints

- [x] Design API endpoints

### 1.3 Plan UI components

- [x] Plan UI components

## Phase 2: Implementation

### 2.1 Implement recovery service

- [x] Implement recovery service

### 2.2 Create API routes

- [x] Create API routes

### 2.3 Add recovery dashboard

- [x] Add recovery dashboard

### 2.4 Implement notifications

- [x] Implement notifications

### 2.5 Add audit logging

- [x] Add audit logging

### 2.6 Write tests

- [ ] Write tests

### 2.7 Documentation

- [ ] Documentation

## Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-05-20 | 2.5 | Coded | packages/db/src/services/recovery.ts | [x] | [ ] |
`;
    }
    return `# ${name}

## Phase 1: Setup

### 1.1 Wire Workbench data

- [x] Wire Workbench data

### 1.2 Render documents

- [x] Render documents

### 1.3 Polish visual density

- [ ] Polish visual density

## Phase 2: Verification

### 2.1 Review light theme

- [ ] Review light theme

### 2.2 Review dark theme

- [ ] Review dark theme

## Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-05-20 | 1.2 | Coded | apps/workbench/src/views/workbench.tsx | [x] | [ ] |
`;
  }
  if (filePath.endsWith("design.md")) {
    return `# ${name}\n\n## Design Direction\n\nUse shadcn primitives with clear surfaces, visible borders, and small AFX metadata accents.\n\n\`\`\`text\nToolbar -> content panes -> durable markdown files\n\`\`\`\n`;
  }
  if (filePath.endsWith("journal.md")) {
    return `# ${name}\n\n## Latest Capture\n\nWorkbench mock preview loaded through the development bridge.\n\n- Keep the UI readable in light and dark themes.\n- Preserve markdown as the source of truth.\n`;
  }
  return `# ${name}\n\n## Summary\n\nMock markdown preview for Workbench development and Playwright visual review.\n\nThis avoids a blank loading state when the VSCode host bridge is not available.\n`;
}
