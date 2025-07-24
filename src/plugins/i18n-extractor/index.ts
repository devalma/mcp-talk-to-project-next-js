/**
 * I18n Extractor Plugin - Modular exports
 */

// Main plugin class
export { I18nExtractorPlugin } from './plugin-new.js';

// Modular components (can be used independently)
export { LanguageDetector } from './language-detector.js';
export { ASTAnalyzer } from './ast-analyzer.js';
export { TranslationFileAnalyzer } from './translation-file-analyzer.js';
export { ResultProcessor } from './result-processor.js';

// Configuration and types
export { DEFAULT_I18N_CONFIG, DEFAULT_EXCLUDE_PATTERNS, LANGUAGE_DETECTION_CONFIG } from './config.js';
export type {
  I18nExtractorConfig,
  I18nAnalysisResult,
  I18nExtractionSummary,
  UntranslatedString,
  TranslationUsage,
  I18nIssue,
  TranslationFile,
  TranslationFileAnalysis,
  LanguageDetectionResult,
  I18nConfigFile
} from './types.js';

// Formatter
export { I18nFormatter, type I18nFormat } from './formatter.js';

// Plugin factory function
import { I18nExtractorPlugin } from './plugin-new.js';
import type { I18nExtractorConfig } from './types.js';

export function createI18nExtractorPlugin(config?: I18nExtractorConfig) {
  return new I18nExtractorPlugin(config);
}

// Plugin metadata for registration
export const I18N_EXTRACTOR_PLUGIN = {
  name: 'i18n-extractor',
  version: '1.0.0',
  description: 'I18n analyzer using modular DRY architecture',
  factory: createI18nExtractorPlugin
} as const;
