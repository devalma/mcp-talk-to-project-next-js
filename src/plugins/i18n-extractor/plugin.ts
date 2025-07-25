/**
 * I18n Extractor Plugin - Analyzes internationalization patterns and missing translations
 */

import { BaseExtractor, type ExtractorConfig } from '../common/base-extractor.js';
import { ASTUtils } from '../common/ast-utils.js';
import { FileUtils } from '../common/file-utils.js';
import type { PluginMetadata } from '../../types/plugin.js';
import { I18nFormatter } from './formatter.js';
import path from 'path';
import fs from 'fs';

// Enhanced config for i18n extraction
export interface I18nExtractorConfig extends ExtractorConfig {
  /** Translation function names to detect (default: ['t', 'translate', '$t', 'i18n.t']) */
  translationFunctions?: string[];
  /** Translation key patterns (default: ['t(', '{{', '{t(']) */
  translationPatterns?: string[];
  /** Minimum string length to consider for translation (default: 3) */
  minStringLength?: number;
  /** Include JSX text content analysis (default: true) */
  analyzeJSXText?: boolean;
  /** Include string literals analysis (default: true) */
  analyzeStringLiterals?: boolean;
  /** Translation file patterns to check */
  translationFilePatterns?: string[];
  /** Languages to check for missing keys */
  languages?: string[];
  /** Exclude certain strings (URLs, technical terms, etc.) */
  excludePatterns?: string[];
  /** Custom filter function for advanced string filtering */
  customFilter?: (text: string) => boolean;
}

// Result types for i18n extraction
export interface I18nAnalysisResult {
  filePath: string;
  untranslatedStrings: Array<{
    text: string;
    type: 'jsx-text' | 'jsx-attribute' | 'string-literal' | 'template-literal';
    line: number;
    column: number;
    context?: string; // surrounding code context
    isLikelyTranslatable: boolean;
    suggestedKey?: string;
  }>;
  translationUsage: Array<{
    functionName: string;
    key: string;
    line: number;
    column: number;
    defaultValue?: string;
  }>;
  potentialIssues: Array<{
    type: 'hardcoded-string' | 'missing-translation-call' | 'untranslated-jsx' | 'dynamic-key';
    description: string;
    line: number;
    suggestion: string;
  }>;
}

export interface I18nExtractionSummary {
  totalFiles: number;
  totalUntranslatedStrings: number;
  totalTranslationUsage: number;
  totalPotentialIssues: number;
  filesCoverage: {
    withTranslations: number;
    withoutTranslations: number;
    partiallyTranslated: number;
  };
  untranslatedStringsByType: {
    [key: string]: number;
  };
  mostCommonUntranslatedStrings: Array<{
    text: string;
    count: number;
    files: string[];
  }>;
  translationKeys: {
    totalKeys: number;
    usedKeys: Array<{
      key: string;
      count: number;
      files: string[];
    }>;
    unusedKeys?: string[];
  };
  missingTranslations: {
    [language: string]: string[];
  };
  recommendedActions: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    description: string;
    affectedFiles: number;
  }>;
  translationFileAnalysis?: {
    translationFiles: Array<{
      file: string;
      language: string;
      keyCount: number;
      missingKeys: string[];
    }>;
    keyConsistency: {
      consistentKeys: string[];
      inconsistentKeys: string[];
    };
  };
}

/**
 * I18n Extractor Plugin using DRY utilities
 */
export class I18nExtractorPlugin extends BaseExtractor<I18nAnalysisResult, I18nExtractionSummary> {
  
  get metadata(): PluginMetadata {
    return {
      name: 'i18n-extractor',
      version: '1.0.0',
      description: 'Analyzes internationalization patterns, detects untranslated strings, and identifies missing translation keys',
      author: 'MCP Next.js Analyzer',
      tags: ['i18n', 'internationalization', 'translations', 'localization'],
      cli: {
        command: 'i18n',
        description: 'Analyze i18n patterns and missing translations',
        usage: 'node cli.js [project-path] i18n [options]',
        category: 'analysis',
        options: [
          {
            name: '--functions',
            description: 'Translation function names to detect (comma-separated)',
            type: 'string',
            default: 't,translate,$t,i18n.t'
          },
          {
            name: '--min-length',
            description: 'Minimum string length to consider for translation',
            type: 'number',
            default: 3
          },
          {
            name: '--languages',
            description: 'Languages to check for missing keys (comma-separated)',
            type: 'string',
            default: 'en,es,fr,de'
          },
          {
            name: '--jsx-text',
            description: 'Include JSX text content analysis',
            type: 'boolean',
            default: true
          },
          {
            name: '--string-literals',
            description: 'Include string literals analysis',
            type: 'boolean',
            default: true
          },
          {
            name: '--format',
            description: 'Output format (text, markdown, json)',
            type: 'string',
            default: 'text'
          }
        ],
        examples: [
          'node cli.js . i18n',
          'node cli.js src/components i18n --functions=t,translate',
          'node cli.js /path/to/project i18n --languages=en,fr --format=markdown'
        ]
      }
    };
  }

  constructor(config: I18nExtractorConfig = {}) {
    super({
      filePatterns: ['**/*.{js,jsx,ts,tsx}'],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.d.ts',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.stories.*',
        '**/locales/**', // Translation files
        '**/i18n/**'     // I18n config files
      ],
      batchSize: 6,
      parallel: true,
      ...config
    });
  }

  shouldProcess(filePath: string): boolean {
    // For directories, always allow processing
    if (!path.extname(filePath)) {
      return true;
    }
    
    // For files, check if they're likely to contain translatable content
    const ext = path.extname(filePath).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
  }

  protected shouldProcessFile(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content) return false;

    // Quick check - skip files that are likely configuration or utility files
    const fileName = path.basename(filePath).toLowerCase();
    const skipPatterns = [
      'config', 'setup', 'util', 'helper', 'constant', 'enum', 
      'type', 'interface', 'api', 'service', 'hook'
    ];
    
    const isUtilityFile = skipPatterns.some(pattern => fileName.includes(pattern));
    
    // Always process files with React components (likely to have UI text)
    const hasReactContent = content.includes('jsx') || 
                           content.includes('<') || 
                           content.includes('React') ||
                           content.includes('Component');
    
    // Process if it has React content OR is not a utility file
    return hasReactContent || !isUtilityFile;
  }

  protected async processFile(filePath: string): Promise<I18nAnalysisResult | null> {
    try {
      const parsed = await this.parseFileWithCache(filePath);
      if (!parsed || !parsed.ast) return null;

      const ast = parsed.ast;
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = this.getI18nConfig();

      // Analyze for untranslated strings
      const untranslatedStrings = await this.findUntranslatedStrings(ast, content, config);
      
      // Analyze translation usage
      const translationUsage = await this.findTranslationUsage(ast, config);
      
      // Detect potential i18n issues
      const potentialIssues = await this.detectI18nIssues(ast, content, untranslatedStrings, translationUsage, config);

      return {
        filePath,
        untranslatedStrings,
        translationUsage,
        potentialIssues
      };

    } catch (error) {
      this.logger.error(`Failed to process ${filePath}:`, error);
      return null;
    }
  }

  protected async aggregateResults(results: I18nAnalysisResult[], targetPath: string): Promise<I18nExtractionSummary> {
    const allUntranslatedStrings = results.flatMap(r => r.untranslatedStrings);
    const allTranslationUsage = results.flatMap(r => r.translationUsage);
    const allPotentialIssues = results.flatMap(r => r.potentialIssues);

    // Analyze translation file coverage
    const translationFileAnalysis = await this.analyzeTranslationFiles(targetPath);

    // Calculate coverage statistics
    const filesCoverage = this.calculateFilesCoverage(results);

    // Group untranslated strings by type
    const untranslatedStringsByType = this.groupStringsByType(allUntranslatedStrings);

    // Find most common untranslated strings
    const mostCommonUntranslatedStrings = this.findMostCommonStrings(allUntranslatedStrings, results);

    // Analyze translation key usage
    const translationKeys = this.analyzeTranslationKeyUsage(allTranslationUsage, translationFileAnalysis);

    // Generate recommendations
    const recommendedActions = this.generateRecommendations(results, translationFileAnalysis);

    this.logger.info(`I18n analysis complete: ${allUntranslatedStrings.length} untranslated strings, ${allTranslationUsage.length} translation calls`);

    return {
      totalFiles: results.length,
      totalUntranslatedStrings: allUntranslatedStrings.length,
      totalTranslationUsage: allTranslationUsage.length,
      totalPotentialIssues: allPotentialIssues.length,
      filesCoverage,
      untranslatedStringsByType,
      mostCommonUntranslatedStrings,
      translationKeys,
      missingTranslations: translationFileAnalysis?.keyConsistency.inconsistentKeys.reduce((acc, key) => {
        acc[key] = translationFileAnalysis.translationFiles
          .filter(f => !f.missingKeys.includes(key))
          .map(f => f.language);
        return acc;
      }, {} as { [key: string]: string[] }) || {},
      recommendedActions,
      translationFileAnalysis
    };
  }

  /**
   * Find untranslated strings in the AST
   */
  private async findUntranslatedStrings(ast: any, content: string, config: I18nExtractorConfig): Promise<I18nAnalysisResult['untranslatedStrings']> {
    const untranslatedStrings: I18nAnalysisResult['untranslatedStrings'] = [];
    console.log('🔍 FINDUNTRANSLATEDSTRINGS: Starting analysis with minimal validator');

    // MINIMAL WHITELIST APPROACH: Start with nothing, add validators one by one
    ASTUtils.traverse(ast, {
      // 1. JSX Text Content (HIGH PRIORITY - Always translate)
      JSXText: (path: any) => {
        if (!config.analyzeJSXText) return;
        
        const text = path.node.value.trim();
        console.log('🔍 JSXText found:', text);
        if (this.validator1_JSXTextContent(text)) {
          console.log('✅ JSXText accepted:', text);
          untranslatedStrings.push({
            text,
            type: 'jsx-text',
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            context: this.getNodeContext(path),
            isLikelyTranslatable: true,
            suggestedKey: this.generateTranslationKey(text)
          });
        }
      }

      // TODO: Add more validators one by one
      // JSXAttribute, StringLiteral, TemplateLiteral will be added step by step
    });

    console.log('🔍 FINDUNTRANSLATEDSTRINGS: Found', untranslatedStrings.length, 'strings');
    return untranslatedStrings;
  }

  /**
   * Find translation function usage
   */
  private async findTranslationUsage(ast: any, config: I18nExtractorConfig): Promise<I18nAnalysisResult['translationUsage']> {
    const translationUsage: I18nAnalysisResult['translationUsage'] = [];

    ASTUtils.traverse(ast, {
      CallExpression: (path: any) => {
        const { node } = path;
        
        // Check if this is a translation function call
        const functionName = this.getCallExpressionName(node);
        if (config.translationFunctions!.includes(functionName)) {
          const key = this.extractTranslationKey(node);
          const defaultValue = this.extractDefaultValue(node);
          
          if (key) {
            translationUsage.push({
              functionName,
              key,
              line: node.loc?.start.line || 0,
              column: node.loc?.start.column || 0,
              defaultValue
            });
          }
        }
      }
    });

    return translationUsage;
  }

  /**
   * Detect potential i18n issues
   */
  private async detectI18nIssues(
    ast: any, 
    content: string, 
    untranslatedStrings: I18nAnalysisResult['untranslatedStrings'],
    translationUsage: I18nAnalysisResult['translationUsage'],
    config: I18nExtractorConfig
  ): Promise<I18nAnalysisResult['potentialIssues']> {
    const issues: I18nAnalysisResult['potentialIssues'] = [];

    // Check for hardcoded strings in user-facing components
    const hardcodedStrings = untranslatedStrings.filter(s => s.isLikelyTranslatable);
    if (hardcodedStrings.length > 0) {
      issues.push({
        type: 'hardcoded-string',
        description: `Found ${hardcodedStrings.length} hardcoded translatable strings`,
        line: hardcodedStrings[0].line,
        suggestion: 'Consider wrapping these strings with translation functions'
      });
    }

    // Check for JSX text that should be translated
    const untranslatedJSX = untranslatedStrings.filter(s => s.type === 'jsx-text' && s.isLikelyTranslatable);
    if (untranslatedJSX.length > 0) {
      issues.push({
        type: 'untranslated-jsx',
        description: `Found ${untranslatedJSX.length} untranslated JSX text elements`,
        line: untranslatedJSX[0].line,
        suggestion: 'Wrap JSX text with translation function: {t("your.key")}'
      });
    }

    // Check for dynamic translation keys (harder to track)
    const dynamicKeys = translationUsage.filter(t => t.key.includes('${') || t.key.includes('+'));
    if (dynamicKeys.length > 0) {
      issues.push({
        type: 'dynamic-key',
        description: `Found ${dynamicKeys.length} dynamic translation keys`,
        line: dynamicKeys[0].line,
        suggestion: 'Consider using static keys for better translation management'
      });
    }

    return issues;
  }

  /**
   * Analyze translation files for key consistency
   */
  private async analyzeTranslationFiles(targetPath: string): Promise<I18nExtractionSummary['translationFileAnalysis']> {
    const config = this.getI18nConfig();
    const translationFiles: Array<{
      file: string;
      language: string;
      keyCount: number;
      missingKeys: string[];
    }> = [];

    try {
      // First try to discover languages from directory structure
      const discoveredLanguages = await this.discoverLanguagesFromStructure(targetPath);
      if (discoveredLanguages.length > 0) {
        this.logger.info(`Discovered languages from directory structure: ${discoveredLanguages.join(', ')}`);
        // Update the config with discovered languages
        config.languages = discoveredLanguages;
      }

      // Find translation files
      for (const pattern of config.translationFilePatterns!) {
        const files = await FileUtils.findFiles(pattern, {
          cwd: targetPath,
          ignore: ['**/node_modules/**']
        });

        for (const file of files) {
          try {
            const content = await FileUtils.readFile(file);
            if (!content) continue;
            
            const translations = JSON.parse(content);
            const language = this.extractLanguageFromPath(file);
            const keys = this.flattenTranslationKeys(translations);

            translationFiles.push({
              file,
              language,
              keyCount: keys.length,
              missingKeys: [] // Will be populated later
            });
          } catch (error) {
            this.logger.warn(`Failed to parse translation file ${file}:`, error);
          }
        }
      }

      // Analyze key consistency across languages
      const allKeys = new Set<string>();
      translationFiles.forEach(tf => {
        const content = fs.readFileSync(tf.file, 'utf-8');
        const translations = JSON.parse(content);
        const keys = this.flattenTranslationKeys(translations);
        keys.forEach(key => allKeys.add(key));
      });

      // Find missing keys in each file
      translationFiles.forEach(tf => {
        const content = fs.readFileSync(tf.file, 'utf-8');
        const translations = JSON.parse(content);
        const fileKeys = new Set(this.flattenTranslationKeys(translations));
        tf.missingKeys = Array.from(allKeys).filter(key => !fileKeys.has(key));
      });

      // Determine consistent vs inconsistent keys
      const consistentKeys: string[] = [];
      const inconsistentKeys: string[] = [];

      Array.from(allKeys).forEach(key => {
        const filesWithKey = translationFiles.filter(tf => {
          const content = fs.readFileSync(tf.file, 'utf-8');
          const translations = JSON.parse(content);
          const fileKeys = this.flattenTranslationKeys(translations);
          return fileKeys.includes(key);
        });

        if (filesWithKey.length === translationFiles.length) {
          consistentKeys.push(key);
        } else {
          inconsistentKeys.push(key);
        }
      });

      return {
        translationFiles,
        keyConsistency: {
          consistentKeys,
          inconsistentKeys
        }
      };
    } catch (error) {
      this.logger.warn('Failed to analyze translation files:', error);
      return {
        translationFiles: [],
        keyConsistency: {
          consistentKeys: [],
          inconsistentKeys: []
        }
      };
    }
  }

  /**
   * Utility methods
   */
  private getI18nConfig(): I18nExtractorConfig {
    return {
      translationFunctions: ['t', 'translate', '$t', 'i18n.t', 'i18next.t'],
      translationPatterns: ['t(', '{{', '{t(', 'translate('],
      minStringLength: 3,
      analyzeJSXText: true,
      analyzeStringLiterals: true,
      translationFilePatterns: ['**/locales/**/*.json', '**/i18n/**/*.json', '**/lang/**/*.json'],
      languages: ['en', 'es', 'fr', 'de'],
      excludePatterns: [
        'http://', 'https://', 'ftp://', 'mailto:',
        'rgb(', 'rgba(', '#', 'px', 'em', 'rem', '%',
        'import', 'export', 'from', 'require',
        'console.', 'localStorage', 'sessionStorage',
        'data-', 'aria-', 'className', 'id',
        '.js', '.ts', '.jsx', '.tsx', '.css', '.json', '.html',
        'NODE_ENV', 'REACT_APP_', 'NEXT_PUBLIC_'
      ],
      ...this.extractorConfig
    };
  }

  // ==========================================================================
  // WHITELIST VALIDATORS - Added one by one according to documentation
  // ==========================================================================

  /**
   * VALIDATOR 1: JSX Text Content (HIGH PRIORITY - Always translate)
   * Rule: All direct text content within JSX elements
   * Examples: <h1>Welcome</h1>, <p>Loading...</p>
   */
  private validator1_JSXTextContent(text: string): boolean {
    // Basic validation: must have content and letters
    if (!text || text.length < 1) return false;
    if (!/[a-zA-Z]/.test(text)) return false;
    
    // JSX text content is always translatable (user-facing by definition)
    return true;
  }

  /**
   * Check if string is inside a translation function call
   */
  private isInTranslationCall(path: any): boolean {
    const config = this.getI18nConfig();
    
    // Check if this string is inside a translation function call
    let parent = path.parent;
    while (parent) {
      if (parent.type === 'CallExpression') {
        const functionName = this.getCallExpressionName(parent);
        if (config.translationFunctions!.includes(functionName)) {
          return true;
        }
      }
      parent = parent.parent;
    }
    return false;
  }

  // ==========================================================================
  // UTILITY METHODS (keeping essential ones)
  // ==========================================================================

  private getCallExpressionName(node: any): string {
    if (node.callee.type === 'Identifier') {
      return node.callee.name;
    } else if (node.callee.type === 'MemberExpression') {
      return this.getMemberExpressionName(node.callee);
    }
    return '';
  }

  private getMemberExpressionName(node: any): string {
    if (node.object.type === 'Identifier' && node.property.type === 'Identifier') {
      return `${node.object.name}.${node.property.name}`;
    }
    return '';
  }

  private extractTranslationKey(node: any): string | null {
    if (node.arguments.length > 0) {
      const firstArg = node.arguments[0];
      if (firstArg.type === 'StringLiteral') {
        return firstArg.value;
      } else if (firstArg.type === 'TemplateLiteral') {
        return firstArg.quasis.map((q: any) => q.value.raw).join('${...}');
      }
    }
    return null;
  }

  private extractDefaultValue(node: any): string | undefined {
    // Look for default value in second argument or options object
    if (node.arguments.length > 1) {
      const secondArg = node.arguments[1];
      if (secondArg.type === 'StringLiteral') {
        return secondArg.value;
      } else if (secondArg.type === 'ObjectExpression') {
        const defaultProp = secondArg.properties.find((p: any) => 
          p.key?.name === 'defaultValue' || p.key?.value === 'defaultValue'
        );
        if (defaultProp?.value?.type === 'StringLiteral') {
          return defaultProp.value.value;
        }
      }
    }
    return undefined;
  }

  private generateTranslationKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '.')
      .substring(0, 50);
  }

  private getNodeContext(path: any): string {
    // Get surrounding context for better understanding
    const parent = path.parent;
    if (parent?.type === 'JSXElement') {
      return `<${parent.openingElement?.name?.name || 'unknown'}>`;
    } else if (parent?.type === 'VariableDeclarator') {
      return `const ${parent.id?.name || 'unknown'}`;
    } else if (parent?.type === 'ObjectProperty') {
      return `${parent.key?.name || parent.key?.value || 'unknown'}: `;
    }
    return '';
  }

  private calculateFilesCoverage(results: I18nAnalysisResult[]): I18nExtractionSummary['filesCoverage'] {
    let withTranslations = 0;
    let withoutTranslations = 0;
    let partiallyTranslated = 0;

    results.forEach(result => {
      const hasTranslations = result.translationUsage.length > 0;
      const hasUntranslatedStrings = result.untranslatedStrings.filter(s => s.isLikelyTranslatable).length > 0;

      if (hasTranslations && !hasUntranslatedStrings) {
        withTranslations++;
      } else if (!hasTranslations && hasUntranslatedStrings) {
        withoutTranslations++;
      } else if (hasTranslations && hasUntranslatedStrings) {
        partiallyTranslated++;
      }
    });

    return {
      withTranslations,
      withoutTranslations,
      partiallyTranslated
    };
  }

  private groupStringsByType(strings: I18nAnalysisResult['untranslatedStrings']): { [key: string]: number } {
    const groups: { [key: string]: number } = {};
    strings.forEach(s => {
      groups[s.type] = (groups[s.type] || 0) + 1;
    });
    return groups;
  }

  private findMostCommonStrings(
    strings: I18nAnalysisResult['untranslatedStrings'], 
    results: I18nAnalysisResult[]
  ): I18nExtractionSummary['mostCommonUntranslatedStrings'] {
    const stringCounts = new Map<string, { count: number; files: Set<string> }>();

    strings.forEach(s => {
      const existing = stringCounts.get(s.text) || { count: 0, files: new Set() };
      existing.count++;
      
      const result = results.find(r => r.untranslatedStrings.includes(s));
      if (result) {
        existing.files.add(result.filePath);
      }
      
      stringCounts.set(s.text, existing);
    });

    return Array.from(stringCounts.entries())
      .map(([text, data]) => ({
        text,
        count: data.count,
        files: Array.from(data.files)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private analyzeTranslationKeyUsage(
    usage: I18nAnalysisResult['translationUsage'],
    translationFileAnalysis: I18nExtractionSummary['translationFileAnalysis']
  ): I18nExtractionSummary['translationKeys'] {
    const keyUsage = new Map<string, { count: number; files: Set<string> }>();

    usage.forEach(u => {
      const existing = keyUsage.get(u.key) || { count: 0, files: new Set() };
      existing.count++;
      keyUsage.set(u.key, existing);
    });

    const usedKeys = Array.from(keyUsage.entries())
      .map(([key, data]) => ({
        key,
        count: data.count,
        files: Array.from(data.files)
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalKeys: keyUsage.size,
      usedKeys,
      unusedKeys: translationFileAnalysis?.keyConsistency.consistentKeys.filter(
        key => !keyUsage.has(key)
      ) || []
    };
  }

  private generateRecommendations(
    results: I18nAnalysisResult[],
    translationFileAnalysis: I18nExtractionSummary['translationFileAnalysis']
  ): I18nExtractionSummary['recommendedActions'] {
    const recommendations: I18nExtractionSummary['recommendedActions'] = [];

    // Count files with issues
    const filesWithUntranslatedStrings = results.filter(r => 
      r.untranslatedStrings.filter(s => s.isLikelyTranslatable).length > 0
    ).length;

    const filesWithoutTranslations = results.filter(r => 
      r.translationUsage.length === 0 && 
      r.untranslatedStrings.filter(s => s.isLikelyTranslatable).length > 0
    ).length;

    if (filesWithUntranslatedStrings > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Add missing translations',
        description: `${filesWithUntranslatedStrings} files contain untranslated strings`,
        affectedFiles: filesWithUntranslatedStrings
      });
    }

    if (filesWithoutTranslations > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Implement i18n in untranslated files',
        description: `${filesWithoutTranslations} files have no translation implementation`,
        affectedFiles: filesWithoutTranslations
      });
    }

    if (translationFileAnalysis?.keyConsistency.inconsistentKeys.length || 0 > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Fix translation key consistency',
        description: `${translationFileAnalysis!.keyConsistency.inconsistentKeys.length} keys are missing in some language files`,
        affectedFiles: translationFileAnalysis!.translationFiles.length
      });
    }

    return recommendations;
  }

  /**
   * Discover languages from directory structure and i18n configuration files
   */
  private async discoverLanguagesFromStructure(targetPath: string): Promise<string[]> {
    const languages = new Set<string>();

    try {
      // Method 1: Check common locale directory patterns
      const localeBasePaths = [
        path.join(targetPath, 'src', 'locales'),
        path.join(targetPath, 'public', 'locales'),
        path.join(targetPath, 'locales'),
        path.join(targetPath, 'i18n'),
        path.join(targetPath, 'lang'),
        path.join(targetPath, 'translations')
      ];

      for (const basePath of localeBasePaths) {
        try {
          if (await FileUtils.isDirectory(basePath)) {
            const entries = await FileUtils.readDirectory(basePath);
            for (const entry of entries) {
              const fullPath = path.join(basePath, entry);
              if (await FileUtils.isDirectory(fullPath)) {
                const langCode = entry;
                if (this.isValidLanguageCode(langCode)) {
                  languages.add(langCode);
                }
              }
            }
          }
        } catch (error) {
          // Continue with next path if this one fails
        }
      }

      // Method 2: Extract from translation file paths
      const config = this.getI18nConfig();
      for (const pattern of config.translationFilePatterns!) {
        try {
          const files = await FileUtils.findFiles(pattern, {
            cwd: targetPath,
            ignore: ['**/node_modules/**']
          });

          for (const file of files) {
            const langCode = this.extractLanguageFromPath(file);
            if (this.isValidLanguageCode(langCode)) {
              languages.add(langCode);
            }
          }
        } catch (error) {
          // Continue with next pattern
        }
      }

      // Method 3: Try to read common i18n config files
      await this.discoverLanguagesFromConfig(targetPath, languages);

    } catch (error) {
      this.logger.warn('Failed to discover languages from structure:', error);
    }

    return Array.from(languages).sort();
  }

  /**
   * Try to discover languages from i18n configuration files
   */
  private async discoverLanguagesFromConfig(targetPath: string, languages: Set<string>): Promise<void> {
    const configPatterns = [
      '**/i18n.{js,ts,json}',
      '**/i18next.{js,ts,json}', 
      '**/i18n-options.{js,ts,json}',
      '**/next.config.{js,ts}',
      '**/nuxt.config.{js,ts}',
      '**/package.json'
    ];

    for (const pattern of configPatterns) {
      try {
        const files = await FileUtils.findFiles(pattern, {
          cwd: targetPath,
          ignore: ['**/node_modules/**']
        });

        for (const file of files) {
          try {
            const content = await FileUtils.readFile(file);
            if (!content) continue;

            // Extract language codes from config content
            const configLanguages = this.extractLanguagesFromConfigContent(content, file);
            configLanguages.forEach(lang => {
              if (this.isValidLanguageCode(lang)) {
                languages.add(lang);
              }
            });
          } catch (error) {
            // Skip files that can't be read
          }
        }
      } catch (error) {
        // Continue with next pattern
      }
    }
  }

  /**
   * Extract language codes from configuration file content
   */
  private extractLanguagesFromConfigContent(content: string, filePath: string): string[] {
    const languages: string[] = [];
    
    try {
      // Common patterns to look for in config files
      const patterns = [
        // i18next locales array: locales: ['en', 'es', 'fr']
        /locales?\s*:\s*\[([^\]]+)\]/g,
        // languages array: languages: ['en', 'es'] 
        /languages?\s*:\s*\[([^\]]+)\]/g,
        // supportedLanguages: ['en', 'es']
        /supportedLanguages?\s*:\s*\[([^\]]+)\]/g,
        // availableLanguages: ['en', 'es']
        /availableLanguages?\s*:\s*\[([^\]]+)\]/g,
        // lng: 'en' or language: 'en'
        /(?:lng|language)\s*:\s*['"]([\w-]+)['"]/g,
        // defaultLocale: 'en'
        /defaultLocale\s*:\s*['"]([\w-]+)['"]/g,
        // fallbackLng: 'en' or fallbackLanguage: 'en'
        /fallback(?:Lng|Language)\s*:\s*['"]([\w-]+)['"]/g
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1]) {
            if (match[1].includes(',')) {
              // Array of languages
              const arrayLangs = match[1]
                .split(',')
                .map(s => s.trim().replace(/['"]/g, ''))
                .filter(s => s && this.isValidLanguageCode(s));
              languages.push(...arrayLangs);
            } else {
              // Single language
              const singleLang = match[1].trim().replace(/['"]/g, '');
              if (this.isValidLanguageCode(singleLang)) {
                languages.push(singleLang);
              }
            }
          }
        }
      }

      // For package.json, also check for i18n related dependencies
      if (filePath.endsWith('package.json')) {
        try {
          const pkg = JSON.parse(content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          // If they have i18n libraries, look for common language patterns in scripts or config
          if (deps['react-i18next'] || deps['i18next'] || deps['next-i18next']) {
            // Look for build scripts or config that might indicate languages
            const scripts = pkg.scripts || {};
            const scriptContent = JSON.stringify(scripts);
            
            const buildPatterns = [
              /build:(\w{2,5})/g,  // build:en, build:es, etc.
              /locale[s]?[:\s]+(\w{2,5})/g
            ];
            
            for (const pattern of buildPatterns) {
              let match;
              while ((match = pattern.exec(scriptContent)) !== null) {
                if (this.isValidLanguageCode(match[1])) {
                  languages.push(match[1]);
                }
              }
            }
          }
        } catch (error) {
          // Not valid JSON or other error, skip
        }
      }

    } catch (error) {
      this.logger.debug(`Failed to extract languages from ${filePath}:`, error);
    }

    return [...new Set(languages)]; // Remove duplicates
  }

  /**
   * Check if a string looks like a valid language code
   */
  private isValidLanguageCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false;
    
    // ISO 639-1 (2 letters) or RFC 5646 (with region, e.g., en-US)
    const langCodePattern = /^[a-z]{2}(-[A-Z]{2})?$/;
    return langCodePattern.test(code) && code.length >= 2 && code.length <= 5;
  }

  private extractLanguageFromPath(filePath: string): string {
    // Extract language from directory structure: /path/to/locales/{language}/file.json
    const pathParts = filePath.split(path.sep);
    
    // Look for locales directory and get the next directory as language
    const localesIndex = pathParts.findIndex(part => 
      part === 'locales' || part === 'i18n' || part === 'lang' || part === 'translations'
    );
    
    if (localesIndex !== -1 && localesIndex + 1 < pathParts.length) {
      const potentialLang = pathParts[localesIndex + 1];
      if (this.isValidLanguageCode(potentialLang)) {
        return potentialLang;
      }
    }
    
    // Fallback: try to extract from filename (legacy support)
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Patterns like: en.json, messages.en.json, en-US.json
    const fileNameMatch = fileName.match(/([a-z]{2}(-[A-Z]{2})?)/);
    if (fileNameMatch && this.isValidLanguageCode(fileNameMatch[1])) {
      return fileNameMatch[1];
    }
    
    // If no valid language found, return the filename (this should be filtered out later)
    return fileName;
  }

  private flattenTranslationKeys(obj: any, prefix = ''): string[] {
    const keys: string[] = [];
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          keys.push(...this.flattenTranslationKeys(obj[key], fullKey));
        } else {
          keys.push(fullKey);
        }
      }
    }
    
    return keys;
  }

  /**
   * Format i18n data according to specified format
   */
  formatData(data: I18nExtractionSummary, format: 'text' | 'markdown' | 'json' = 'text'): string {
    return I18nFormatter.format(data, format);
  }
}
