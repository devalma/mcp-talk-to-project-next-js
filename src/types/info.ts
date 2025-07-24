export interface ComponentInfo {
  name: string;
  type: 'functional' | 'class';
  file: string;
  props?: PropInfo[];
  hooks?: string[];
  exports: 'default' | 'named';
  category: 'shared' | 'feature';
  feature?: string;
  imports?: string[];
  jsxElements?: string[];
}

export interface PropInfo {
  name: string;
  type?: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface HookInfo {
  name: string;
  file: string;
  type: 'custom' | 'builtin';
  parameters?: string[];
  returns?: string[];
  dependencies?: string[];
  usedBy?: string[];
  signature?: string;
}

export interface PageInfo {
  route: string;
  file: string;
  component?: string;
  type?: 'static' | 'dynamic' | 'api';
  dataFetching?: string[];
  dynamicParams?: string[];
  methods?: string[];
}

export interface FeatureInfo {
  name: string;
  path: string;
  components: ComponentInfo[];
  hooks: HookInfo[];
  types?: TypeInfo[];
  services?: string[];
}

export interface TypeInfo {
  name: string;
  file: string;
  kind: 'interface' | 'type' | 'enum' | 'class';
  properties?: string[];
  extends?: string[];
  description?: string;
}

export interface PatternInfo {
  name: string;
  file: string;
  type: 'context' | 'hoc' | 'render-props' | 'custom-hook';
  provider?: string;
  hook?: string;
  values?: string[];
  parameters?: string[];
}

export interface ProjectInfo {
  name: string;
  version?: string;
  nextVersion?: string;
  structure: 'pages' | 'app' | 'mixed';
  typescript: boolean;
  componentCount: number;
  pageCount: number;
  apiRouteCount: number;
  customHookCount: number;
  features: string[];
  dependencies: string[];
  devDependencies?: string[];
}

export interface SearchResult {
  file: string;
  name: string;
  type: 'component' | 'hook' | 'function' | 'type' | 'page';
  score: number;
  description?: string;
  relevantCode?: string;
}

export interface SimilarityResult {
  file: string;
  name: string;
  similarity: number;
  reasons: string[];
  type?: string;
}
