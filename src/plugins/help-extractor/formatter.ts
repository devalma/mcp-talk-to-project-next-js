/**
 * Help formatter for different output formats
 */

import type { HelpData, HelpFormat, CommandInfo, CLIOption } from './types.js';

export class HelpFormatter {
  
  static format(helpData: HelpData, format: HelpFormat = 'text'): string {
    switch (format) {
      case 'markdown':
        return this.formatMarkdown(helpData);
      case 'text':
      default:
        return this.formatText(helpData);
    }
  }

  private static formatText(helpData: HelpData): string {
    const lines: string[] = [];
    
    // Title
    lines.push(helpData.title);
    lines.push('='.repeat(helpData.title.length));
    lines.push('');
    
    // Usage
    lines.push('Usage:');
    lines.push(`  ${helpData.usage}`);
    lines.push('');
    
    // Global options
    if (helpData.globalOptions.length > 0) {
      lines.push('Global Options:');
      helpData.globalOptions.forEach(option => {
        const typeInfo = option.type === 'boolean' ? '' : ` <${option.type}>`;
        const defaultInfo = option.default !== undefined ? ` (default: ${option.default})` : '';
        lines.push(`  ${option.name}${typeInfo}${defaultInfo}`);
        lines.push(`    ${option.description}`);
      });
      lines.push('');
    }
    
    // Commands by category
    const commandsByCategory = this.groupCommandsByCategory(helpData.commands);
    
    Object.entries(commandsByCategory).forEach(([category, commands]) => {
      lines.push(`${category} Commands:`);
      commands.forEach(cmd => {
        lines.push(`  ${cmd.command.padEnd(12)} ${cmd.description}`);
      });
      lines.push('');
    });
    
    // Examples
    if (helpData.examples.length > 0) {
      lines.push('Examples:');
      helpData.examples.forEach(example => {
        lines.push(`  ${example}`);
      });
      lines.push('');
    }
    
    // Notes
    if (helpData.notes && helpData.notes.length > 0) {
      lines.push('Notes:');
      helpData.notes.forEach(note => {
        lines.push(`  ${note}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private static formatMarkdown(helpData: HelpData): string {
    const lines: string[] = [];
    
    // Title
    lines.push(`# ${helpData.title}`);
    lines.push('');
    
    // Usage
    lines.push('## Usage');
    lines.push('');
    lines.push('```bash');
    lines.push(helpData.usage);
    lines.push('```');
    lines.push('');
    
    // Global options
    if (helpData.globalOptions.length > 0) {
      lines.push('## Global Options');
      lines.push('');
      helpData.globalOptions.forEach(option => {
        const typeInfo = option.type === 'boolean' ? '' : ` \`<${option.type}>\``;
        const defaultInfo = option.default !== undefined ? ` (default: \`${option.default}\`)` : '';
        lines.push(`### \`${option.name}\`${typeInfo}${defaultInfo}`);
        lines.push('');
        lines.push(option.description);
        lines.push('');
      });
    }
    
    // Commands by category
    const commandsByCategory = this.groupCommandsByCategory(helpData.commands);
    
    Object.entries(commandsByCategory).forEach(([category, commands]) => {
      lines.push(`## ${category} Commands`);
      lines.push('');
      
      commands.forEach(cmd => {
        lines.push(`### \`${cmd.command}\``);
        lines.push('');
        lines.push(cmd.description);
        lines.push('');
        
        if (cmd.usage) {
          lines.push('**Usage:**');
          lines.push('```bash');
          lines.push(cmd.usage);
          lines.push('```');
          lines.push('');
        }
        
        if (cmd.options && cmd.options.length > 0) {
          lines.push('**Options:**');
          lines.push('');
          cmd.options.forEach(option => {
            const typeInfo = option.type === 'boolean' ? '' : ` \`<${option.type}>\``;
            const defaultInfo = option.default !== undefined ? ` (default: \`${option.default}\`)` : '';
            lines.push(`- \`${option.name}\`${typeInfo}${defaultInfo}: ${option.description}`);
          });
          lines.push('');
        }
        
        if (cmd.examples && cmd.examples.length > 0) {
          lines.push('**Examples:**');
          lines.push('');
          cmd.examples.forEach(example => {
            lines.push('```bash');
            lines.push(example);
            lines.push('```');
          });
          lines.push('');
        }
      });
    });
    
    // Global Examples
    if (helpData.examples.length > 0) {
      lines.push('## Examples');
      lines.push('');
      helpData.examples.forEach(example => {
        lines.push('```bash');
        lines.push(example);
        lines.push('```');
        lines.push('');
      });
    }
    
    // Notes
    if (helpData.notes && helpData.notes.length > 0) {
      lines.push('## Notes');
      lines.push('');
      helpData.notes.forEach(note => {
        lines.push(`- ${note}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  private static groupCommandsByCategory(commands: CommandInfo[]): Record<string, CommandInfo[]> {
    const groups: Record<string, CommandInfo[]> = {};
    
    commands.forEach(cmd => {
      const category = cmd.category || 'General';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(cmd);
    });
    
    // Sort commands within each category
    Object.keys(groups).forEach(category => {
      groups[category].sort((a, b) => a.command.localeCompare(b.command));
    });
    
    return groups;
  }
}
