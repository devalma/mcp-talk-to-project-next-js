/**
 * Simple dependency injection container implementation
 */

import type {
  IServiceContainer,
  IServiceScope,
  ServiceToken,
  ServiceImplementation,
  ServiceFactory,
  ServiceLifetime,
  ServiceRegistration,
  ContainerConfig
} from '../interfaces/container.js';

/**
 * Simple service container implementation
 */
export class ServiceContainer implements IServiceContainer {
  private registrations = new Map<symbol, ServiceRegistration<any>>();
  private singletons = new Map<symbol, any>();
  private config: ContainerConfig;

  constructor(config: Partial<ContainerConfig> = {}) {
    this.config = {
      autoRegister: false,
      strictMode: true,
      enableDecorators: false,
      defaultLifetime: 'transient',
      ...config
    };
  }

  register<T>(token: ServiceToken<T>, implementation: ServiceImplementation<T>): void {
    this.registerWithLifetime(token, implementation, 'transient');
  }

  registerSingleton<T>(token: ServiceToken<T>, implementation: ServiceImplementation<T>): void {
    this.registerWithLifetime(token, implementation, 'singleton');
  }

  registerFactory<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
    this.registrations.set(token.symbol, {
      token,
      factory,
      lifetime: 'transient',
      dependencies: []
    });
  }

  private registerWithLifetime<T>(
    token: ServiceToken<T>,
    implementation: ServiceImplementation<T>,
    lifetime: ServiceLifetime
  ): void {
    this.registrations.set(token.symbol, {
      token,
      implementation,
      lifetime,
      dependencies: []
    });
  }

  resolve<T>(token: ServiceToken<T>): T {
    const registration = this.registrations.get(token.symbol);
    
    if (!registration) {
      if (this.config.strictMode) {
        throw new Error(`Service not registered: ${token.name}`);
      }
      // In non-strict mode, try to auto-register if possible
      throw new Error(`Service not found: ${token.name}`);
    }

    // Check if it's a singleton and already instantiated
    if (registration.lifetime === 'singleton') {
      const existing = this.singletons.get(token.symbol);
      if (existing) {
        return existing;
      }
    }

    // Create instance
    let instance: T;
    
    if (registration.factory) {
      instance = registration.factory(this);
    } else if (registration.implementation) {
      // Resolve dependencies
      const deps = registration.dependencies?.map(dep => this.resolve(dep)) || [];
      instance = new registration.implementation(...deps);
    } else {
      throw new Error(`No implementation or factory for service: ${token.name}`);
    }

    // Store singleton
    if (registration.lifetime === 'singleton') {
      this.singletons.set(token.symbol, instance);
    }

    return instance;
  }

  has<T>(token: ServiceToken<T>): boolean {
    return this.registrations.has(token.symbol);
  }

  unregister<T>(token: ServiceToken<T>): void {
    this.registrations.delete(token.symbol);
    this.singletons.delete(token.symbol);
  }

  createScope(): IServiceScope {
    return new ServiceScope(this);
  }

  /**
   * Register multiple services from a module
   */
  registerModule(configure: (container: IServiceContainer) => void): void {
    configure(this);
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.registrations.values()).map(reg => reg.token.name);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.registrations.clear();
    this.singletons.clear();
  }
}

/**
 * Service scope implementation for scoped dependencies
 */
class ServiceScope implements IServiceScope {
  private parent: IServiceContainer;
  private scopedInstances = new Map<symbol, any>();

  constructor(parent: IServiceContainer) {
    this.parent = parent;
  }

  register<T>(token: ServiceToken<T>, implementation: ServiceImplementation<T>): void {
    this.parent.register(token, implementation);
  }

  registerSingleton<T>(token: ServiceToken<T>, implementation: ServiceImplementation<T>): void {
    this.parent.registerSingleton(token, implementation);
  }

  registerFactory<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
    this.parent.registerFactory(token, factory);
  }

  resolve<T>(token: ServiceToken<T>): T {
    // Check if we have a scoped instance
    const existing = this.scopedInstances.get(token.symbol);
    if (existing) {
      return existing;
    }

    // Resolve from parent and store in scope
    const instance = this.parent.resolve(token);
    this.scopedInstances.set(token.symbol, instance);
    return instance;
  }

  has<T>(token: ServiceToken<T>): boolean {
    return this.parent.has(token);
  }

  unregister<T>(token: ServiceToken<T>): void {
    this.parent.unregister(token);
    this.scopedInstances.delete(token.symbol);
  }

  createScope(): IServiceScope {
    return new ServiceScope(this);
  }

  dispose(): void {
    // Dispose scoped instances that implement IDisposable
    for (const instance of this.scopedInstances.values()) {
      if (instance && typeof instance.dispose === 'function') {
        instance.dispose();
      }
    }
    this.scopedInstances.clear();
  }
}
