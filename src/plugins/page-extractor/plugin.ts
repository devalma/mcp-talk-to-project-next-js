/**
 * Page Extractor Plugin - Using DRY utilities
 */

import { BaseExtractor, type ExtractorConfig } from '../common/base-extractor.js';
import { NextJSUtils } from '../common/nextjs-utils.js';
import { ReactComponentUtils } from '../common/react-component-utils.js';
import { ASTUtils } from '../common/ast-utils.js';
import type { PluginResult, PluginMetadata } from '../../types/plugin.js';
import { PageFormatter } from './formatter.js';
import fs from 'fs';
import path from 'path';

// Enhanced config for page extraction
export interface PageExtractorConfig extends ExtractorConfig {
  includeApiRoutes?: boolean;
  includeAppDir?: boolean;
  trackDynamicRoutes?: boolean;
  analyzeComponents?: boolean;
}

// Result types for page extraction
export interface PageAnalysisResult {
  filePath: string;
  route: string;
  pageType: 'page' | 'api' | 'layout' | 'loading' | 'error' | 'not-found';
  isDynamic: boolean;
  dynamicSegments: string[];
  exports: Array<{
    name: string;
    type: 'default' | 'named';
    isPageFunction: boolean;
  }>;
  components: Array<{
    name: string;
    type: 'functional' | 'class';
  }>;
  hasServerSideRendering: boolean;
  hasStaticGeneration: boolean;
  isAppDirectory: boolean;
}

export interface PageExtractionSummary {
  totalFiles: number;
  totalPages: number;
  totalApiRoutes: number;
  totalDynamicRoutes: number;
  pagesByType: Record<string, number>;
  routesByDirectory: Array<{ directory: string; pages: number; routes: string[] }>;
  renderingMethods: {
    ssr: number;
    ssg: number;
    spa: number;
  };
  mostComplexRoutes: Array<{ route: string; dynamicSegments: number; components: number }>;
  pages: Array<{
    route: string;
    pageType: 'page' | 'api' | 'layout' | 'loading' | 'error' | 'not-found';
    file: string;
    isDynamic: boolean;
    dynamicSegments: string[];
    hasSSR: boolean;
    hasSSG: boolean;
    components: Array<{ name: string; type: 'functional' | 'class' }>;
    exports: Array<{ name: string; type: 'default' | 'named'; isPageFunction: boolean }>;
  }>;
}

/**
 * Page Extractor Plugin using DRY utilities
 */
export class PageExtractorPlugin extends BaseExtractor<PageAnalysisResult, PageExtractionSummary> {
  
  get metadata(): PluginMetadata {
    return {
      name: 'page-extractor',
      version: '2.0.0',
      description: 'Analyzes Next.js pages, API routes, and App Router structure',
      author: 'MCP Next.js Analyzer',
      tags: ['nextjs', 'pages', 'routes', 'analysis'],
      cli: {
        command: 'pages',
        description: 'List all pages and routes',
        usage: 'node cli.js [project-path] pages [options]',
        category: 'analysis',
        options: [
          {
            name: '--no-api',
            description: 'Exclude API routes from output',
            type: 'boolean',
            default: false
          },
          {
            name: '--dynamic',
            description: 'Show only dynamic routes',
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
          'node cli.js . pages',
          'node cli.js . pages --no-api',
          'node cli.js /path/to/project pages --dynamic --format=markdown'
        ]
      }
    };
  }

  constructor(config: PageExtractorConfig = {}) {
    super({
      filePatterns: ['**/pages/**/*.{js,jsx,ts,tsx}', '**/app/**/*.{js,jsx,ts,tsx}'],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.d.ts',
        '**/_*.{js,jsx,ts,tsx}' // Exclude Next.js internal files
      ],
      batchSize: 5,
      parallel: true,
      includeApiRoutes: true,
      includeAppDir: true,
      trackDynamicRoutes: true,
      analyzeComponents: true,
      ...config
    });
  }

  shouldProcess(filePath: string): boolean {
    // For directories, always allow processing
    if (!path.extname(filePath)) {
      return true;
    }
    
    // Only process files in pages or app directories
    return filePath.includes('/pages/') || filePath.includes('/app/');
  }

  protected shouldProcessFile(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    
    const config = this.extractorConfig as PageExtractorConfig;
    
    // Check if it's in pages or app directory
    const isPageFile = filePath.includes('/pages/');
    const isAppFile = filePath.includes('/app/');
    
    if (!isPageFile && !isAppFile) return false;
    
    // Skip API routes if not included
    if (filePath.includes('/api/') && !config.includeApiRoutes) {
      return false;
    }
    
    // Skip app directory if not included
    if (isAppFile && !config.includeAppDir) {
      return false;
    }
    
    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
  }

  protected async processFile(filePath: string): Promise<PageAnalysisResult | null> {
    try {
      const parsed = await this.parseFileWithCache(filePath);
      if (!parsed || !parsed.ast) return null;

      const ast = parsed.ast; // Extract the actual AST from ParsedAST
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = this.extractorConfig as PageExtractorConfig;

      // Determine route and page type
      const route = this.generateRoute(filePath);
      const pageType = this.determinePageType(filePath);
      const isAppDirectory = filePath.includes('/app/');
      
      // Check for dynamic routes
      const isDynamic = NextJSUtils.isDynamicRoute(filePath);
      const dynamicSegments = this.extractDynamicSegments(filePath);

      // Extract exports
      const exports = ASTUtils.findExports(ast);

      // Extract components if enabled
      const components = config.analyzeComponents ? 
        ReactComponentUtils.findReactComponents(ast) : [];

      // Check rendering methods
      const hasServerSideRendering = this.hasSSR(exports);
      const hasStaticGeneration = this.hasSSG(exports);

      return {
        filePath,
        route,
        pageType,
        isDynamic,
        dynamicSegments,
        exports: exports.map((exp: any) => ({
          name: exp.name,
          type: exp.type,
          isPageFunction: this.isPageFunction(exp.name)
        })),
        components: components.map(comp => ({
          name: comp.name,
          type: comp.type
        })),
        hasServerSideRendering,
        hasStaticGeneration,
        isAppDirectory
      };

    } catch (error) {
      this.logger.error(`Failed to process ${filePath}:`, error);
      return null;
    }
  }

  protected async aggregateResults(results: PageAnalysisResult[], targetPath: string): Promise<PageExtractionSummary> {
    const pagesByType: Record<string, number> = {};
    const routesByDirectory = new Map<string, { pages: number; routes: string[] }>();
    
    let totalPages = 0;
    let totalApiRoutes = 0;
    let totalDynamicRoutes = 0;
    let ssrCount = 0;
    let ssgCount = 0;
    let spaCount = 0;

    const complexRoutes: Array<{ route: string; dynamicSegments: number; components: number }> = [];

    for (const result of results) {
      // Count by type
      pagesByType[result.pageType] = (pagesByType[result.pageType] || 0) + 1;
      
      if (result.pageType === 'page') totalPages++;
      if (result.pageType === 'api') totalApiRoutes++;
      if (result.isDynamic) totalDynamicRoutes++;

      // Count rendering methods
      if (result.hasServerSideRendering) ssrCount++;
      if (result.hasStaticGeneration) ssgCount++;
      if (!result.hasServerSideRendering && !result.hasStaticGeneration) spaCount++;

      // Track by directory
      const directory = path.dirname(this.getRelativePath(result.filePath));
      const dirData = routesByDirectory.get(directory) || { pages: 0, routes: [] };
      dirData.pages++;
      dirData.routes.push(result.route);
      routesByDirectory.set(directory, dirData);

      // Track complex routes
      complexRoutes.push({
        route: result.route,
        dynamicSegments: result.dynamicSegments.length,
        components: result.components.length
      });
    }

    // Get most complex routes
    const mostComplexRoutes = complexRoutes
      .sort((a, b) => (b.dynamicSegments + b.components) - (a.dynamicSegments + a.components))
      .slice(0, 10);

    return {
      totalFiles: results.length,
      totalPages,
      totalApiRoutes,
      totalDynamicRoutes,
      pagesByType,
      routesByDirectory: Array.from(routesByDirectory.entries())
        .map(([directory, data]) => ({ directory, ...data }))
        .sort((a, b) => b.pages - a.pages),
      renderingMethods: {
        ssr: ssrCount,
        ssg: ssgCount,
        spa: spaCount
      },
      mostComplexRoutes,
      pages: results.map(result => ({
        route: result.route,
        pageType: result.pageType,
        file: result.filePath,
        isDynamic: result.isDynamic,
        dynamicSegments: result.dynamicSegments,
        hasSSR: result.hasServerSideRendering,
        hasSSG: result.hasStaticGeneration,
        components: result.components,
        exports: result.exports
      }))
    };
  }

  private generateRoute(filePath: string): string {
    // Extract route from file path
    let route = filePath;
    
    // Remove everything before /pages/ or /app/
    if (route.includes('/pages/')) {
      route = route.substring(route.indexOf('/pages/') + 7);
    } else if (route.includes('/app/')) {
      route = route.substring(route.indexOf('/app/') + 5);
    }
    
    // Remove file extension
    route = route.replace(/\.[jt]sx?$/, '');
    
    // Handle index files
    if (route.endsWith('/index')) {
      route = route.substring(0, route.length - 6) || '/';
    }
    
    // Convert to route format
    if (!route.startsWith('/')) {
      route = '/' + route;
    }
    
    return route;
  }

  private determinePageType(filePath: string): PageAnalysisResult['pageType'] {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    if (filePath.includes('/api/')) return 'api';
    if (fileName === 'layout') return 'layout';
    if (fileName === 'loading') return 'loading';
    if (fileName === 'error') return 'error';
    if (fileName === 'not-found') return 'not-found';
    
    return 'page';
  }

  private extractDynamicSegments(filePath: string): string[] {
    const segments: string[] = [];
    const parts = filePath.split('/');
    
    for (const part of parts) {
      // Dynamic route segments: [slug], [id], etc.
      if (part.includes('[') && part.includes(']')) {
        segments.push(part);
      }
      // Catch-all routes: [...slug]
      if (part.includes('[...') && part.includes(']')) {
        segments.push(part);
      }
    }
    
    return segments;
  }

  private hasSSR(exports: any[]): boolean {
    return exports.some(exp => 
      exp.name === 'getServerSideProps' || 
      exp.name === 'getInitialProps'
    );
  }

  private hasSSG(exports: any[]): boolean {
    return exports.some(exp => 
      exp.name === 'getStaticProps' || 
      exp.name === 'getStaticPaths'
    );
  }

  private isPageFunction(exportName: string): boolean {
    const pageFunctions = [
      'default', 'getServerSideProps', 'getStaticProps', 
      'getStaticPaths', 'getInitialProps'
    ];
    return pageFunctions.includes(exportName);
  }

  /**
   * Format page data according to specified format
   */
  formatData(data: PageExtractionSummary, format: 'text' | 'markdown' | 'json' = 'text'): string {
    return PageFormatter.format(data, format);
  }
}
