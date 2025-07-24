/**
 * Feature extractor formatter for different output formats
 */

import type { FeatureExtractionSummary, FeatureAnalysisResult } from './plugin.js';

export type FeatureFormat = 'text' | 'markdown' | 'json';

export class FeatureFormatter {
  
  static format(data: FeatureExtractionSummary, format: FeatureFormat = 'text'): string {
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

  private static formatText(data: FeatureExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Feature Analysis Results');
    lines.push('='.repeat(23));
    lines.push('');
    
    // Summary Statistics
    lines.push('Summary:');
    lines.push(`  Total Features: ${data.totalFeatures}`);
    lines.push(`  Average Complexity: ${data.averageComplexity.toFixed(2)}`);
    lines.push('');
    
    // Features by Type
    if (Object.keys(data.featuresByType).length > 0) {
      lines.push('Features by Type:');
      Object.entries(data.featuresByType).forEach(([type, count]) => {
        lines.push(`  ${type}: ${count}`);
      });
      lines.push('');
    }

    // Business Logic Distribution
    if (Object.keys(data.businessLogicDistribution).length > 0) {
      lines.push('Business Logic Distribution:');
      Object.entries(data.businessLogicDistribution)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          lines.push(`  ${type}: ${count} instances`);
        });
      lines.push('');
    }

    // Architectural Patterns
    if (data.architecturalPatterns.length > 0) {
      lines.push('Architectural Patterns:');
      data.architecturalPatterns.forEach(pattern => {
        lines.push(`  ${pattern.pattern}: ${pattern.count} occurrences`);
        if (pattern.examples.length > 0) {
          lines.push(`    Examples: ${pattern.examples.slice(0, 3).join(', ')}`);
        }
      });
      lines.push('');
    }
    
    // Most Complex Features
    if (data.mostComplexFeatures.length > 0) {
      lines.push('Most Complex Features:');
      data.mostComplexFeatures.forEach((feature, index) => {
        lines.push(`  ${index + 1}. ${feature.name} (complexity: ${feature.complexity.toFixed(2)})`);
        lines.push(`     Path: ${feature.path}`);
      });
      lines.push('');
    }
    
    // Shared Components
    if (data.sharedComponents.length > 0) {
      lines.push('Shared Components:');
      data.sharedComponents.forEach(component => {
        lines.push(`  ${component.name} (used by ${component.usedBy.length} features)`);
        lines.push(`    Location: ${component.location}`);
        lines.push(`    Used by: ${component.usedBy.join(', ')}`);
      });
      lines.push('');
    }
    
    // Data Flow Analysis
    if (data.dataFlowAnalysis) {
      lines.push('Data Flow Analysis:');
      lines.push(`  Total Connections: ${data.dataFlowAnalysis.totalConnections}`);
      
      // Connection Types
      if (Object.keys(data.dataFlowAnalysis.connectionTypes).length > 0) {
        lines.push('  Connection Types:');
        Object.entries(data.dataFlowAnalysis.connectionTypes).forEach(([type, count]) => {
          lines.push(`    ${type}: ${count} connections`);
        });
      }
      
      if (data.dataFlowAnalysis.mostConnectedFeatures.length > 0) {
        lines.push('  Most Connected Features:');
        data.dataFlowAnalysis.mostConnectedFeatures.forEach(feature => {
          lines.push(`    ${feature.name}: ${feature.connections} connections`);
        });
      }
      lines.push('');
    }

    // Module Analysis
    if (data.moduleAnalysis) {
      lines.push('Module Analysis:');
      lines.push(`  Total Modules: ${data.moduleAnalysis.totalModules}`);
      lines.push('');
      
      // Modules by Directory
      if (data.moduleAnalysis.modulesByDirectory.length > 0) {
        lines.push('  Modules by Directory:');
        data.moduleAnalysis.modulesByDirectory
          .sort((a, b) => b.fileCount - a.fileCount)
          .forEach(module => {
            lines.push(`    ${module.directory}/ (${module.type})`);
            lines.push(`      Files: ${module.fileCount}`);
            lines.push(`      Components: ${module.componentCount}`);
            lines.push(`      Hooks: ${module.hookCount}`);
          });
        lines.push('');
      }
      
      // Feature Structure
      if (data.moduleAnalysis.featureStructure.length > 0) {
        lines.push('  Feature Structure:');
        data.moduleAnalysis.featureStructure
          .slice(0, 10) // Show top 10 features
          .forEach(feature => {
            lines.push(`    ${feature.name} (${feature.type})`);
            lines.push(`      Path: ${feature.path}`);
            lines.push(`      Structure:`);
            
            // Only show non-zero counts
            if (feature.structure.componentCount > 0) {
              lines.push(`        Components: ${feature.structure.componentCount}`);
            }
            if (feature.structure.hookCount > 0) {
              lines.push(`        Hooks: ${feature.structure.hookCount}`);
            }
            if (feature.structure.serviceCount > 0) {
              lines.push(`        Services: ${feature.structure.serviceCount}`);
            }
            if (feature.structure.typeCount > 0) {
              lines.push(`        Types: ${feature.structure.typeCount}`);
            }
            if (feature.structure.testCount > 0) {
              lines.push(`        Tests: ${feature.structure.testCount}`);
            }
            if (feature.structure.styleCount > 0) {
              lines.push(`        Styles: ${feature.structure.styleCount}`);
            }
            
            lines.push(`      Files: ${feature.files.length}`);
            
            // Show file details for smaller features
            if (feature.files.length <= 5) {
              feature.files.forEach(file => {
                const components = file.components.length > 0 ? ` (${file.components.join(', ')})` : '';
                const hooks = file.hooks.length > 0 ? ` [${file.hooks.join(', ')}]` : '';
                lines.push(`        ${file.name} (${file.type})${components}${hooks}`);
              });
            }
            
            lines.push(`      Dependencies:`);
            lines.push(`        Internal: ${feature.dependencies.internal.length}`);
            lines.push(`        External: ${feature.dependencies.external.length}`);
            lines.push(`        Cross-module: ${feature.dependencies.crossModule.length}`);
            lines.push('');
          });
      }
      
      // Dependency Graph Summary
      if (data.moduleAnalysis.dependencyGraph.length > 0) {
        lines.push('  Module Dependencies:');
        const depCount = new Map<string, number>();
        data.moduleAnalysis.dependencyGraph.forEach(dep => {
          depCount.set(dep.from, (depCount.get(dep.from) || 0) + 1);
        });
        
        Array.from(depCount.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .forEach(([module, count]) => {
            lines.push(`    ${module}: ${count} dependencies`);
          });
        lines.push('');
      }
    }

    // Refactoring Recommendations
    if (data.recommendedRefactoring.length > 0) {
      lines.push('Refactoring Recommendations:');
      data.recommendedRefactoring.forEach((recommendation, index) => {
        const priority = recommendation.priority.toUpperCase();
        lines.push(`  ${index + 1}. [${priority}] ${recommendation.feature}`);
        lines.push(`     Issue: ${recommendation.reason}`);
        lines.push(`     Suggestion: ${recommendation.suggestion}`);
        lines.push('');
      });
    }
    
    return lines.join('\n');
  }

  private static formatMarkdown(data: FeatureExtractionSummary): string {
    const lines: string[] = [];
    
    // Header
    lines.push('# Feature Analysis Results');
    lines.push('');
    
    // Summary Statistics
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Features | ${data.totalFeatures} |`);
    lines.push(`| Average Complexity | ${data.averageComplexity.toFixed(2)} |`);
    lines.push('');
    
    // Features by Type
    if (Object.keys(data.featuresByType).length > 0) {
      lines.push('## Features by Type');
      lines.push('');
      lines.push('| Feature Type | Count |');
      lines.push('|--------------|-------|');
      Object.entries(data.featuresByType).forEach(([type, count]) => {
        lines.push(`| ${type} | ${count} |`);
      });
      lines.push('');
    }
    
    // Most Complex Features
    if (data.mostComplexFeatures.length > 0) {
      lines.push('## Most Complex Features');
      lines.push('');
      lines.push('| Rank | Feature Name | Complexity | Path |');
      lines.push('|------|--------------|------------|------|');
      data.mostComplexFeatures.forEach((feature, index) => {
        lines.push(`| ${index + 1} | \`${feature.name}\` | ${feature.complexity.toFixed(2)} | \`${feature.path}\` |`);
      });
      lines.push('');
    }

    // Business Logic Distribution
    if (Object.keys(data.businessLogicDistribution).length > 0) {
      lines.push('## Business Logic Distribution');
      lines.push('');
      lines.push('| Logic Type | Count |');
      lines.push('|------------|-------|');
      Object.entries(data.businessLogicDistribution)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          lines.push(`| ${type} | ${count} |`);
        });
      lines.push('');
    }

    // Architectural Patterns
    if (data.architecturalPatterns.length > 0) {
      lines.push('## Architectural Patterns');
      lines.push('');
      lines.push('| Pattern | Count | Examples |');
      lines.push('|---------|-------|----------|');
      data.architecturalPatterns.forEach(pattern => {
        const examples = pattern.examples.slice(0, 2).join(', ') + (pattern.examples.length > 2 ? '...' : '');
        lines.push(`| ${pattern.pattern} | ${pattern.count} | ${examples} |`);
      });
      lines.push('');
    }
    
    // Shared Components
    if (data.sharedComponents.length > 0) {
      lines.push('## Shared Components');
      lines.push('');
      lines.push('| Component | Usage Count | Used By Features | Location |');
      lines.push('|-----------|-------------|------------------|----------|');
      data.sharedComponents.forEach(component => {
        lines.push(`| \`${component.name}\` | ${component.usedBy.length} | ${component.usedBy.join(', ')} | \`${component.location}\` |`);
      });
      lines.push('');
    }
    
    // Data Flow Analysis
    if (data.dataFlowAnalysis) {
      lines.push('## Data Flow Analysis');
      lines.push('');
      lines.push(`**Total Connections:** ${data.dataFlowAnalysis.totalConnections}`);
      lines.push('');

      // Connection Types
      if (Object.keys(data.dataFlowAnalysis.connectionTypes).length > 0) {
        lines.push('### Connection Types');
        lines.push('');
        lines.push('| Connection Type | Count |');
        lines.push('|-----------------|-------|');
        Object.entries(data.dataFlowAnalysis.connectionTypes).forEach(([type, count]) => {
          lines.push(`| ${type} | ${count} |`);
        });
        lines.push('');
      }
      
      if (data.dataFlowAnalysis.mostConnectedFeatures.length > 0) {
        lines.push('### Most Connected Features');
        lines.push('');
        lines.push('| Feature | Connections |');
        lines.push('|---------|-------------|');
        data.dataFlowAnalysis.mostConnectedFeatures.forEach(feature => {
          lines.push(`| \`${feature.name}\` | ${feature.connections} |`);
        });
        lines.push('');
      }
    }

    // Refactoring Recommendations
    if (data.recommendedRefactoring.length > 0) {
      lines.push('## Refactoring Recommendations');
      lines.push('');
      lines.push('| Priority | Feature | Issue | Suggestion |');
      lines.push('|----------|---------|-------|------------|');
      data.recommendedRefactoring.forEach(recommendation => {
        const priority = recommendation.priority.toUpperCase();
        lines.push(`| **${priority}** | \`${recommendation.feature}\` | ${recommendation.reason} | ${recommendation.suggestion} |`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }
}
