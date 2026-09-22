/**
 * @file
 * Unit tests for Markdown bundling and fluff stripping service.
 */

import * as assert from 'assert';
import {
  buildContextBundle,
  stripMarkdownFluff,
} from '../../src/services/bundler';

describe('Bundler Service Unit Tests', () => {
  describe('stripMarkdownFluff', () => {
    it('should strip HTML comments', () => {
      const raw = `# Header\n<!-- Single line comment -->\nContent paragraph.\n<!-- Multi-line\ncomment\nhere -->\nFooter.`;
      const cleaned = stripMarkdownFluff(raw);
      assert.strictEqual(
        cleaned,
        '# Header\n\nContent paragraph.\n\nFooter.'
      );
    });

    it('should collapse 3+ consecutive blank lines down to at most 1 blank line', () => {
      const raw = `Section 1\n\n\n\n\nSection 2\n\n\nSection 3`;
      const cleaned = stripMarkdownFluff(raw);
      assert.strictEqual(
        cleaned,
        `Section 1\n\nSection 2\n\nSection 3`
      );
    });

    it('should trim trailing whitespace on lines', () => {
      const raw = `Line with trailing spaces    \nLine with trailing tabs\t\t\nNormal line`;
      const cleaned = stripMarkdownFluff(raw);
      assert.strictEqual(
        cleaned,
        `Line with trailing spaces\nLine with trailing tabs\nNormal line`
      );
    });

    it('should strip AIContextFlow markers', () => {
      const raw = `<!-- AICONTEXTFLOW:ACTIVE_FEATURE:START -->\nActive Section\n<!-- AICONTEXTFLOW:ACTIVE_FEATURE:END -->`;
      const cleaned = stripMarkdownFluff(raw);
      assert.strictEqual(cleaned, 'Active Section');
    });

    it('should handle empty or null string gracefully', () => {
      assert.strictEqual(stripMarkdownFluff(''), '');
    });
  });

  describe('buildContextBundle', () => {
    it('should bundle global rules alone when no active feature is provided', () => {
      const rules = `# Architecture Rules\n\n- Rule 1\n- Rule 2`;
      const bundle = buildContextBundle(rules, null, null);

      assert.strictEqual(bundle.featureName, null);
      assert.ok(bundle.content.includes('# Project Context & Architecture Guidelines'));
      assert.ok(bundle.content.includes('## Global Project Rules'));
      assert.ok(bundle.content.includes('- Rule 1'));
      assert.strictEqual(bundle.tokenEstimate > 0, true);
    });

    it('should concatenate project rules and active feature', () => {
      const rules = `# Rules\n<!-- comment -->\n- Global rule A`;
      const feature = `# User Auth\n\n## Scope\n- Login flow\n\n## Verification\n- Run tests`;
      const bundle = buildContextBundle(
        rules,
        feature,
        'user-auth',
        '.context/project-rules.md',
        '.context/features/user-auth.md',
        true
      );

      assert.strictEqual(bundle.featureName, 'user-auth');
      assert.ok(bundle.content.includes('## Global Project Rules'));
      assert.ok(bundle.content.includes('- Global rule A'));
      assert.ok(!bundle.content.includes('<!-- comment -->')); // Fluff stripped!
      assert.ok(bundle.content.includes('## Active Sub-Context: user-auth'));
      assert.ok(bundle.content.includes('## Scope'));
      assert.ok(bundle.content.includes('Login flow'));
      assert.strictEqual(bundle.characterCount, bundle.content.length);
      assert.strictEqual(bundle.lineCount, bundle.content.split('\n').length);
    });
  });
});
