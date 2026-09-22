/**
 * @file
 * Unit tests for SymlinkManager service.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  checkSymlinkStatus,
  createSymlinkWithFallback,
} from '../../src/services/symlinkManager';

describe('SymlinkManager Unit Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'aicontextflow-symlink-test-'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort.
    }
  });

  it('should create and validate a symlink pointing to target file', async () => {
    const targetFile = path.join(tempDir, 'AGENTS.md');
    const linkFile = path.join(tempDir, 'CLAUDE.md');

    await fs.promises.writeFile(targetFile, '# Master Instructions\n', 'utf8');

    const result = await createSymlinkWithFallback(targetFile, linkFile, 'AGENTS.md');
    assert.strictEqual(result.success, true);

    const status = await checkSymlinkStatus(linkFile, 'AGENTS.md', targetFile);
    assert.strictEqual(status.exists, true);
    assert.strictEqual(status.targetExists, true);

    if (result.method === 'symlink') {
      assert.strictEqual(status.isSymlink, true);
      assert.strictEqual(status.pointsToExpected, true);
    } else {
      assert.strictEqual(status.isDirectCopy, true);
    }
  });

  it('should support relative symlinks across subdirectories', async () => {
    const targetFile = path.join(tempDir, 'AGENTS.md');
    const githubDir = path.join(tempDir, '.github');
    const linkFile = path.join(githubDir, 'copilot-instructions.md');

    await fs.promises.writeFile(targetFile, '# Master Instructions\n', 'utf8');

    const result = await createSymlinkWithFallback(targetFile, linkFile, '../AGENTS.md');
    assert.strictEqual(result.success, true);

    const status = await checkSymlinkStatus(linkFile, '../AGENTS.md', targetFile);
    assert.strictEqual(status.exists, true);
    assert.strictEqual(status.targetExists, true);

    if (result.method === 'symlink') {
      assert.strictEqual(status.isSymlink, true);
      assert.strictEqual(status.pointsToExpected, true);
    }
  });
});
