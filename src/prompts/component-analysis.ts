/**
 * Component Analysis Prompt
 * 
 * Provides detailed analysis prompts for React components
 */

import type { PromptModule, PromptResponse } from './types.js';
import { PROJECT_STRUCTURE_RESOURCE, ANALYSIS_SUMMARY_RESOURCE } from '../resources/index.js';

export const componentAnalysisPrompt: PromptModule = {
  definition: {
    name: 'component-analysis',
    description: 'Deep dive into React component structure and relationships',
    arguments: [
      {
        name: 'component_name',
        description: 'Specific component to analyze (optional)',
        required: false,
      },
      {
        name: 'analysis_type',
        description: 'Type of analysis (structure, performance, accessibility, testing)',
        required: false,
      },
      {
        name: 'include_dependencies',
        description: 'Include component dependency analysis',
        required: false,
      },
    ],
  },
  
  generator: {
    async generate(args: Record<string, any>): Promise<PromptResponse> {
      const componentName = args.component_name;
      const analysisType = args.analysis_type || 'comprehensive';
      const includeDependencies = args.include_dependencies !== false; // Default to true
      
      let analysisScope = '';
      let analysisInstructions = '';
      
      if (componentName) {
        analysisScope = `the "${componentName}" component`;
      } else {
        analysisScope = 'all React components in this project';
      }
      
      switch (analysisType) {
        case 'structure':
          analysisInstructions = `Focus on component structure analysis:
- Component composition and hierarchy
- Props interface and data flow
- State management and lifecycle
- Rendering logic and conditional rendering
- Component reusability and modularity`;
          break;
          
        case 'performance':
          analysisInstructions = `Focus on component performance analysis:
- Re-render frequency and optimization opportunities
- Memoization usage (React.memo, useMemo, useCallback)
- Heavy computation and expensive operations
- Bundle size impact and code splitting opportunities
- Virtual DOM optimization patterns`;
          break;
          
        case 'accessibility':
          analysisInstructions = `Focus on accessibility analysis:
- ARIA attributes and semantic HTML usage
- Keyboard navigation and focus management
- Screen reader compatibility
- Color contrast and visual accessibility
- Form accessibility and error handling`;
          break;
          
        case 'testing':
          analysisInstructions = `Focus on testability analysis:
- Component testing strategies and coverage
- Mock-ability and test isolation
- Props and state testing approaches
- Integration testing considerations
- Testing utilities and best practices`;
          break;
          
        default:
          analysisInstructions = `Provide comprehensive component analysis covering:
- **Structure**: Component architecture and design patterns
- **Performance**: Optimization opportunities and bottlenecks
- **Accessibility**: WCAG compliance and inclusive design
- **Maintainability**: Code quality and refactoring opportunities
- **Testing**: Test coverage and testing strategies`;
      }
      
      const dependencyInstruction = includeDependencies 
        ? '\n\nInclude analysis of component dependencies, imports, and relationships with other components.'
        : '';
      
      const promptText = `Please provide a detailed analysis of ${analysisScope}.

${analysisInstructions}

You have access to comprehensive project resources that contain:

### Project Structure Resource
- Complete file system hierarchy and organization
- Component file locations and relationships

### Analysis Summary Resource  
- **Components**: Detailed data about all React components including:
  - Component props, state, and dependencies
  - File locations and relationships
  - Code structure and patterns
  - Performance characteristics

Based on the attached resources, please provide:

1. **Component Overview** - Structure and purpose summary
2. **Detailed Analysis** - In-depth examination based on analysis type
3. **Quality Assessment** - Code quality and best practices evaluation  
4. **Optimization Opportunities** - Specific improvement recommendations
5. **Action Items** - Prioritized steps for enhancement

${dependencyInstruction}

Use the attached project resources to provide thorough component analysis.`;

      return {
        description: componentName 
          ? `Detailed analysis of ${componentName} component`
          : `Comprehensive analysis of all React components`,
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
