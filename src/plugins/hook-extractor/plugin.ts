/**
 * Hook Extractor Plugin - Using DRY utilities
 */

import { BaseExtractor, type ExtractorConfig } from '../common/base-extractor.js';
import { ReactHooksUtils, type HookInfo, type HookUsageInfo } from '../common/react-hooks-utils.js';
import { ReactComponentUtils } from '../common/react-component-utils.js';
import type { PluginResult, PluginMetadata } from '../../types/plugin.js';
import { HookFormatter } from './formatter.js';
import path from 'path';
import fs from 'fs';

// Enhanced config for hook extraction
export interface HookExtractorConfig extends ExtractorConfig {
  includeBuiltIn?: boolean;
  includeCustom?: boolean;
  validateRules?: boolean;
  trackDependencies?: boolean;
}

// Result types for hook extraction
export interface HookAnalysisResult {
  filePath: string;
  customHooks: Array<{
    name: string;
    isExported: boolean;
    params: string[];
  }>;
  hookUsage: Array<{
    name: string;
    type: 'builtin' | 'custom';
    count: number;
    locations: Array<{ line?: number; component?: string }>;
  }>;
  violations: Array<{
    violation: string;
    hookName: string;
    line?: number;
    suggestion: string;
  }>;
  isReactFile: boolean;
}

export interface HookExtractionSummary {
  totalFiles: number;
  totalCustomHooks: number;
  totalHookUsage: number;
  mostUsedHooks: Array<{ name: string; count: number; type: 'builtin' | 'custom' }>;
  ruleViolations: number;
  filesWithViolations: number;
  hooksByFile: Array<{ 
    file: string; 
    customHooks: number; 
    usage: number;
    customHookNames: string[];
    usageHookNames: string[];
  }>;
  customHooksList: Array<{
    name: string;
    file: string;
    isExported: boolean;
    params: string[];
  }>;
  hookUsageDetails: Array<{
    hookName: string;
    type: 'builtin' | 'custom';
    file: string;
    component?: string;
    line?: number;
  }>;
  violations: Array<{
    violation: string;
    hookName: string;
    file: string;
    line?: number;
    suggestion: string;
  }>;
}

/**
 * Hook Extractor Plugin using DRY utilities
 */
export class HookExtractorPlugin extends BaseExtractor<HookAnalysisResult, HookExtractionSummary> {
  
  get metadata(): PluginMetadata {
    return {
      name: 'hook-extractor',
      version: '2.0.0',
      description: 'React hooks extractor and rules validator using shared utilities',
      author: 'MCP Next.js Analyzer',
      cli: {
        command: 'hooks',
        description: 'List all hooks (custom and built-in)',
        usage: 'node cli.js [project-path] hooks [options]',
        category: 'analysis',
        options: [
          {
            name: '--custom-only',
            description: 'Show only custom hooks',
            type: 'boolean',
            default: false
          },
          {
            name: '--violations',
            description: 'Include hooks rules violations',
            type: 'boolean',
            default: false
          },
          {
            name: '--format',
            description: 'Output format (text, markdown)',
            type: 'string',
            default: 'text'
          }
        ],
        examples: [
          'node cli.js . hooks',
          'node cli.js . hooks --custom-only',
          'node cli.js /path/to/project hooks --violations --format=markdown'
        ]
      }
    };
  }

  constructor(config: HookExtractorConfig = {}) {
    super({
      filePatterns: ['**/*.{js,jsx,ts,tsx}'],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.d.ts'
      ],
      batchSize: 8,
      parallel: true,
      includeBuiltIn: true,
      includeCustom: true,
      validateRules: true,
      trackDependencies: true,
      ...config
    });
  }

  shouldProcess(filePath: string): boolean {
    // For directories, always allow processing
    if (!path.extname(filePath)) {
      return true;
    }
    
    // Skip non-React files quickly
    if (filePath.includes('node_modules')) return false;
    if (filePath.endsWith('.d.ts')) return false;
    
    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
  }

  protected shouldProcessFile(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content) return false;

    // Quick string checks before AST parsing
    return content.includes('use') && (
      content.includes('React') || 
      content.includes('import') ||
      content.includes('export')
    );
  }

  protected async processFile(filePath: string): Promise<HookAnalysisResult | null> {
    try {
      const parsed = await this.parseFileWithCache(filePath);
      if (!parsed || !parsed.ast) return null;

      const ast = parsed.ast; // Extract the actual AST from ParsedAST
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = this.extractorConfig as HookExtractorConfig;

      // Check if this is a React file
      const isReactFile = ReactComponentUtils.isReactComponentFile(ast) || 
                         content.includes('use') || 
                         content.includes('React');

      if (!isReactFile) return null;

      // Extract custom hooks
      const customHooks = config.includeCustom ? 
        ReactHooksUtils.findCustomHooks(ast) : [];

      // Find hook usage
      const hookUsageRaw = ReactHooksUtils.findHookUsage(ast);

      // Validate hook rules if enabled
      const violations = config.validateRules ? 
        ReactHooksUtils.validateHookRules(ast) : [];

      return {
        filePath,
        customHooks: customHooks.map(hook => ({
          name: hook.name,
          isExported: hook.isExported || false,
          params: hook.params || []
        })),
        hookUsage: this.aggregateHookUsage(hookUsageRaw),
        violations: violations.map(v => ({
          violation: v.violation,
          hookName: v.hookName,
          line: v.line,
          suggestion: v.suggestion
        })),
        isReactFile
      };

    } catch (error) {
      this.logger.error(`Failed to process ${filePath}:`, error);
      return null;
    }
  }

  protected async aggregateResults(results: HookAnalysisResult[], targetPath: string): Promise<HookExtractionSummary> {
    const hookCounts = new Map<string, { count: number; type: 'builtin' | 'custom' }>();
    
    let totalCustomHooks = 0;
    let totalHookUsage = 0;
    let totalViolations = 0;
    let filesWithViolations = 0;

    const hooksByFile: Array<{ 
      file: string; 
      customHooks: number; 
      usage: number;
      customHookNames: string[];
      usageHookNames: string[];
    }> = [];

    for (const result of results) {
      // Count custom hooks
      totalCustomHooks += result.customHooks.length;

      // Count hook usage
      const fileUsageCount = result.hookUsage.reduce((sum, usage) => sum + usage.count, 0);
      totalHookUsage += fileUsageCount;

      // Track violations
      totalViolations += result.violations.length;
      if (result.violations.length > 0) {
        filesWithViolations++;
      }

      // Aggregate hook usage counts
      for (const usage of result.hookUsage) {
        const existing = hookCounts.get(usage.name) || { count: 0, type: usage.type };
        existing.count += usage.count;
        hookCounts.set(usage.name, existing);
      }

      // Track hooks by file
      hooksByFile.push({
        file: this.getRelativePath(result.filePath),
        customHooks: result.customHooks.length,
        usage: fileUsageCount,
        customHookNames: result.customHooks.map(hook => hook.name),
        usageHookNames: result.hookUsage.map(usage => usage.name)
      });
    }

    // Get most used hooks
    const mostUsedHooks = Array.from(hookCounts.entries())
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 15)
      .map(([name, data]) => ({
        name,
        count: data.count,
        type: data.type
      }));

    return {
      totalFiles: results.length,
      totalCustomHooks,
      totalHookUsage,
      mostUsedHooks,
      ruleViolations: totalViolations,
      filesWithViolations,
      hooksByFile: hooksByFile
        .sort((a, b) => (b.customHooks + b.usage) - (a.customHooks + a.usage))
        .slice(0, 20),
      customHooksList: results.flatMap(result => 
        result.customHooks.map(hook => ({
          name: hook.name,
          file: result.filePath,
          isExported: hook.isExported,
          params: hook.params
        }))
      ),
      hookUsageDetails: results.flatMap(result =>
        result.hookUsage.flatMap(usage =>
          usage.locations.map(location => ({
            hookName: usage.name,
            type: usage.type,
            file: result.filePath,
            component: location.component,
            line: location.line
          }))
        )
      ),
      violations: results.flatMap(result =>
        result.violations.map(violation => ({
          ...violation,
          file: result.filePath
        }))
      )
    };
  }

  private aggregateHookUsage(hookUsage: HookUsageInfo[]): Array<{
    name: string;
    type: 'builtin' | 'custom';
    count: number;
    locations: Array<{ line?: number; component?: string }>;
  }> {
    const usage = new Map<string, {
      type: 'builtin' | 'custom';
      count: number;
      locations: Array<{ line?: number; component?: string }>;
    }>();

    for (const hook of hookUsage) {
      const existing = usage.get(hook.hookName) || {
        type: this.isBuiltinHook(hook.hookName) ? 'builtin' : 'custom',
        count: 0,
        locations: []
      };

      existing.count += hook.usageCount;
      for (const location of hook.locations) {
        existing.locations.push({
          line: location.line,
          component: location.context
        });
      }

      usage.set(hook.hookName, existing);
    }

    return Array.from(usage.entries()).map(([name, data]) => ({
      name,
      ...data
    }));
  }

  private isBuiltinHook(hookName: string): boolean {
    const builtinHooks = [
      'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback',
      'useMemo', 'useRef', 'useImperativeHandle', 'useLayoutEffect',
      'useDebugValue', 'useDeferredValue', 'useTransition', 'useId',
      'useSyncExternalStore', 'useInsertionEffect'
    ];
    return builtinHooks.includes(hookName);
  }

  /**
   * Format hook data according to specified format
   */
  formatData(data: HookExtractionSummary, format: 'text' | 'markdown' | 'json' = 'text'): string {
    return HookFormatter.format(data, format);
  }
}
