/**
 * @file
 * Controls the AIContextFlow status bar item in VS Code.
 */

import * as vscode from 'vscode';
import { COMMANDS } from '../constants';
import { ContextManager } from '../services/contextManager';

/**
 * Manages the status bar item displaying the current active AI context feature.
 */
export class StatusBarController implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private contextManager: ContextManager;

  constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;

    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = COMMANDS.SET_ACTIVE_FEATURE;
    this.statusBarItem.name = 'AIContextFlow Active Sub-Context';
  }

  /**
   * Initializes and displays the status bar item.
   */
  public async initialize(): Promise<void> {
    await this.update();
  }

  /**
   * Updates the status bar text, icon, and tooltip based on the current active feature.
   */
  public async update(): Promise<void> {
    const config = this.contextManager.getConfig();

    if (!config.showStatusBar) {
      this.statusBarItem.hide();
      return;
    }

    try {
      const activeFeature = await this.contextManager.getActiveFeatureName();

      if (activeFeature) {
        this.statusBarItem.text = `$(book) AI Context: [${activeFeature}]`;
        this.statusBarItem.tooltip = new vscode.MarkdownString(
          `**AIContextFlow**\n\n` +
            `Active Sub-Context: \`${activeFeature}\`\n\n` +
            `Click to switch feature or bundle context.`
        );
        this.statusBarItem.backgroundColor = undefined;
      } else {
        this.statusBarItem.text = `$(book) AI Context: [None]`;
        this.statusBarItem.tooltip = new vscode.MarkdownString(
          `**AIContextFlow**\n\n` +
            `Active Sub-Context: *None (Global Rules Only)*\n\n` +
            `Click to select an active feature sub-context.`
        );
        this.statusBarItem.backgroundColor = undefined;
      }

      this.statusBarItem.show();
    } catch {
      this.statusBarItem.text = `$(book) AI Context: [None]`;
      this.statusBarItem.show();
    }
  }

  /**
   * Disposes of the status bar item.
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
