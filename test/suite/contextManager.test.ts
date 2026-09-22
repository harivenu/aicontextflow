/**
 * @file
 * Integration and unit tests for ContextManager service.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ContextManager } from '../../src/services/contextManager';

describe('ContextManager Unit & Integration Tests', () => {
  let tempDir: string;
  let manager: ContextManager;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'aicontextflow-mgr-test-'));
    manager = new ContextManager(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup.
    }
  });

  describe('initStructure', () => {
    it('should create complete directory and file structure', async () => {
      const result = await manager.initStructure();

      // Check directories.
      assert.strictEqual(fs.existsSync(path.join(tempDir, '.context')), true);
      assert.strictEqual(fs.existsSync(path.join(tempDir, '.context', 'features')), true);

      // Check files.
      assert.strictEqual(fs.existsSync(path.join(tempDir, '.context', 'project-rules.md')), true);
      assert.strictEqual(fs.existsSync(path.join(tempDir, 'AGENTS.md')), true);
      assert.strictEqual(fs.existsSync(path.join(tempDir, 'CLAUDE.md')), true);
      assert.strictEqual(
        fs.existsSync(path.join(tempDir, '.github', 'copilot-instructions.md')),
        true
      );

      // Verify result tracking.
      assert.ok(result.created.length >= 4);
    });

    it('should be idempotent and not destroy existing files', async () => {
      await manager.initStructure();

      // Modify project-rules.md.
      const customRules = '# Custom Rules 123';
      await fs.promises.writeFile(
        path.join(tempDir, '.context', 'project-rules.md'),
        customRules,
        'utf8'
      );

      // Re-run initStructure without overwrite.
      const secondResult = await manager.initStructure(false);
      assert.ok(secondResult.skipped.length > 0);

      const content = await fs.promises.readFile(
        path.join(tempDir, '.context', 'project-rules.md'),
        'utf8'
      );
      assert.strictEqual(content, customRules);
    });
  });

  describe('createFeature', () => {
    beforeEach(async () => {
      await manager.initStructure();
    });

    it('should create a new feature file with standard sections (Scope, Key Files, Gotchas, Verification)', async () => {
      const feature = await manager.createFeature('auth-flow');
      assert.strictEqual(feature.name, 'auth-flow');
      assert.strictEqual(fs.existsSync(feature.filePath), true);

      const content = await fs.promises.readFile(feature.filePath, 'utf8');
      assert.ok(content.includes('# Auth Flow'));
      assert.ok(content.includes('## Scope'));
      assert.ok(content.includes('## Key Files'));
      assert.ok(content.includes('## Gotchas'));
      assert.ok(content.includes('## Verification'));
    });

    it('should reject invalid non-kebab-case feature names', async () => {
      await assert.rejects(async () => {
        await manager.createFeature('InvalidName');
      }, /Invalid feature name/);

      await assert.rejects(async () => {
        await manager.createFeature('-leading-hyphen');
      }, /Invalid feature name/);
    });

    it('should error when creating a duplicate feature', async () => {
      await manager.createFeature('payment-service');
      await assert.rejects(async () => {
        await manager.createFeature('payment-service');
      }, /already exists/);
    });
  });

  describe('setActiveFeature & getActiveFeatureName', () => {
    beforeEach(async () => {
      await manager.initStructure();
      await manager.createFeature('user-profile');
      await manager.createFeature('checkout-cart');
    });

    it('should initially have no active feature', async () => {
      const active = await manager.getActiveFeatureName();
      assert.strictEqual(active, null);
    });

    it('should set and retrieve the active feature', async () => {
      await manager.setActiveFeature('user-profile');
      const active = await manager.getActiveFeatureName();
      assert.strictEqual(active, 'user-profile');

      // Check AGENTS.md content.
      const agents = await fs.promises.readFile(path.join(tempDir, 'AGENTS.md'), 'utf8');
      assert.ok(agents.includes('## Active Sub-Context: user-profile'));
      assert.ok(agents.includes('.context/features/user-profile.md'));
    });

    it('should switch active features smoothly', async () => {
      await manager.setActiveFeature('user-profile');
      assert.strictEqual(await manager.getActiveFeatureName(), 'user-profile');

      await manager.setActiveFeature('checkout-cart');
      assert.strictEqual(await manager.getActiveFeatureName(), 'checkout-cart');
    });

    it('should clear the active feature when set to null', async () => {
      await manager.setActiveFeature('user-profile');
      await manager.setActiveFeature(null);
      const active = await manager.getActiveFeatureName();
      assert.strictEqual(active, null);
    });
  });

  describe('listFeatures', () => {
    beforeEach(async () => {
      await manager.initStructure();
      await manager.createFeature('beta-feature');
      await manager.createFeature('alpha-feature');
    });

    it('should list all feature markdown files and mark the active one', async () => {
      await manager.setActiveFeature('alpha-feature');
      const features = await manager.listFeatures();

      assert.strictEqual(features.length, 2);
      const active = features.find((f) => f.name === 'alpha-feature');
      const inactive = features.find((f) => f.name === 'beta-feature');

      assert.ok(active);
      assert.strictEqual(active.isActive, true);
      assert.ok(inactive);
      assert.strictEqual(inactive.isActive, false);

      // Active feature sorted first.
      assert.strictEqual(features[0].name, 'alpha-feature');
    });
  });

  describe('exportBundle', () => {
    beforeEach(async () => {
      await manager.initStructure();
      await manager.createFeature('search-api');
      await manager.setActiveFeature('search-api');
    });

    it('should export bundle combining global rules and active feature', async () => {
      const bundle = await manager.exportBundle();

      assert.strictEqual(bundle.featureName, 'search-api');
      assert.ok(bundle.content.includes('# Project Context & Architecture Guidelines'));
      assert.ok(bundle.content.includes('## Global Project Rules'));
      assert.ok(bundle.content.includes('## Active Sub-Context: search-api'));
      assert.ok(bundle.content.includes('## Scope'));
      assert.ok(bundle.characterCount > 0);
      assert.ok(bundle.lineCount > 0);
    });
  });

  describe('validateStructure', () => {
    it('should report valid when structure is initialized', async () => {
      await manager.initStructure();
      const report = await manager.validateStructure();
      assert.strictEqual(report.isValid, true);
      assert.strictEqual(report.items.length >= 6, true);
    });

    it('should detect missing directories or files', async () => {
      const emptyManager = new ContextManager(tempDir);
      const report = await emptyManager.validateStructure();
      assert.strictEqual(report.isValid, false);
      const errors = report.items.filter((i) => i.status === 'error');
      assert.ok(errors.length > 0);
    });
  });

  describe('deleteFeature', () => {
    beforeEach(async () => {
      await manager.initStructure();
      await manager.createFeature('obsolete-feature');
      await manager.setActiveFeature('obsolete-feature');
    });

    it('should delete the feature file and unset active state', async () => {
      assert.strictEqual(await manager.getActiveFeatureName(), 'obsolete-feature');

      await manager.deleteFeature('obsolete-feature');

      assert.strictEqual(
        fs.existsSync(path.join(tempDir, '.context', 'features', 'obsolete-feature.md')),
        false
      );
      assert.strictEqual(await manager.getActiveFeatureName(), null);
    });
  });
});
