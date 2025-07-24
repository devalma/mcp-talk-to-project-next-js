#!/usr/bin/env node

/**
 * Dynamic CLI for Next.js Project Analyzer MCP Server
 * Automatically builds commands from plugin metadata
 */

import { PluginManager } from './dist/plugins/manager.js';
import { registerAllPlugins } from './dist/plugins/registry.js';
import { isNextJsProject } from './dist/utils/file.js';
import fs from 'fs';
import path from 'path';

/**
 * Parse command line arguments intelligently
 */
function parseArguments() {
  const args = process.argv.slice(2);
  
  // Check for help first
  if (args.includes('help') || args.includes('--help') || args.includes('-h')) {
    return { command: 'help', projectPath: process.cwd(), options: args };
  }
  
  // Parse project path and command
  let projectPath, command;
  if (args.length === 0) {
    projectPath = process.cwd();
    command = 'overview';
  } else if (args.length === 1) {
    // Could be either project path or command
    // If it's a valid command, use current directory as project path
    const potentialCommand = args[0];
    if (fs.existsSync(potentialCommand) && fs.statSync(potentialCommand).isDirectory()) {
      projectPath = potentialCommand;
      command = 'overview';
    } else {
      projectPath = process.cwd();
      command = potentialCommand;
    }
  } else {
    projectPath = args[0];
    command = args[1];
  }
  
  const options = args.slice(2);
  return { projectPath, command, options, args };
}

/**
 * Show dynamic help built from plugin metadata
 */
async function showHelp(pluginManager, options = []) {
  try {
    const format = options.find(opt => opt.startsWith('--format='))?.split('=')[1] || 'text';
    const result = await pluginManager.executePlugin('help-extractor', process.cwd(), { format });
    
    if (result.success && result.data) {
      const helpPlugin = pluginManager.getPlugin('help-extractor');
      if (helpPlugin && helpPlugin.formatHelp) {
        console.log(helpPlugin.formatHelp(result.data, format));
      } else {
        console.log(JSON.stringify(result.data, null, 2));
      }
    } else {
      console.error('❌ Failed to generate help:', result.errors?.join(', ') || 'Unknown error');
      showFallbackHelp();
    }
  } catch (error) {
    console.error('❌ Error generating dynamic help:', error.message);
    showFallbackHelp();
  }
}

/**
 * Fallback help when dynamic help fails
 */
function showFallbackHelp() {
  console.log('Next.js Project Analyzer CLI');
  console.log('============================');
  console.log('');
  console.log('Usage: node cli.js [project-path] [command] [options]');
  console.log('');
  console.log('Available commands:');
  console.log('  overview     Show project overview');
  console.log('  components   List all React components');
  console.log('  hooks        List all hooks (custom and built-in)');
  console.log('  pages        List all pages and routes');
  console.log('  features     Show feature organization');
  console.log('  patterns     Find React patterns');
  console.log('  all          Run all extractors');
  console.log('  help         Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node cli.js . overview');
  console.log('  node cli.js . help --format=markdown');
  console.log('  node cli.js /path/to/project all');
}

/**
 * Validate project directory
 */
function validateProject(projectPath) {
  if (!fs.existsSync(projectPath)) {
    console.error(`❌ Error: Project path does not exist: ${projectPath}`);
    process.exit(1);
  }

  if (!isNextJsProject(projectPath)) {
    console.warn('⚠️  Warning: This may not be a Next.js project');
    console.warn('   (No next dependency found in package.json)');
    console.log('');
  }
}

/**
 * Execute overview command
 */
async function runOverview(pluginManager, projectPath) {
  console.log('📊 Next.js Project Overview');
  console.log('===========================');
  console.log(`Project: ${path.basename(projectPath)}`);
  console.log(`Path: ${projectPath}`);
  console.log('');

  try {
    // Basic project info
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      console.log(`Name: ${packageJson.name || 'Unknown'}`);
      console.log(`Version: ${packageJson.version || 'Unknown'}`);
      if (packageJson.dependencies?.next) {
        console.log(`Next.js: ${packageJson.dependencies.next}`);
      }
      console.log('');
    }

    // Quick analysis using plugin manager
    const promises = [
      pluginManager.executePlugin('component-extractor', projectPath),
      pluginManager.executePlugin('page-extractor', projectPath),
      pluginManager.executePlugin('hook-extractor', projectPath)
    ];
    
    const [componentsResult, pagesResult, hooksResult] = await Promise.all(promises);
    
    const components = componentsResult.success && componentsResult.data ? componentsResult.data : { totalComponents: 0 };
    const pages = pagesResult.success && pagesResult.data ? pagesResult.data : { pages: [] };
    const hooks = hooksResult.success && hooksResult.data ? hooksResult.data : { totalCustomHooks: 0, customHooksList: [] };

    console.log('📦 Components:', components.totalComponents || 0);
    console.log('📄 Pages:', pages.pages ? pages.pages.filter(p => p.type !== 'api').length : 0);
    console.log('🔌 API Routes:', pages.pages ? pages.pages.filter(p => p.type === 'api').length : 0);
    console.log('🎣 Custom Hooks:', hooks.totalCustomHooks || 0);

    // Structure info
    const hasAppDir = fs.existsSync(path.join(projectPath, 'app'));
    const hasPagesDir = fs.existsSync(path.join(projectPath, 'pages'));
    const hasSrcDir = fs.existsSync(path.join(projectPath, 'src'));
    
    console.log('');
    console.log('🏗️  Structure:');
    console.log(`   App Router: ${hasAppDir ? '✅' : '❌'}`);
    console.log(`   Pages Router: ${hasPagesDir ? '✅' : '❌'}`);
    console.log(`   Src Directory: ${hasSrcDir ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
  }
}

/**
 * Execute all extractors
 */
async function runAll(pluginManager, projectPath) {
  console.log('🧪 Complete Next.js Project Analysis');
  console.log('=====================================');
  console.log(`Target project: ${projectPath}`);
  console.log('');

  const extractors = ['component-extractor', 'hook-extractor', 'page-extractor', 'feature-extractor', 'pattern-extractor'];
  const icons = ['📦', '🎣', '📄', '🏗️', '🎨'];
  const names = ['component', 'hook', 'page', 'feature', 'pattern'];

  for (let i = 0; i < extractors.length; i++) {
    const extractor = extractors[i];
    const icon = icons[i];
    const name = names[i];
    
    console.log(`${icon} Testing ${name} extraction...`);
    try {
      const result = await pluginManager.executePlugin(extractor, projectPath);
      
      if (result.success && result.data) {
        const data = result.data;
        
        if (Array.isArray(data)) {
          console.log(`   Found ${data.length} ${name}s`);
          if (data.length > 0) {
            const example = data[0];
            console.log(`   Example: ${example.name || example.route || example.type || 'unknown'}`);
          }
        } else if (typeof data === 'object') {
          if (data.totalFeatures !== undefined) {
            console.log(`   Found ${data.totalFeatures || 0} features`);
            if (data.mostComplexFeatures && data.mostComplexFeatures.length > 0) {
              console.log(`   Most complex: ${data.mostComplexFeatures[0].name}`);
            }
          } else if (data.mostCommonPatterns) {
            console.log(`   Found ${data.mostCommonPatterns?.length || 0} pattern types`);
            if (data.mostCommonPatterns.length > 0) {
              console.log(`   Most common: ${data.mostCommonPatterns[0].type}`);
            }
          } else {
            console.log(`   Analysis completed`);
          }
        } else {
          console.log(`   Analysis completed`);
        }
      } else {
        console.log(`   ❌ ${name} extraction failed: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`   ❌ ${name} extraction failed: ${error.message}`);
    }
  }

  console.log('');
  console.log('✅ All plugin tests completed!');
  console.log('');
  console.log('💡 To use this as an MCP server:');
  console.log('1. Add it to your Claude Desktop configuration');
  console.log('2. Set NEXTJS_PROJECT_PATH environment variable');
  console.log('3. Use the available tools: get_components, get_hooks, get_pages, etc.');
}

/**
 * Execute a plugin command
 */
async function executePluginCommand(pluginManager, command, projectPath, options) {
  try {
    const result = await pluginManager.executePlugin(command, projectPath, { options });
    
    if (result.success) {
      // Format output based on options
      const format = options.find(opt => opt.startsWith('--format='))?.split('=')[1] || 'text';
      
      // Get the plugin instance to access formatData method
      const plugin = pluginManager.getPlugin(command);
      
      if (plugin && plugin.formatData && typeof plugin.formatData === 'function') {
        // Use the plugin's custom formatter
        const formattedOutput = plugin.formatData(result.data, format);
        console.log(formattedOutput);
      } else {
        // Fallback to JSON formatting
        if (format === 'markdown') {
          console.log('```json');
          console.log(JSON.stringify(result.data, null, 2));
          console.log('```');
        } else {
          console.log(JSON.stringify(result.data, null, 2));
        }
      }
    } else {
      console.error('❌ Command failed:', result.errors?.join(', ') || 'Unknown error');
      if (result.errors) {
        console.error('Details:', result.errors);
      }
    }
  } catch (error) {
    console.error('❌ Error executing command:', error.message);
    console.error('Stack:', error.stack);
  }
}

/**
 * Main CLI logic
 */
async function main() {
  const { projectPath, command, options, args } = parseArguments();
  
  // Initialize plugin manager
  const pluginManager = new PluginManager(projectPath);
  registerAllPlugins(pluginManager);
  
  console.log(`🔍 Analyzing: ${projectPath}`);
  console.log('');

  // Handle help command first
  if (command === 'help') {
    await showHelp(pluginManager, options);
    return;
  }

  // Validate project
  validateProject(projectPath);

  // Execute command
  switch (command) {
    case 'overview':
      await runOverview(pluginManager, projectPath);
      break;
      
    case 'all':
      await runAll(pluginManager, projectPath);
      break;
      
    default:
      // Try to execute as plugin command dynamically
      const plugins = pluginManager.getRegisteredPlugins();
      const matchingPlugin = plugins.find(p => p.metadata.cli?.command === command);
      
      if (matchingPlugin) {
        await executePluginCommand(pluginManager, matchingPlugin.metadata.name, projectPath, options);
      } else {
        console.error(`❌ Unknown command: ${command}`);
        console.log('');
        console.log('Available commands:');
        plugins.forEach(p => {
          if (p.metadata.cli) {
            console.log(`  ${p.metadata.cli.command.padEnd(12)} ${p.metadata.cli.description}`);
          }
        });
        console.log('  overview     Show project overview');
        console.log('  all          Run all extractors');
        console.log('  help         Show this help message');
        process.exit(1);
      }
  }
}

// Run CLI
main().catch(error => {
  console.error('❌ CLI Error:', error.message);
  process.exit(1);
});
