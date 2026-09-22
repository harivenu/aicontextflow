/**
 * @file
 * TreeItem representations for the AI Context Explorer sidebar.
 */

import * as vscode from 'vscode';
import { COMMANDS } from '../constants';

/**
 * Discriminator types for items in the context explorer tree.
 */
export type ContextTreeItemType =
  | 'category'
  | 'globalRule'
  | 'featureItem'
  | 'rootInstruction'
  | 'emptyNotice';

/**
 * Options for constructing a ContextTreeItem.
 */
export interface ContextTreeItemOptions {
  label: string;
  itemType: ContextTreeItemType;
  collapsibleState?: vscode.TreeItemCollapsibleState;
  filePath?: string;
  featureName?: string;
  isActiveFeature?: boolean;
  iconPath?: vscode.ThemeIcon | { light: vscode.Uri; dark: vscode.Uri };
  description?: string;
  tooltip?: string | vscode.MarkdownString;
  contextValue?: string;
  command?: vscode.Command;
}

/**
 * Custom TreeItem for AIContextFlow explorer.
 */
export class ContextTreeItem extends vscode.TreeItem {
  public readonly itemType: ContextTreeItemType;
  public readonly filePath?: string;
  public readonly featureName?: string;
  public readonly isActiveFeature?: boolean;

  constructor(options: ContextTreeItemOptions) {
    super(
      options.label,
      options.collapsibleState ?? vscode.TreeItemCollapsibleState.None
    );

    this.itemType = options.itemType;
    this.filePath = options.filePath;
    this.featureName = options.featureName;
    this.isActiveFeature = options.isActiveFeature;

    if (options.description !== undefined) {
      this.description = options.description;
    }

    if (options.tooltip !== undefined) {
      this.tooltip = options.tooltip;
    }

    if (options.iconPath !== undefined) {
      this.iconPath = options.iconPath;
    }

    if (options.contextValue !== undefined) {
      this.contextValue = options.contextValue;
    }

    if (options.command) {
      this.command = options.command;
    } else if (options.filePath) {
      // Default click action: open the file in editor.
      this.command = {
        command: COMMANDS.OPEN_FILE,
        title: 'Open File',
        arguments: [options.filePath],
      };
    }
  }
}
