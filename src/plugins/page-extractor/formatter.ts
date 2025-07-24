/**
 * Page extractor formatter for different output formats
 */

import type { PageExtractionSummary, PageAnalysisResult } from './plugin.js';

export type PageFormat = 'text' | 'markdown' | 'json';

export class PageFormatter {
  
  static format(data: PageExtractionSummary, format: PageFormat = 'text'): string {
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

  private static formatText(data: PageExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Page Analysis Results');
    lines.push('='.repeat(20));
    lines.push('');
    
    // Summary Statistics
    lines.push('Summary:');
    lines.push(`  Total Files Analyzed: ${data.totalFiles}`);
    lines.push(`  Total Pages: ${data.totalPages}`);
    lines.push(`  Total API Routes: ${data.totalApiRoutes}`);
    lines.push(`  Total Dynamic Routes: ${data.totalDynamicRoutes}`);
    lines.push('');
    
    // Pages by Type
    if (Object.keys(data.pagesByType).length > 0) {
      lines.push('Pages by Type:');
      Object.entries(data.pagesByType).forEach(([type, count]) => {
        lines.push(`  ${type}: ${count}`);
      });
      lines.push('');
    }
    
    // Rendering Methods
    if (data.renderingMethods) {
      lines.push('Rendering Methods:');
      lines.push(`  Server-Side Rendering (SSR): ${data.renderingMethods.ssr || 0}`);
      lines.push(`  Static Site Generation (SSG): ${data.renderingMethods.ssg || 0}`);
      lines.push(`  Single Page Application (SPA): ${data.renderingMethods.spa || 0}`);
      lines.push('');
    }
    
    // Routes by Directory
    if (data.routesByDirectory.length > 0) {
      lines.push('Routes by Directory:');
      data.routesByDirectory.forEach(item => {
        lines.push(`  ${item.directory}: ${item.pages} page${item.pages === 1 ? '' : 's'}`);
        if (item.routes.length > 0) {
          item.routes.forEach(route => {
            lines.push(`    - ${route}`);
          });
        }
      });
      lines.push('');
    }
    
    // Detailed Pages List
    if (data.pages.length > 0) {
      lines.push('All Pages:');
      data.pages.forEach(page => {
        const typeLabel = page.pageType.toUpperCase();
        const dynamicLabel = page.isDynamic ? ' [DYNAMIC]' : '';
        const ssrLabel = page.hasSSR ? ' [SSR]' : '';
        const ssgLabel = page.hasSSG ? ' [SSG]' : '';
        
        lines.push(`  ${page.route} (${typeLabel})${dynamicLabel}${ssrLabel}${ssgLabel}`);
        lines.push(`    File: ${page.file}`);
        
        if (page.dynamicSegments.length > 0) {
          lines.push(`    Dynamic Segments: ${page.dynamicSegments.join(', ')}`);
        }
        
        if (page.components.length > 0) {
          const componentNames = page.components.map(c => c.name).join(', ');
          lines.push(`    Components: ${componentNames}`);
        }
        
        if (page.exports.length > 0) {
          const exportNames = page.exports.map(e => e.name).join(', ');
          lines.push(`    Exports: ${exportNames}`);
        }
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private static formatMarkdown(data: PageExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('# Page Analysis Results');
    lines.push('');
    
    // Summary Statistics
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Files Analyzed | ${data.totalFiles} |`);
    lines.push(`| Total Pages | ${data.totalPages} |`);
    lines.push(`| Total API Routes | ${data.totalApiRoutes} |`);
    lines.push(`| Total Dynamic Routes | ${data.totalDynamicRoutes} |`);
    lines.push('');
    
    // Pages by Type
    if (Object.keys(data.pagesByType).length > 0) {
      lines.push('## Pages by Type');
      lines.push('');
      lines.push('| Type | Count |');
      lines.push('|------|-------|');
      Object.entries(data.pagesByType).forEach(([type, count]) => {
        lines.push(`| ${type} | ${count} |`);
      });
      lines.push('');
    }
    
    // Rendering Methods
    if (data.renderingMethods) {
      lines.push('## Rendering Methods');
      lines.push('');
      lines.push('| Method | Count |');
      lines.push('|--------|-------|');
      lines.push(`| Server-Side Rendering (SSR) | ${data.renderingMethods.ssr || 0} |`);
      lines.push(`| Static Site Generation (SSG) | ${data.renderingMethods.ssg || 0} |`);
      lines.push(`| Single Page Application (SPA) | ${data.renderingMethods.spa || 0} |`);
      lines.push('');
    }
    
    // Routes by Directory
    if (data.routesByDirectory.length > 0) {
      lines.push('## Routes by Directory');
      lines.push('');
      data.routesByDirectory.forEach(item => {
        lines.push(`### \`${item.directory}\``);
        lines.push('');
        lines.push(`**Pages:** ${item.pages}`);
        lines.push('');
        if (item.routes.length > 0) {
          lines.push('**Routes:**');
          item.routes.forEach(route => {
            lines.push(`- \`${route}\``);
          });
          lines.push('');
        }
      });
    }
    
    // Detailed Pages List
    if (data.pages.length > 0) {
      lines.push('## All Pages');
      lines.push('');
      lines.push('| Route | Type | Dynamic | SSR | SSG | Components | File |');
      lines.push('|-------|------|---------|-----|-----|------------|------|');
      data.pages.forEach(page => {
        const typeLabel = page.pageType.toUpperCase();
        const dynamicLabel = page.isDynamic ? '✓' : '—';
        const ssrLabel = page.hasSSR ? '✓' : '—';
        const ssgLabel = page.hasSSG ? '✓' : '—';
        const componentNames = page.components.length > 0 ? page.components.map(c => c.name).join(', ') : '—';
        
        lines.push(`| \`${page.route}\` | ${typeLabel} | ${dynamicLabel} | ${ssrLabel} | ${ssgLabel} | ${componentNames} | \`${page.file}\` |`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }
}
