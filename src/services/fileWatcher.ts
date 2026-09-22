/**
 * @file
 * File system watcher monitoring .context/ directory and root instruction files.
 */

import * as vscode from 'vscode';

export type FileChangeCallback = () => void | Promise<void>;

/**
 * Manages VS Code file watchers for AIContextFlow artifacts.
 */
export class ContextFileWatcher implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private callbacks: FileChangeCallback[] = [];

  /**
   * Registers a callback invoked whenever relevant files are created, changed, or deleted.
   */
  public onDidChange(callback: FileChangeCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Starts watching relevant files in the workspace.
   */
  public startWatching(): void {
    this.disposeWatchers();

    const patterns = [
      '**/.context/**',
      '**/AGENTS.md',
      '**/CLAUDE.md',
      '**/.github/copilot-instructions.md',
    ];

    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      watcher.onDidCreate(() => this.triggerChange());
      watcher.onDidChange(() => this.triggerChange());
      watcher.onDidDelete(() => this.triggerChange());

      this.watchers.push(watcher);
    }
  }

  /**
   * Debounced trigger for notifying subscribers of file changes.
   */
  private triggerChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      for (const cb of this.callbacks) {
        try {
          await cb();
        } catch (err) {
          console.error('[AIContextFlow] File change callback error:', err);
        }
      }
    }, 150);
  }

  private disposeWatchers(): void {
    for (const w of this.watchers) {
      w.dispose();
    }
    this.watchers = [];
  }

  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.disposeWatchers();
    this.callbacks = [];
  }
}
