/**
 * @file
 * Cross-platform symlink management and validation service for AIContextFlow.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Status report of a symlink or context instruction file.
 */
export interface SymlinkStatus {
  exists: boolean;
  isSymlink: boolean;
  targetExists: boolean;
  actualTarget?: string;
  expectedTarget: string;
  pointsToExpected: boolean;
  isDirectCopy?: boolean;
  error?: string;
}

/**
 * Creates a relative symbolic link pointing to targetPath from linkPath.
 * If creating a symbolic link fails (e.g., Windows EPERM or unprivileged user),
 * falls back to copying the target file so the AI instructions remain in sync.
 *
 * @param targetPath
 *   Absolute path to the target destination file (e.g. workspace/AGENTS.md).
 * @param linkPath
 *   Absolute path where the symlink should be placed (e.g. workspace/CLAUDE.md).
 * @param relativeTarget
 *   The relative path string to record in the symlink (e.g. 'AGENTS.md' or '../AGENTS.md').
 *
 * @return
 *   Object with action taken ('symlink' | 'copy') and optional warning message.
 */
export async function createSymlinkWithFallback(
  targetPath: string,
  linkPath: string,
  relativeTarget: string
): Promise<{ success: boolean; method: 'symlink' | 'copy'; warning?: string }> {
  // Ensure the parent directory for linkPath exists.
  const parentDir = path.dirname(linkPath);
  if (!fs.existsSync(parentDir)) {
    await fs.promises.mkdir(parentDir, { recursive: true });
  }

  // If linkPath already exists, check if it's already a symlink pointing to the right place.
  try {
    const lstat = await fs.promises.lstat(linkPath);
    if (lstat.isSymbolicLink()) {
      const currentTarget = await fs.promises.readlink(linkPath);
      const resolvedCurrent = path.resolve(parentDir, currentTarget);
      const resolvedTarget = path.resolve(targetPath);
      if (resolvedCurrent === resolvedTarget || currentTarget === relativeTarget) {
        return { success: true, method: 'symlink' };
      }
      // Remove stale symlink before recreating.
      await fs.promises.unlink(linkPath);
    } else {
      // It's an existing regular file or directory.
      // Remove it to replace with symlink.
      await fs.promises.unlink(linkPath);
    }
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code !== 'ENOENT') {
      throw err;
    }
  }

  // Attempt symlink creation.
  try {
    // Type 'file' is important on Windows.
    await fs.promises.symlink(relativeTarget, linkPath, 'file');
    return { success: true, method: 'symlink' };
  } catch (symlinkError: unknown) {
    const err = symlinkError as NodeJS.ErrnoException;

    // Windows EPERM or unsupported filesystem -> fallback to file copy.
    if (err.code === 'EPERM' || err.code === 'ENOTSUP' || err.code === 'EACCES') {
      try {
        await fs.promises.copyFile(targetPath, linkPath);
        return {
          success: true,
          method: 'copy',
          warning: `Symlink creation failed (${err.code}). Created a file copy as fallback. Note: enable Developer Mode on Windows for native symlinks.`,
        };
      } catch (copyError: unknown) {
        const copyErr = copyError as Error;
        throw new Error(
          `Failed to create symlink and fallback copy failed: ${copyErr.message}`
        );
      }
    }

    throw new Error(`Failed to create symlink: ${err.message}`);
  }
}

/**
 * Checks the status and validity of a symlink or instruction file.
 *
 * @param linkPath
 *   Absolute path to the link file.
 * @param expectedTargetRel
 *   Expected relative target (e.g. 'AGENTS.md' or '../AGENTS.md').
 * @param targetPath
 *   Absolute path of the expected target file.
 *
 * @return
 *   A SymlinkStatus structure describing health and details.
 */
export async function checkSymlinkStatus(
  linkPath: string,
  expectedTargetRel: string,
  targetPath: string
): Promise<SymlinkStatus> {
  const result: SymlinkStatus = {
    exists: false,
    isSymlink: false,
    targetExists: false,
    expectedTarget: expectedTargetRel,
    pointsToExpected: false,
  };

  try {
    const lstat = await fs.promises.lstat(linkPath);
    result.exists = true;

    if (lstat.isSymbolicLink()) {
      result.isSymlink = true;
      try {
        const rawTarget = await fs.promises.readlink(linkPath);
        result.actualTarget = rawTarget;

        const linkDir = path.dirname(linkPath);
        const resolvedActual = path.resolve(linkDir, rawTarget);
        const resolvedExpected = path.resolve(targetPath);

        result.pointsToExpected = resolvedActual === resolvedExpected;

        // Check if destination actually exists on disk.
        result.targetExists = fs.existsSync(resolvedActual);
      } catch (readErr: unknown) {
        const err = readErr as Error;
        result.error = `Could not read symlink target: ${err.message}`;
      }
    } else {
      // It's a regular file.
      result.isSymlink = false;
      result.targetExists = fs.existsSync(targetPath);

      // Check if contents match the target file (copy fallback).
      try {
        if (result.targetExists) {
          const fileContent = await fs.promises.readFile(linkPath, 'utf8');
          const targetContent = await fs.promises.readFile(targetPath, 'utf8');
          result.isDirectCopy = fileContent.trim() === targetContent.trim();
        }
      } catch {
        result.isDirectCopy = false;
      }
    }
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      result.exists = false;
    } else {
      result.error = (err as Error).message;
    }
  }

  return result;
}
