/**
 * @file
 * Test environment setup providing lightweight mocks for the VS Code runtime.
 */

const Module = require('module');

class MockTreeItem {
  constructor(label, collapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

class MockThemeIcon {
  constructor(id, color) {
    this.id = id;
    this.color = color;
  }
}

class MockThemeColor {
  constructor(id) {
    this.id = id;
  }
}

class MockEventEmitter {
  constructor() {
    this.event = (listener) => ({ dispose: () => {} });
  }
  fire(data) {}
  dispose() {}
}

class MockMarkdownString {
  constructor(value) {
    this.value = value;
  }
}

const mockVscode = {
  workspace: {
    workspaceFolders: [{ uri: { fsPath: process.cwd() } }],
    getConfiguration: () => ({
      get: (_key, defaultValue) => defaultValue,
    }),
    createFileSystemWatcher: () => ({
      onDidCreate: () => ({ dispose: () => {} }),
      onDidChange: () => ({ dispose: () => {} }),
      onDidDelete: () => ({ dispose: () => {} }),
      dispose: () => {},
    }),
  },
  env: {
    clipboard: {
      writeText: async (_text) => {},
    },
  },
  window: {
    createOutputChannel: () => ({
      appendLine: () => {},
      show: () => {},
      clear: () => {},
      dispose: () => {},
    }),
    createStatusBarItem: () => ({
      show: () => {},
      hide: () => {},
      dispose: () => {},
      text: '',
      tooltip: '',
      command: '',
    }),
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showInputBox: async () => undefined,
    showQuickPick: async () => undefined,
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  TreeItem: MockTreeItem,
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  ThemeIcon: MockThemeIcon,
  ThemeColor: MockThemeColor,
  EventEmitter: MockEventEmitter,
  MarkdownString: MockMarkdownString,
  ProgressLocation: {
    Notification: 15,
  },
};

const originalRequire = Module.prototype.require;
Module.prototype.require = function (moduleName) {
  if (moduleName === 'vscode') {
    return mockVscode;
  }
  return originalRequire.apply(this, arguments);
};
