/**
 * I18n Extractor Plugin - Main orchestrator using modular architecture
 */

import { BaseExtractor } from '../common/base-extractor.js';
import { PluginLogger } from '../common/logger.js';
import type { PluginMetadata } from '../../types/plugin.js';
import type { 
  I18nExtractorConfig, 
  I18nAnalysisResult, 
  I18nExtractionSummary 
} from './types.js';

// Import all the modular components
import { LanguageDetector } from './language-detector.js';
import { ASTAnalyzer } from './ast-analyzer.js';
import { TranslationFileAnalyzer } from './translation-file-analyzer.js';
import { ResultProcessor } from './result-processor.js';
import { DEFAULT_I18N_CONFIG, DEFAULT_EXCLUDE_PATTERNS } from './config.js';

import * as fs from 'fs';
import * as path from 'path';

/**
 * I18n Extractor Plugin using modular DRY architecture
 */
export class I18nExtractorPlugin extends BaseExtractor<I18nAnalysisResult, I18nExtractionSummary> {
  private languageDetector: LanguageDetector;
  private astAnalyzer: ASTAnalyzer;
  private translationAnalyzer: TranslationFileAnalyzer;
  private resultProcessor: ResultProcessor;
  private detectedLanguages: string[] = [];

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
            default: 'auto-detect'
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

    // Initialize all the modular components
    const fullConfig = {
      ...DEFAULT_I18N_CONFIG,
      excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
      ...config
    };

    this.languageDetector = new LanguageDetector();
    this.astAnalyzer = new ASTAnalyzer(fullConfig);
    this.translationAnalyzer = new TranslationFileAnalyzer(fullConfig);
    this.resultProcessor = new ResultProcessor();
  }

  /**
   * Pre-analysis setup: detect project languages
   */
  async preAnalysis(targetPath: string): Promise<void> {
    this.logger.info('🔍 Starting language detection...');
    
    try {
      const detectionResult = await this.languageDetector.detectProjectLanguages(targetPath);
      this.detectedLanguages = detectionResult.languages;
      
      if (this.detectedLanguages.length > 0) {
        this.logger.info(`✅ Detected languages: ${this.detectedLanguages.join(', ')}`);
        this.logger.info(`   Detection methods: ${detectionResult.detectionMethods.join(', ')}`);
        
        if (detectionResult.configFiles.length > 0) {
          this.logger.debug(`   Config files found: ${detectionResult.configFiles.length}`);
        }
      } else {
        this.logger.warn('⚠️  No project languages detected, using fallback languages');
        this.detectedLanguages = DEFAULT_I18N_CONFIG.languages!;
      }
    } catch (error) {
      this.logger.error('❌ Language detection failed:', error);
      this.detectedLanguages = DEFAULT_I18N_CONFIG.languages!;
    }
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

      // Use the AST analyzer to extract all information
      const untranslatedStrings = await this.astAnalyzer.findUntranslatedStrings(ast, content);
      const translationUsage = await this.astAnalyzer.findTranslationUsage(ast);
      const potentialIssues = await this.astAnalyzer.detectI18nIssues(
        ast, 
        content, 
        untranslatedStrings, 
        translationUsage
      );

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
    // Ensure we have detected languages before analysis
    if (this.detectedLanguages.length === 0) {
      await this.preAnalysis(targetPath);
    }

    // Analyze translation files using detected languages
    this.logger.info('📝 Analyzing translation files...');
    const translationFileAnalysis = await this.translationAnalyzer.analyzeTranslationFiles(
      targetPath, 
      this.detectedLanguages
    );

    // Process and aggregate all results
    this.logger.info('📊 Processing analysis results...');
    const summary = await this.resultProcessor.aggregateResults(results, translationFileAnalysis);

    // Log a quick summary
    this.logger.info('\n' + this.resultProcessor.generateQuickSummary(summary));

    return summary;
  }

  /**
   * Get detected languages (useful for external access)
   */
  getDetectedLanguages(): string[] {
    return this.detectedLanguages;
  }

  /**
   * Format results according to specified format
   */
  formatData(data: I18nExtractionSummary, format: 'text' | 'markdown' | 'json' = 'text'): string {
    return this.resultProcessor.formatResults(data, format);
  }

  /**
   * Quick language detection utility (static method)
   */
  static async detectLanguages(projectPath: string): Promise<string[]> {
    return LanguageDetector.quickDetect(projectPath);
  }
}
