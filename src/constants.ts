/**
 * @file
 * Defines global constants, command identifiers, and default paths for AIContextFlow.
 */

export const EXTENSION_ID = 'aicontextflow';
export const EXTENSION_NAME = 'AIContextFlow';

/**
 * Command identifiers registered by the extension.
 */
export const COMMANDS = {
  INIT_STRUCTURE: 'aicontextflow.initStructure',
  CREATE_FEATURE: 'aicontextflow.createFeature',
  SET_ACTIVE_FEATURE: 'aicontextflow.setActiveFeature',
  UNSET_ACTIVE_FEATURE: 'aicontextflow.unsetActiveFeature',
  EXPORT_BUNDLE: 'aicontextflow.exportBundle',
  PREVIEW_BUNDLE: 'aicontextflow.previewBundle',
  VALIDATE_STRUCTURE: 'aicontextflow.validateStructure',
  REFRESH_EXPLORER: 'aicontextflow.refreshExplorer',
  OPEN_FILE: 'aicontextflow.openFile',
  DELETE_FEATURE: 'aicontextflow.deleteFeature',
} as const;

/**
 * Configuration setting keys under the extension's section.
 */
export const CONFIG_KEYS = {
  CONTEXT_DIRECTORY: 'contextDirectory',
  AGENTS_FILE_PATH: 'agentsFilePath',
  STRIP_FLUFF_ON_EXPORT: 'stripFluffOnExport',
  EMBED_FULL_CONTENT: 'embedFullContentInAgentsMd',
  SHOW_STATUS_BAR: 'showStatusBarItem',
} as const;

/**
 * Default directory and file names.
 */
export const DEFAULTS = {
  CONTEXT_DIR: '.context',
  FEATURES_DIR: 'features',
  PROJECT_RULES_FILE: 'project-rules.md',
  AGENTS_FILE: 'AGENTS.md',
  CLAUDE_FILE: 'CLAUDE.md',
  COPILOT_DIR: '.github',
  COPILOT_FILE: '.github/copilot-instructions.md',
} as const;

/**
 * Markers used for marking the active sub-context block inside AGENTS.md.
 */
export const MARKERS = {
  ACTIVE_FEATURE_START: '<!-- AICONTEXTFLOW:ACTIVE_FEATURE:START -->',
  ACTIVE_FEATURE_END: '<!-- AICONTEXTFLOW:ACTIVE_FEATURE:END -->',
} as const;

/**
 * Tree View ID registered in package.json.
 */
export const EXPLORER_VIEW_ID = 'aicontextflow.explorer';
