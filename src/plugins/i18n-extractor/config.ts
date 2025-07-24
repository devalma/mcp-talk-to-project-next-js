/**
 * Default configuration for I18n Extractor Plugin
 */

import type { I18nExtractorConfig } from './types.js';

export const DEFAULT_I18N_CONFIG: Omit<I18nExtractorConfig, 'filePatterns' | 'excludePatterns' | 'batchSize' | 'parallel'> = {
  translationFunctions: ['t', 'translate', '$t', 'i18n.t', 'i18next.t'],
  translationPatterns: ['t(', '{{', '{t(', 'translate('],
  minStringLength: 3,
  analyzeJSXText: true,
  analyzeStringLiterals: true,
  translationFilePatterns: [
    '**/src/locales/**/*.json',
    '**/public/locales/**/*.json', 
    '**/locales/**/*.json', 
    '**/i18n/**/*.json', 
    '**/lang/**/*.json'
  ],
  languages: ['en', 'es', 'fr', 'de'], // Fallback languages
};

export const DEFAULT_EXCLUDE_PATTERNS = [
  // URLs and protocols
  'http://', 'https://', 'ftp://', 'mailto:',
  // CSS and styling
  'rgb(', 'rgba(', '#', 'px', 'em', 'rem', '%',
  // JavaScript/TypeScript keywords and imports
  'import', 'export', 'from', 'require',
  // Browser APIs
  'console.', 'localStorage', 'sessionStorage',
  // HTML/React attributes
  'data-', 'aria-', 'className', 'id',
  // File extensions
  '.js', '.ts', '.jsx', '.tsx', '.css', '.json', '.html',
  // Environment variables
  'NODE_ENV', 'REACT_APP_', 'NEXT_PUBLIC_'
];

export const LANGUAGE_DETECTION_CONFIG = {
  // Directories to search for languages (relative to project root)
  localeBasePaths: [
    'src/locales',
    'public/locales',
    'locales',
    'i18n',
    'lang',
    'translations'
  ],
  
  // Config file patterns to search for language information
  configFilePatterns: [
    '**/i18n.{js,ts,json}',
    '**/i18next.{js,ts,json}', 
    '**/i18n-options.{js,ts,json}',
    '**/next.config.{js,ts}',
    '**/nuxt.config.{js,ts}',
    '**/package.json'
  ],
  
  // Directories to exclude from language detection
  excludeFromDetection: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/.next/**',
    '**/coverage/**'
  ],
  
  // Regex patterns to extract languages from config files
  configLanguagePatterns: [
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
  ]
};
