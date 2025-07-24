/**
 * Feature Extractor Plugin - Using DRY utilities
 */

import { BaseExtractor, type ExtractorConfig } from '../common/base-extractor.js';
import { ReactComponentUtils, type ComponentInfo } from '../common/react-component-utils.js';
import { ReactHooksUtils } from '../common/react-hooks-utils.js';
import { ReactContextUtils } from '../common/react-context-utils.js';
import { FileUtils } from '../common/file-utils.js';
import { ASTUtils } from '../common/ast-utils.js';
import type { PluginResult, PluginMetadata } from '../../types/plugin.js';
import { FeatureFormatter } from './formatter.js';
import path from 'path';
import fs from 'fs';

// Enhanced config for feature extraction
export interface FeatureExtractorConfig extends ExtractorConfig {
  includeTypes?: boolean;
  analyzeBusinessLogic?: boolean;
  detectDataFlow?: boolean;
  featurePatterns?: string[];
  utilityDirectories?: string[];
}

// Result types for feature extraction
export interface FeatureAnalysisResult {
  filePath: string;
  featureName: string;
  featureType: 'module' | 'page' | 'domain' | 'shared' | 'utility';
  components: Array<{
    name: string;
    type: 'functional' | 'class' | 'hook';
    complexity: 'low' | 'medium' | 'high';
    dependencies: string[];
  }>;
  businessLogic: Array<{
    type: 'service' | 'store' | 'api' | 'repository' | 'utils';
    name: string;
    methods: string[];
  }>;
  dataFlow: Array<{
    from: string;
    to: string;
    type: 'props' | 'context' | 'api' | 'store';
  }>;
  structure: {
    componentCount: number;
    hookCount: number;
    serviceCount: number;
    typeCount: number;
    testCount: number;
    styleCount: number;
  };
  metrics: {
    componentCount: number;
    hookCount: number;
    serviceCount: number;
    complexity: number;
    cohesion: number; // How well organized the feature is
  };
}

export interface FeatureExtractionSummary {
  totalFeatures: number;
  featuresByType: Record<string, number>;
  averageComplexity: number;
  mostComplexFeatures: Array<{ name: string; complexity: number; path: string }>;
  sharedComponents: Array<{ name: string; usedBy: string[]; location: string }>;
  businessLogicDistribution: Record<string, number>;
  architecturalPatterns: Array<{
    pattern: string;
    count: number;
    examples: string[];
  }>;
  dataFlowAnalysis: {
    totalConnections: number;
    connectionTypes: Record<string, number>;
    mostConnectedFeatures: Array<{ name: string; connections: number }>;
  };
  moduleAnalysis: {
    totalModules: number;
    modulesByDirectory: Array<{
      directory: string;
      type: 'features' | 'components' | 'hooks' | 'context' | 'lib' | 'types' | 'utils';
      fileCount: number;
      componentCount: number;
      hookCount: number;
      modules: Array<{
        name: string;
        files: string[];
        components: string[];
        hooks: string[];
        exports: string[];
        dependencies: string[];
      }>;
    }>;
    featureStructure: Array<{
      name: string;
      path: string;
      type: 'module' | 'page' | 'domain' | 'shared' | 'utility';
      structure: {
        componentCount: number;
        hookCount: number;
        serviceCount: number;
        typeCount: number;
        testCount: number;
        styleCount: number;
      };
      files: Array<{
        name: string;
        type: 'component' | 'hook' | 'service' | 'type' | 'test' | 'style' | 'other';
        components: string[];
        hooks: string[];
        exports: string[];
      }>;
      dependencies: {
        internal: string[];
        external: string[];
        crossModule: string[];
      };
    }>;
    dependencyGraph: Array<{
      from: string;
      to: string;
      type: 'import' | 'component' | 'hook' | 'context';
      weight: number;
    }>;
  };
  recommendedRefactoring: Array<{
    feature: string;
    reason: string;
    suggestion: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

/**
 * Feature Extractor Plugin using DRY utilities
 */
export class FeatureExtractorPlugin extends BaseExtractor<FeatureAnalysisResult, FeatureExtractionSummary> {
  
  get metadata(): PluginMetadata {
    return {
      name: 'feature-extractor',
      version: '2.0.0',
      description: 'Analyzes application features, business logic organization, and architectural patterns',
      author: 'MCP Next.js Analyzer',
      tags: ['features', 'architecture', 'organization', 'business-logic'],
      cli: {
        command: 'features',
        description: 'Show feature organization',
        usage: 'node cli.js [project-path] features [options]',
        category: 'analysis',
        options: [
          {
            name: '--src',
            description: 'Source directory to analyze',
            type: 'string',
            default: 'src'
          },
          {
            name: '--complexity',
            description: 'Show complexity metrics',
            type: 'boolean',
            default: false
          },
          {
            name: '--format',
            description: 'Output format (text, markdown)',
            type: 'string',
            default: 'text'
          }
        ],
        examples: [
          'node cli.js . features',
          'node cli.js . features --src=app --complexity',
          'node cli.js /path/to/project features --format=markdown'
        ]
      }
    };
  }

  constructor(config: FeatureExtractorConfig = {}) {
    super({
      filePatterns: ['**/*.{js,jsx,ts,tsx}'],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.d.ts',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      batchSize: 8,
      parallel: true,
      includeTypes: true,
      analyzeBusinessLogic: true,
      detectDataFlow: true,
      featurePatterns: ['features', 'modules', 'domains', 'pages', 'views', 'screens'],
      utilityDirectories: [
        'components', 'ui', 'shared', 'common', 'utils', 'helpers', 
        'lib', 'libs', 'hooks', 'context', 'providers', 'types', 
        'interfaces', 'models', 'styles', 'assets', 'constants', 'config'
      ],
      ...config
    });
  }

  shouldProcess(filePath: string): boolean {
    // For directories, always allow processing
    if (!path.extname(filePath)) {
      return true;
    }
    
    // Process files that are part of features
    return this.isFeatureFile(filePath);
  }

  protected shouldProcessFile(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content) return false;

    // Quick checks for feature-relevant content
    return content.includes('export') || 
           content.includes('import') || 
           content.includes('function') ||
           content.includes('class') ||
           content.includes('const') ||
           content.includes('interface') ||
           content.includes('type');
  }

  protected async processFile(filePath: string): Promise<FeatureAnalysisResult | null> {
    try {
      const parsed = await this.parseFileWithCache(filePath);
      if (!parsed || !parsed.ast) return null;

      const ast = parsed.ast; // Extract the actual AST from ParsedAST
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = this.extractorConfig as FeatureExtractorConfig;

      // Determine feature information
      const featureInfo = this.analyzeFeatureContext(filePath);
      if (!featureInfo) return null;

      // Analyze components in this file
      const components = await this.analyzeComponents(ast, filePath);
      
      // Analyze business logic
      const businessLogic = config.analyzeBusinessLogic ? 
        await this.analyzeBusinessLogic(ast, filePath) : [];
      
      // Analyze data flow
      const dataFlow = config.detectDataFlow ? 
        await this.analyzeDataFlow(ast, content) : [];

      // Analyze structure
      const structure = await this.analyzeFeatureStructure(filePath);
      
      // Calculate metrics
      const metrics = this.calculateMetrics(components, businessLogic, dataFlow);

      return {
        filePath,
        featureName: featureInfo.name,
        featureType: featureInfo.type,
        components,
        businessLogic,
        dataFlow,
        structure,
        metrics
      };

    } catch (error) {
      this.logger.error(`Failed to process ${filePath}:`, error);
      return null;
    }
  }

  protected async aggregateResults(results: FeatureAnalysisResult[], targetPath: string): Promise<FeatureExtractionSummary> {
    const featuresByType: Record<string, number> = {};
    const businessLogicDistribution: Record<string, number> = {};
    const architecturalPatterns: Array<{ pattern: string; count: number; examples: string[] }> = [];
    const connectionTypes: Record<string, number> = {};
    
    let totalComplexity = 0;
    let totalConnections = 0;
    const complexFeatures: Array<{ name: string; complexity: number; path: string }> = [];
    const connectedFeatures: Array<{ name: string; connections: number }> = [];
    const refactoringSuggestions: Array<{
      feature: string;
      reason: string;
      suggestion: string;
      priority: 'low' | 'medium' | 'high';
    }> = [];

    // Group results by feature
    const featureGroups = new Map<string, FeatureAnalysisResult[]>();
    for (const result of results) {
      const existing = featureGroups.get(result.featureName) || [];
      existing.push(result);
      featureGroups.set(result.featureName, existing);
    }

    // Analyze each feature group
    for (const [featureName, featureResults] of featureGroups) {
      // Count by type
      const featureType = featureResults[0]?.featureType || 'unknown';
      featuresByType[featureType] = (featuresByType[featureType] || 0) + 1;

      // Calculate feature complexity
      const featureComplexity = featureResults.reduce((sum, r) => sum + r.metrics.complexity, 0);
      totalComplexity += featureComplexity;
      complexFeatures.push({
        name: featureName,
        complexity: featureComplexity,
        path: this.getRelativePath(featureResults[0]?.filePath || '')
      });

      // Count business logic types
      for (const result of featureResults) {
        for (const logic of result.businessLogic) {
          businessLogicDistribution[logic.type] = (businessLogicDistribution[logic.type] || 0) + 1;
        }

        // Count connections
        const connections = result.dataFlow.length;
        totalConnections += connections;
        
        for (const flow of result.dataFlow) {
          connectionTypes[flow.type] = (connectionTypes[flow.type] || 0) + 1;
        }
      }

      // Track connected features
      const totalFeatureConnections = featureResults.reduce((sum, r) => sum + r.dataFlow.length, 0);
      connectedFeatures.push({ name: featureName, connections: totalFeatureConnections });

      // Generate refactoring suggestions
      if (featureComplexity > 50) {
        refactoringSuggestions.push({
          feature: featureName,
          reason: 'High complexity detected',
          suggestion: 'Consider breaking into smaller modules',
          priority: 'high'
        });
      }

      if (featureResults.length > 10) {
        refactoringSuggestions.push({
          feature: featureName,
          reason: 'Too many files in feature',
          suggestion: 'Consider organizing into sub-features',
          priority: 'medium'
        });
      }
    }

    // Sort and limit results
    complexFeatures.sort((a, b) => b.complexity - a.complexity);
    connectedFeatures.sort((a, b) => b.connections - a.connections);

    // Generate comprehensive module analysis
    const moduleAnalysis = this.generateModuleAnalysis(results, featureGroups);

    return {
      totalFeatures: featureGroups.size,
      featuresByType,
      averageComplexity: totalComplexity / Math.max(results.length, 1),
      mostComplexFeatures: complexFeatures.slice(0, 10),
      sharedComponents: this.findSharedComponents(results),
      businessLogicDistribution,
      architecturalPatterns: this.detectArchitecturalPatterns(results),
      dataFlowAnalysis: {
        totalConnections,
        connectionTypes,
        mostConnectedFeatures: connectedFeatures.slice(0, 10)
      },
      moduleAnalysis,
      recommendedRefactoring: refactoringSuggestions.slice(0, 15)
    };
  }

  private isFeatureFile(filePath: string): boolean {
    const config = this.extractorConfig as FeatureExtractorConfig;
    const pathParts = filePath.split(path.sep);
    
    // Skip pages, app router, and API routes
    if (this.isPageFile(pathParts)) {
      return false;
    }
    
    // Check if file is in a feature directory
    return config.featurePatterns!.some(pattern => 
      pathParts.some(part => part.toLowerCase().includes(pattern))
    ) || this.isBusinessModule(filePath);
  }

  private isBusinessModule(filePath: string): boolean {
    const config = this.extractorConfig as FeatureExtractorConfig;
    const pathParts = filePath.split(path.sep);
    
    // Check if it's in a business module directory (not utility/infrastructure)
    const businessDirs = ['features', 'modules', 'domains', 'components', 'hooks', 'context'];
    return businessDirs.some(dir => 
      pathParts.some(part => part.toLowerCase() === dir)
    ) && !config.utilityDirectories!.some(util => 
      pathParts.some(part => part.toLowerCase() === util.toLowerCase())
    );
  }

  private analyzeFeatureContext(filePath: string): { name: string; type: FeatureAnalysisResult['featureType'] } | null {
    const pathParts = filePath.split(path.sep);
    const config = this.extractorConfig as FeatureExtractorConfig;
    
    // Skip pages, app router, and API routes - these are not business features
    if (this.isPageFile(pathParts)) {
      return null;
    }
    
    // Find feature directory
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const part = pathParts[i].toLowerCase();
      
      if (config.featurePatterns!.includes(part)) {
        const featureName = pathParts[i + 1] || path.basename(filePath, path.extname(filePath));
        return {
          name: featureName,
          type: this.determineFeatureType(part)
        };
      }
    }

    // Check if it's a shared/utility module
    if (config.utilityDirectories!.some(util => 
         pathParts.some(part => part.toLowerCase() === util.toLowerCase()))) {
      const srcIndex = pathParts.findIndex(part => part === 'src');
      const moduleName = srcIndex >= 0 && srcIndex + 1 < pathParts.length ? 
        pathParts[srcIndex + 1] : 'shared';
      return {
        name: moduleName,
        type: 'shared'
      };
    }

    // Only return business domain features, not pages
    return null;
  }

  private isPageFile(pathParts: string[]): boolean {
    const pageDirs = ['pages', 'app', 'routes', 'views', 'screens'];
    const apiDirs = ['api'];
    
    return pathParts.some(part => {
      const lowerPart = part.toLowerCase();
      return pageDirs.includes(lowerPart) || 
             apiDirs.includes(lowerPart) ||
             part.startsWith('[') && part.endsWith(']'); // Dynamic routes
    });
  }

  private determineFeatureType(directoryName: string): FeatureAnalysisResult['featureType'] {
    switch (directoryName.toLowerCase()) {
      case 'features': case 'modules': case 'domains':
        return 'module';
      case 'shared': case 'common': case 'components':
        return 'shared';
      case 'utils': case 'helpers': case 'lib': case 'libraries':
        return 'utility';
      case 'hooks': case 'context': case 'providers':
        return 'shared'; // These are shared utilities, not business features
      default:
        return 'domain';
    }
  }

  private async analyzeComponents(ast: any, filePath: string): Promise<FeatureAnalysisResult['components']> {
    const components: FeatureAnalysisResult['components'] = [];
    
    try {
      // Get React components
      const reactComponents = ReactComponentUtils.findReactComponents(ast);
      for (const comp of reactComponents) {
        components.push({
          name: comp.name,
          type: comp.type === 'functional' ? 'functional' : 'class',
          complexity: this.calculateComponentComplexity(comp),
          dependencies: this.extractComponentDependencies(comp, ast)
        });
      }
    } catch (error) {
      this.logger.debug(`Error analyzing React components in ${filePath}:`, error);
    }

    try {
      // Get custom hooks
      const hooks = ReactHooksUtils.findCustomHooks(ast);
      for (const hook of hooks) {
        if (hook.type === 'custom') {
          components.push({
            name: hook.name,
            type: 'hook',
            complexity: this.calculateHookComplexity(hook),
            dependencies: []
          });
        }
      }
    } catch (error) {
      this.logger.debug(`Error analyzing custom hooks in ${filePath}:`, error);
    }

    return components;
  }

  private async analyzeBusinessLogic(ast: any, filePath: string): Promise<FeatureAnalysisResult['businessLogic']> {
    const businessLogic: FeatureAnalysisResult['businessLogic'] = [];
    
    try {
      // Find services, APIs, repositories etc.
      const exports = ASTUtils.findExports(ast);
      
      for (const exp of exports) {
        const type = this.classifyBusinessLogic(exp.name, filePath);
        if (type) {
          const methods = this.extractMethods(exp, ast);
          businessLogic.push({
            type,
            name: exp.name,
            methods
          });
        }
      }
    } catch (error) {
      this.logger.debug(`Error analyzing business logic in ${filePath}:`, error);
    }

    return businessLogic;
  }

  private async analyzeDataFlow(ast: any, content: string): Promise<FeatureAnalysisResult['dataFlow']> {
    const dataFlow: FeatureAnalysisResult['dataFlow'] = [];
    
    // Simple data flow analysis based on imports/exports and common patterns
    const imports = ASTUtils.findImports(ast);
    const exports = ASTUtils.findExports(ast);
    
    // Analyze props flow
    if (content.includes('props') && imports.length > 0) {
      dataFlow.push({
        from: 'parent',
        to: 'component',
        type: 'props'
      });
    }

    // Analyze context usage
    if (content.includes('useContext') || content.includes('Consumer')) {
      dataFlow.push({
        from: 'context',
        to: 'component',
        type: 'context'
      });
    }

    // Analyze API calls
    if (content.includes('fetch') || content.includes('axios') || content.includes('api')) {
      dataFlow.push({
        from: 'api',
        to: 'component',
        type: 'api'
      });
    }

    return dataFlow;
  }

  private async analyzeFeatureStructure(filePath: string): Promise<FeatureAnalysisResult['structure']> {
    const featureDir = path.dirname(filePath);
    
    return {
      componentCount: await this.countFilesMatching(featureDir, /component|ui/i),
      hookCount: await this.countFilesMatching(featureDir, /hook/i),
      serviceCount: await this.countFilesMatching(featureDir, /service|api|repository/i),
      typeCount: await this.countFilesMatching(featureDir, /type|interface|model/i),
      testCount: await this.countFilesMatching(featureDir, /test|spec/i),
      styleCount: await this.countFilesMatching(featureDir, /style|css|scss|sass/i)
    };
  }

  private async countFilesMatching(dir: string, pattern: RegExp): Promise<number> {
    try {
      if (!fs.existsSync(dir)) return 0;
      
      const files = await fs.promises.readdir(dir, { recursive: true });
      return files.filter(file => pattern.test(file.toString())).length;
    } catch {
      return 0;
    }
  }

  private calculateMetrics(
    components: FeatureAnalysisResult['components'],
    businessLogic: FeatureAnalysisResult['businessLogic'],
    dataFlow: FeatureAnalysisResult['dataFlow']
  ): FeatureAnalysisResult['metrics'] {
    const componentCount = components.filter(c => c.type !== 'hook').length;
    const hookCount = components.filter(c => c.type === 'hook').length;
    const serviceCount = businessLogic.length;
    
    // Simple complexity calculation
    const complexity = componentCount * 2 + hookCount + serviceCount * 3 + dataFlow.length;
    
    // Simple cohesion calculation (inverse of complexity for now)
    const cohesion = Math.max(0, 100 - complexity) / 100;

    return {
      componentCount,
      hookCount,
      serviceCount,
      complexity,
      cohesion
    };
  }

  private calculateComponentComplexity(component: any): 'low' | 'medium' | 'high' {
    const propsCount = component.props?.length || 0;
    const hasState = component.hasState || false;
    const hasEffects = component.hasEffects || false;
    
    const score = propsCount + (hasState ? 2 : 0) + (hasEffects ? 2 : 0);
    
    if (score <= 2) return 'low';
    if (score <= 5) return 'medium';
    return 'high';
  }

  private calculateHookComplexity(hook: any): 'low' | 'medium' | 'high' {
    const paramCount = hook.params?.length || 0;
    if (paramCount === 0) return 'low';
    if (paramCount <= 2) return 'medium';
    return 'high';
  }

  private extractComponentDependencies(component: any, ast: any): string[] {
    const imports = ASTUtils.findImports(ast);
    return imports.map(imp => imp.source).filter(Boolean).slice(0, 5); // Limit to first 5
  }

  private classifyBusinessLogic(name: string, filePath: string): FeatureAnalysisResult['businessLogic'][0]['type'] | null {
    const lowerName = name.toLowerCase();
    const lowerPath = filePath.toLowerCase();
    
    if (lowerName.includes('service') || lowerPath.includes('service')) return 'service';
    if (lowerName.includes('api') || lowerPath.includes('api')) return 'api';
    if (lowerName.includes('store') || lowerName.includes('state')) return 'store';
    if (lowerName.includes('repository') || lowerName.includes('repo')) return 'repository';
    if (lowerName.includes('util') || lowerName.includes('helper')) return 'utils';
    
    return null;
  }

  private extractMethods(exp: any, ast: any): string[] {
    // Simple method extraction - in a full implementation, 
    // you'd traverse the AST to find actual methods
    return ['method1', 'method2']; // Placeholder
  }

  private findSharedComponents(results: FeatureAnalysisResult[]): FeatureExtractionSummary['sharedComponents'] {
    const componentUsage = new Map<string, { usedBy: Set<string>; location: string }>();
    
    for (const result of results) {
      if (result.featureType === 'shared') {
        for (const component of result.components) {
          const existing = componentUsage.get(component.name) || { 
            usedBy: new Set(), 
            location: this.getRelativePath(result.filePath) 
          };
          existing.usedBy.add(result.featureName);
          componentUsage.set(component.name, existing);
        }
      }
    }

    return Array.from(componentUsage.entries())
      .filter(([, data]) => data.usedBy.size > 1)
      .map(([name, data]) => ({
        name,
        usedBy: Array.from(data.usedBy),
        location: data.location
      }))
      .slice(0, 20);
  }

  private detectArchitecturalPatterns(results: FeatureAnalysisResult[]): FeatureExtractionSummary['architecturalPatterns'] {
    const patterns = new Map<string, { count: number; examples: Set<string> }>();
    
    for (const result of results) {
      // Detect common patterns
      if (result.structure.componentCount > 0 && result.structure.hookCount > 0) {
        this.addPattern(patterns, 'Feature with Custom Hooks', result.featureName);
      }
      
      if (result.structure.serviceCount > 0 && result.structure.typeCount > 0) {
        this.addPattern(patterns, 'Typed Service Layer', result.featureName);
      }
      
      if (result.dataFlow.some(flow => flow.type === 'context')) {
        this.addPattern(patterns, 'Context-based State', result.featureName);
      }
      
      if (result.businessLogic.some(logic => logic.type === 'repository')) {
        this.addPattern(patterns, 'Repository Pattern', result.featureName);
      }
    }

    return Array.from(patterns.entries())
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        examples: Array.from(data.examples).slice(0, 3)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private addPattern(patterns: Map<string, { count: number; examples: Set<string> }>, pattern: string, example: string) {
    const existing = patterns.get(pattern) || { count: 0, examples: new Set() };
    existing.count++;
    existing.examples.add(example);
    patterns.set(pattern, existing);
  }

  /**
   * Generate comprehensive module analysis
   */
  private generateModuleAnalysis(results: FeatureAnalysisResult[], featureGroups: Map<string, FeatureAnalysisResult[]>) {
    const modulesByDirectory = new Map<string, {
      type: 'features' | 'components' | 'hooks' | 'context' | 'lib' | 'types' | 'utils';
      fileCount: number;
      componentCount: number;
      hookCount: number;
      modules: Array<{
        name: string;
        files: string[];
        components: string[];
        hooks: string[];
        exports: string[];
        dependencies: string[];
      }>;
    }>();

    const featureStructure: any[] = [];
    const dependencyGraph: any[] = [];

    // Analyze directory structure
    for (const result of results) {
      const pathParts = result.filePath.split(path.sep);
      const srcIndex = pathParts.findIndex(part => part === 'src');
      
      if (srcIndex >= 0 && srcIndex + 1 < pathParts.length) {
        const topLevelDir = pathParts[srcIndex + 1];
        const dirType = this.categorizeDirectory(topLevelDir);
        
        const existing = modulesByDirectory.get(topLevelDir) || {
          type: dirType,
          fileCount: 0,
          componentCount: 0,
          hookCount: 0,
          modules: []
        };
        
        existing.fileCount++;
        existing.componentCount += result.components.length;
        existing.hookCount += result.components.filter(c => c.type === 'hook').length;
        
        modulesByDirectory.set(topLevelDir, existing);
      }
    }

    // Analyze feature structure
    for (const [featureName, featureResults] of featureGroups) {
      const firstResult = featureResults[0];
      
      // Calculate actual counts
      const componentCount = featureResults.reduce((sum, r) => sum + r.components.length, 0);
      const hookCount = featureResults.reduce((sum, r) => sum + r.components.filter(c => c.type === 'hook').length, 0);
      const serviceCount = featureResults.reduce((sum, r) => sum + r.businessLogic.filter(bl => bl.type === 'service').length, 0);
      const typeCount = featureResults.reduce((sum, r) => sum + r.businessLogic.filter(bl => bl.type === 'repository').length, 0);
      const testCount = featureResults.filter(r => r.filePath.includes('.test.') || r.filePath.includes('.spec.')).length;
      const styleCount = featureResults.filter(r => r.filePath.includes('.css') || r.filePath.includes('.scss')).length;
      
      const structure = {
        componentCount,
        hookCount,
        serviceCount,
        typeCount,
        testCount,
        styleCount
      };

      const files = featureResults.map(r => ({
        name: path.basename(r.filePath),
        type: this.categorizeFileType(r.filePath),
        components: r.components.map(c => c.name),
        hooks: r.components.filter(c => c.type === 'hook').map(c => c.name),
        exports: r.businessLogic.map(bl => bl.name)
      }));

      // Analyze dependencies
      const allDependencies = featureResults.flatMap(r => 
        r.components.flatMap(c => c.dependencies)
      );
      
      const internal = allDependencies.filter(dep => dep.startsWith('./') || dep.startsWith('../'));
      const external = allDependencies.filter(dep => !dep.startsWith('.') && !dep.startsWith('@/'));
      const crossModule = allDependencies.filter(dep => dep.startsWith('@/'));

      featureStructure.push({
        name: featureName,
        path: firstResult.filePath,
        type: firstResult.featureType,
        structure,
        files,
        dependencies: { internal, external, crossModule }
      });

      // Build dependency graph
      for (const result of featureResults) {
        for (const component of result.components) {
          for (const dep of component.dependencies) {
            dependencyGraph.push({
              from: featureName,
              to: dep,
              type: 'import',
              weight: 1
            });
          }
        }
      }
    }

    return {
      totalModules: modulesByDirectory.size,
      modulesByDirectory: Array.from(modulesByDirectory.entries()).map(([directory, data]) => ({
        directory,
        ...data
      })),
      featureStructure,
      dependencyGraph: dependencyGraph.slice(0, 50) // Limit for readability
    };
  }

  private categorizeDirectory(dirName: string): 'features' | 'components' | 'hooks' | 'context' | 'lib' | 'types' | 'utils' {
    const name = dirName.toLowerCase();
    if (name.includes('feature') || name.includes('module')) return 'features';
    if (name.includes('component')) return 'components';
    if (name.includes('hook')) return 'hooks';
    if (name.includes('context')) return 'context';
    if (name.includes('lib') || name.includes('library')) return 'lib';
    if (name.includes('type')) return 'types';
    return 'utils';
  }

  private categorizeFileType(filePath: string): 'component' | 'hook' | 'service' | 'type' | 'test' | 'style' | 'other' {
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName.includes('.test.') || fileName.includes('.spec.')) return 'test';
    if (fileName.includes('.css') || fileName.includes('.scss') || fileName.includes('.module.')) return 'style';
    if (fileName.includes('.type.') || fileName.includes('.d.ts')) return 'type';
    if (fileName.startsWith('use') && fileName.includes('.ts')) return 'hook';
    if (fileName.includes('service') || fileName.includes('api')) return 'service';
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) return 'component';
    return 'other';
  }

  /**
   * Format feature data according to specified format
   */
  formatData(data: FeatureExtractionSummary, format: 'text' | 'markdown' | 'json' = 'text'): string {
    return FeatureFormatter.format(data, format);
  }
}
