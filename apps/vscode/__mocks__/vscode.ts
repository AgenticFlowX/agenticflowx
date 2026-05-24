/**
 * Vitest mock of the `vscode` module.
 *
 * Used by `apps/vscode` unit tests to exercise extension-host logic without
 * launching a real VSCode instance. Real-VSCode coverage lives in
 * `apps/vscode-e2e` via `@vscode/test-electron`.
 *
 * Trimmed to the surface area used by this extension.
 */

type Disposable = { dispose: () => void };

const mockDisposable: Disposable = { dispose: () => {} };

class EventEmitter<T> {
  private listeners = new Set<(e: T) => void>();
  event = (listener: (e: T) => void): Disposable => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire = (e: T): void => {
    for (const l of this.listeners) l(e);
  };
  dispose = (): void => {
    this.listeners.clear();
  };
}

class Position {
  constructor(
    public line: number,
    public character: number,
  ) {}
}

class Range {
  constructor(
    public start: Position,
    public end: Position,
  ) {}
}

class Selection extends Range {
  anchor: Position;
  active: Position;
  constructor(start: Position, end: Position) {
    super(start, end);
    this.anchor = start;
    this.active = end;
  }
}

const Uri = {
  file: (path: string) => ({ fsPath: path, path, scheme: "file" }),
  parse: (path: string) => ({ fsPath: path, path, scheme: "file" }),
  joinPath: (base: { path: string }, ...segments: string[]) => ({
    fsPath: [base.path, ...segments].join("/"),
    path: [base.path, ...segments].join("/"),
    scheme: "file",
  }),
};

class ThemeIcon {
  constructor(public id: string) {}
}

const FileType = { File: 1, Directory: 2, SymbolicLink: 64 } as const;
const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 } as const;
const StatusBarAlignment = { Left: 1, Right: 2 } as const;
const ViewColumn = { Active: -1, Beside: -2, One: 1, Two: 2, Three: 3 } as const;
const ExtensionMode = { Production: 1, Development: 2, Test: 3 } as const;
const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 } as const;

const createOutputChannel = (name: string) => ({
  name,
  appendLine: (_line: string) => {},
  append: (_value: string) => {},
  clear: () => {},
  show: (_preserveFocus?: boolean) => {},
  hide: () => {},
  replace: (_value: string) => {},
  dispose: () => {},
});

const createStatusBarItem = (_alignment?: number, _priority?: number) => ({
  text: "",
  tooltip: "",
  command: "",
  alignment: 1,
  priority: 0,
  show: () => {},
  hide: () => {},
  dispose: () => {},
});

const createWebviewView = () => ({
  webview: {
    options: {},
    html: "",
    cspSource: "vscode-webview://mock",
    asWebviewUri: (uri: { path: string }) => uri,
    onDidReceiveMessage: () => mockDisposable,
    postMessage: async () => true,
  },
  visible: true,
  onDidChangeVisibility: () => mockDisposable,
  onDidDispose: () => mockDisposable,
  show: (_preserveFocus?: boolean) => {},
});

export const workspace = {
  workspaceFolders: [] as { uri: { fsPath: string }; name: string; index: number }[],
  getWorkspaceFolder: () => null,
  asRelativePath: (pathOrUri: string | { fsPath: string }) =>
    typeof pathOrUri === "string" ? pathOrUri : pathOrUri.fsPath,
  findFiles: async () => [] as Array<{ fsPath: string; path: string; scheme: string }>,
  onDidChangeWorkspaceFolders: () => mockDisposable,
  onDidChangeConfiguration: () => mockDisposable,
  onDidSaveTextDocument: () => mockDisposable,
  getConfiguration: (_section?: string) => ({
    get: <T>(_key: string, defaultValue?: T): T | undefined => defaultValue,
    has: () => false,
    inspect: () => undefined,
    update: async () => {},
  }),
  createFileSystemWatcher: () => ({
    onDidCreate: () => mockDisposable,
    onDidChange: () => mockDisposable,
    onDidDelete: () => mockDisposable,
    dispose: () => {},
  }),
  fs: {
    readFile: async () => new Uint8Array(),
    writeFile: async () => {},
    stat: async () => ({ type: 1, ctime: 0, mtime: 0, size: 0 }),
    readDirectory: async () => [] as [string, number][],
    createDirectory: async () => {},
    delete: async () => {},
  },
  // Minimal stubs so `vi.spyOn(vscode.workspace, "openTextDocument")` and
  // `vi.spyOn(vscode.workspace, "applyEdit")` resolve. The default impl is
  // a no-op; tests override with `mockResolvedValueOnce(...)` etc.
  openTextDocument: async (_uri?: unknown) =>
    ({
      uri: { fsPath: "" },
      getText: () => "",
      save: async () => true,
    }) as unknown as { uri: unknown; getText: () => string; save: () => Promise<boolean> },
  applyEdit: async (_edit: unknown) => true,
};

export const window = {
  activeTextEditor: null,
  tabGroups: {
    all: [] as Array<{ tabs: Array<{ input?: { uri?: { fsPath: string; scheme: string } } }> }>,
    activeTabGroup: undefined as
      | { activeTab?: { input?: { uri?: { fsPath: string; scheme: string }; viewType?: string } } }
      | undefined,
  },
  onDidChangeActiveTextEditor: () => mockDisposable,
  onDidChangeTextEditorSelection: () => mockDisposable,
  onDidChangeWindowState: () => mockDisposable,
  showErrorMessage: async (_msg: string) => undefined,
  showWarningMessage: async (_msg: string) => undefined,
  showInformationMessage: async (_msg: string) => undefined,
  showInputBox: async () => undefined,
  showQuickPick: async <T>(_items: T | T[], _opts?: unknown): Promise<T | undefined> => undefined,
  showTextDocument: async (_uri: unknown, _options?: unknown) => undefined,
  createOutputChannel,
  createStatusBarItem,
  registerWebviewViewProvider: () => mockDisposable,
  createWebviewPanel: () => createWebviewView(),
  onDidCloseTerminal: () => mockDisposable,
};

export const commands = {
  registerCommand: () => mockDisposable,
  executeCommand: async <T = unknown>(): Promise<T | undefined> => undefined,
  getCommands: async () => [] as string[],
};

export const languages = {
  createDiagnosticCollection: () => ({
    set: () => {},
    delete: () => {},
    clear: () => {},
    dispose: () => {},
  }),
  registerCodeLensProvider: () => mockDisposable,
  registerHoverProvider: () => mockDisposable,
  registerDefinitionProvider: () => mockDisposable,
  registerDocumentLinkProvider: () => mockDisposable,
  registerCompletionItemProvider: () => mockDisposable,
  registerCodeActionsProvider: () => mockDisposable,
};

export class CodeAction {
  command?: { command: string; title: string };
  constructor(
    public title: string,
    public kind?: unknown,
  ) {}
}

export const CodeActionKind = {
  RefactorRewrite: "refactor.rewrite",
};

export class CodeLens {
  command?: { title: string; command: string; arguments?: unknown[] };
  constructor(
    public range: unknown,
    command?: { title: string; command: string; arguments?: unknown[] },
  ) {
    this.command = command;
  }
}

export class DocumentLink {
  tooltip?: string;
  constructor(
    public range: unknown,
    public target?: unknown,
  ) {}
}

export class Hover {
  constructor(public contents: unknown) {}
}

export class Location {
  constructor(
    public uri: unknown,
    public range: unknown,
  ) {}
}

export class MarkdownString {
  isTrusted = false;
  value = "";
  appendCodeblock(): MarkdownString {
    return this;
  }
  appendMarkdown(): MarkdownString {
    return this;
  }
}

export class CompletionItem {
  insertText?: string;
  constructor(
    public label: string,
    public kind?: unknown,
  ) {}
}

export const CompletionItemKind = {
  File: 17,
  Folder: 19,
};

export const extensions = {
  getExtension: () => null,
};

export const env = {
  isTelemetryEnabled: true,
  onDidChangeTelemetryEnabled: () => mockDisposable,
  openExternal: async () => true,
  clipboard: {
    writeText: async () => {},
    readText: async () => "",
  },
};

// Minimal WorkspaceEdit shim — collects replace/insert calls so tests can
// assert against `vscode.workspace.applyEdit` without exercising the real
// extension host. Only the methods used by `tasks-signoff.ts` are stubbed.
class WorkspaceEdit {
  replace(_uri: unknown, _range: unknown, _newText: string): void {
    /* no-op; production uses VS Code's real WorkspaceEdit */
  }
  insert(_uri: unknown, _position: unknown, _newText: string): void {
    /* no-op */
  }
}

export {
  EventEmitter,
  Position,
  Range,
  Selection,
  Uri,
  ThemeIcon,
  FileType,
  DiagnosticSeverity,
  StatusBarAlignment,
  ViewColumn,
  ExtensionMode,
  ConfigurationTarget,
  WorkspaceEdit,
  createWebviewView,
};

export const Disposable = mockDisposable;

export default {
  workspace,
  window,
  commands,
  languages,
  extensions,
  env,
  Uri,
  Range,
  Position,
  Selection,
  Disposable,
  ThemeIcon,
  EventEmitter,
  WorkspaceEdit,
  FileType,
  DiagnosticSeverity,
  StatusBarAlignment,
  ViewColumn,
  ExtensionMode,
  ConfigurationTarget,
};
