/**
 * Dependency injection container interfaces
 */

/**
 * Service container interface for dependency injection
 */
export interface IServiceContainer {
  register<T>(token: ServiceToken<T>, implementation: ServiceImplementation<T>): void;
  registerSingleton<T>(token: ServiceToken<T>, implementation: ServiceImplementation<T>): void;
  registerFactory<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void;
  resolve<T>(token: ServiceToken<T>): T;
  has<T>(token: ServiceToken<T>): boolean;
  unregister<T>(token: ServiceToken<T>): void;
  createScope(): IServiceScope;
}

/**
 * Service scope interface for scoped dependencies
 */
export interface IServiceScope extends IServiceContainer {
  dispose(): void;
}

/**
 * Service token for type-safe dependency injection
 */
export interface ServiceToken<T> {
  readonly symbol: symbol;
  readonly name: string;
}

/**
 * Service implementation types
 */
export type ServiceImplementation<T> = new (...args: any[]) => T;
export type ServiceFactory<T> = (container: IServiceContainer) => T;
export type ServiceLifetime = 'transient' | 'singleton' | 'scoped';

/**
 * Service registration options
 */
export interface ServiceRegistration<T> {
  token: ServiceToken<T>;
  implementation?: ServiceImplementation<T>;
  factory?: ServiceFactory<T>;
  lifetime: ServiceLifetime;
  dependencies?: ServiceToken<any>[];
}

/**
 * Service decorator interface
 */
export interface IServiceDecorator<T> {
  decorate(instance: T): T;
  canDecorate(token: ServiceToken<any>): boolean;
}

/**
 * Module interface for organizing service registrations
 */
export interface IServiceModule {
  configure(container: IServiceContainer): void;
  getName(): string;
  getDependencies(): string[];
}

// Service tokens for our application
export const SERVICE_TOKENS = {
  FileService: createToken<import('./services.js').IFileService>('IFileService'),
  ASTService: createToken<import('./services.js').IASTService>('IASTService'),
  AnalysisService: createToken<import('./services.js').IAnalysisService>('IAnalysisService'),
  ReportService: createToken<import('./services.js').IReportService>('IReportService'),
  PluginRegistry: createToken<import('./services.js').IPluginRegistry>('IPluginRegistry'),
  Logger: createToken<import('./services.js').ILogger>('ILogger'),
  ConfigService: createToken<import('./services.js').IConfigService>('IConfigService'),
  CacheService: createToken<import('./services.js').ICacheService>('ICacheService'),
  ComponentExtractor: createToken<import('./extractors.js').IComponentExtractor>('IComponentExtractor'),
  HookExtractor: createToken<import('./extractors.js').IHookExtractor>('IHookExtractor'),
  PageExtractor: createToken<import('./extractors.js').IPageExtractor>('IPageExtractor'),
  FeatureExtractor: createToken<import('./extractors.js').IFeatureExtractor>('IFeatureExtractor'),
} as const;

/**
 * Helper function to create service tokens
 */
export function createToken<T>(name: string): ServiceToken<T> {
  return {
    symbol: Symbol(name),
    name
  };
}

/**
 * Injectable decorator metadata
 */
export interface InjectableMetadata {
  token: ServiceToken<any>;
  lifetime: ServiceLifetime;
  dependencies: ServiceToken<any>[];
}

/**
 * Dependency metadata for constructor injection
 */
export interface DependencyMetadata {
  token: ServiceToken<any>;
  parameterIndex: number;
  optional: boolean;
}

/**
 * Container configuration interface
 */
export interface ContainerConfig {
  autoRegister: boolean;
  strictMode: boolean;
  enableDecorators: boolean;
  defaultLifetime: ServiceLifetime;
}

/**
 * Container events interface
 */
export interface IContainerEvents {
  onBeforeResolve<T>(token: ServiceToken<T>, callback: (token: ServiceToken<T>) => void): void;
  onAfterResolve<T>(token: ServiceToken<T>, callback: (token: ServiceToken<T>, instance: T) => void): void;
  onRegistration<T>(callback: (registration: ServiceRegistration<T>) => void): void;
  onDisposal(callback: (token: ServiceToken<any>) => void): void;
}
