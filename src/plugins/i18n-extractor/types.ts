/**
 * Type definitions for I18n Extractor Plugin
 */

import type { ExtractorConfig } from '../common/base-extractor.js';

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
  /** Include JSX attribute analysis (default: true) */
  analyzeJSXAttributes?: boolean;
  /** Include string literals analysis (default: true) */
  analyzeStringLiterals?: boolean;
  /** Translation file patterns to check */
  translationFilePatterns?: string[];
  /** Languages to check for missing keys */
  languages?: string[];
  /** Exclude certain strings (URLs, technical terms, etc.) */
  excludePatterns?: string[];
}

// Result types for i18n extraction
export interface UntranslatedString {
  text: string;
  type: 'jsx-text' | 'jsx-attribute' | 'variable-declaration' | 'string-literal' | 'template-literal' | 'object-property' | 'form-validation' | 'component-prop' | 'alert-message';
  line: number;
  column: number;
  context?: string; // surrounding code context
  isLikelyTranslatable: boolean;
  suggestedKey?: string;
}

export interface TranslationUsage {
  functionName: string;
  key: string;
  line: number;
  column: number;
  defaultValue?: string;
}

export interface I18nIssue {
  type: 'hardcoded-string' | 'missing-translation-call' | 'untranslated-jsx' | 'dynamic-key';
  description: string;
  line: number;
  suggestion: string;
}

export interface I18nAnalysisResult {
  filePath: string;
  untranslatedStrings: UntranslatedString[];
  translationUsage: TranslationUsage[];
  potentialIssues: I18nIssue[];
}

export interface TranslationFile {
  file: string;
  language: string;
  keyCount: number;
  missingKeys: string[];
}

export interface KeyConsistency {
  consistentKeys: string[];
  inconsistentKeys: string[];
}

export interface TranslationFileAnalysis {
  translationFiles: TranslationFile[];
  keyConsistency: KeyConsistency;
}

export interface FilesCoverage {
  withTranslations: number;
  withoutTranslations: number;
  partiallyTranslated: number;
}

export interface CommonUntranslatedString {
  text: string;
  count: number;
  files: string[];
}

export interface TranslationKeyUsage {
  key: string;
  count: number;
  files: string[];
}

export interface TranslationKeysAnalysis {
  totalKeys: number;
  usedKeys: TranslationKeyUsage[];
  unusedKeys?: string[];
}

export interface RecommendedAction {
  priority: 'high' | 'medium' | 'low';
  action: string;
  description: string;
  affectedFiles: number;
}

export interface I18nExtractionSummary {
  totalFiles: number;
  totalUntranslatedStrings: number;
  totalTranslationUsage: number;
  totalPotentialIssues: number;
  filesCoverage: FilesCoverage;
  untranslatedStringsByType: {
    [key: string]: number;
  };
  mostCommonUntranslatedStrings: CommonUntranslatedString[];
  translationKeys: TranslationKeysAnalysis;
  missingTranslations: {
    [language: string]: string[];
  };
  recommendedActions: RecommendedAction[];
  translationFileAnalysis?: TranslationFileAnalysis;
}

// Language detection types
export interface LanguageDetectionResult {
  languages: string[];
  detectionMethods: string[];
  configFiles: string[];
  localeDirectories: string[];
}

export interface I18nConfigFile {
  path: string;
  type: 'js' | 'ts' | 'json';
  languages: string[];
  isValid: boolean;
}
