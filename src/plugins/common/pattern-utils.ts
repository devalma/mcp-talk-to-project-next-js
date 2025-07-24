/**
 * Common Pattern Utilities - Shared pattern matching and filtering
 */

import { minimatch } from 'minimatch';

/**
 * Pattern matching utilities for all plugins
 */
export class PatternUtils {
  /**
   * Check if a file path matches any of the given patterns
   */
  static matchesAny(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => this.matches(filePath, pattern));
  }

  /**
   * Check if a file path matches a glob pattern
   */
  static matches(filePath: string, pattern: string): boolean {
    try {
      return minimatch(filePath, pattern, { dot: true });
    } catch {
      // Fallback to simple string matching
      return filePath.includes(pattern.replace(/\*+/g, ''));
    }
  }

  /**
   * Filter file paths by include/exclude patterns
   */
  static filterFiles(
    filePaths: string[], 
    options: {
      include?: string[];
      exclude?: string[];
    } = {}
  ): string[] {
    let filtered = filePaths;

    // Apply include patterns
    if (options.include?.length) {
      filtered = filtered.filter(filePath => 
        this.matchesAny(filePath, options.include!)
      );
    }

    // Apply exclude patterns
    if (options.exclude?.length) {
      filtered = filtered.filter(filePath => 
        !this.matchesAny(filePath, options.exclude!)
      );
    }

    return filtered;
  }

  /**
   * Get common file patterns for different file types
   */
  static getCommonPatterns() {
    return {
      react: ['**/*.{js,jsx,ts,tsx}'],
      typescript: ['**/*.{ts,tsx}'],
      javascript: ['**/*.{js,jsx}'],
      styles: ['**/*.{css,scss,sass,less,styl}'],
      tests: ['**/*.{test,spec}.{js,ts,jsx,tsx}', '**/__tests__/**/*'],
      stories: ['**/*.stories.{js,ts,jsx,tsx}'],
      config: ['**/*.config.{js,ts}', '**/.*rc*', '**/package.json'],
      markdown: ['**/*.{md,mdx}'],
      images: ['**/*.{jpg,jpeg,png,gif,svg,webp}'],
      nodeModules: ['**/node_modules/**'],
      dist: ['**/dist/**', '**/build/**', '**/.next/**'],
      git: ['**/.git/**']
    };
  }

  /**
   * Get default exclude patterns
   */
  static getDefaultExcludes(): string[] {
    const patterns = this.getCommonPatterns();
    return [
      ...patterns.nodeModules,
      ...patterns.dist,
      ...patterns.git,
      ...patterns.tests,
      '**/coverage/**',
      '**/.cache/**',
      '**/tmp/**',
      '**/temp/**'
    ];
  }
}

/**
 * Path utilities for consistent path handling
 */
export class PathUtils {
  /**
   * Normalize path separators for cross-platform compatibility
   */
  static normalize(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Check if a path represents a React component file
   */
  static isReactFile(filePath: string): boolean {
    const extensions = ['.jsx', '.tsx'];
    return extensions.some(ext => filePath.endsWith(ext)) ||
           (filePath.endsWith('.js') || filePath.endsWith('.ts')) && 
           this.hasComponentNaming(filePath);
  }

  /**
   * Check if filename follows component naming conventions
   */
  static hasComponentNaming(filePath: string): boolean {
    const fileName = filePath.split('/').pop()?.split('.')[0] || '';
    return /^[A-Z]/.test(fileName); // Starts with capital letter
  }

  /**
   * Extract feature name from file path
   */
  static extractFeature(filePath: string): string | undefined {
    const normalized = this.normalize(filePath);
    const segments = normalized.split('/');
    
    // Common feature directory patterns
    const featureIndicators = ['features', 'modules', 'domains', 'components'];
    
    for (let i = 0; i < segments.length - 1; i++) {
      if (featureIndicators.includes(segments[i]) && segments[i + 1]) {
        return segments[i + 1];
      }
    }
    
    return undefined;
  }

  /**
   * Determine file category based on path
   */
  static getFileCategory(filePath: string): 'page' | 'component' | 'layout' | 'shared' | 'util' | 'config' {
    const normalized = this.normalize(filePath).toLowerCase();
    
    if (normalized.includes('/pages/') || 
        (normalized.includes('/app/') && normalized.includes('page.'))) {
      return 'page';
    }
    
    if (normalized.includes('layout')) {
      return 'layout';
    }
    
    if (normalized.includes('/shared/') || 
        normalized.includes('/common/') || 
        normalized.includes('/ui/')) {
      return 'shared';
    }
    
    if (normalized.includes('/utils/') || 
        normalized.includes('/helpers/') || 
        normalized.includes('/lib/')) {
      return 'util';
    }
    
    if (normalized.includes('.config.') || 
        normalized.includes('package.json') || 
        normalized.includes('tsconfig')) {
      return 'config';
    }
    
    return 'component';
  }

  /**
   * Check if file is likely a test file
   */
  static isTestFile(filePath: string): boolean {
    const normalized = this.normalize(filePath).toLowerCase();
    return normalized.includes('.test.') || 
           normalized.includes('.spec.') || 
           normalized.includes('__tests__') ||
           normalized.includes('test/') ||
           normalized.includes('spec/');
  }

  /**
   * Check if file is a story file (Storybook)
   */
  static isStoryFile(filePath: string): boolean {
    return this.normalize(filePath).toLowerCase().includes('.stories.');
  }

  /**
   * Get relative path with consistent separators
   */
  static getRelative(from: string, to: string): string {
    const path = require('path');
    return this.normalize(path.relative(from, to));
  }
}
