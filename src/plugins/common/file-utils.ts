/**
 * Common Plugin Utilities - Shared services available to all plugins
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * File system utilities that all plugins can use
 */
export class FileUtils {
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async readFile(filePath: string): Promise<string | null> {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  static async getFileStats(filePath: string) {
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        path: filePath,
        size: stats.size,
        extension: path.extname(filePath),
        lastModified: stats.mtime,
        created: stats.birthtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      throw new Error(`Cannot get file stats for ${filePath}: ${error}`);
    }
  }

  static async findFiles(pattern: string, options: { cwd?: string; ignore?: string[] } = {}): Promise<string[]> {
    try {
      return await glob(pattern, {
        cwd: options.cwd || process.cwd(),
        ignore: options.ignore || ['node_modules/**', '.git/**'],
        absolute: true
      });
    } catch (error) {
      console.warn(`Failed to find files with pattern ${pattern}:`, error);
      return [];
    }
  }

  static getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  static async readDirectory(dirPath: string): Promise<string[]> {
    try {
      return await fs.promises.readdir(dirPath);
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}:`, error);
      return [];
    }
  }

  static async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  static async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  static async isNextJsProject(projectPath: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageContent = await this.readFile(packageJsonPath);
      
      if (!packageContent) return false;
      
      const packageJson = JSON.parse(packageContent);
      return !!(packageJson.dependencies?.next || packageJson.devDependencies?.next);
    } catch {
      return false;
    }
  }

  static async getProjectFiles(projectPath: string, extensions: string[] = ['.js', '.jsx', '.ts', '.tsx']): Promise<string[]> {
    try {
      const patterns = extensions.map(ext => `**/*${ext}`);
      const allFiles: string[] = [];
      
      for (const pattern of patterns) {
        const files = await this.findFiles(pattern, { 
          cwd: projectPath,
          ignore: ['node_modules/**', '.git/**', '.next/**', 'dist/**', 'build/**']
        });
        allFiles.push(...files);
      }
      
      return [...new Set(allFiles)]; // Remove duplicates
    } catch (error) {
      console.warn(`Failed to get project files from ${projectPath}:`, error);
      return [];
    }
  }

  static async readFileIfExists(filePath: string): Promise<string | null> {
    if (await this.exists(filePath)) {
      return this.readFile(filePath);
    }
    return null;
  }
}
