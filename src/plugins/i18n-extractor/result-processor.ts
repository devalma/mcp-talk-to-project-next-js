/**
 * Result Processor - Aggregates and formats i18n analysis results
 */

import { PluginLogger } from '../common/logger.js';
import { I18nFormatter } from './formatter.js';
import type { 
  I18nAnalysisResult,
  I18nExtractionSummary,
  UntranslatedString,
  TranslationUsage,
  TranslationFileAnalysis,
  FilesCoverage,
  CommonUntranslatedString,
  TranslationKeysAnalysis,
  RecommendedAction
} from './types.js';

export class ResultProcessor {
  private logger: PluginLogger;

  constructor() {
    this.logger = new PluginLogger('result-processor');
  }

  /**
   * Aggregate file analysis results into a comprehensive summary
   */
  async aggregateResults(
    results: I18nAnalysisResult[], 
    translationFileAnalysis: TranslationFileAnalysis
  ): Promise<I18nExtractionSummary> {
    this.logger.info(`Processing results from ${results.length} files`);

    const allUntranslatedStrings = results.flatMap(r => r.untranslatedStrings);
    const allTranslationUsage = results.flatMap(r => r.translationUsage);
    const allPotentialIssues = results.flatMap(r => r.potentialIssues);

    // Calculate various metrics
    const filesCoverage = this.calculateFilesCoverage(results);
    const untranslatedStringsByType = this.groupStringsByType(allUntranslatedStrings);
    const mostCommonUntranslatedStrings = this.findMostCommonStrings(allUntranslatedStrings, results);
    const translationKeys = this.analyzeTranslationKeyUsage(allTranslationUsage, translationFileAnalysis);
    const missingTranslations = this.calculateMissingTranslations(translationFileAnalysis);
    const recommendedActions = this.generateRecommendations(results, translationFileAnalysis);

    const summary: I18nExtractionSummary = {
      totalFiles: results.length,
      totalUntranslatedStrings: allUntranslatedStrings.length,
      totalTranslationUsage: allTranslationUsage.length,
      totalPotentialIssues: allPotentialIssues.length,
      filesCoverage,
      untranslatedStringsByType,
      mostCommonUntranslatedStrings,
      translationKeys,
      missingTranslations,
      recommendedActions,
      translationFileAnalysis
    };

    this.logger.info(`Analysis complete: ${allUntranslatedStrings.length} untranslated strings, ${allTranslationUsage.length} translation calls`);

    return summary;
  }

  /**
   * Calculate files coverage statistics
   */
  private calculateFilesCoverage(results: I18nAnalysisResult[]): FilesCoverage {
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

  /**
   * Group untranslated strings by type
   */
  private groupStringsByType(strings: UntranslatedString[]): { [key: string]: number } {
    const groups: { [key: string]: number } = {};
    strings.forEach(s => {
      groups[s.type] = (groups[s.type] || 0) + 1;
    });
    return groups;
  }

  /**
   * Find most common untranslated strings across files
   */
  private findMostCommonStrings(
    strings: UntranslatedString[], 
    results: I18nAnalysisResult[]
  ): CommonUntranslatedString[] {
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

  /**
   * Analyze translation key usage
   */
  private analyzeTranslationKeyUsage(
    usage: TranslationUsage[],
    translationFileAnalysis: TranslationFileAnalysis
  ): TranslationKeysAnalysis {
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
      unusedKeys: translationFileAnalysis.keyConsistency.consistentKeys.filter(
        key => !keyUsage.has(key)
      )
    };
  }

  /**
   * Calculate missing translations by language
   */
  private calculateMissingTranslations(translationFileAnalysis: TranslationFileAnalysis): { [language: string]: string[] } {
    const missingByLanguage: { [language: string]: string[] } = {};

    // Group files by language
    const filesByLanguage = new Map<string, typeof translationFileAnalysis.translationFiles[0][]>();
    translationFileAnalysis.translationFiles.forEach(tf => {
      if (!filesByLanguage.has(tf.language)) {
        filesByLanguage.set(tf.language, []);
      }
      filesByLanguage.get(tf.language)!.push(tf);
    });

    // For each inconsistent key, find which languages are missing it
    translationFileAnalysis.keyConsistency.inconsistentKeys.forEach(key => {
      const languagesWithKey = new Set<string>();
      
      translationFileAnalysis.translationFiles.forEach(tf => {
        if (!tf.missingKeys.includes(key)) {
          languagesWithKey.add(tf.language);
        }
      });

      // Languages that don't have this key
      const allLanguages = Array.from(filesByLanguage.keys());
      const missingLanguages = allLanguages.filter(lang => !languagesWithKey.has(lang));
      
      missingLanguages.forEach(lang => {
        if (!missingByLanguage[lang]) {
          missingByLanguage[lang] = [];
        }
        missingByLanguage[lang].push(key);
      });
    });

    return missingByLanguage;
  }

  /**
   * Generate recommendations based on analysis results
   */
  private generateRecommendations(
    results: I18nAnalysisResult[],
    translationFileAnalysis: TranslationFileAnalysis
  ): RecommendedAction[] {
    const recommendations: RecommendedAction[] = [];

    // Count files with issues
    const filesWithUntranslatedStrings = results.filter(r => 
      r.untranslatedStrings.filter(s => s.isLikelyTranslatable).length > 0
    ).length;

    const filesWithoutTranslations = results.filter(r => 
      r.translationUsage.length === 0 && 
      r.untranslatedStrings.filter(s => s.isLikelyTranslatable).length > 0
    ).length;

    const totalUntranslatedStrings = results.reduce((sum, r) => 
      sum + r.untranslatedStrings.filter(s => s.isLikelyTranslatable).length, 0
    );

    // High priority recommendations
    if (filesWithUntranslatedStrings > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Add missing translations',
        description: `${filesWithUntranslatedStrings} files contain ${totalUntranslatedStrings} untranslated strings`,
        affectedFiles: filesWithUntranslatedStrings
      });
    }

    // Medium priority recommendations
    if (filesWithoutTranslations > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Implement i18n in untranslated files',
        description: `${filesWithoutTranslations} files have no translation implementation`,
        affectedFiles: filesWithoutTranslations
      });
    }

    if (translationFileAnalysis.keyConsistency.inconsistentKeys.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Fix translation key consistency',
        description: `${translationFileAnalysis.keyConsistency.inconsistentKeys.length} keys are missing in some language files`,
        affectedFiles: translationFileAnalysis.translationFiles.length
      });
    }

    // Low priority recommendations
    const dynamicKeys = results.reduce((sum, r) => 
      sum + r.translationUsage.filter(t => t.key.includes('${') || t.key.includes('+')).length, 0
    );

    if (dynamicKeys > 0) {
      recommendations.push({
        priority: 'low',
        action: 'Review dynamic translation keys',
        description: `${dynamicKeys} dynamic keys found which are harder to track`,
        affectedFiles: results.filter(r => 
          r.translationUsage.some(t => t.key.includes('${') || t.key.includes('+'))
        ).length
      });
    }

    return recommendations;
  }

  /**
   * Format the analysis results according to specified format
   */
  formatResults(data: I18nExtractionSummary, format: 'text' | 'markdown' | 'json' = 'text'): string {
    return I18nFormatter.format(data, format);
  }

  /**
   * Generate a simple summary for quick overview
   */
  generateQuickSummary(data: I18nExtractionSummary): string {
    const coverage = data.totalFiles > 0 
      ? ((data.filesCoverage.withTranslations / data.totalFiles) * 100).toFixed(1)
      : '0.0';

    return [
      `📊 I18n Analysis Summary`,
      `• Files analyzed: ${data.totalFiles}`,
      `• Untranslated strings: ${data.totalUntranslatedStrings}`,
      `• Translation calls: ${data.totalTranslationUsage}`,
      `• Translation coverage: ${coverage}%`,
      `• Languages: ${data.translationFileAnalysis?.translationFiles.length || 0}`,
      `• Key inconsistencies: ${data.translationFileAnalysis?.keyConsistency.inconsistentKeys.length || 0}`,
      `• Priority actions: ${data.recommendedActions.filter(a => a.priority === 'high').length}`
    ].join('\n');
  }
}
