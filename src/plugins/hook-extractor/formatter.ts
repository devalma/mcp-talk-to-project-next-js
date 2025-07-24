/**
 * Hook extractor formatter for different output formats
 */

import type { HookExtractionSummary, HookAnalysisResult } from './plugin.js';

export type HookFormat = 'text' | 'markdown' | 'json';

export class HookFormatter {
  
  static format(data: HookExtractionSummary, format: HookFormat = 'text'): string {
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

  private static formatText(data: HookExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Hook Analysis Results');
    lines.push('='.repeat(20));
    lines.push('');
    
    // Summary Statistics
    lines.push('Summary:');
    lines.push(`  Total Files Analyzed: ${data.totalFiles}`);
    lines.push(`  Total Custom Hooks: ${data.totalCustomHooks}`);
    lines.push(`  Total Hook Usage: ${data.totalHookUsage}`);
    lines.push(`  Rule Violations: ${data.ruleViolations}`);
    lines.push(`  Files with Violations: ${data.filesWithViolations}`);
    lines.push('');
    
    // Most Used Hooks
    if (data.mostUsedHooks.length > 0) {
      lines.push('Most Used Hooks:');
      data.mostUsedHooks.forEach((hook, index) => {
        const typeLabel = hook.type === 'builtin' ? '(built-in)' : '(custom)';
        lines.push(`  ${index + 1}. ${hook.name} ${typeLabel} - used ${hook.count} times`);
      });
      lines.push('');
    }
    
    // Hooks by File
    if (data.hooksByFile.length > 0) {
      lines.push('Hooks by File:');
      data.hooksByFile.forEach(item => {
        lines.push(`  ${item.file}:`);
        
        // Custom hooks with names
        if (item.customHooks > 0) {
          const hookNames = item.customHookNames.length > 0 ? ` (${item.customHookNames.join(', ')})` : '';
          lines.push(`    Custom Hooks: ${item.customHooks}${hookNames}`);
        } else {
          lines.push(`    Custom Hooks: ${item.customHooks}`);
        }
        
        // Hook usage with names
        if (item.usage > 0) {
          const usageNames = item.usageHookNames.length > 0 ? ` (${item.usageHookNames.join(', ')})` : '';
          lines.push(`    Hook Usage: ${item.usage}${usageNames}`);
        } else {
          lines.push(`    Hook Usage: ${item.usage}`);
        }
      });
      lines.push('');
    }
    
    // Custom Hooks Details
    if (data.customHooksList.length > 0) {
      lines.push('Custom Hooks:');
      data.customHooksList.forEach(hook => {
        const exportLabel = hook.isExported ? 'exported' : 'local';
        const paramsLabel = hook.params.length > 0 ? ` (${hook.params.join(', ')})` : '';
        lines.push(`  ${hook.name}${paramsLabel} (${exportLabel})`);
        lines.push(`    File: ${hook.file}`);
      });
      lines.push('');
    }
    
    // Hook Usage Details (Top 10)
    if (data.hookUsageDetails.length > 0) {
      lines.push('Hook Usage Details (Top 10):');
      const topUsage = data.hookUsageDetails.slice(0, 10);
      topUsage.forEach(usage => {
        const typeLabel = usage.type === 'builtin' ? '(built-in)' : '(custom)';
        const componentLabel = usage.component ? ` in ${usage.component}` : '';
        const lineLabel = usage.line ? ` at line ${usage.line}` : '';
        lines.push(`  ${usage.hookName} ${typeLabel}${componentLabel}${lineLabel}`);
        lines.push(`    File: ${usage.file}`);
      });
      lines.push('');
    }
    
    // Rule Violations
    if (data.violations.length > 0) {
      lines.push('⚠️  Rule Violations:');
      data.violations.forEach(violation => {
        const lineLabel = violation.line ? ` (line ${violation.line})` : '';
        lines.push(`  ${violation.violation} - ${violation.hookName}${lineLabel}`);
        lines.push(`    File: ${violation.file}`);
        lines.push(`    Suggestion: ${violation.suggestion}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private static formatMarkdown(data: HookExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('# Hook Analysis Results');
    lines.push('');
    
    // Summary Statistics
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Files Analyzed | ${data.totalFiles} |`);
    lines.push(`| Total Custom Hooks | ${data.totalCustomHooks} |`);
    lines.push(`| Total Hook Usage | ${data.totalHookUsage} |`);
    lines.push(`| Rule Violations | ${data.ruleViolations} |`);
    lines.push(`| Files with Violations | ${data.filesWithViolations} |`);
    lines.push('');
    
    // Most Used Hooks
    if (data.mostUsedHooks.length > 0) {
      lines.push('## Most Used Hooks');
      lines.push('');
      lines.push('| Rank | Hook Name | Type | Usage Count |');
      lines.push('|------|-----------|------|-------------|');
      data.mostUsedHooks.forEach((hook, index) => {
        const typeLabel = hook.type === 'builtin' ? 'Built-in' : 'Custom';
        lines.push(`| ${index + 1} | \`${hook.name}\` | ${typeLabel} | ${hook.count} |`);
      });
      lines.push('');
    }
    
    // Hooks by File
    if (data.hooksByFile.length > 0) {
      lines.push('## Hooks by File');
      lines.push('');
      lines.push('| File | Custom Hooks | Hook Usage |');
      lines.push('|------|--------------|------------|');
      data.hooksByFile.forEach(item => {
        const customHooksDisplay = item.customHooks > 0 && item.customHookNames.length > 0 
          ? `${item.customHooks} (${item.customHookNames.join(', ')})` 
          : item.customHooks.toString();
        
        const usageDisplay = item.usage > 0 && item.usageHookNames.length > 0 
          ? `${item.usage} (${item.usageHookNames.join(', ')})` 
          : item.usage.toString();
          
        lines.push(`| \`${item.file}\` | ${customHooksDisplay} | ${usageDisplay} |`);
      });
      lines.push('');
    }
    
    // Custom Hooks Details
    if (data.customHooksList.length > 0) {
      lines.push('## Custom Hooks');
      lines.push('');
      lines.push('| Hook Name | Export | Parameters | File |');
      lines.push('|-----------|--------|------------|------|');
      data.customHooksList.forEach(hook => {
        const exportLabel = hook.isExported ? 'Exported' : 'Local';
        const paramsLabel = hook.params.length > 0 ? hook.params.join(', ') : '—';
        lines.push(`| \`${hook.name}\` | ${exportLabel} | ${paramsLabel} | \`${hook.file}\` |`);
      });
      lines.push('');
    }
    
    // Hook Usage Details
    if (data.hookUsageDetails.length > 0) {
      lines.push('## Hook Usage Details');
      lines.push('');
      lines.push('| Hook Name | Type | Component | File | Line |');
      lines.push('|-----------|------|-----------|------|------|');
      data.hookUsageDetails.slice(0, 15).forEach(usage => {
        const typeLabel = usage.type === 'builtin' ? 'Built-in' : 'Custom';
        const componentLabel = usage.component || '—';
        const lineLabel = usage.line ? usage.line.toString() : '—';
        lines.push(`| \`${usage.hookName}\` | ${typeLabel} | ${componentLabel} | \`${usage.file}\` | ${lineLabel} |`);
      });
      lines.push('');
    }
    
    // Rule Violations
    if (data.violations.length > 0) {
      lines.push('## ⚠️ Rule Violations');
      lines.push('');
      lines.push('| Violation | Hook | File | Line | Suggestion |');
      lines.push('|-----------|------|------|------|------------|');
      data.violations.forEach(violation => {
        const lineLabel = violation.line ? violation.line.toString() : '—';
        lines.push(`| ${violation.violation} | \`${violation.hookName}\` | \`${violation.file}\` | ${lineLabel} | ${violation.suggestion} |`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }
}
