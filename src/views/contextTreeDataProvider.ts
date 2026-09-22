/**
 * @file
 * TreeDataProvider implementation for the AI Context Explorer sidebar.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { COMMANDS, DEFAULTS } from '../constants';
import { ContextManager } from '../services/contextManager';
import { checkSymlinkStatus } from '../services/symlinkManager';
import { ContextTreeItem } from './contextTreeItem';

/**
 * Category node keys for tree rendering.
 */
enum CategoryId {
  GlobalRules = 'cat_global_rules',
  FeatureSubContexts = 'cat_features',
  RootInstructions = 'cat_root_instructions',
}

/**
 * Provides hierarchical data for the AI Context Explorer TreeView.
 */
export class ContextTreeDataProvider
  implements vscode.TreeDataProvider<ContextTreeItem>, vscode.Disposable
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    ContextTreeItem | undefined | null | void
  > = new vscode.EventEmitter<ContextTreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<
    ContextTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private contextManager: ContextManager;

  constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
  }

  /**
   * Refreshes the tree view hierarchy.
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * TreeDataProvider interface: returns the UI presentation for an element.
   */
  public getTreeItem(element: ContextTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * TreeDataProvider interface: returns child elements for a given node.
   */
  public async getChildren(element?: ContextTreeItem): Promise<ContextTreeItem[]> {
    try {
      this.contextManager.getWorkspaceRoot();
    } catch {
      return [
        new ContextTreeItem({
          label: 'No folder open in workspace',
          itemType: 'emptyNotice',
          iconPath: new vscode.ThemeIcon('info'),
        }),
      ];
    }

    // Root level: return main category groups.
    if (!element) {
      return this.getRootCategories();
    }

    // Children of "Global Rules".
    if (element.contextValue === CategoryId.GlobalRules) {
      return this.getGlobalRulesChildren();
    }

    // Children of "Feature Sub-Contexts".
    if (element.contextValue === CategoryId.FeatureSubContexts) {
      return this.getFeatureChildren();
    }

    // Children of "Root Instructions".
    if (element.contextValue === CategoryId.RootInstructions) {
      return this.getRootInstructionChildren();
    }

    return [];
  }

  /**
   * Builds the top-level categories.
   */
  private async getRootCategories(): Promise<ContextTreeItem[]> {
    const features = await this.contextManager.listFeatures();
    const activeFeature = features.find((f) => f.isActive);
    const rulesPath = this.contextManager.getProjectRulesPath();
    const rulesExist = fs.existsSync(rulesPath);

    const categories: ContextTreeItem[] = [];

    // 1. Global Rules Category.
    categories.push(
      new ContextTreeItem({
        label: 'Global Rules',
        itemType: 'category',
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        iconPath: new vscode.ThemeIcon('law'),
        description: rulesExist ? '1 file' : 'missing',
        contextValue: CategoryId.GlobalRules,
        tooltip: 'Global project architecture and coding standards loaded by AI assistants.',
      })
    );

    // 2. Feature Sub-Contexts Category.
    const activeLabel = activeFeature ? `Active: ${activeFeature.name}` : 'None active';
    categories.push(
      new ContextTreeItem({
        label: 'Feature Sub-Contexts',
        itemType: 'category',
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        iconPath: new vscode.ThemeIcon('layers'),
        description: `${features.length} features (${activeLabel})`,
        contextValue: CategoryId.FeatureSubContexts,
        tooltip: 'Modular feature sub-contexts (.context/features/*.md). Click inline check to activate.',
      })
    );

    // 3. Root Instruction Symlinks Category.
    categories.push(
      new ContextTreeItem({
        label: 'Root AI Instructions',
        itemType: 'category',
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        iconPath: new vscode.ThemeIcon('hub'),
        description: 'AGENTS.md + Symlinks',
        contextValue: CategoryId.RootInstructions,
        tooltip: 'Unified root instructions and cross-tool symlinks (Claude, Copilot).',
      })
    );

    return categories;
  }

  /**
   * Builds items under the "Global Rules" group.
   */
  private async getGlobalRulesChildren(): Promise<ContextTreeItem[]> {
    const rulesPath = this.contextManager.getProjectRulesPath();
    const exists = fs.existsSync(rulesPath);

    if (!exists) {
      return [
        new ContextTreeItem({
          label: 'project-rules.md (missing)',
          itemType: 'emptyNotice',
          iconPath: new vscode.ThemeIcon(
            'warning',
            new vscode.ThemeColor('problemsWarningIcon.foreground')
          ),
          description: 'Click to initialize',
          tooltip: 'File .context/project-rules.md does not exist. Click to initialize.',
          command: {
            command: COMMANDS.INIT_STRUCTURE,
            title: 'Initialize Structure',
          },
        }),
      ];
    }

    let stats: fs.Stats | undefined;
    try {
      stats = await fs.promises.stat(rulesPath);
    } catch {
      // Ignored.
    }

    const fileSizeStr = stats ? `${stats.size} bytes` : '';

    return [
      new ContextTreeItem({
        label: 'project-rules.md',
        itemType: 'globalRule',
        filePath: rulesPath,
        iconPath: new vscode.ThemeIcon(
          'file-code',
          new vscode.ThemeColor('symbolIcon.fileForeground')
        ),
        description: fileSizeStr,
        contextValue: 'globalRulesFile',
        tooltip: new vscode.MarkdownString(
          `**Global Project Rules**\n\nPath: \`${this.contextManager.relPath(
            rulesPath
          )}\`\n\nClick to open in editor.`
        ),
      }),
    ];
  }

  /**
   * Builds items under the "Feature Sub-Contexts" group.
   */
  private async getFeatureChildren(): Promise<ContextTreeItem[]> {
    const featuresDir = this.contextManager.getFeaturesDirPath();
    if (!fs.existsSync(featuresDir)) {
      return [
        new ContextTreeItem({
          label: 'No .context/features directory found',
          itemType: 'emptyNotice',
          iconPath: new vscode.ThemeIcon('info'),
          description: 'Click to initialize',
          command: {
            command: COMMANDS.INIT_STRUCTURE,
            title: 'Initialize Structure',
          },
        }),
      ];
    }

    const features = await this.contextManager.listFeatures();

    if (features.length === 0) {
      return [
        new ContextTreeItem({
          label: 'No feature sub-contexts yet',
          itemType: 'emptyNotice',
          iconPath: new vscode.ThemeIcon('add'),
          description: 'Click to create one',
          command: {
            command: COMMANDS.CREATE_FEATURE,
            title: 'Create Feature',
          },
        }),
      ];
    }

    return features.map((feature) => {
      if (feature.isActive) {
        // Visual badge/icon indicating active sub-context.
        return new ContextTreeItem({
          label: feature.name,
          itemType: 'featureItem',
          filePath: feature.filePath,
          featureName: feature.name,
          isActiveFeature: true,
          iconPath: new vscode.ThemeIcon(
            'pass-filled',
            new vscode.ThemeColor('charts.green')
          ),
          description: '✓ Active Sub-Context',
          contextValue: 'featureItemActive',
          tooltip: new vscode.MarkdownString(
            `### $(pass-filled) Active Sub-Context: **${feature.name}**\n\n` +
              `*Title:* ${feature.title ?? feature.name}\n\n` +
              `*File:* \`${feature.relativeFilePath}\`\n\n` +
              (feature.scope ? `*Scope:* ${feature.scope}\n\n` : '') +
              `This feature is currently synchronized into \`AGENTS.md\` and bundled on export.`
          ),
        });
      }

      // Inactive feature item.
      return new ContextTreeItem({
        label: feature.name,
        itemType: 'featureItem',
        filePath: feature.filePath,
        featureName: feature.name,
        isActiveFeature: false,
        iconPath: new vscode.ThemeIcon('file-text'),
        description: feature.title && feature.title !== feature.name ? feature.title : '',
        contextValue: 'featureItemInactive',
        tooltip: new vscode.MarkdownString(
          `### Feature Sub-Context: **${feature.name}**\n\n` +
            `*File:* \`${feature.relativeFilePath}\`\n\n` +
            (feature.scope ? `*Scope:* ${feature.scope}\n\n` : '') +
            `Click inline check icon or right click to set as Active Sub-Context.`
        ),
      });
    });
  }

  /**
   * Builds items under the "Root AI Instructions" group.
   */
  private async getRootInstructionChildren(): Promise<ContextTreeItem[]> {
    const items: ContextTreeItem[] = [];
    const agentsPath = this.contextManager.getAgentsFilePath();
    const claudePath = this.contextManager.getClaudeFilePath();
    const copilotPath = this.contextManager.getCopilotFilePath();

    // 1. AGENTS.md
    const agentsExist = fs.existsSync(agentsPath);
    items.push(
      new ContextTreeItem({
        label: DEFAULTS.AGENTS_FILE,
        itemType: 'rootInstruction',
        filePath: agentsPath,
        iconPath: agentsExist
          ? new vscode.ThemeIcon('markdown', new vscode.ThemeColor('charts.blue'))
          : new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground')),
        description: agentsExist ? 'Master context' : 'Missing',
        tooltip: `Master agent instructions file (${this.contextManager.relPath(
          agentsPath
        )})`,
      })
    );

    // 2. CLAUDE.md
    const claudeRelTarget = path.relative(path.dirname(claudePath), agentsPath);
    const claudeStatus = await checkSymlinkStatus(
      claudePath,
      claudeRelTarget,
      agentsPath
    );
    items.push(
      new ContextTreeItem({
        label: DEFAULTS.CLAUDE_FILE,
        itemType: 'rootInstruction',
        filePath: claudePath,
        iconPath: this.getSymlinkIcon(claudeStatus),
        description: this.getSymlinkDesc(claudeStatus),
        tooltip: `Claude Code context: ${this.getSymlinkTooltip(
          claudeStatus,
          claudeRelTarget
        )}`,
      })
    );

    // 3. .github/copilot-instructions.md
    const copilotRelTarget = path.relative(path.dirname(copilotPath), agentsPath);
    const copilotStatus = await checkSymlinkStatus(
      copilotPath,
      copilotRelTarget,
      agentsPath
    );
    items.push(
      new ContextTreeItem({
        label: DEFAULTS.COPILOT_FILE,
        itemType: 'rootInstruction',
        filePath: copilotPath,
        iconPath: this.getSymlinkIcon(copilotStatus),
        description: this.getSymlinkDesc(copilotStatus),
        tooltip: `GitHub Copilot context: ${this.getSymlinkTooltip(
          copilotStatus,
          copilotRelTarget
        )}`,
      })
    );

    return items;
  }

  private getSymlinkIcon(status: {
    exists: boolean;
    isSymlink: boolean;
    pointsToExpected: boolean;
    isDirectCopy?: boolean;
  }): vscode.ThemeIcon {
    if (!status.exists) {
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
    }
    if (status.isSymlink && status.pointsToExpected) {
      return new vscode.ThemeIcon(
        'link',
        new vscode.ThemeColor('charts.green')
      );
    }
    if (status.isDirectCopy) {
      return new vscode.ThemeIcon(
        'files',
        new vscode.ThemeColor('charts.yellow')
      );
    }
    return new vscode.ThemeIcon(
      'warning',
      new vscode.ThemeColor('problemsWarningIcon.foreground')
    );
  }

  private getSymlinkDesc(status: {
    exists: boolean;
    isSymlink: boolean;
    pointsToExpected: boolean;
    isDirectCopy?: boolean;
  }): string {
    if (!status.exists) return 'Missing';
    if (status.isSymlink && status.pointsToExpected) return '→ AGENTS.md (symlink)';
    if (status.isDirectCopy) return '= AGENTS.md (copy)';
    if (status.isSymlink) return 'Broken symlink';
    return 'Standalone file';
  }

  private getSymlinkTooltip(
    status: {
      exists: boolean;
      isSymlink: boolean;
      pointsToExpected: boolean;
      actualTarget?: string;
      isDirectCopy?: boolean;
    },
    expected: string
  ): string {
    if (!status.exists) return 'File does not exist. Run "Initialize Context Structure".';
    if (status.isSymlink && status.pointsToExpected) {
      return `Valid symbolic link pointing to ${status.actualTarget}`;
    }
    if (status.isDirectCopy) {
      return 'Direct file copy matching AGENTS.md content.';
    }
    if (status.isSymlink) {
      return `Symlink points to "${status.actualTarget}", expected "${expected}".`;
    }
    return 'Regular file (not symlinked to AGENTS.md).';
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
