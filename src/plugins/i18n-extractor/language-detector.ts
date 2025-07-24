/**
 * Language Detection Module - Detects available languages in i18n projects
 */

import * as path from 'path';
import { FileUtils } from '../common/file-utils.js';
import { PluginLogger } from '../common/logger.js';
import { LANGUAGE_DETECTION_CONFIG } from './config.js';
import type { LanguageDetectionResult, I18nConfigFile } from './types.js';

export class LanguageDetector {
  private logger: PluginLogger;

  constructor() {
    this.logger = new PluginLogger('language-detector');
  }

  /**
   * Detect languages in a project before analysis starts
   */
  async detectProjectLanguages(projectPath: string): Promise<LanguageDetectionResult> {
    this.logger.info(`Starting language detection for: ${projectPath}`);
    
    const languages = new Set<string>();
    const detectionMethods: string[] = [];
    const configFiles: string[] = [];
    const localeDirectories: string[] = [];

    try {
      // Method 1: Check directory structure
      const directoryLanguages = await this.detectFromDirectoryStructure(projectPath);
      if (directoryLanguages.length > 0) {
        directoryLanguages.forEach(lang => languages.add(lang));
        detectionMethods.push('directory-structure');
        this.logger.debug(`Found languages from directories: ${directoryLanguages.join(', ')}`);
      }

      // Method 2: Parse configuration files
      const configResult = await this.detectFromConfigFiles(projectPath);
      if (configResult.languages.length > 0) {
        configResult.languages.forEach(lang => languages.add(lang));
        detectionMethods.push('config-files');
        configFiles.push(...configResult.configFiles);
        this.logger.debug(`Found languages from config: ${configResult.languages.join(', ')}`);
      }

      // Method 3: Analyze translation file patterns
      const filePatternLanguages = await this.detectFromTranslationFiles(projectPath);
      if (filePatternLanguages.length > 0) {
        filePatternLanguages.forEach(lang => languages.add(lang));
        if (!detectionMethods.includes('directory-structure')) {
          detectionMethods.push('translation-files');
        }
        this.logger.debug(`Found languages from translation files: ${filePatternLanguages.join(', ')}`);
      }

      const result: LanguageDetectionResult = {
        languages: Array.from(languages).sort(),
        detectionMethods,
        configFiles,
        localeDirectories
      };

      this.logger.info(`Language detection complete. Found: ${result.languages.join(', ')}`);
      return result;

    } catch (error) {
      this.logger.error('Language detection failed:', error);
      return {
        languages: [],
        detectionMethods: [],
        configFiles: [],
        localeDirectories: []
      };
    }
  }

  /**
   * Detect languages from directory structure (most reliable method)
   */
  private async detectFromDirectoryStructure(projectPath: string): Promise<string[]> {
    const languages = new Set<string>();

    for (const basePath of LANGUAGE_DETECTION_CONFIG.localeBasePaths) {
      try {
        const fullPath = path.join(projectPath, basePath);
        
        if (await FileUtils.isDirectory(fullPath)) {
          this.logger.debug(`Checking locale directory: ${fullPath}`);
          
          const entries = await FileUtils.readDirectory(fullPath);
          for (const entry of entries) {
            const entryPath = path.join(fullPath, entry);
            
            if (await FileUtils.isDirectory(entryPath)) {
              if (this.isValidLanguageCode(entry)) {
                languages.add(entry);
                this.logger.debug(`Found language directory: ${entry}`);
              }
            }
          }
        }
      } catch (error) {
        this.logger.debug(`Failed to check directory ${basePath}:`, error);
      }
    }

    return Array.from(languages);
  }

  /**
   * Detect languages from configuration files
   */
  private async detectFromConfigFiles(projectPath: string): Promise<{ languages: string[]; configFiles: string[] }> {
    const languages = new Set<string>();
    const configFiles: string[] = [];

    for (const pattern of LANGUAGE_DETECTION_CONFIG.configFilePatterns) {
      try {
        const files = await FileUtils.findFiles(pattern, {
          cwd: projectPath,
          ignore: LANGUAGE_DETECTION_CONFIG.excludeFromDetection
        });

        for (const file of files) {
          try {
            const configInfo = await this.parseConfigFile(file);
            if (configInfo.isValid && configInfo.languages.length > 0) {
              configInfo.languages.forEach(lang => languages.add(lang));
              configFiles.push(file);
              this.logger.debug(`Found languages in ${file}: ${configInfo.languages.join(', ')}`);
            }
          } catch (error) {
            this.logger.debug(`Failed to parse config file ${file}:`, error);
          }
        }
      } catch (error) {
        this.logger.debug(`Failed to find files with pattern ${pattern}:`, error);
      }
    }

    return {
      languages: Array.from(languages),
      configFiles
    };
  }

  /**
   * Detect languages from translation file paths
   */
  private async detectFromTranslationFiles(projectPath: string): Promise<string[]> {
    const languages = new Set<string>();

    const translationPatterns = [
      '**/src/locales/**/*.json',
      '**/public/locales/**/*.json',
      '**/locales/**/*.json'
    ];

    for (const pattern of translationPatterns) {
      try {
        const files = await FileUtils.findFiles(pattern, {
          cwd: projectPath,
          ignore: LANGUAGE_DETECTION_CONFIG.excludeFromDetection
        });

        for (const file of files) {
          const language = this.extractLanguageFromPath(file);
          if (this.isValidLanguageCode(language)) {
            languages.add(language);
          }
        }
      } catch (error) {
        this.logger.debug(`Failed to find translation files with pattern ${pattern}:`, error);
      }
    }

    return Array.from(languages);
  }

  /**
   * Parse a configuration file to extract language information
   */
  private async parseConfigFile(filePath: string): Promise<I18nConfigFile> {
    const content = await FileUtils.readFile(filePath);
    if (!content) {
      return { path: filePath, type: 'json', languages: [], isValid: false };
    }

    const fileType = this.getConfigFileType(filePath);
    const languages = this.extractLanguagesFromConfigContent(content, filePath);

    return {
      path: filePath,
      type: fileType,
      languages,
      isValid: languages.length > 0
    };
  }

  /**
   * Extract language codes from configuration file content
   */
  private extractLanguagesFromConfigContent(content: string, filePath: string): string[] {
    const languages: string[] = [];
    
    try {
      for (const pattern of LANGUAGE_DETECTION_CONFIG.configLanguagePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1]) {
            if (match[1].includes(',')) {
              // Array of languages: ['en', 'es', 'fr']
              const arrayLangs = match[1]
                .split(',')
                .map(s => s.trim().replace(/['"]/g, ''))
                .filter(s => s && this.isValidLanguageCode(s));
              languages.push(...arrayLangs);
            } else {
              // Single language: 'en'
              const singleLang = match[1].trim().replace(/['"]/g, '');
              if (this.isValidLanguageCode(singleLang)) {
                languages.push(singleLang);
              }
            }
          }
        }
      }

      // Special handling for package.json
      if (filePath.endsWith('package.json')) {
        const packageLanguages = this.extractLanguagesFromPackageJson(content);
        languages.push(...packageLanguages);
      }

    } catch (error) {
      this.logger.debug(`Failed to extract languages from ${filePath}:`, error);
    }

    return [...new Set(languages)]; // Remove duplicates
  }

  /**
   * Extract languages from package.json (scripts, dependencies, etc.)
   */
  private extractLanguagesFromPackageJson(content: string): string[] {
    const languages: string[] = [];
    
    try {
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      // If they have i18n libraries, look for language patterns in scripts
      if (deps['react-i18next'] || deps['i18next'] || deps['next-i18next']) {
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

    return languages;
  }

  /**
   * Extract language from file path (fallback method)
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
    
    return fileNameMatch ? fileNameMatch[1] : '';
  }

  /**
   * Get the type of configuration file
   */
  private getConfigFileType(filePath: string): 'js' | 'ts' | 'json' {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.js': return 'js';
      case '.ts': return 'ts';
      case '.json': return 'json';
      default: return 'json';
    }
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
   * Quick language detection for CLI usage
   */
  static async quickDetect(projectPath: string): Promise<string[]> {
    const detector = new LanguageDetector();
    const result = await detector.detectProjectLanguages(projectPath);
    return result.languages;
  }
}
