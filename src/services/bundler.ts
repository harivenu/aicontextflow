/**
 * @file
 * Markdown bundling service for AIContextFlow.
 * Handles concatenation of rules and features, stripping fluff and formatting for AI context windows.
 */

import { ContextBundle } from '../types';

/**
 * Options for fluff stripping.
 */
export interface StripFluffOptions {
  /**
   * Remove all HTML-style comments (<!-- ... -->). Defaults to true.
   */
  stripComments?: boolean;

  /**
   * Collapse 3 or more consecutive newlines to at most 2 newlines (1 blank line). Defaults to true.
   */
  collapseBlankLines?: boolean;

  /**
   * Remove trailing whitespace on each line. Defaults to true.
   */
  trimLineEnds?: boolean;

  /**
   * Strip AIContextFlow internal markers. Defaults to true.
   */
  stripInternalMarkers?: boolean;
}

/**
 * Strips markdown fluff (comments, excessive whitespace, trailing spaces) from text.
 *
 * @param markdown
 *   The raw markdown string.
 * @param options
 *   Optional configuration for stripping rules.
 *
 * @return
 *   Cleaned, token-efficient markdown string.
 */
export function stripMarkdownFluff(
  markdown: string,
  options: StripFluffOptions = {}
): string {
  if (!markdown) {
    return '';
  }

  const {
    stripComments = true,
    collapseBlankLines = true,
    trimLineEnds = true,
    stripInternalMarkers = true,
  } = options;

  let cleaned = markdown;

  // Normalize line endings to LF.
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Strip internal markers specifically if requested.
  if (stripInternalMarkers) {
    cleaned = cleaned.replace(/<!--\s*AICONTEXTFLOW:[A-Z_]+:?(?:START|END)?\s*-->/gi, '');
  }

  // Strip all HTML comments (multi-line or single-line).
  if (stripComments) {
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  }

  // Trim trailing whitespace from each line.
  if (trimLineEnds) {
    cleaned = cleaned
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/, ''))
      .join('\n');
  }

  // Collapse consecutive blank lines (more than 2 newlines in a row).
  if (collapseBlankLines) {
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  }

  // Trim leading and trailing whitespace.
  return cleaned.trim();
}

/**
 * Builds a unified context bundle from project rules and an optional active feature.
 *
 * @param rulesContent
 *   Content from .context/project-rules.md.
 * @param featureContent
 *   Content from active feature file (optional).
 * @param featureName
 *   Kebab-case name of active feature (optional).
 * @param rulesPath
 *   Relative path for the rules file.
 * @param featurePath
 *   Relative path for the feature file (optional).
 * @param stripFluff
 *   Whether to strip comments and redundant blank lines. Defaults to true.
 *
 * @return
 *   A ContextBundle object containing content and metadata.
 */
export function buildContextBundle(
  rulesContent: string,
  featureContent: string | null = null,
  featureName: string | null = null,
  rulesPath: string = '.context/project-rules.md',
  featurePath: string | null = null,
  stripFluff: boolean = true
): ContextBundle {
  const processedRules = stripFluff ? stripMarkdownFluff(rulesContent) : rulesContent.trim();
  const processedFeature = featureContent
    ? (stripFluff ? stripMarkdownFluff(featureContent) : featureContent.trim())
    : null;

  const sections: string[] = [];

  // Header banner.
  sections.push('# Project Context & Architecture Guidelines');

  // Global project rules section.
  if (processedRules.length > 0) {
    sections.push(`## Global Project Rules (\`${rulesPath}\`)\n\n${processedRules}`);
  } else {
    sections.push(`## Global Project Rules (\`${rulesPath}\`)\n\n*No global rules defined.*`);
  }

  // Active feature section.
  if (featureName && processedFeature && processedFeature.length > 0) {
    const featureFile = featurePath ?? `.context/features/${featureName}.md`;
    sections.push(`## Active Sub-Context: ${featureName} (\`${featureFile}\`)\n\n${processedFeature}`);
  } else if (featureName) {
    sections.push(`## Active Sub-Context: ${featureName}\n\n*Feature file exists but has no content.*`);
  }

  const finalContent = sections.join('\n\n---\n\n') + '\n';
  const characterCount = finalContent.length;
  const lineCount = finalContent.split('\n').length;
  // Estimate ~4 characters per token for standard English / code mix.
  const tokenEstimate = Math.ceil(characterCount / 4);

  return {
    content: finalContent,
    featureName,
    rulesPath,
    featurePath,
    characterCount,
    lineCount,
    tokenEstimate,
  };
}
