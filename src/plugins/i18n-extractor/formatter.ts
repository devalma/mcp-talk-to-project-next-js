/**
 * I18n Formatter - Formats i18n analysis results into different output formats
 */

import type { 
  I18nExtractionSummary, 
  CommonUntranslatedString,
  RecommendedAction
} from './types.js';

export type I18nFormat = 'text' | 'markdown' | 'json';

export class I18nFormatter {
  
  static format(data: I18nExtractionSummary, format: I18nFormat = 'text'): string {
    switch (format) {
      case 'markdown':
        return this.formatMarkdown(data);
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'text':
      default:
        return this.formatText(data);
    }
  }

  private static formatText(data: I18nExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('I18n Analysis Results');
    lines.push('='.repeat(20));
    lines.push('');
    
    // Summary Statistics
    lines.push('Summary:');
    lines.push(`  Total Files Analyzed: ${data.totalFiles}`);
    lines.push(`  Total Untranslated Strings: ${data.totalUntranslatedStrings}`);
    lines.push(`  Total Translation Usage: ${data.totalTranslationUsage}`);
    lines.push(`  Total Potential Issues: ${data.totalPotentialIssues}`);
    lines.push('');
    
    // Files Coverage
    lines.push('Translation Coverage:');
    lines.push(`  Files with translations: ${data.filesCoverage.withTranslations}`);
    lines.push(`  Files without translations: ${data.filesCoverage.withoutTranslations}`);
    lines.push(`  Partially translated files: ${data.filesCoverage.partiallyTranslated}`);
    
    if (data.totalFiles > 0) {
      const coveragePercent = ((data.filesCoverage.withTranslations + data.filesCoverage.partiallyTranslated) / data.totalFiles * 100).toFixed(1);
      lines.push(`  Translation coverage: ${coveragePercent}%`);
    }
    lines.push('');
    
    // Untranslated Strings by Type
    if (Object.keys(data.untranslatedStringsByType).length > 0) {
      lines.push('Untranslated Strings by Type:');
      Object.entries(data.untranslatedStringsByType).forEach(([type, count]) => {
        lines.push(`  ${type}: ${count}`);
      });
      lines.push('');
    }
    
    // Most Common Untranslated Strings
    if (data.mostCommonUntranslatedStrings.length > 0) {
      lines.push('Most Common Untranslated Strings:');
      data.mostCommonUntranslatedStrings.slice(0, 10).forEach((item: CommonUntranslatedString, index: number) => {
        lines.push(`  ${index + 1}. "${item.text}" (${item.count} occurrences)`);
        if (item.files.length <= 3) {
          lines.push(`     Files: ${item.files.map((f: string) => f.split('/').pop()).join(', ')}`);
        } else {
          lines.push(`     Files: ${item.files.slice(0, 2).map((f: string) => f.split('/').pop()).join(', ')} and ${item.files.length - 2} more`);
        }
      });
      lines.push('');
    }
    
    // Translation Keys Analysis
    if (data.translationKeys.totalKeys > 0) {
      lines.push('Translation Keys:');
      lines.push(`  Total unique keys used: ${data.translationKeys.totalKeys}`);
      
      if (data.translationKeys.usedKeys.length > 0) {
        lines.push('  Most used keys:');
        data.translationKeys.usedKeys.slice(0, 5).forEach((key: any) => {
          lines.push(`    "${key.key}": ${key.count} uses`);
        });
      }
      
      if (data.translationKeys.unusedKeys && data.translationKeys.unusedKeys.length > 0) {
        lines.push(`  Unused keys: ${data.translationKeys.unusedKeys.length}`);
        if (data.translationKeys.unusedKeys.length <= 5) {
          data.translationKeys.unusedKeys.forEach((key: string) => {
            lines.push(`    "${key}"`);
          });
        }
      }
      lines.push('');
    }
    
    // Missing Translations
    if (Object.keys(data.missingTranslations).length > 0) {
      lines.push('Missing Translations by Language:');
      Object.entries(data.missingTranslations).forEach(([key, languages]) => {
        if ((languages as string[]).length > 0) {
          lines.push(`  "${key}": missing in ${(languages as string[]).join(', ')}`);
        }
      });
      lines.push('');
    }
    
    // Translation Files Analysis
    if (data.translationFileAnalysis) {
      lines.push('Translation Files:');
      data.translationFileAnalysis.translationFiles.forEach((file: any) => {
        const fileName = file.file.split('/').pop();
        lines.push(`  ${fileName} (${file.language}): ${file.keyCount} keys`);
        if (file.missingKeys.length > 0) {
          lines.push(`    Missing ${file.missingKeys.length} keys`);
        }
      });
      
      if (data.translationFileAnalysis.keyConsistency.inconsistentKeys.length > 0) {
        lines.push('');
        lines.push(`Key Consistency Issues: ${data.translationFileAnalysis.keyConsistency.inconsistentKeys.length} inconsistent keys`);
      }
      lines.push('');
    }
    
    // Recommended Actions
    if (data.recommendedActions.length > 0) {
      lines.push('Recommended Actions:');
      data.recommendedActions.forEach((action: RecommendedAction, index: number) => {
        const priority = action.priority.toUpperCase();
        lines.push(`  ${index + 1}. [${priority}] ${action.action}`);
        lines.push(`     ${action.description}`);
        lines.push(`     Affected files: ${action.affectedFiles}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private static formatMarkdown(data: I18nExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('# I18n Analysis Results');
    lines.push('');
    
    // Summary Statistics
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Files Analyzed | ${data.totalFiles} |`);
    lines.push(`| Total Untranslated Strings | ${data.totalUntranslatedStrings} |`);
    lines.push(`| Total Translation Usage | ${data.totalTranslationUsage} |`);
    lines.push(`| Total Potential Issues | ${data.totalPotentialIssues} |`);
    lines.push('');
    
    // Translation Coverage
    lines.push('## Translation Coverage');
    lines.push('');
    lines.push('| Status | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Files with translations | ${data.filesCoverage.withTranslations} |`);
    lines.push(`| Files without translations | ${data.filesCoverage.withoutTranslations} |`);
    lines.push(`| Partially translated files | ${data.filesCoverage.partiallyTranslated} |`);
    
    if (data.totalFiles > 0) {
      const coveragePercent = ((data.filesCoverage.withTranslations + data.filesCoverage.partiallyTranslated) / data.totalFiles * 100).toFixed(1);
      lines.push(`| **Translation coverage** | **${coveragePercent}%** |`);
    }
    lines.push('');
    
    // Untranslated Strings by Type
    if (Object.keys(data.untranslatedStringsByType).length > 0) {
      lines.push('## Untranslated Strings by Type');
      lines.push('');
      lines.push('| Type | Count |');
      lines.push('|------|-------|');
      Object.entries(data.untranslatedStringsByType).forEach(([type, count]) => {
        lines.push(`| ${type} | ${count} |`);
      });
      lines.push('');
    }
    
    // Most Common Untranslated Strings
    if (data.mostCommonUntranslatedStrings.length > 0) {
      lines.push('## Most Common Untranslated Strings');
      lines.push('');
      lines.push('| Rank | String | Count | Files |');
      lines.push('|------|--------|-------|-------|');
      data.mostCommonUntranslatedStrings.slice(0, 10).forEach((item: CommonUntranslatedString, index: number) => {
        const truncatedText = item.text.length > 50 ? item.text.substring(0, 47) + '...' : item.text;
        const filesList = item.files.length <= 2 
          ? item.files.map((f: string) => f.split('/').pop()).join(', ')
          : `${item.files.slice(0, 2).map((f: string) => f.split('/').pop()).join(', ')} (+${item.files.length - 2})`;
        lines.push(`| ${index + 1} | \`${truncatedText}\` | ${item.count} | ${filesList} |`);
      });
      lines.push('');
    }
    
    // Translation Keys
    if (data.translationKeys.totalKeys > 0) {
      lines.push('## Translation Keys Analysis');
      lines.push('');
      lines.push(`**Total unique keys used:** ${data.translationKeys.totalKeys}`);
      lines.push('');
      
      if (data.translationKeys.usedKeys.length > 0) {
        lines.push('### Most Used Keys');
        lines.push('');
        lines.push('| Key | Usage Count |');
        lines.push('|-----|-------------|');
        data.translationKeys.usedKeys.slice(0, 10).forEach((key: any) => {
          lines.push(`| \`${key.key}\` | ${key.count} |`);
        });
        lines.push('');
      }
      
      if (data.translationKeys.unusedKeys && data.translationKeys.unusedKeys.length > 0) {
        lines.push(`### Unused Keys`);
        lines.push('');
        lines.push(`Found **${data.translationKeys.unusedKeys.length}** unused translation keys.`);
        lines.push('');
      }
    }
    
    // Translation Files Analysis
    if (data.translationFileAnalysis) {
      lines.push('## Translation Files');
      lines.push('');
      lines.push('| File | Language | Keys | Missing Keys |');
      lines.push('|------|----------|------|--------------|');
      data.translationFileAnalysis.translationFiles.forEach((file: any) => {
        const fileName = file.file.split('/').pop();
        lines.push(`| ${fileName} | ${file.language} | ${file.keyCount} | ${file.missingKeys.length} |`);
      });
      
      if (data.translationFileAnalysis.keyConsistency.inconsistentKeys.length > 0) {
        lines.push('');
        lines.push(`### ⚠️ Key Consistency Issues`);
        lines.push('');
        lines.push(`**${data.translationFileAnalysis.keyConsistency.inconsistentKeys.length}** keys are not consistent across all language files.`);
        lines.push('');
      }
    }
    
    // Recommended Actions
    if (data.recommendedActions.length > 0) {
      lines.push('## 🔧 Recommended Actions');
      lines.push('');
      data.recommendedActions.forEach((action: RecommendedAction, index: number) => {
        const priority = action.priority === 'high' ? '🔴' : action.priority === 'medium' ? '🟡' : '🟢';
        lines.push(`### ${index + 1}. ${priority} ${action.action}`);
        lines.push('');
        lines.push(action.description);
        lines.push('');
        lines.push(`**Affected files:** ${action.affectedFiles}`);
        lines.push('');
      });
    }
    
    return lines.join('\n');
  }
}
