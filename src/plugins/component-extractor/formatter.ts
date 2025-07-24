/**
 * Component extractor formatter for different output formats
 */

import type { ComponentExtractionSummary, ComponentAnalysisResult } from './plugin.js';

export type ComponentFormat = 'text' | 'markdown' | 'json';

export class ComponentFormatter {
  
  static format(data: ComponentExtractionSummary, format: ComponentFormat = 'text'): string {
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

  private static formatText(data: ComponentExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Component Analysis Results');
    lines.push('='.repeat(25));
    lines.push('');
    
    // Summary Statistics
    lines.push('Summary:');
    lines.push(`  Total Files Analyzed: ${data.totalFiles}`);
    lines.push(`  Total Components: ${data.totalComponents}`);
    lines.push(`  - Functional Components: ${data.functionalComponents}`);
    lines.push(`  - Class Components: ${data.classComponents}`);
    lines.push(`  Custom Hooks: ${data.customHooks}`);
    lines.push('');
    
    // Most Used Hooks
    if (data.mostUsedHooks.length > 0) {
      lines.push('Most Used Hooks:');
      data.mostUsedHooks.forEach((hook, index) => {
        lines.push(`  ${index + 1}. ${hook.name} (used ${hook.count} times)`);
      });
      lines.push('');
    }
    
    // Components by File
    if (data.componentsByFile.length > 0) {
      lines.push('Components by File:');
      data.componentsByFile.forEach(item => {
        const componentNames = item.componentNames.length > 0 ? ` (${item.componentNames.join(', ')})` : '';
        lines.push(`  ${item.file}: ${item.count} component${item.count === 1 ? '' : 's'}${componentNames}`);
      });
      lines.push('');
    }
    
    // Detailed Components List
    if (data.components.length > 0) {
      lines.push('All Components:');
      data.components.forEach(component => {
        const typeLabel = component.type === 'functional' ? 'FC' : 'CC';
        const exportLabel = component.isDefault ? 'default' : component.isExported ? 'named' : 'local';
        const propsLabel = component.hasProps ? ' [props]' : '';
        const stateLabel = component.hasState ? ' [state]' : '';
        const hooksLabel = component.hooks.length > 0 ? ` [hooks: ${component.hooks.join(', ')}]` : '';
        
        lines.push(`  ${component.name} (${typeLabel}, ${exportLabel})${propsLabel}${stateLabel}${hooksLabel}`);
        lines.push(`    File: ${component.file}`);
      });
      lines.push('');
    }
    
    // Custom Hooks List
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
    
    return lines.join('\n');
  }

  private static formatMarkdown(data: ComponentExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('# Component Analysis Results');
    lines.push('');
    
    // Summary Statistics
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Files Analyzed | ${data.totalFiles} |`);
    lines.push(`| Total Components | ${data.totalComponents} |`);
    lines.push(`| Functional Components | ${data.functionalComponents} |`);
    lines.push(`| Class Components | ${data.classComponents} |`);
    lines.push(`| Custom Hooks | ${data.customHooks} |`);
    lines.push('');
    
    // Most Used Hooks
    if (data.mostUsedHooks.length > 0) {
      lines.push('## Most Used Hooks');
      lines.push('');
      lines.push('| Rank | Hook Name | Usage Count |');
      lines.push('|------|-----------|-------------|');
      data.mostUsedHooks.forEach((hook, index) => {
        lines.push(`| ${index + 1} | \`${hook.name}\` | ${hook.count} |`);
      });
      lines.push('');
    }
    
    // Components by File
    if (data.componentsByFile.length > 0) {
      lines.push('## Components by File');
      lines.push('');
      lines.push('| File | Component Count | Components |');
      lines.push('|------|-----------------|------------|');
      data.componentsByFile.forEach(item => {
        const componentNames = item.componentNames.length > 0 ? item.componentNames.join(', ') : '—';
        lines.push(`| \`${item.file}\` | ${item.count} | ${componentNames} |`);
      });
      lines.push('');
    }
    
    // Detailed Components List
    if (data.components.length > 0) {
      lines.push('## All Components');
      lines.push('');
      lines.push('| Component | Type | Export | Props | State | Hooks | File |');
      lines.push('|-----------|------|--------|-------|-------|-------|------|');
      data.components.forEach(component => {
        const typeLabel = component.type === 'functional' ? 'Functional' : 'Class';
        const exportLabel = component.isDefault ? 'Default' : component.isExported ? 'Named' : 'Local';
        const propsLabel = component.hasProps ? '✓' : '—';
        const stateLabel = component.hasState ? '✓' : '—';
        const hooksLabel = component.hooks.length > 0 ? component.hooks.join(', ') : '—';
        
        lines.push(`| \`${component.name}\` | ${typeLabel} | ${exportLabel} | ${propsLabel} | ${stateLabel} | ${hooksLabel} | \`${component.file}\` |`);
      });
      lines.push('');
    }
    
    // Custom Hooks List
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
    
    return lines.join('\n');
  }
}
