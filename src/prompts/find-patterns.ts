/**
 * Find Patterns Prompt
 * 
 * Provides prompts for analyzing React and Next.js patterns in codebases
 */

import type { PromptModule, PromptResponse } from './types.js';
import { PROJECT_STRUCTURE_RESOURCE, ANALYSIS_SUMMARY_RESOURCE } from '../resources/index.js';

export const findPatternsPrompt: PromptModule = {
  definition: {
    name: 'find-patterns',
    description: 'Find and analyze React patterns in the codebase',
    arguments: [
      {
        name: 'pattern_type',
        description: 'Type of pattern to look for (all, anti-patterns, performance, architecture, design)',
        required: false,
      },
      {
        name: 'severity',
        description: 'Pattern severity to focus on (info, warning, error)',
        required: false,
      },
      {
        name: 'include_examples',
        description: 'Include code examples in the analysis',
        required: false,
      },
    ],
  },
  
  generator: {
    async generate(args: Record<string, any>): Promise<PromptResponse> {
      const patternType = args.pattern_type || 'all';
      const severity = args.severity || 'all severities';
      const includeExamples = args.include_examples !== false; // Default to true
      
      let patternFocus = '';
      let analysisInstructions = '';
      
      switch (patternType) {
        case 'anti-patterns':
          patternFocus = 'anti-patterns and code smells';
          analysisInstructions = `Focus on identifying problematic patterns such as:
- Unnecessary re-renders and performance issues
- Poor component composition and prop drilling
- Incorrect hook usage and dependencies
- Memory leaks and cleanup issues
- Accessibility violations
- Security vulnerabilities`;
          break;
          
        case 'performance':
          patternFocus = 'performance-related patterns';
          analysisInstructions = `Focus on performance optimization opportunities:
- Component memoization opportunities (React.memo, useMemo, useCallback)
- Bundle size optimizations and code splitting
- Image and asset optimization patterns
- Loading and rendering optimization strategies
- Caching and data fetching patterns`;
          break;
          
        case 'architecture':
          patternFocus = 'architectural patterns and structure';
          analysisInstructions = `Focus on architectural patterns:
- Component composition and reusability patterns
- State management patterns and data flow
- Custom hooks and logic extraction
- Error boundary and error handling patterns
- Feature organization and module structure`;
          break;
          
        case 'design':
          patternFocus = 'design patterns and UI/UX practices';
          analysisInstructions = `Focus on design and UI patterns:
- Component design consistency
- Responsive design patterns
- Accessibility patterns and ARIA usage
- Theme and styling organization
- User interaction and feedback patterns`;
          break;
          
        default:
          patternFocus = 'all React and Next.js patterns';
          analysisInstructions = `Provide a comprehensive pattern analysis covering:
- Design patterns (good practices and anti-patterns)
- Performance patterns and optimization opportunities
- Architectural patterns and code organization
- Security and accessibility patterns
- Next.js specific patterns (SSR, SSG, API routes, etc.)`;
      }
      
      const exampleInstruction = includeExamples 
        ? '\n\nFor each pattern found, provide specific code examples and suggested improvements.'
        : '\n\nProvide pattern descriptions and recommendations without code examples.';
      
      const promptText = `Please analyze this React/Next.js codebase to identify ${patternFocus}.

${analysisInstructions}

Focus on patterns with ${severity} level issues.

You have access to comprehensive project resources:

### Project Structure Resource
- Complete file system hierarchy 
- Code organization patterns

### Analysis Summary Resource
- **Patterns**: Detailed pattern analysis including:
  - Design patterns and anti-patterns found in the codebase
  - Performance optimization opportunities
  - Architectural patterns and code quality metrics
  - Best practices compliance and violations

Based on the attached resources, please provide:

1. **Pattern Summary** - Overview of patterns found
2. **Detailed Analysis** - Specific patterns with explanations  
3. **Severity Assessment** - Priority and impact of each pattern
4. **Recommendations** - Specific steps to improve or implement patterns
5. **Best Practices** - General guidelines for avoiding issues

${exampleInstruction}

Use the attached project resources to provide thorough pattern analysis.`;

      return {
        description: `React pattern analysis focusing on ${patternType}`,
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
