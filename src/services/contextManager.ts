/**
 * @file
 * Core ContextManager service orchestrating .context/ structure,
 * AGENTS.md synchronization, feature lifecycle, and bundling.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { COMMANDS, CONFIG_KEYS, DEFAULTS, MARKERS } from '../constants';
import {
  ContextBundle,
  FeatureInfo,
  InitResult,
  ValidationItem,
  ValidationReport,
} from '../types';
import { buildContextBundle } from './bundler';
import { checkSymlinkStatus, createSymlinkWithFallback } from './symlinkManager';
import { isValidKebabCase, toTitleCase } from '../utils/validators';

/**
 * Manages the AI context file architecture for a workspace.
 */
export class ContextManager {
  private workspaceRoot: string | undefined;

  /**
   * Constructs a ContextManager instance.
   *
   * @param workspaceRoot
   *   Optional explicit workspace root directory path.
   */
  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Resolves the current workspace root directory path.
   */
  public getWorkspaceRoot(): string {
    if (this.workspaceRoot) {
      return this.workspaceRoot;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      throw new Error('No workspace folder is currently open in VS Code.');
    }
    return folders[0].uri.fsPath;
  }

  /**
   * Resolves configuration options for the extension.
   */
  public getConfig() {
    try {
      const cfg = vscode.workspace.getConfiguration('aicontextflow');
      return {
        contextDirectory: cfg.get<string>(
          CONFIG_KEYS.CONTEXT_DIRECTORY,
          DEFAULTS.CONTEXT_DIR
        ),
        agentsFilePath: cfg.get<string>(
          CONFIG_KEYS.AGENTS_FILE_PATH,
          DEFAULTS.AGENTS_FILE
        ),
        stripFluffOnExport: cfg.get<boolean>(
          CONFIG_KEYS.STRIP_FLUFF_ON_EXPORT,
          true
        ),
        embedFullContent: cfg.get<boolean>(
          CONFIG_KEYS.EMBED_FULL_CONTENT,
          false
        ),
        showStatusBar: cfg.get<boolean>(CONFIG_KEYS.SHOW_STATUS_BAR, true),
      };
    } catch {
      return {
        contextDirectory: DEFAULTS.CONTEXT_DIR,
        agentsFilePath: DEFAULTS.AGENTS_FILE,
        stripFluffOnExport: true,
        embedFullContent: false,
        showStatusBar: true,
      };
    }
  }

  /**
   * Resolves absolute path to the .context directory.
   */
  public getContextDirPath(): string {
    const config = this.getConfig();
    return path.resolve(this.getWorkspaceRoot(), config.contextDirectory);
  }

  /**
   * Resolves absolute path to the .context/features directory.
   */
  public getFeaturesDirPath(): string {
    return path.join(this.getContextDirPath(), DEFAULTS.FEATURES_DIR);
  }

  /**
   * Resolves absolute path to .context/project-rules.md.
   */
  public getProjectRulesPath(): string {
    return path.join(this.getContextDirPath(), DEFAULTS.PROJECT_RULES_FILE);
  }

  /**
   * Resolves absolute path to AGENTS.md.
   */
  public getAgentsFilePath(): string {
    const config = this.getConfig();
    return path.resolve(this.getWorkspaceRoot(), config.agentsFilePath);
  }

  /**
   * Resolves absolute path to CLAUDE.md.
   */
  public getClaudeFilePath(): string {
    return path.resolve(this.getWorkspaceRoot(), DEFAULTS.CLAUDE_FILE);
  }

  /**
   * Resolves absolute path to .github/copilot-instructions.md.
   */
  public getCopilotFilePath(): string {
    return path.resolve(this.getWorkspaceRoot(), DEFAULTS.COPILOT_FILE);
  }

  /**
   * Initializes the entire AI context file structure.
   * Creates:
   *   - .context/
   *   - .context/features/
   *   - .context/project-rules.md
   *   - AGENTS.md
   *   - CLAUDE.md -> AGENTS.md (symlink)
   *   - .github/copilot-instructions.md -> AGENTS.md (symlink)
   *
   * @param overwriteExisting
   *   Whether to overwrite existing content files.
   *
   * @return
   *   Summary of files created, skipped, and any warnings.
   */
  public async initStructure(overwriteExisting: boolean = false): Promise<InitResult> {
    const result: InitResult = {
      created: [],
      skipped: [],
      warnings: [],
    };

    const contextDir = this.getContextDirPath();
    const featuresDir = this.getFeaturesDirPath();
    const projectRulesPath = this.getProjectRulesPath();
    const agentsPath = this.getAgentsFilePath();
    const claudePath = this.getClaudeFilePath();
    const copilotPath = this.getCopilotFilePath();

    // 1. Create .context/ directory.
    if (!fs.existsSync(contextDir)) {
      await fs.promises.mkdir(contextDir, { recursive: true });
      result.created.push(this.relPath(contextDir));
    } else {
      result.skipped.push(this.relPath(contextDir));
    }

    // 2. Create .context/features/ directory.
    if (!fs.existsSync(featuresDir)) {
      await fs.promises.mkdir(featuresDir, { recursive: true });
      result.created.push(this.relPath(featuresDir));
    } else {
      result.skipped.push(this.relPath(featuresDir));
    }

    // 3. Create .context/project-rules.md if not present.
    if (!fs.existsSync(projectRulesPath) || overwriteExisting) {
      const defaultRulesContent = this.getDefaultProjectRulesTemplate();
      await fs.promises.writeFile(projectRulesPath, defaultRulesContent, 'utf8');
      result.created.push(this.relPath(projectRulesPath));
    } else {
      result.skipped.push(this.relPath(projectRulesPath));
    }

    // 4. Create AGENTS.md if not present.
    if (!fs.existsSync(agentsPath) || overwriteExisting) {
      const defaultAgentsContent = this.getDefaultAgentsMdTemplate();
      await fs.promises.writeFile(agentsPath, defaultAgentsContent, 'utf8');
      result.created.push(this.relPath(agentsPath));
    } else {
      // Ensure existing AGENTS.md contains the active feature marker block.
      await this.ensureActiveFeatureBlock(agentsPath);
      result.skipped.push(this.relPath(agentsPath));
    }

    // 5. Create symlink: CLAUDE.md -> AGENTS.md
    try {
      const relToAgents = path.relative(path.dirname(claudePath), agentsPath);
      const claudeResult = await createSymlinkWithFallback(
        agentsPath,
        claudePath,
        relToAgents
      );
      if (claudeResult.warning) {
        result.warnings.push(claudeResult.warning);
      }
      result.created.push(`${this.relPath(claudePath)} (${claudeResult.method})`);
    } catch (err: unknown) {
      result.warnings.push(`CLAUDE.md symlink: ${(err as Error).message}`);
    }

    // 6. Create symlink: .github/copilot-instructions.md -> ../AGENTS.md
    try {
      const relToAgents = path.relative(path.dirname(copilotPath), agentsPath);
      const copilotResult = await createSymlinkWithFallback(
        agentsPath,
        copilotPath,
        relToAgents
      );
      if (copilotResult.warning) {
        result.warnings.push(copilotResult.warning);
      }
      result.created.push(`${this.relPath(copilotPath)} (${copilotResult.method})`);
    } catch (err: unknown) {
      result.warnings.push(`.github/copilot-instructions.md symlink: ${(err as Error).message}`);
    }

    return result;
  }

  /**
   * Creates a new feature sub-context markdown file.
   *
   * @param name
   *   Kebab-case feature name (e.g. 'auth-flow').
   *
   * @return
   *   Information about the newly created feature.
   */
  public async createFeature(name: string): Promise<FeatureInfo> {
    if (!isValidKebabCase(name)) {
      throw new Error(
        `Invalid feature name "${name}". Feature names must be kebab-case (e.g. "auth-service", "checkout-flow").`
      );
    }

    const featuresDir = this.getFeaturesDirPath();
    if (!fs.existsSync(featuresDir)) {
      await fs.promises.mkdir(featuresDir, { recursive: true });
    }

    const targetFile = path.join(featuresDir, `${name}.md`);
    if (fs.existsSync(targetFile)) {
      throw new Error(`Feature sub-context file already exists: ${this.relPath(targetFile)}`);
    }

    const title = toTitleCase(name);
    const content = this.getDefaultFeatureTemplate(name, title);
    await fs.promises.writeFile(targetFile, content, 'utf8');

    return {
      name,
      filePath: targetFile,
      relativeFilePath: this.relPath(targetFile),
      isActive: false,
      title,
      scope: 'Pending definition',
    };
  }

  /**
   * Deletes a feature sub-context file.
   *
   * @param name
   *   Kebab-case feature name.
   */
  public async deleteFeature(name: string): Promise<void> {
    const filePath = path.join(this.getFeaturesDirPath(), `${name}.md`);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    // If this feature was active, clear it in AGENTS.md.
    const active = await this.getActiveFeatureName();
    if (active === name) {
      await this.setActiveFeature(null);
    }
  }

  /**
   * Lists all feature sub-contexts discovered in .context/features/*.md.
   *
   * @return
   *   Array of FeatureInfo descriptors.
   */
  public async listFeatures(): Promise<FeatureInfo[]> {
    const featuresDir = this.getFeaturesDirPath();
    if (!fs.existsSync(featuresDir)) {
      return [];
    }

    const files = await fs.promises.readdir(featuresDir);
    const mdFiles = files.filter((f) => f.endsWith('.md') && !f.startsWith('.'));
    const activeName = await this.getActiveFeatureName();

    const features: FeatureInfo[] = [];

    for (const file of mdFiles) {
      const name = path.basename(file, '.md');
      const filePath = path.join(featuresDir, file);
      let title = toTitleCase(name);
      let scope: string | undefined;

      try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        // Extract title from first H1.
        const h1Match = content.match(/^#\s+(.+)$/m);
        if (h1Match) {
          title = h1Match[1].trim();
        }

        // Extract scope preview.
        const scopeMatch = content.match(/##\s+Scope\s*\n+([^#\n]+)/i);
        if (scopeMatch) {
          scope = scopeMatch[1].trim();
        }
      } catch {
        // Fallback to title based on filename.
      }

      features.push({
        name,
        filePath,
        relativeFilePath: this.relPath(filePath),
        isActive: name === activeName,
        title,
        scope,
      });
    }

    // Sort active feature first, then alphabetically.
    features.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.name.localeCompare(b.name);
    });

    return features;
  }

  /**
   * Reads AGENTS.md and parses the name of the currently active feature.
   *
   * @return
   *   Active feature name, or null if no feature is currently active.
   */
  public async getActiveFeatureName(): Promise<string | null> {
    const agentsPath = this.getAgentsFilePath();
    if (!fs.existsSync(agentsPath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(agentsPath, 'utf8');

      // 1. Search within dedicated markers first.
      const markerRegex = new RegExp(
        `${MARKERS.ACTIVE_FEATURE_START}([\\s\\S]*?)${MARKERS.ACTIVE_FEATURE_END}`,
        'i'
      );
      const markerMatch = content.match(markerRegex);
      const searchBlock = markerMatch ? markerMatch[1] : content;

      // 2. Match active feature name.
      const featureMatch = searchBlock.match(
        /##\s*Active Sub-Context:\s*`?([a-z0-9-]+)`?/i
      );

      if (featureMatch) {
        const candidate = featureMatch[1].trim();
        if (candidate.toLowerCase() === 'none') {
          return null;
        }
        return candidate;
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Updates AGENTS.md to set or clear the active feature sub-context.
   *
   * @param featureName
   *   Kebab-case feature name to activate, or null to clear.
   */
  public async setActiveFeature(featureName: string | null): Promise<void> {
    const agentsPath = this.getAgentsFilePath();

    // Verify feature file exists if a name is provided.
    let featureContent = '';
    let featureFilePath = '';
    if (featureName) {
      featureFilePath = path.join(this.getFeaturesDirPath(), `${featureName}.md`);
      if (!fs.existsSync(featureFilePath)) {
        throw new Error(
          `Feature file does not exist: ${this.relPath(featureFilePath)}`
        );
      }
      featureContent = await fs.promises.readFile(featureFilePath, 'utf8');
    }

    // Ensure AGENTS.md exists.
    if (!fs.existsSync(agentsPath)) {
      const template = this.getDefaultAgentsMdTemplate();
      await fs.promises.writeFile(agentsPath, template, 'utf8');
    }

    const currentAgentsContent = await fs.promises.readFile(agentsPath, 'utf8');
    const newActiveBlock = this.generateActiveBlock(
      featureName,
      featureContent,
      featureFilePath
    );

    const markerRegex = new RegExp(
      `${MARKERS.ACTIVE_FEATURE_START}[\\s\\S]*?${MARKERS.ACTIVE_FEATURE_END}`,
      'i'
    );

    let updatedContent: string;
    if (markerRegex.test(currentAgentsContent)) {
      updatedContent = currentAgentsContent.replace(markerRegex, newActiveBlock);
    } else {
      // If markers are missing, append or replace existing section.
      const fallbackHeaderRegex = /##\s*Active Sub-Context[\s\S]*?(?=(?:\n##|\Z))/i;
      if (fallbackHeaderRegex.test(currentAgentsContent)) {
        updatedContent = currentAgentsContent.replace(fallbackHeaderRegex, newActiveBlock);
      } else {
        updatedContent = currentAgentsContent.trimEnd() + '\n\n' + newActiveBlock + '\n';
      }
    }

    await fs.promises.writeFile(agentsPath, updatedContent, 'utf8');
  }

  /**
   * Exports the bundled context (project rules + active feature) to clipboard.
   *
   * @param featureNameOverride
   *   Optional feature name to bundle instead of currently active one.
   *
   * @return
   *   The generated ContextBundle.
   */
  public async exportBundle(featureNameOverride?: string): Promise<ContextBundle> {
    const config = this.getConfig();
    const rulesPath = this.getProjectRulesPath();

    let rulesContent = '';
    if (fs.existsSync(rulesPath)) {
      rulesContent = await fs.promises.readFile(rulesPath, 'utf8');
    }

    const activeFeatureName =
      featureNameOverride !== undefined
        ? featureNameOverride
        : await this.getActiveFeatureName();

    let featureContent: string | null = null;
    let featureRelPath: string | null = null;

    if (activeFeatureName) {
      const featureFile = path.join(
        this.getFeaturesDirPath(),
        `${activeFeatureName}.md`
      );
      if (fs.existsSync(featureFile)) {
        featureContent = await fs.promises.readFile(featureFile, 'utf8');
        featureRelPath = this.relPath(featureFile);
      }
    }

    const bundle = buildContextBundle(
      rulesContent,
      featureContent,
      activeFeatureName,
      this.relPath(rulesPath),
      featureRelPath,
      config.stripFluffOnExport
    );

    // Copy to system clipboard if available.
    try {
      if (vscode.env && vscode.env.clipboard) {
        await vscode.env.clipboard.writeText(bundle.content);
      }
    } catch {
      // Headless / non-VS Code environments can skip clipboard write.
    }

    return bundle;
  }

  /**
   * Validates the integrity of context files and symlinks.
   *
   * @return
   *   A comprehensive ValidationReport.
   */
  public async validateStructure(): Promise<ValidationReport> {
    const items: ValidationItem[] = [];
    const contextDir = this.getContextDirPath();
    const featuresDir = this.getFeaturesDirPath();
    const rulesPath = this.getProjectRulesPath();
    const agentsPath = this.getAgentsFilePath();
    const claudePath = this.getClaudeFilePath();
    const copilotPath = this.getCopilotFilePath();

    // 1. Check .context/ directory.
    if (fs.existsSync(contextDir)) {
      items.push({
        label: 'Context Directory',
        path: this.relPath(contextDir),
        type: 'directory',
        status: 'ok',
        message: 'Directory exists and is accessible.',
      });
    } else {
      items.push({
        label: 'Context Directory',
        path: this.relPath(contextDir),
        type: 'directory',
        status: 'error',
        message: `Missing directory. Run "${COMMANDS.INIT_STRUCTURE}" to initialize.`,
      });
    }

    // 2. Check .context/features/ directory.
    if (fs.existsSync(featuresDir)) {
      const features = await this.listFeatures();
      items.push({
        label: 'Feature Sub-Contexts Directory',
        path: this.relPath(featuresDir),
        type: 'directory',
        status: 'ok',
        message: `Contains ${features.length} feature sub-context(s).`,
      });
    } else {
      items.push({
        label: 'Feature Sub-Contexts Directory',
        path: this.relPath(featuresDir),
        type: 'directory',
        status: 'warning',
        message: 'Features directory missing. Create it or initialize structure.',
      });
    }

    // 3. Check project-rules.md.
    if (fs.existsSync(rulesPath)) {
      const stats = await fs.promises.stat(rulesPath);
      items.push({
        label: 'Global Project Rules',
        path: this.relPath(rulesPath),
        type: 'file',
        status: stats.size > 0 ? 'ok' : 'warning',
        message:
          stats.size > 0
            ? `Active (${stats.size} bytes).`
            : 'File is empty. Define your project rules.',
      });
    } else {
      items.push({
        label: 'Global Project Rules',
        path: this.relPath(rulesPath),
        type: 'file',
        status: 'error',
        message: 'Missing project-rules.md file.',
      });
    }

    // 4. Check AGENTS.md.
    if (fs.existsSync(agentsPath)) {
      const content = await fs.promises.readFile(agentsPath, 'utf8');
      const hasMarkers =
        content.includes(MARKERS.ACTIVE_FEATURE_START) &&
        content.includes(MARKERS.ACTIVE_FEATURE_END);

      items.push({
        label: 'Root Agents Instructions (AGENTS.md)',
        path: this.relPath(agentsPath),
        type: 'file',
        status: hasMarkers ? 'ok' : 'warning',
        message: hasMarkers
          ? 'Valid with AIContextFlow integration markers.'
          : 'File exists but is missing AIContextFlow sync markers.',
      });
    } else {
      items.push({
        label: 'Root Agents Instructions (AGENTS.md)',
        path: this.relPath(agentsPath),
        type: 'file',
        status: 'error',
        message: 'Missing AGENTS.md file in workspace root.',
      });
    }

    // 5. Check CLAUDE.md symlink.
    const claudeRelTarget = path.relative(path.dirname(claudePath), agentsPath);
    const claudeStatus = await checkSymlinkStatus(
      claudePath,
      claudeRelTarget,
      agentsPath
    );

    if (claudeStatus.exists && claudeStatus.isSymlink && claudeStatus.pointsToExpected) {
      items.push({
        label: 'Claude Symlink (CLAUDE.md)',
        path: this.relPath(claudePath),
        type: 'symlink',
        status: 'ok',
        message: `Valid symlink -> ${claudeStatus.actualTarget}`,
      });
    } else if (claudeStatus.exists && claudeStatus.isDirectCopy) {
      items.push({
        label: 'Claude Instructions (CLAUDE.md)',
        path: this.relPath(claudePath),
        type: 'file',
        status: 'warning',
        message: 'Direct file copy instead of symlink (content matches AGENTS.md).',
      });
    } else if (claudeStatus.exists && claudeStatus.isSymlink) {
      items.push({
        label: 'Claude Symlink (CLAUDE.md)',
        path: this.relPath(claudePath),
        type: 'symlink',
        status: 'error',
        message: `Broken symlink: points to "${claudeStatus.actualTarget}" instead of "${claudeRelTarget}".`,
      });
    } else if (claudeStatus.exists) {
      items.push({
        label: 'Claude File (CLAUDE.md)',
        path: this.relPath(claudePath),
        type: 'file',
        status: 'warning',
        message: 'Standalone file (not linked to AGENTS.md).',
      });
    } else {
      items.push({
        label: 'Claude Symlink (CLAUDE.md)',
        path: this.relPath(claudePath),
        type: 'symlink',
        status: 'warning',
        message: 'Missing CLAUDE.md symlink.',
      });
    }

    // 6. Check .github/copilot-instructions.md symlink.
    const copilotRelTarget = path.relative(path.dirname(copilotPath), agentsPath);
    const copilotStatus = await checkSymlinkStatus(
      copilotPath,
      copilotRelTarget,
      agentsPath
    );

    if (copilotStatus.exists && copilotStatus.isSymlink && copilotStatus.pointsToExpected) {
      items.push({
        label: 'Copilot Symlink (.github/copilot-instructions.md)',
        path: this.relPath(copilotPath),
        type: 'symlink',
        status: 'ok',
        message: `Valid symlink -> ${copilotStatus.actualTarget}`,
      });
    } else if (copilotStatus.exists && copilotStatus.isDirectCopy) {
      items.push({
        label: 'Copilot Instructions (.github/copilot-instructions.md)',
        path: this.relPath(copilotPath),
        type: 'file',
        status: 'warning',
        message: 'Direct file copy instead of symlink (content matches AGENTS.md).',
      });
    } else if (copilotStatus.exists && copilotStatus.isSymlink) {
      items.push({
        label: 'Copilot Symlink (.github/copilot-instructions.md)',
        path: this.relPath(copilotPath),
        type: 'symlink',
        status: 'error',
        message: `Broken symlink: points to "${copilotStatus.actualTarget}".`,
      });
    } else if (copilotStatus.exists) {
      items.push({
        label: 'Copilot File (.github/copilot-instructions.md)',
        path: this.relPath(copilotPath),
        type: 'file',
        status: 'warning',
        message: 'Standalone file (not linked to AGENTS.md).',
      });
    } else {
      items.push({
        label: 'Copilot Symlink (.github/copilot-instructions.md)',
        path: this.relPath(copilotPath),
        type: 'symlink',
        status: 'warning',
        message: 'Missing .github/copilot-instructions.md symlink.',
      });
    }

    // 7. Check Active Feature resolution.
    const activeName = await this.getActiveFeatureName();
    if (activeName) {
      const activeFile = path.join(this.getFeaturesDirPath(), `${activeName}.md`);
      if (fs.existsSync(activeFile)) {
        items.push({
          label: 'Active Sub-Context',
          path: this.relPath(activeFile),
          type: 'active-state',
          status: 'ok',
          message: `Active feature "${activeName}" points to valid file.`,
        });
      } else {
        items.push({
          label: 'Active Sub-Context',
          path: this.relPath(activeFile),
          type: 'active-state',
          status: 'error',
          message: `Active feature "${activeName}" referenced in AGENTS.md does not exist on disk.`,
        });
      }
    } else {
      items.push({
        label: 'Active Sub-Context',
        path: 'N/A',
        type: 'active-state',
        status: 'ok',
        message: 'No feature currently active (Global rules only).',
      });
    }

    const hasErrors = items.some((item) => item.status === 'error');
    const warningCount = items.filter((item) => item.status === 'warning').length;

    return {
      isValid: !hasErrors,
      items,
      summary: hasErrors
        ? 'Validation detected critical errors in your AI context setup.'
        : warningCount > 0
        ? `Setup is valid with ${warningCount} optional recommendation(s).`
        : 'All AI context files and symlinks are healthy and synchronized.',
    };
  }

  /**
   * Helper to format a relative path from the workspace root.
   */
  public relPath(absolutePath: string): string {
    const root = this.getWorkspaceRoot();
    const rel = path.relative(root, absolutePath);
    return rel.startsWith('.') ? rel : `./${rel}`;
  }

  /**
   * Generates the markdown block for active feature inside AGENTS.md.
   */
  private generateActiveBlock(
    featureName: string | null,
    featureContent: string,
    featureFilePath: string
  ): string {
    const config = this.getConfig();

    if (!featureName) {
      return `${MARKERS.ACTIVE_FEATURE_START}
## Active Sub-Context: None

*No active feature sub-context is currently selected. Only global project rules apply.*
${MARKERS.ACTIVE_FEATURE_END}`;
    }

    const relPath = this.relPath(featureFilePath);
    let body = `*Active Feature:* \`${featureName}\`
*Context File:* [${featureName}.md](${relPath})

> **AI Instructions:** When assisting with this project, incorporate both the global rules from \`.context/project-rules.md\` and the specific requirements defined in \`${relPath}\`.`;

    if (config.embedFullContent && featureContent.trim().length > 0) {
      body += `\n\n### Embedded Feature Sub-Context\n\n${featureContent.trim()}`;
    }

    return `${MARKERS.ACTIVE_FEATURE_START}
## Active Sub-Context: ${featureName}

${body}
${MARKERS.ACTIVE_FEATURE_END}`;
  }

  /**
   * Ensures the active feature markers exist in AGENTS.md without overwriting other content.
   */
  private async ensureActiveFeatureBlock(agentsPath: string): Promise<void> {
    const content = await fs.promises.readFile(agentsPath, 'utf8');
    if (content.includes(MARKERS.ACTIVE_FEATURE_START)) {
      return;
    }
    const initialBlock = this.generateActiveBlock(null, '', '');
    const updated = content.trimEnd() + '\n\n' + initialBlock + '\n';
    await fs.promises.writeFile(agentsPath, updated, 'utf8');
  }

  /**
   * Returns default starter template for .context/project-rules.md.
   */
  private getDefaultProjectRulesTemplate(): string {
    return `# Project Rules & Architecture Guidelines

<!-- AIContextFlow: Global project rules loaded by all AI coding assistants -->

## 1. Architecture Overview
- Maintain clear modular separation between business logic, presentation, and data layers.
- Avoid tight coupling; prefer dependency injection and well-defined interface contracts.
- Keep dependencies updated and do not introduce unapproved external libraries.

## 2. Code Quality & Conventions
- Adhere strictly to project linting and formatting rules.
- Add descriptive documentation blocks for all public functions, interfaces, and classes.
- Handle error boundaries gracefully; do not swallow unexpected exceptions.
- Prefer self-documenting code with clear variable and function naming.

## 3. Testing & Verification
- Unit test coverage is required for all new logic and bug fixes.
- Run tests and linting before committing code changes.
- Never disable existing tests without explicit justification.

## 4. AI Assistant Guardrails
- **No silent breaking changes:** Always verify API backward compatibility.
- **Explain non-obvious design choices:** Include rationale for complex algorithms.
- **Respect established patterns:** Follow prevailing patterns in the codebase before introducing new paradigms.
`;
  }

  /**
   * Returns default starter template for AGENTS.md.
   */
  private getDefaultAgentsMdTemplate(): string {
    return `# AI Agent Workspace Instructions

This workspace utilizes **AIContextFlow** for modular context management.
AI assistants (Anthropic Claude, GitHub Copilot, Cursor, Gemini) must follow the instructions below.

## Global Guidelines
1. Read and adhere to the project rules defined in \`.context/project-rules.md\`.
2. Check the active sub-context section below before implementing feature-specific tasks.
3. Keep code clean, test-covered, and maintain existing conventions.

${MARKERS.ACTIVE_FEATURE_START}
## Active Sub-Context: None

*No active feature sub-context is currently selected. Only global project rules apply.*
${MARKERS.ACTIVE_FEATURE_END}
`;
  }

  /**
   * Returns default starter template for a new feature markdown file.
   * Explicitly includes: Scope, Key Files, Gotchas, Verification.
   */
  public getDefaultFeatureTemplate(name: string, title: string): string {
    return `# ${title}

<!-- AIContextFlow: Feature sub-context for ${name} -->

## Scope
<!-- Define the boundaries, user stories, and acceptance criteria for this feature -->
- Describe the feature objectives and functional requirements here.
- Specify what is explicitly in-scope and out-of-scope.

## Key Files
<!-- List the primary files, entry points, and modules involved in this feature -->
- \`src/example.ts\` - Core implementation
- \`test/example.test.ts\` - Test suite

## Gotchas
<!-- Document edge cases, pitfalls, security considerations, or performance constraints -->
- Note tricky race conditions, permissions, or API rate limits.
- Keep backwards compatibility in mind.

## Verification
<!-- Step-by-step instructions to verify that this feature is working as expected -->
1. Run the test suite: \`npm test\`
2. Manual verification steps:
   - [ ] Step 1: Description
   - [ ] Step 2: Description
`;
  }
}
