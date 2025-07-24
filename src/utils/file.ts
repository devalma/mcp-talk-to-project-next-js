/**
 * File utilities used by the plugin manager
 */

import fs from 'fs';
import path from 'path';
import { FileUtils } from '../plugins/common/file-utils.js';

// Synchronous wrapper functions for the plugin context interface
export function getProjectFiles(projectPath: string, pattern?: string): string[] {
  // This is a stub - plugins should use FileUtils directly for async operations
  return [];
}

export function getRelativePath(filePath: string, projectPath: string): string {
  return path.relative(projectPath, filePath);
}

export function readFileIfExists(filePath: string): string | null {
  // This is a stub - plugins should use FileUtils directly for async operations
  return null;
}

// Async versions for actual use
export async function isNextJsProject(projectPath: string): Promise<boolean> {
  return FileUtils.isNextJsProject(projectPath);
}

export async function getProjectFilesAsync(projectPath: string, pattern?: string): Promise<string[]> {
  const extensions = pattern ? [pattern] : ['.js', '.jsx', '.ts', '.tsx'];
  return FileUtils.getProjectFiles(projectPath, extensions);
}

export async function readFileIfExistsAsync(filePath: string): Promise<string | null> {
  return FileUtils.readFileIfExists(filePath);
}
