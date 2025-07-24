/**
 * Translation File Analyzer - Analyzes translation files for key consistency
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileUtils } from '../common/file-utils.js';
import { PluginLogger } from '../common/logger.js';
import { DEFAULT_I18N_CONFIG } from './config.js';
import type { 
  I18nExtractorConfig, 
  TranslationFile, 
  TranslationFileAnalysis,
  KeyConsistency 
} from './types.js';

export class TranslationFileAnalyzer {
  private logger: PluginLogger;
  private config: I18nExtractorConfig;

  constructor(config: Partial<I18nExtractorConfig> = {}) {
    this.logger = new PluginLogger('translation-analyzer');
    this.config = {
      ...DEFAULT_I18N_CONFIG,
      ...config
    };
  }

  /**
   * Analyze translation files for key consistency
   */
  async analyzeTranslationFiles(
    targetPath: string, 
    detectedLanguages?: string[]
  ): Promise<TranslationFileAnalysis> {
    try {
      // Use detected languages if provided, otherwise fall back to config
      const languages = detectedLanguages && detectedLanguages.length > 0 
        ? detectedLanguages 
        : this.config.languages!;

      this.logger.info(`Analyzing translation files for languages: ${languages.join(', ')}`);

      const translationFiles = await this.findAndParseTranslationFiles(targetPath);
      
      if (translationFiles.length === 0) {
        this.logger.warn('No translation files found');
        return {
          translationFiles: [],
          keyConsistency: {
            consistentKeys: [],
            inconsistentKeys: []
          }
        };
      }

      const keyConsistency = this.analyzeKeyConsistency(translationFiles);

      this.logger.info(`Found ${translationFiles.length} translation files, ${keyConsistency.inconsistentKeys.length} inconsistent keys`);

      return {
        translationFiles,
        keyConsistency
      };

    } catch (error) {
      this.logger.error('Failed to analyze translation files:', error);
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
   * Find and parse all translation files
   */
  private async findAndParseTranslationFiles(targetPath: string): Promise<TranslationFile[]> {
    const translationFiles: TranslationFile[] = [];

    for (const pattern of this.config.translationFilePatterns!) {
      try {
        const files = await FileUtils.findFiles(pattern, {
          cwd: targetPath,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
        });

        for (const file of files) {
          try {
            const translationFile = await this.parseTranslationFile(file);
            if (translationFile) {
              translationFiles.push(translationFile);
            }
          } catch (error) {
            this.logger.warn(`Failed to parse translation file ${file}:`, error);
          }
        }
      } catch (error) {
        this.logger.debug(`Failed to find files with pattern ${pattern}:`, error);
      }
    }

    return translationFiles;
  }

  /**
   * Parse a single translation file
   */
  private async parseTranslationFile(filePath: string): Promise<TranslationFile | null> {
    try {
      const content = await FileUtils.readFile(filePath);
      if (!content) return null;
      
      const translations = JSON.parse(content);
      const language = this.extractLanguageFromPath(filePath);
      const keys = this.flattenTranslationKeys(translations);

      if (!language) {
        this.logger.debug(`Could not extract language from path: ${filePath}`);
        return null;
      }

      return {
        file: filePath,
        language,
        keyCount: keys.length,
        missingKeys: [] // Will be populated later
      };
    } catch (error) {
      this.logger.debug(`Failed to parse translation file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Analyze key consistency across all translation files
   */
  private analyzeKeyConsistency(translationFiles: TranslationFile[]): KeyConsistency {
    // Collect all unique keys
    const allKeys = new Set<string>();
    const fileKeyMap = new Map<string, Set<string>>();

    for (const tf of translationFiles) {
      try {
        const content = fs.readFileSync(tf.file, 'utf-8');
        const translations = JSON.parse(content);
        const keys = this.flattenTranslationKeys(translations);
        const keySet = new Set(keys);
        
        fileKeyMap.set(tf.file, keySet);
        keys.forEach(key => allKeys.add(key));
      } catch (error) {
        this.logger.warn(`Failed to re-read translation file ${tf.file}:`, error);
      }
    }

    // Update missing keys for each file
    for (const tf of translationFiles) {
      const fileKeys = fileKeyMap.get(tf.file) || new Set();
      tf.missingKeys = Array.from(allKeys).filter(key => !fileKeys.has(key));
    }

    // Determine consistent vs inconsistent keys
    const consistentKeys: string[] = [];
    const inconsistentKeys: string[] = [];

    for (const key of allKeys) {
      const filesWithKey = translationFiles.filter(tf => {
        const fileKeys = fileKeyMap.get(tf.file) || new Set();
        return fileKeys.has(key);
      });

      if (filesWithKey.length === translationFiles.length) {
        consistentKeys.push(key);
      } else {
        inconsistentKeys.push(key);
      }
    }

    return {
      consistentKeys,
      inconsistentKeys
    };
  }

  /**
   * Extract language from file path
   */
  private extractLanguageFromPath(filePath: string): string {
    // Extract language from directory structure: /path/to/locales/{language}/file.json
    const pathParts = filePath.split(path.sep);
    
    // Look for locales directory and get the next directory as language
    const localesIndex = pathParts.findIndex(part => 
      ['locales', 'i18n', 'lang', 'translations'].includes(part)
    );
    
    if (localesIndex !== -1 && localesIndex + 1 < pathParts.length) {
      const potentialLang = pathParts[localesIndex + 1];
      if (this.isValidLanguageCode(potentialLang)) {
        return potentialLang;
      }
    }
    
    // Fallback: try to extract from filename (legacy support)
    const fileName = path.basename(filePath, path.extname(filePath));
    const fileNameMatch = fileName.match(/([a-z]{2}(-[A-Z]{2})?)/);
    
    return fileNameMatch && this.isValidLanguageCode(fileNameMatch[1]) ? fileNameMatch[1] : '';
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

  /**
   * Flatten nested translation keys into dot notation
   */
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
   * Get translation files grouped by language
   */
  async getTranslationFilesByLanguage(targetPath: string): Promise<Map<string, TranslationFile[]>> {
    const translationFiles = await this.findAndParseTranslationFiles(targetPath);
    const byLanguage = new Map<string, TranslationFile[]>();

    for (const tf of translationFiles) {
      if (!byLanguage.has(tf.language)) {
        byLanguage.set(tf.language, []);
      }
      byLanguage.get(tf.language)!.push(tf);
    }

    return byLanguage;
  }

  /**
   * Get all translation keys for a specific language
   */
  async getKeysForLanguage(targetPath: string, language: string): Promise<string[]> {
    const filesByLanguage = await this.getTranslationFilesByLanguage(targetPath);
    const languageFiles = filesByLanguage.get(language) || [];
    
    const allKeys = new Set<string>();
    
    for (const tf of languageFiles) {
      try {
        const content = fs.readFileSync(tf.file, 'utf-8');
        const translations = JSON.parse(content);
        const keys = this.flattenTranslationKeys(translations);
        keys.forEach(key => allKeys.add(key));
      } catch (error) {
        this.logger.warn(`Failed to read keys from ${tf.file}:`, error);
      }
    }

    return Array.from(allKeys);
  }
}
