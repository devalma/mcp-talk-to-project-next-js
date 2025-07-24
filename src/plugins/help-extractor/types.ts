/**
 * Types for help extractor plugin
 */

export interface HelpData {
  title: string;
  usage: string;
  globalOptions: CLIOption[];
  commands: CommandInfo[];
  examples: string[];
  notes?: string[];
}

export interface CommandInfo {
  command: string;
  description: string;
  usage?: string;
  options?: CLIOption[];
  examples?: string[];
  category?: string;
}

export interface CLIOption {
  name: string;
  description: string;
  type: 'boolean' | 'string' | 'number';
  default?: any;
  required?: boolean;
}

export type HelpFormat = 'text' | 'markdown';

export interface HelpOptions {
  format?: HelpFormat;
  includeExamples?: boolean;
  includeOptions?: boolean;
  command?: string; // Show help for specific command
}
