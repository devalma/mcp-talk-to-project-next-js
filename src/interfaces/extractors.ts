/**
 * Extractor-specific interfaces
 */

import type { IExtractor, IValidator, IFilterStrategy, ValidationResult } from './core.js';
import type { ComponentInfo, HookInfo, PageInfo } from '../types/info.js';

/**
 * Component extractor interface
 */
export interface IComponentExtractor extends IExtractor<string, ComponentExtractionResult> {
  extractFromAST(ast: any, filePath: string): ComponentInfo[];
  getComponentType(node: any): 'functional' | 'class' | 'unknown';
  extractProps(node: any): PropExtractionResult;
  extractHooks(node: any): HookExtractionResult;
}

/**
 * Hook extractor interface
 */
export interface IHookExtractor extends IExtractor<string, HookExtractionResult> {
  extractCustomHooks(ast: any): HookInfo[];
  extractBuiltinHookUsage(ast: any): BuiltinHookUsage[];
  getHookDependencies(hookName: string): string[];
}

/**
 * Page extractor interface
 */
export interface IPageExtractor extends IExtractor<string, PageExtractionResult> {
  extractRoutes(projectPath: string): RouteInfo[];
  getPageType(filePath: string): 'app-router' | 'pages-router' | 'static';
  extractMetadata(ast: any): PageMetadata;
}

/**
 * Feature extractor interface
 */
export interface IFeatureExtractor extends IExtractor<string, FeatureExtractionResult> {
  identifyFeatures(projectPath: string): FeatureInfo[];
  getFeatureStructure(featurePath: string): FeatureStructure;
  extractDependencies(featurePath: string): FeatureDependency[];
}

/**
 * Component validator interface
 */
export interface IComponentValidator extends IValidator<ComponentInfo> {
  validateProps(props: any[]): ValidationResult;
  validateHooks(hooks: any[]): ValidationResult;
  validateNaming(name: string): ValidationResult;
}

/**
 * Component filter interface
 */
export interface IComponentFilter extends IFilterStrategy {
  filterByType(type: 'functional' | 'class'): boolean;
  filterByFeature(feature: string): boolean;
  filterByComplexity(maxProps?: number, maxHooks?: number): boolean;
}

// Result types
export interface ComponentExtractionResult {
  components: ComponentInfo[];
  summary: ComponentSummary;
  errors: ExtractionError[];
  warnings: ExtractionWarning[];
}

export interface PropExtractionResult {
  props: PropInfo[];
  defaultProps: Record<string, any>;
  propTypes?: any;
}

export interface HookExtractionResult {
  customHooks: HookInfo[];
  builtinHooks: BuiltinHookUsage[];
  hookDependencies: Record<string, string[]>;
}

export interface PageExtractionResult {
  pages: PageInfo[];
  routes: RouteInfo[];
  metadata: PageMetadata[];
}

export interface FeatureExtractionResult {
  features: FeatureInfo[];
  dependencies: FeatureDependency[];
  structure: FeatureStructure[];
}

// Supporting types
export interface ComponentSummary {
  totalComponents: number;
  functionalComponents: number;
  classComponents: number;
  componentsWithProps: number;
  componentsWithHooks: number;
  averageComplexity: number;
}

export interface BuiltinHookUsage {
  hookName: string;
  count: number;
  locations: HookLocation[];
}

export interface HookLocation {
  filePath: string;
  lineNumber: number;
  componentName?: string;
}

export interface RouteInfo {
  path: string;
  filePath: string;
  type: 'page' | 'api' | 'layout' | 'loading' | 'error';
  dynamic: boolean;
  params?: string[];
}

export interface PageMetadata {
  title?: string;
  description?: string;
  keywords?: string[];
  openGraph?: Record<string, any>;
}

export interface FeatureInfo {
  name: string;
  path: string;
  type: 'feature' | 'module' | 'shared';
  components: number;
  hooks: number;
  services: number;
}

export interface FeatureStructure {
  components: string[];
  hooks: string[];
  services: string[];
  types: string[];
  utils: string[];
}

export interface FeatureDependency {
  from: string;
  to: string;
  type: 'import' | 'component' | 'hook' | 'service';
}

export interface ExtractionError {
  filePath: string;
  message: string;
  code: string;
  lineNumber?: number;
}

export interface ExtractionWarning {
  filePath: string;
  message: string;
  suggestion?: string;
}

export interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
  description?: string;
}
