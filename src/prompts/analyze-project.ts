/**
 * Analyze Project Prompt
 * 
 * Provides comprehensive analysis prompts for Next.js projects
 */

import type { PromptModule, PromptResponse } from './types.js';
import { PROJECT_STRUCTURE_RESOURCE, ANALYSIS_SUMMARY_RESOURCE } from '../resources/index.js';

export const analyzeProjectPrompt: PromptModule = {
  definition: {
    name: 'analyze-project',
    description: 'Get a comprehensive analysis of the Next.js project',
    arguments: [
      {
        name: 'focus',
        description: 'Area to focus analysis on (components, hooks, pages, features, patterns, all)',
        required: false,
      },
      {
        name: 'format',
        description: 'Output format (text, markdown, json)',
        required: false,
      },
      {
        name: 'depth',
        description: 'Analysis depth (basic, detailed, comprehensive)',
        required: false,
      },
    ],
  },
  
  generator: {
    async generate(args: Record<string, any>): Promise<PromptResponse> {
      const focus = args.focus || 'all aspects';
      const format = args.format || 'json';
      const depth = args.depth || 'detailed';
      
      let analysisScope = '';
      
      switch (focus) {
        case 'components':
          analysisScope = 'React components, their props, state management, and component relationships';
          break;
        case 'hooks':
          analysisScope = 'React hooks usage, custom hooks, and hook dependencies';
          break;
        case 'pages':
          analysisScope = 'Next.js pages, routing structure, and navigation patterns';
          break;
        case 'features':
          analysisScope = 'feature organization, business logic structure, and architectural patterns';
          break;
        case 'patterns':
          analysisScope = 'React design patterns, anti-patterns, and code quality metrics';
          break;
        default:
          analysisScope = 'all aspects including components, hooks, pages, features, and patterns';
      }
      
      let depthInstruction = '';
      switch (depth) {
        case 'basic':
          depthInstruction = 'Provide a high-level overview with key metrics and summary information.';
          break;
        case 'comprehensive':
          depthInstruction = 'Provide an in-depth analysis with detailed explanations, examples, and recommendations.';
          break;
        default:
          depthInstruction = 'Provide a balanced analysis with good detail and actionable insights.';
      }
      
      const promptText = `Please analyze this Next.js project with focus on ${analysisScope}. 

${depthInstruction}

## Available Resources

You have access to two comprehensive resources containing all project data:

### 1. Project Structure Resource
- Complete file system hierarchy and organization
- Directory structure and file relationships
- Project layout visualization

### 2. Analysis Summary Resource
Contains comprehensive project analysis data including:
- **Project Overview**: Name, version, Next.js version, project structure type, TypeScript usage, dependencies
- **Components**: List of all React components with their props, locations, and relationships
- **Pages**: All pages and API routes with routing information and file-based routing structure  
- **Hooks**: Custom hooks analysis including dependencies and usage patterns
- **Features**: Feature-based code organization and business logic structure
- **Patterns**: React design patterns, code quality metrics, and architectural insights

## Analysis Areas

Please provide insights covering:
1. **Project Structure** - Overall architecture and organization patterns
2. **Code Quality** - Design patterns, best practices, and areas for improvement
3. **Performance** - Optimization opportunities and potential bottlenecks
4. **Maintainability** - Code organization, scalability, and technical debt
5. **Recommendations** - Specific, actionable suggestions for improvement

## Output Requirements

- Format: ${format}
- Focus: ${focus}
- Analysis depth: ${depth}

Use the attached resources to provide a thorough analysis based on the actual project data.`;

      return {
        description: `Comprehensive Next.js project analysis focusing on ${focus}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: promptText,
            },
          },
        ],
        resources: [
          PROJECT_STRUCTURE_RESOURCE,
          ANALYSIS_SUMMARY_RESOURCE,
        ],
      };
    },
  },
};
