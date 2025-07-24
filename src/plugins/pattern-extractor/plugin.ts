/**
 * Pattern Extractor Plugin - Using DRY utilities
 */

import { BaseExtractor, type ExtractorConfig } from '../common/base-extractor.js';
import { ReactComponentUtils } from '../common/react-component-utils.js';
import { ReactHooksUtils } from '../common/react-hooks-utils.js';
import { ReactContextUtils } from '../common/react-context-utils.js';
import { ASTUtils } from '../common/ast-utils.js';
import type { PluginResult, PluginMetadata } from '../../types/plugin.js';
import { PatternFormatter } from './formatter.js';
import path from 'path';
import fs from 'fs';

// Enhanced config for pattern extraction
export interface PatternExtractorConfig extends ExtractorConfig {
  patterns?: Array<'hooks' | 'context' | 'hoc' | 'render-props' | 'compound' | 'provider'>;
  analyzeComplexity?: boolean;
  trackUsage?: boolean;
}

// Result types for pattern extraction
export interface PatternAnalysisResult {
  filePath: string;
  patterns: Array<{
    type: 'hooks' | 'context' | 'hoc' | 'render-props' | 'compound' | 'provider';
    name: string;
    description: string;
    complexity: 'low' | 'medium' | 'high';
    usage: number;
    examples: string[];
  }>;
  customHooks: Array<{
    name: string;
    pattern: 'state-management' | 'data-fetching' | 'side-effects' | 'utility' | 'other';
  }>;
  contextProviders: Array<{
    name: string;
    hasProvider: boolean;
    hasConsumer: boolean;
    usesHook: boolean;
  }>;
  antiPatterns: Array<{
    type: string;
    description: string;
    severity: 'warning' | 'error';
    suggestion: string;
  }>;
}

export interface PatternExtractionSummary {
  totalFiles: number;
  patternsByType: Record<string, number>;
  mostCommonPatterns: Array<{ type: string; count: number; examples: string[] }>;
  customHookCategories: Record<string, number>;
  contextUsage: {
    totalProviders: number;
    totalConsumers: number;
    averageConsumersPerProvider: number;
  };
  antiPatternsFound: number;
  complexityDistribution: Record<string, number>;
  recommendedRefactors: Array<{
    file: string;
    pattern: string;
    suggestion: string;
  }>;
}

/**
 * Pattern Extractor Plugin using DRY utilities
 */
export class PatternExtractorPlugin extends BaseExtractor<PatternAnalysisResult, PatternExtractionSummary> {
  
  get metadata(): PluginMetadata {
    return {
      name: 'pattern-extractor',
      version: '2.0.0',
      description: 'Analyzes React design patterns, anti-patterns, and architectural decisions',
      author: 'MCP Next.js Analyzer',
      tags: ['react', 'patterns', 'architecture', 'analysis'],
      cli: {
        command: 'patterns',
        description: 'Find React patterns (context, hoc, etc.)',
        usage: 'node cli.js [project-path] patterns [pattern-type] [options]',
        category: 'analysis',
        options: [
          {
            name: 'pattern-type',
            description: 'Type of pattern to analyze (hooks, context, hoc, render-props)',
            type: 'string',
            default: 'context'
          },
          {
            name: '--anti-patterns',
            description: 'Include anti-patterns analysis',
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
          'node cli.js . patterns',
          'node cli.js . patterns context',
          'node cli.js /path/to/project patterns hoc --anti-patterns --format=markdown'
        ]
      }
    };
  }

  constructor(config: PatternExtractorConfig = {}) {
    super({
      filePatterns: ['**/*.{js,jsx,ts,tsx}'],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.d.ts',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      batchSize: 6,
      parallel: true,
      patterns: ['hooks', 'context', 'hoc', 'render-props', 'compound', 'provider'],
      analyzeComplexity: true,
      trackUsage: true,
      ...config
    });
  }

  shouldProcess(filePath: string): boolean {
    // For directories, always allow processing
    if (!path.extname(filePath)) {
      return true;
    }
    
    // For files, check extension
    const ext = path.extname(filePath).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
  }

  protected shouldProcessFile(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content) return false;

    // Quick checks for React patterns
    return content.includes('React') || 
           content.includes('use') || 
           content.includes('create') || 
           content.includes('Context') ||
           content.includes('Provider') ||
           content.includes('Consumer');
  }

  protected async processFile(filePath: string): Promise<PatternAnalysisResult | null> {
    try {
      const parsed = await this.parseFileWithCache(filePath);
      if (!parsed || !parsed.ast) return null;

      const ast = parsed.ast; // Extract the actual AST from ParsedAST
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = this.extractorConfig as PatternExtractorConfig;

      // Analyze different patterns
      const patterns = await this.analyzePatterns(ast, filePath, config);
      const customHooks = await this.analyzeCustomHooks(ast);
      const contextProviders = await this.analyzeContextPatterns(ast);
      const antiPatterns = await this.detectAntiPatterns(ast, content);

      return {
        filePath,
        patterns,
        customHooks,
        contextProviders,
        antiPatterns
      };

    } catch (error) {
      this.logger.error(`Failed to process ${filePath}:`, error);
      return null;
    }
  }

  protected async aggregateResults(results: PatternAnalysisResult[], targetPath: string): Promise<PatternExtractionSummary> {
    const patternsByType: Record<string, number> = {};
    const customHookCategories: Record<string, number> = {};
    const complexityDistribution: Record<string, number> = {};
    const allPatterns: Array<{ type: string; name: string }> = [];
    
    let totalProviders = 0;
    let totalConsumers = 0;
    let antiPatternsFound = 0;
    const recommendedRefactors: Array<{ file: string; pattern: string; suggestion: string }> = [];

    for (const result of results) {
      // Count patterns by type
      for (const pattern of result.patterns) {
        patternsByType[pattern.type] = (patternsByType[pattern.type] || 0) + 1;
        complexityDistribution[pattern.complexity] = (complexityDistribution[pattern.complexity] || 0) + 1;
        allPatterns.push({ type: pattern.type, name: pattern.name });
      }

      // Count custom hook categories
      for (const hook of result.customHooks) {
        customHookCategories[hook.pattern] = (customHookCategories[hook.pattern] || 0) + 1;
      }

      // Count context usage
      for (const context of result.contextProviders) {
        if (context.hasProvider) totalProviders++;
        if (context.hasConsumer) totalConsumers++;
      }

      // Count anti-patterns
      antiPatternsFound += result.antiPatterns.length;

      // Collect refactoring suggestions
      for (const antiPattern of result.antiPatterns) {
        if (antiPattern.severity === 'error') {
          recommendedRefactors.push({
            file: this.getRelativePath(result.filePath),
            pattern: antiPattern.type,
            suggestion: antiPattern.suggestion
          });
        }
      }
    }

    // Calculate most common patterns
    const patternCounts = new Map<string, { count: number; examples: string[] }>();
    for (const pattern of allPatterns) {
      const existing = patternCounts.get(pattern.type) || { count: 0, examples: [] };
      existing.count++;
      if (existing.examples.length < 5) {
        existing.examples.push(pattern.name);
      }
      patternCounts.set(pattern.type, existing);
    }

    const mostCommonPatterns = Array.from(patternCounts.entries())
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10)
      .map(([type, data]) => ({ type, count: data.count, examples: data.examples }));

    return {
      totalFiles: results.length,
      patternsByType,
      mostCommonPatterns,
      customHookCategories,
      contextUsage: {
        totalProviders,
        totalConsumers,
        averageConsumersPerProvider: totalProviders > 0 ? totalConsumers / totalProviders : 0
      },
      antiPatternsFound,
      complexityDistribution,
      recommendedRefactors: recommendedRefactors.slice(0, 15)
    };
  }

  private async analyzePatterns(ast: any, filePath: string, config: PatternExtractorConfig): Promise<PatternAnalysisResult['patterns']> {
    const patterns: PatternAnalysisResult['patterns'] = [];
    const enabledPatterns = config.patterns || ['hooks', 'context', 'hoc', 'render-props'];

    // Analyze Hook patterns
    if (enabledPatterns.includes('hooks')) {
      const customHooks = ReactHooksUtils.findCustomHooks(ast);
      for (const hook of customHooks) {
        patterns.push({
          type: 'hooks',
          name: hook.name,
          description: `Custom hook: ${hook.name}`,
          complexity: this.calculateHookComplexity(hook),
          usage: 1, // TODO: Track actual usage
          examples: [hook.name]
        });
      }
    }

    // Analyze Context patterns
    if (enabledPatterns.includes('context')) {
      const contexts = ReactContextUtils.findContextDefinitions(ast);
      for (const context of contexts) {
        patterns.push({
          type: 'context',
          name: context.contextName,
          description: `React Context: ${context.contextName}`,
          complexity: 'medium',
          usage: 1,
          examples: [context.contextName]
        });
      }
    }

    // Analyze HOC patterns
    if (enabledPatterns.includes('hoc')) {
      const hocs = this.findHOCPatterns(ast);
      patterns.push(...hocs);
    }

    // Analyze Render Props patterns
    if (enabledPatterns.includes('render-props')) {
      const renderProps = this.findRenderPropsPatterns(ast);
      patterns.push(...renderProps);
    }

    return patterns;
  }

  private async analyzeCustomHooks(ast: any): Promise<PatternAnalysisResult['customHooks']> {
    const customHooks = ReactHooksUtils.findCustomHooks(ast);
    
    return customHooks.map(hook => ({
      name: hook.name,
      pattern: this.categorizeHook(hook.name)
    }));
  }

  private async analyzeContextPatterns(ast: any): Promise<PatternAnalysisResult['contextProviders']> {
    const contextFlow = ReactContextUtils.analyzeContextFlow(ast);
    
    return contextFlow.map(context => ({
      name: context.contextName,
      hasProvider: context.hasProvider,
      hasConsumer: context.hasConsumer,
      usesHook: context.consumerCount > 0 // Assume hook usage if there are consumers
    }));
  }

  private async detectAntiPatterns(ast: any, content: string): Promise<PatternAnalysisResult['antiPatterns']> {
    const antiPatterns: PatternAnalysisResult['antiPatterns'] = [];

    // Detect common anti-patterns
    if (content.includes('useState') && content.includes('useEffect') && 
        content.split('useState').length > 5) {
      antiPatterns.push({
        type: 'too-many-state-variables',
        description: 'Component has too many useState calls',
        severity: 'warning',
        suggestion: 'Consider using useReducer or breaking into smaller components'
      });
    }

    if (content.includes('useEffect(') && content.split('useEffect').length > 4) {
      antiPatterns.push({
        type: 'too-many-effects',
        description: 'Component has too many useEffect calls',
        severity: 'warning',
        suggestion: 'Consider extracting effects into custom hooks'
      });
    }

    return antiPatterns;
  }

  private calculateHookComplexity(hook: any): 'low' | 'medium' | 'high' {
    const paramCount = hook.params?.length || 0;
    if (paramCount === 0) return 'low';
    if (paramCount <= 2) return 'medium';
    return 'high';
  }

  private categorizeHook(hookName: string): 'state-management' | 'data-fetching' | 'side-effects' | 'utility' | 'other' {
    if (hookName.includes('State') || hookName.includes('Store')) return 'state-management';
    if (hookName.includes('Fetch') || hookName.includes('Api') || hookName.includes('Query')) return 'data-fetching';
    if (hookName.includes('Effect') || hookName.includes('Event')) return 'side-effects';
    if (hookName.includes('Format') || hookName.includes('Parse') || hookName.includes('Validate')) return 'utility';
    return 'other';
  }

  private findHOCPatterns(ast: any): PatternAnalysisResult['patterns'] {
    const patterns: PatternAnalysisResult['patterns'] = [];
    
    // Simple HOC detection - functions that return components
    const exports = ASTUtils.findExports(ast);
    for (const exp of exports) {
      if (exp.name.startsWith('with') || exp.name.endsWith('HOC')) {
        patterns.push({
          type: 'hoc',
          name: exp.name,
          description: `Higher-Order Component: ${exp.name}`,
          complexity: 'medium',
          usage: 1,
          examples: [exp.name]
        });
      }
    }
    
    return patterns;
  }

  private findRenderPropsPatterns(ast: any): PatternAnalysisResult['patterns'] {
    const patterns: PatternAnalysisResult['patterns'] = [];
    
    // TODO: Implement render props detection
    // Look for props that are functions, especially 'render' or 'children' as functions
    
    return patterns;
  }

  /**
   * Format pattern data according to specified format
   */
  formatData(data: PatternExtractionSummary, format: 'text' | 'markdown' | 'json' = 'text'): string {
    return PatternFormatter.format(data, format);
  }
}
