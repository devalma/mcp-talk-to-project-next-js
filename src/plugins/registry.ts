/**
 * Plugin Registry - Register all available plugins
 */

import { ComponentExtractorPlugin } from './component-extractor/index.js';
import { HookExtractorPlugin } from './hook-extractor/index.js';
import { PageExtractorPlugin } from './page-extractor/index.js';
import { PatternExtractorPlugin } from './pattern-extractor/index.js';
import { FeatureExtractorPlugin } from './feature-extractor/index.js';
import { HelpExtractorPlugin } from './help-extractor/index.js';
import type { PluginManager } from './manager.js';

/**
 * Register all plugins with the plugin manager
 */
export function registerAllPlugins(manager: PluginManager): void {
  // Register DRY Architecture plugins
  
  // Component Extractor Plugin (existing)
  const componentPlugin = new ComponentExtractorPlugin();
  manager.register(componentPlugin);

  // Hook Extractor Plugin (converted from extractor)
  const hookPlugin = new HookExtractorPlugin();
  manager.register(hookPlugin);

  // Page Extractor Plugin (converted from extractor)
  const pagePlugin = new PageExtractorPlugin();
  manager.register(pagePlugin);

  // Pattern Extractor Plugin (converted from extractor)
  const patternPlugin = new PatternExtractorPlugin();
  manager.register(patternPlugin);

  // Feature Extractor Plugin (converted from extractor)
  const featurePlugin = new FeatureExtractorPlugin();
  manager.register(featurePlugin);

  // Help Extractor Plugin (dynamic help system)
  const helpPlugin = new HelpExtractorPlugin();
  manager.register(helpPlugin);
}

/**
 * Get available plugin types for configuration
 */
export function getAvailablePlugins(): Array<{
  name: string;
  description: string;
  version: string;
  tags: string[];
}> {
  return [
    {
      name: 'component-extractor',
      description: 'Analyzes React components, their props, state, and relationships',
      version: '2.0.0',
      tags: ['react', 'components', 'props', 'state']
    },
    {
      name: 'hook-extractor',
      description: 'Analyzes React hooks usage, custom hooks, and hook dependencies',
      version: '2.0.0',
      tags: ['react', 'hooks', 'custom-hooks', 'dependencies']
    },
    {
      name: 'page-extractor',
      description: 'Analyzes Next.js pages, routes, SSR/SSG patterns, and navigation',
      version: '2.0.0',
      tags: ['nextjs', 'pages', 'routing', 'ssr', 'ssg']
    },
    {
      name: 'pattern-extractor',
      description: 'Analyzes React design patterns, anti-patterns, and architectural decisions',
      version: '2.0.0',
      tags: ['react', 'patterns', 'architecture', 'analysis']
    },
    {
      name: 'feature-extractor',
      description: 'Analyzes application features, business logic organization, and architectural patterns',
      version: '2.0.0',
      tags: ['features', 'architecture', 'organization', 'business-logic']
    }
  ];
}

/**
 * Create a plugin instance by name with optional configuration
 */
export function createPlugin(name: string, config?: any): any {
  switch (name) {
    case 'component-extractor':
      return new ComponentExtractorPlugin(config);
    case 'hook-extractor':
      return new HookExtractorPlugin(config);
    case 'page-extractor':
      return new PageExtractorPlugin(config);
    case 'pattern-extractor':
      return new PatternExtractorPlugin(config);
    case 'feature-extractor':
      return new FeatureExtractorPlugin(config);
    default:
      throw new Error(`Unknown plugin: ${name}`);
  }
}
