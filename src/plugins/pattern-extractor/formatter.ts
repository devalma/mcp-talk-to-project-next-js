/**
 * Pattern extractor formatter for different output formats
 */

import type { PatternExtractionSummary, PatternAnalysisResult } from './plugin.js';

export type PatternFormat = 'text' | 'markdown' | 'json';

export class PatternFormatter {
  
  static format(data: PatternExtractionSummary, format: PatternFormat = 'text'): string {
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

  private static formatText(data: PatternExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Pattern Analysis Results');
    lines.push('='.repeat(23));
    lines.push('');
    
    // Summary Statistics
    lines.push('Summary:');
    lines.push(`  Total Files Analyzed: ${data.totalFiles}`);
    const totalPatterns = Object.values(data.patternsByType).reduce((sum, count) => sum + count, 0);
    lines.push(`  Total Patterns Found: ${totalPatterns}`);
    lines.push('');
    
    // Patterns by Type
    if (Object.keys(data.patternsByType).length > 0) {
      lines.push('Patterns by Type:');
      Object.entries(data.patternsByType).forEach(([type, count]) => {
        lines.push(`  ${type}: ${count}`);
      });
      lines.push('');
    }
    
    // Most Common Patterns
    if (data.mostCommonPatterns.length > 0) {
      lines.push('Most Common Patterns:');
      data.mostCommonPatterns.forEach((pattern, index) => {
        lines.push(`  ${index + 1}. ${pattern.type} (${pattern.count} occurrences)`);
      });
      lines.push('');
    }
    
    // Context Usage
    if (data.contextUsage) {
      lines.push('Context Usage:');
      lines.push(`  Total Providers: ${data.contextUsage.totalProviders}`);
      lines.push(`  Total Consumers: ${data.contextUsage.totalConsumers}`);
      lines.push(`  Average Consumers per Provider: ${data.contextUsage.averageConsumersPerProvider.toFixed(1)}`);
      lines.push('');
    }
    
    // Anti-patterns Found
    if (data.antiPatternsFound > 0) {
      lines.push(`⚠️  Anti-patterns Found: ${data.antiPatternsFound}`);
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private static formatMarkdown(data: PatternExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('# Pattern Analysis Results');
    lines.push('');
    
    // Summary Statistics
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Files Analyzed | ${data.totalFiles} |`);
    const totalPatterns = Object.values(data.patternsByType).reduce((sum, count) => sum + count, 0);
    lines.push(`| Total Patterns Found | ${totalPatterns} |`);
    lines.push(`| Anti-patterns Found | ${data.antiPatternsFound} |`);
    lines.push('');
    
    // Patterns by Type
    if (Object.keys(data.patternsByType).length > 0) {
      lines.push('## Patterns by Type');
      lines.push('');
      lines.push('| Pattern Type | Count |');
      lines.push('|--------------|-------|');
      Object.entries(data.patternsByType).forEach(([type, count]) => {
        lines.push(`| ${type} | ${count} |`);
      });
      lines.push('');
    }
    
    // Most Common Patterns
    if (data.mostCommonPatterns.length > 0) {
      lines.push('## Most Common Patterns');
      lines.push('');
      lines.push('| Rank | Pattern Type | Occurrences |');
      lines.push('|------|--------------|-------------|');
      data.mostCommonPatterns.forEach((pattern, index) => {
        lines.push(`| ${index + 1} | \`${pattern.type}\` | ${pattern.count} |`);
      });
      lines.push('');
    }
    
    // Context Usage
    if (data.contextUsage) {
      lines.push('## Context Usage');
      lines.push('');
      lines.push('| Metric | Count |');
      lines.push('|--------|-------|');
      lines.push(`| Total Providers | ${data.contextUsage.totalProviders} |`);
      lines.push(`| Total Consumers | ${data.contextUsage.totalConsumers} |`);
      lines.push(`| Average Consumers per Provider | ${data.contextUsage.averageConsumersPerProvider.toFixed(1)} |`);
      lines.push('');
    }
    
    // Anti-patterns Warning
    if (data.antiPatternsFound > 0) {
      lines.push('## ⚠️ Anti-patterns Found');
      lines.push('');
      lines.push(`**${data.antiPatternsFound}** anti-patterns were detected in the codebase. Consider reviewing these for potential improvements.`);
      lines.push('');
    }
    
    return lines.join('\n');
  }
}
