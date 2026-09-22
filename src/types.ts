/**
 * @file
 * Type definitions for AIContextFlow.
 */

/**
 * Represents metadata for a feature sub-context markdown file.
 */
export interface FeatureInfo {
  /**
   * Kebab-case identifier for the feature (e.g. 'auth-flow').
   */
  name: string;

  /**
   * Absolute file path to the feature markdown file.
   */
  filePath: string;

  /**
   * Relative file path from workspace root.
   */
  relativeFilePath: string;

  /**
   * Whether this feature is currently the active sub-context.
   */
  isActive: boolean;

  /**
   * Human-readable title extracted from markdown header, if present.
   */
  title?: string;

  /**
   * Extracted scope snippet, if present.
   */
  scope?: string;
}

/**
 * Result of bundling context files for prompt export.
 */
export interface ContextBundle {
  /**
   * The complete bundled markdown content ready for prompt context.
   */
  content: string;

  /**
   * Name of the active feature included in the bundle, or null if only global rules.
   */
  featureName: string | null;

  /**
   * Path to the project rules file included in the bundle.
   */
  rulesPath: string;

  /**
   * Path to the active feature file included in the bundle, if any.
   */
  featurePath: string | null;

  /**
   * Character count of the bundled content.
   */
  characterCount: number;

  /**
   * Total line count of the bundled content.
   */
  lineCount: number;

  /**
   * Approximate token count estimate (based on ~4 chars per token).
   */
  tokenEstimate: number;
}

/**
 * Represents an individual check item in a structure validation report.
 */
export interface ValidationItem {
  /**
   * Display label for the validated artifact.
   */
  label: string;

  /**
   * Target path being checked.
   */
  path: string;

  /**
   * Category type of the target.
   */
  type: 'directory' | 'file' | 'symlink' | 'active-state';

  /**
   * Health status of the item.
   */
  status: 'ok' | 'warning' | 'error';

  /**
   * Human-readable details or resolution guidance.
   */
  message: string;
}

/**
 * Aggregated report from validating the context repository structure.
 */
export interface ValidationReport {
  /**
   * Overall health status: true if all critical checks passed.
   */
  isValid: boolean;

  /**
   * Individual validation items.
   */
  items: ValidationItem[];

  /**
   * Summary text for notification or quick display.
   */
  summary: string;
}

/**
 * Result of initializing or updating project context structure.
 */
export interface InitResult {
  /**
   * List of files and directories created.
   */
  created: string[];

  /**
   * List of paths skipped because they already exist.
   */
  skipped: string[];

  /**
   * List of warnings or non-fatal errors encountered.
   */
  warnings: string[];
}

/**
 * Extension configuration settings.
 */
export interface ExtensionConfiguration {
  contextDirectory: string;
  agentsFilePath: string;
  stripFluffOnExport: boolean;
  embedFullContentInAgentsMd: boolean;
  showStatusBarItem: boolean;
}
