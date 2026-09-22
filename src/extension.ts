/**
 * @file
 * Extension entry point for AIContextFlow.
 * Registers commands, sidebar tree view, status bar controller, and file watchers.
 */

import * as vscode from 'vscode';
import { COMMANDS, EXPLORER_VIEW_ID } from './constants';
import { ContextManager } from './services/contextManager';
import { ContextFileWatcher } from './services/fileWatcher';
import { ContextTreeDataProvider } from './views/contextTreeDataProvider';
import { ContextTreeItem } from './views/contextTreeItem';
import { StatusBarController } from './views/statusBarController';
import { validateFeatureNameInput } from './utils/validators';

/**
 * Global output channel for logging and validation reports.
 */
let outputChannel: vscode.OutputChannel;

/**
 * Activates the AIContextFlow extension.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel('AIContextFlow');
  context.subscriptions.push(outputChannel);

  const contextManager = new ContextManager();
  const treeDataProvider = new ContextTreeDataProvider(contextManager);
  const statusBarController = new StatusBarController(contextManager);
  const fileWatcher = new ContextFileWatcher();

  // Register TreeView.
  const treeView = vscode.window.createTreeView(EXPLORER_VIEW_ID, {
    treeDataProvider,
    showCollapseAll: true,
  });

  // Setup file watching on .context/ and AGENTS.md.
  fileWatcher.onDidChange(async () => {
    treeDataProvider.refresh();
    await statusBarController.update();
  });
  fileWatcher.startWatching();

  // Helper to refresh UI.
  const refreshUI = async () => {
    treeDataProvider.refresh();
    await statusBarController.update();
  };

  // Register Commands.

  // 1. Initialize Structure.
  const initCmd = vscode.commands.registerCommand(
    COMMANDS.INIT_STRUCTURE,
    async () => {
      try {
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'AIContextFlow: Initializing context structure...',
            cancellable: false,
          },
          async () => {
            return await contextManager.initStructure(false);
          }
        );

        let msg = `Context structure initialized. Created: ${result.created.length} item(s).`;
        if (result.skipped.length > 0) {
          msg += ` (${result.skipped.length} existing skipped).`;
        }

        if (result.warnings.length > 0) {
          vscode.window.showWarningMessage(
            `${msg} Warnings: ${result.warnings.join(' ')}`
          );
        } else {
          vscode.window.showInformationMessage(msg);
        }

        outputChannel.appendLine(`[Init] Created: ${result.created.join(', ')}`);
        if (result.skipped.length > 0) {
          outputChannel.appendLine(`[Init] Skipped: ${result.skipped.join(', ')}`);
        }
        if (result.warnings.length > 0) {
          outputChannel.appendLine(`[Init] Warnings: ${result.warnings.join(', ')}`);
        }

        await refreshUI();
      } catch (err: unknown) {
        const message = (err as Error).message;
        vscode.window.showErrorMessage(`AIContextFlow init failed: ${message}`);
        outputChannel.appendLine(`[Init Error] ${message}`);
      }
    }
  );

  // 2. Create Feature.
  const createFeatureCmd = vscode.commands.registerCommand(
    COMMANDS.CREATE_FEATURE,
    async () => {
      try {
        const featureName = await vscode.window.showInputBox({
          title: 'Create Feature Sub-Context',
          prompt:
            'Enter a kebab-case name for the new feature (e.g. auth-flow, payment-service)',
          placeHolder: 'feature-name',
          validateInput: validateFeatureNameInput,
        });

        if (!featureName) {
          return;
        }

        const feature = await contextManager.createFeature(featureName.trim());
        outputChannel.appendLine(`[Create Feature] Created ${feature.filePath}`);

        // Open newly created markdown file in editor.
        const doc = await vscode.workspace.openTextDocument(feature.filePath);
        await vscode.window.showTextDocument(doc);

        await refreshUI();

        // Ask user if they'd like to set it active immediately.
        const selection = await vscode.window.showInformationMessage(
          `Created feature sub-context "${feature.name}". Set as active sub-context?`,
          'Set as Active',
          'Keep Current'
        );

        if (selection === 'Set as Active') {
          await contextManager.setActiveFeature(feature.name);
          await refreshUI();
          vscode.window.showInformationMessage(
            `Active sub-context set to "${feature.name}".`
          );
        }
      } catch (err: unknown) {
        const message = (err as Error).message;
        vscode.window.showErrorMessage(`Failed to create feature: ${message}`);
        outputChannel.appendLine(`[Create Feature Error] ${message}`);
      }
    }
  );

  // 3. Set Active Feature.
  const setActiveFeatureCmd = vscode.commands.registerCommand(
    COMMANDS.SET_ACTIVE_FEATURE,
    async (arg?: ContextTreeItem | string) => {
      try {
        let targetFeatureName: string | undefined;

        if (typeof arg === 'string') {
          targetFeatureName = arg;
        } else if (arg instanceof ContextTreeItem && arg.featureName) {
          targetFeatureName = arg.featureName;
        } else {
          // Triggered from command palette or status bar: show QuickPick.
          const features = await contextManager.listFeatures();
          const currentActive = await contextManager.getActiveFeatureName();

          interface FeatureQuickPickItem extends vscode.QuickPickItem {
            action: 'select' | 'clear' | 'create';
            featureName?: string;
          }

          const items: FeatureQuickPickItem[] = [];

          // Option: Clear active sub-context.
          items.push({
            label: '$(clear-all) Clear Active Sub-Context',
            description: currentActive ? `Currently: ${currentActive}` : '(None active)',
            detail: 'Deactivate feature context; use global project rules only.',
            action: 'clear',
          });

          // Option: Create new feature.
          items.push({
            label: '$(add) Create New Feature Sub-Context...',
            description: '',
            detail: 'Prompt for feature name and generate template.',
            action: 'create',
          });

          // List all features.
          for (const feat of features) {
            const isCur = feat.name === currentActive;
            items.push({
              label: isCur ? `$(pass-filled) ${feat.name}` : `$(file-text) ${feat.name}`,
              description: isCur ? '(Active)' : (feat.title ?? ''),
              detail: feat.scope ?? feat.relativeFilePath,
              action: 'select',
              featureName: feat.name,
            });
          }

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an active feature sub-context or choose an action',
            title: 'AIContextFlow: Select Active Feature',
          });

          if (!selected) {
            return;
          }

          if (selected.action === 'clear') {
            await contextManager.setActiveFeature(null);
            await refreshUI();
            vscode.window.showInformationMessage(
              'Active AI sub-context cleared. Global rules only.'
            );
            return;
          }

          if (selected.action === 'create') {
            await vscode.commands.executeCommand(COMMANDS.CREATE_FEATURE);
            return;
          }

          targetFeatureName = selected.featureName;
        }

        if (targetFeatureName) {
          await contextManager.setActiveFeature(targetFeatureName);
          await refreshUI();
          vscode.window.showInformationMessage(
            `Active sub-context set to "${targetFeatureName}" in AGENTS.md.`
          );
        }
      } catch (err: unknown) {
        const message = (err as Error).message;
        vscode.window.showErrorMessage(`Failed to set active feature: ${message}`);
        outputChannel.appendLine(`[Set Active Error] ${message}`);
      }
    }
  );

  // 4. Unset Active Feature.
  const unsetActiveFeatureCmd = vscode.commands.registerCommand(
    COMMANDS.UNSET_ACTIVE_FEATURE,
    async () => {
      try {
        await contextManager.setActiveFeature(null);
        await refreshUI();
        vscode.window.showInformationMessage(
          'Active sub-context cleared. Global rules only.'
        );
      } catch (err: unknown) {
        const message = (err as Error).message;
        vscode.window.showErrorMessage(`Failed to clear active feature: ${message}`);
      }
    }
  );

  // 5. Export Bundle.
  const exportBundleCmd = vscode.commands.registerCommand(
    COMMANDS.EXPORT_BUNDLE,
    async (arg?: ContextTreeItem | string) => {
      try {
        let featureOverride: string | undefined;
        if (typeof arg === 'string') {
          featureOverride = arg;
        } else if (arg instanceof ContextTreeItem && arg.featureName) {
          featureOverride = arg.featureName;
        }

        const bundle = await contextManager.exportBundle(featureOverride);

        const targetLabel = bundle.featureName
          ? `rules + ${bundle.featureName}`
          : 'global rules only';

        const action = await vscode.window.showInformationMessage(
          `Bundled AI context (${targetLabel}) copied to clipboard! (${bundle.characterCount.toLocaleString()} chars, ~${bundle.tokenEstimate.toLocaleString()} tokens)`,
          'Preview Bundle'
        );

        if (action === 'Preview Bundle') {
          await vscode.commands.executeCommand(COMMANDS.PREVIEW_BUNDLE, bundle.content);
        }
      } catch (err: unknown) {
        const message = (err as Error).message;
        vscode.window.showErrorMessage(`Failed to export bundle: ${message}`);
        outputChannel.appendLine(`[Export Bundle Error] ${message}`);
      }
    }
  );

  // 6. Preview Bundle.
  const previewBundleCmd = vscode.commands.registerCommand(
    COMMANDS.PREVIEW_BUNDLE,
    async (contentOverride?: string) => {
      try {
        let content = contentOverride;
        if (!content) {
          const bundle = await contextManager.exportBundle();
          content = bundle.content;
        }

        const doc = await vscode.workspace.openTextDocument({
          content,
          language: 'markdown',
        });
        await vscode.window.showTextDocument(doc, {
          preview: true,
          viewColumn: vscode.ViewColumn.Beside,
        });
      } catch (err: unknown) {
        vscode.window.showErrorMessage(`Failed to preview bundle: ${(err as Error).message}`);
      }
    }
  );

  // 7. Validate Structure.
  const validateCmd = vscode.commands.registerCommand(
    COMMANDS.VALIDATE_STRUCTURE,
    async () => {
      try {
        const report = await contextManager.validateStructure();

        outputChannel.clear();
        outputChannel.appendLine('========================================');
        outputChannel.appendLine(' AIContextFlow Structure Validation');
        outputChannel.appendLine('========================================');
        outputChannel.appendLine(`Overall Status: ${report.isValid ? 'PASSED' : 'FAILED'}`);
        outputChannel.appendLine(`Summary: ${report.summary}\n`);

        for (const item of report.items) {
          const icon = item.status === 'ok' ? '✓' : item.status === 'warning' ? '⚠' : '✗';
          outputChannel.appendLine(`[${icon}] ${item.label}`);
          outputChannel.appendLine(`    Path: ${item.path}`);
          outputChannel.appendLine(`    Type: ${item.type}`);
          outputChannel.appendLine(`    Status: ${item.status.toUpperCase()}`);
          outputChannel.appendLine(`    Details: ${item.message}\n`);
        }

        if (report.isValid) {
          const action = await vscode.window.showInformationMessage(
            `AI Context Structure is valid! ${report.summary}`,
            'View Full Report'
          );
          if (action === 'View Full Report') {
            outputChannel.show();
          }
        } else {
          const action = await vscode.window.showErrorMessage(
            `AI Context Structure has errors: ${report.summary}`,
            'Repair / Initialize',
            'View Report'
          );
          if (action === 'Repair / Initialize') {
            await vscode.commands.executeCommand(COMMANDS.INIT_STRUCTURE);
          } else if (action === 'View Report') {
            outputChannel.show();
          }
        }
      } catch (err: unknown) {
        vscode.window.showErrorMessage(`Validation failed: ${(err as Error).message}`);
      }
    }
  );

  // 8. Refresh Explorer.
  const refreshCmd = vscode.commands.registerCommand(
    COMMANDS.REFRESH_EXPLORER,
    async () => {
      await refreshUI();
    }
  );

  // 9. Open File.
  const openFileCmd = vscode.commands.registerCommand(
    COMMANDS.OPEN_FILE,
    async (filePath: string) => {
      if (!filePath) return;
      try {
        const uri = vscode.Uri.file(filePath);
        await vscode.window.showTextDocument(uri);
      } catch (err: unknown) {
        vscode.window.showErrorMessage(`Cannot open file: ${(err as Error).message}`);
      }
    }
  );

  // 10. Delete Feature.
  const deleteFeatureCmd = vscode.commands.registerCommand(
    COMMANDS.DELETE_FEATURE,
    async (item?: ContextTreeItem) => {
      const name = item?.featureName;
      if (!name) return;

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete feature sub-context "${name}"?`,
        { modal: true },
        'Delete'
      );

      if (confirm === 'Delete') {
        try {
          await contextManager.deleteFeature(name);
          await refreshUI();
          vscode.window.showInformationMessage(`Deleted feature "${name}".`);
        } catch (err: unknown) {
          vscode.window.showErrorMessage(`Failed to delete feature: ${(err as Error).message}`);
        }
      }
    }
  );

  // Register subscriptions.
  context.subscriptions.push(
    treeView,
    treeDataProvider,
    statusBarController,
    fileWatcher,
    initCmd,
    createFeatureCmd,
    setActiveFeatureCmd,
    unsetActiveFeatureCmd,
    exportBundleCmd,
    previewBundleCmd,
    validateCmd,
    refreshCmd,
    openFileCmd,
    deleteFeatureCmd
  );

  // Initialize status bar item.
  await statusBarController.initialize();
}

/**
 * Deactivates the AIContextFlow extension.
 */
export function deactivate(): void {
  // Clean up if needed.
}
