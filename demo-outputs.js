#!/usr/bin/env node

/**
 * Demo MCP Tool Output Test
 * Shows actual output from enhanced tools
 */

import { executeTool } from './dist/tools/index.js';
import { PluginManager } from './dist/plugins/manager.js';
import { registerAllPlugins } from './dist/plugins/registry.js';
import path from 'path';

async function demoToolOutputs() {
  console.log('🎯 Demo: Enhanced MCP Tool Outputs\n');

  // Initialize plugin manager
  const projectPath = path.join(process.cwd(), 'demo-project');
  const pluginManager = new PluginManager(projectPath);
  registerAllPlugins(pluginManager);

  const toolContext = {
    pluginManager,
    resolvedProjectPath: projectPath,
  };

  // Demo 1: Component Analysis - All Mode
  console.log('📦 DEMO 1: Component Analysis (All Mode)');
  console.log('==========================================');
  try {
    const result = await executeTool('analyze_components', { 
      mode: 'all', 
      format: 'text' 
    }, toolContext);
    console.log(result.content[0].text);
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Demo 2: Component Analysis - Specific Pattern
  console.log('🔍 DEMO 2: Component Analysis (Specific Pattern: "*Button*")');
  console.log('============================================================');
  try {
    const result = await executeTool('analyze_components', { 
      mode: 'specific',
      componentPattern: '*Button*',
      format: 'markdown' 
    }, toolContext);
    console.log(result.content[0].text);
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Demo 3: Hook Analysis - JSON Format
  console.log('🎣 DEMO 3: Hook Analysis (JSON Format)');
  console.log('======================================');
  try {
    const result = await executeTool('analyze_hooks', { 
      mode: 'all',
      format: 'json' 
    }, toolContext);
    console.log(result.content[0].text);
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Demo 4: Project Overview - Markdown Format
  console.log('📊 DEMO 4: Project Overview (Markdown Format)');
  console.log('==============================================');
  try {
    const result = await executeTool('get_project_overview', { 
      format: 'markdown' 
    }, toolContext);
    console.log(result.content[0].text);
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Demo 5: Help System
  console.log('❓ DEMO 5: Help System');
  console.log('======================');
  try {
    const result = await executeTool('get_help', { 
      format: 'text' 
    }, toolContext);
    console.log(result.content[0].text);
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n✅ Demo completed successfully!');
}

demoToolOutputs().catch(console.error);
