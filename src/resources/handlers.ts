/**
 * Resource Handlers
 * 
 * Handlers that generate the actual resource content
 */

import type { ResourceHandler, ResourceContext } from './types.js';

/**
 * Project Structure Resource Handler
 * Generates a visual representation of the project file structure
 */
export const projectStructureHandler: ResourceHandler = {
  async generate(projectPath: string): Promise<string> {
    const path = await import('path');
    const fs = await import('fs/promises');
    
    const files: string[] = [];
    
    const scanDir = async (dir: string, indent = '') => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          
          files.push(`${indent}${entry.isDirectory() ? '📁' : '📄'} ${entry.name}`);
          
          if (entry.isDirectory() && files.length < 100) { // Limit to prevent huge outputs
            await scanDir(path.join(dir, entry.name), indent + '  ');
          }
        }
      } catch (error) {
        // Ignore permission errors, etc.
      }
    };
    
    await scanDir(projectPath);
    return files.slice(0, 100).join('\n'); // Limit output
  }
};

/**
 * Analysis Summary Resource Handler
 * Generates comprehensive project analysis data
 */
export const analysisSummaryHandler: ResourceHandler = {
  async generate(projectPath: string, pluginManager: any): Promise<string> {
    try {
      // Get project overview data
      const projectOverview = await getProjectOverview(projectPath);
      
      // Get comprehensive project data from multiple extractors
      const [
        componentsData,
        pagesData,
        hooksData,
        featuresData,
        patternsData
      ] = await Promise.allSettled([
        pluginManager.executePlugin('component-extractor', projectPath),
        pluginManager.executePlugin('page-extractor', projectPath),
        pluginManager.executePlugin('hook-extractor', projectPath),
        pluginManager.executePlugin('feature-extractor', projectPath),
        pluginManager.executePlugin('pattern-extractor', projectPath)
      ]);

      const analysisData = {
        projectOverview,
        components: componentsData.status === 'fulfilled' && componentsData.value.success 
          ? componentsData.value.data 
          : { error: 'Failed to analyze components' },
        pages: pagesData.status === 'fulfilled' && pagesData.value.success 
          ? pagesData.value.data 
          : { error: 'Failed to analyze pages' },
        hooks: hooksData.status === 'fulfilled' && hooksData.value.success 
          ? hooksData.value.data 
          : { error: 'Failed to analyze hooks' },
        features: featuresData.status === 'fulfilled' && featuresData.value.success 
          ? featuresData.value.data 
          : { error: 'Failed to analyze features' },
        patterns: patternsData.status === 'fulfilled' && patternsData.value.success 
          ? patternsData.value.data 
          : { error: 'Failed to analyze patterns' },
        timestamp: new Date().toISOString(),
        analysisVersion: '1.0.0'
      };

      return JSON.stringify(analysisData, null, 2);
    } catch (error) {
      const errorData = { 
        error: 'Failed to generate comprehensive analysis summary',
        timestamp: new Date().toISOString()
      };
      return JSON.stringify(errorData, null, 2);
    }
  }
};

/**
 * Get project overview data
 */
async function getProjectOverview(projectPath: string): Promise<any> {
  const path = await import('path');
  const fs = await import('fs/promises');
  
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
    const packageJson = packageJsonExists 
      ? JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
      : {};

    const nextConfigPath = path.join(projectPath, 'next.config.js');
    const nextConfigExists = await fs.access(nextConfigPath).then(() => true).catch(() => false);

    // Detect project structure
    const hasAppDir = await fs.access(path.join(projectPath, 'app')).then(() => true).catch(() => false);
    const hasPagesDir = await fs.access(path.join(projectPath, 'pages')).then(() => true).catch(() => false);
    const hasSrcDir = await fs.access(path.join(projectPath, 'src')).then(() => true).catch(() => false);

    let structure: 'pages' | 'app' | 'mixed' = 'pages';
    if (hasAppDir && hasPagesDir) {
      structure = 'mixed';
    } else if (hasAppDir) {
      structure = 'app';
    }

    return {
      name: packageJson.name || path.basename(projectPath),
      version: packageJson.version,
      nextVersion: packageJson.dependencies?.next || packageJson.devDependencies?.next,
      structure,
      typescript: await fs.access(path.join(projectPath, 'tsconfig.json')).then(() => true).catch(() => false),
      hasSrcDirectory: hasSrcDir,
      hasAppDirectory: hasAppDir,
      hasPagesDirectory: hasPagesDir,
      hasNextConfig: nextConfigExists,
      dependencies: Object.keys(packageJson.dependencies || {}),
      devDependencies: Object.keys(packageJson.devDependencies || {}),
      scripts: packageJson.scripts || {}
    };
  } catch (error) {
    return {
      name: path.basename(projectPath),
      error: 'Failed to read project information'
    };
  }
}
