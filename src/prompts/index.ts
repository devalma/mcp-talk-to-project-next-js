/**
 * Prompts Registry
 * 
 * Central registry for all available prompts
 */

import type { PromptModule, PromptDefinition, PromptResponse } from './types.js';
import { analyzeProjectPrompt } from './analyze-project.js';
import { findPatternsPrompt } from './find-patterns.js';
import { componentAnalysisPrompt } from './component-analysis.js';

/**
 * Registry of all available prompts
 */
const promptRegistry = new Map<string, PromptModule>([
  [analyzeProjectPrompt.definition.name, analyzeProjectPrompt],
  [findPatternsPrompt.definition.name, findPatternsPrompt],
  [componentAnalysisPrompt.definition.name, componentAnalysisPrompt],
]);

/**
 * Get all available prompt definitions
 */
export function getAllPromptDefinitions(): PromptDefinition[] {
  return Array.from(promptRegistry.values()).map(prompt => prompt.definition);
}

/**
 * Get a specific prompt module by name
 */
export function getPromptModule(name: string): PromptModule | undefined {
  return promptRegistry.get(name);
}

/**
 * Generate a prompt response for a given prompt name and arguments
 */
export async function generatePrompt(name: string, args: Record<string, any>): Promise<PromptResponse> {
  const promptModule = promptRegistry.get(name);
  
  if (!promptModule) {
    throw new Error(`Unknown prompt: ${name}`);
  }
  
  return await promptModule.generator.generate(args);
}

/**
 * Check if a prompt exists
 */
export function hasPrompt(name: string): boolean {
  return promptRegistry.has(name);
}

/**
 * Get all available prompt names
 */
export function getPromptNames(): string[] {
  return Array.from(promptRegistry.keys());
}

/**
 * Register a new prompt module
 */
export function registerPrompt(promptModule: PromptModule): void {
  promptRegistry.set(promptModule.definition.name, promptModule);
}

/**
 * Unregister a prompt
 */
export function unregisterPrompt(name: string): boolean {
  return promptRegistry.delete(name);
}

/**
 * Get registry statistics
 */
export function getRegistryStats() {
  return {
    totalPrompts: promptRegistry.size,
    promptNames: getPromptNames(),
    lastUpdated: new Date().toISOString(),
  };
}
