# Component Extractor Plugin

The Component Extractor plugin analyzes React components and extracts basic information about their structure, props, hooks usage, and complexity metrics.

## 🎯 Overview

This plugin provides foundational React component analysis capabilities, useful for:

- **Code Documentation**: Generate basic component documentation
- **Code Review**: Identify complex components that need refactoring
- **Project Overview**: Understand component distribution and organization
- **Basic Metrics**: Get cyclomatic complexity and component categorization

## 🔧 Current Features

### Component Detection ✅

- **Functional Components**: Function declarations and arrow functions with JSX
- **Class Components**: ES6 class-based components extending React.Component
- **JSX Validation**: Ensures detected functions/classes actually return JSX

### Basic Props Analysis ✅

- **Destructured Props**: Extract props from function parameter destructuring
- **Basic Structure**: Prop name extraction (type analysis limited)

### Basic Hooks Analysis ✅

- **Hook Detection**: Identifies function calls starting with 'use' and capital letter
- **Hook Names**: Extracts unique hook names used in component
- **Functional Components Only**: Hook analysis limited to functional components

### Complexity Metrics ✅

- **Cyclomatic Complexity**: Measures code path complexity including:
  - Conditional statements (if, ternary, logical operators)
  - Loops (for, while)
  - Switch cases
  - Hook usage complexity

### Component Organization ✅

- **Category Detection**: Automatically categorizes as page, component, layout, or shared
- **Feature Extraction**: Identifies feature from file path structure
- **Path Analysis**: Relative path tracking and organization

## 📊 Output Format

### Component Information (Current Implementation)

```typescript
interface ComponentInfo {
  name: string;                    // Component name
  type: 'functional' | 'class';   // Component type
  filePath: string;               // Absolute file path
  relativePath: string;           // Path relative to project root
  
  // Export information
  exports: ComponentExport[];
  
  // Component categorization
  category: 'page' | 'component' | 'layout' | 'shared';
  feature?: string;               // Feature name from path
  
  // Optional analysis (if enabled)
  props?: PropInfo[];             // Basic prop extraction
  hooks?: string[];               // Hook names used
  complexity?: number;            // Cyclomatic complexity
}
```

### Props Information (Basic)

```typescript
interface PropInfo {
  name: string;                   // Prop name from destructuring
  type: string;                   // Currently always 'any' (limited analysis)
  required: boolean;              // Currently always true (limited analysis)
  defaultValue?: any;             // Not currently extracted
  description?: string;           // Not currently extracted
}
```

### Component Export Information

```typescript
interface ComponentExport {
  name: string;                   // Export name
  type: 'default' | 'named';     // Export type
  isComponent: boolean;           // Always true for detected components
}
```

### Component Summary

```typescript
interface ComponentSummary {
  totalComponents: number;
  functionalComponents: number;
  classComponents: number;
  componentsWithProps: number;
  componentsWithHooks: number;
  componentsByFeature: Record<string, number>;
  averageComplexity: number;
}
```

## 🚀 Usage Examples

### Basic Analysis

```typescript
import { ComponentExtractorPlugin } from './src/plugins/component-extractor/index.js';

const plugin = new ComponentExtractorPlugin();
const result = await plugin.extract('/path/to/react/project');

if (result.success) {
  const components = result.data;
  
  console.log(`Found ${components.length} components`);
  
  // Find complex components
  const complexComponents = components.filter(c => c.complexity && c.complexity > 10);
  console.log(`Complex components: ${complexComponents.length}`);
  
  // Group by category
  const byCategory = components.reduce((acc, comp) => {
    acc[comp.category] = (acc[comp.category] || 0) + 1;
    return acc;
  }, {});
  console.log('Components by category:', byCategory);
}
```

### CLI Usage

```bash
# Analyze all components
npm run cli analyze-components /path/to/project

# Analyze specific directory
npm run cli analyze-components /path/to/project src/components

# Output to file
npm run cli analyze-components /path/to/project --output components.json
```

## ⚙️ Configuration

### Plugin Configuration

```typescript
interface ComponentPluginConfig {
  includeProps?: boolean;           // Extract basic props (default: true)
  includeHooks?: boolean;           // Extract hook names (default: true)
  strict?: boolean;                 // Strict validation (default: false)
  excludePatterns?: string[];       // Files to exclude
  includePatterns?: string[];       // Files to include
  maxFileSize?: number;             // Max file size in bytes
}

const config: ComponentPluginConfig = {
  includeProps: true,
  includeHooks: true,
  strict: false,
  excludePatterns: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
  includePatterns: ['**/*.{js,jsx,ts,tsx}'],
  maxFileSize: 1024 * 1024 // 1MB
};

const result = await plugin.extract(targetPath, config);
```

### Default File Patterns

The plugin analyzes files matching these patterns:

```typescript
const defaultPatterns = [
  '**/*.{js,jsx,ts,tsx}',          // React component files
  '!**/*.test.{js,jsx,ts,tsx}',   // Exclude tests
  '!**/*.spec.{js,jsx,ts,tsx}',   // Exclude specs
  '!**/node_modules/**',          // Exclude dependencies
  '!**/dist/**',                  // Exclude build output
  '!**/build/**'                  // Exclude build output
];
```

## 📈 Analysis Results

### Summary Statistics (Current)

```typescript
interface ComponentSummary {
  totalComponents: number;
  functionalComponents: number;
  classComponents: number;
  componentsWithProps: number;      // Components with extracted props
  componentsWithHooks: number;      // Components using hooks
  componentsByFeature: Record<string, number>; // Components per feature
  averageComplexity: number;        // Average cyclomatic complexity
}
```

### Complexity Analysis

The plugin calculates cyclomatic complexity by counting:
- Conditional statements (if, ternary operators)
- Logical expressions (&&, ||)
- Loops (for, while)
- Switch cases
- Hook usage (each hook call adds complexity)

Complexity ranges:
- **1-5**: Simple component
- **6-10**: Moderate complexity
- **11-15**: High complexity (consider refactoring)
- **16+**: Very high complexity (requires refactoring)

### Component Categories

Components are automatically categorized based on file path:
- **page**: Files in `/pages/` or `/app/` directories (Next.js pages)
- **layout**: Files containing 'layout' in path
- **shared**: Files in `/shared/` or `/common/` directories
- **component**: All other components

## 🎨 Example Output

### Single Component Analysis (Current Format)

```json
{
  "name": "UserProfile",
  "type": "functional",
  "filePath": "/project/src/components/UserProfile.tsx",
  "relativePath": "src/components/UserProfile.tsx",
  
  "exports": [
    {
      "name": "UserProfile",
      "type": "named",
      "isComponent": true
    }
  ],
  
  "category": "component",
  "feature": undefined,
  
  "props": [
    {
      "name": "user",
      "type": "any",
      "required": true
    },
    {
      "name": "showEmail",
      "type": "any", 
      "required": true
    }
  ],
  
  "hooks": [
    "useState",
    "useEffect",
    "useUserPermissions"
  ],
  
  "complexity": 6
}
```

### Project Summary (Current Format)

```json
{
  "totalComponents": 47,
  "functionalComponents": 45,
  "classComponents": 2,
  "componentsWithProps": 32,
  "componentsWithHooks": 40,
  "componentsByFeature": {
    "auth": 8,
    "dashboard": 12,
    "profile": 5
  },
  "averageComplexity": 4.2
}
```

## 🚧 Limitations & Future Enhancements

### Current Limitations

- **Props Analysis**: Limited to parameter destructuring, no TypeScript interface parsing
- **Hook Analysis**: Only extracts hook names, no dependency tracking or classification
- **Export Detection**: Basic named export detection, limited default export analysis
- **Complexity**: Only cyclomatic complexity, no lines of code or JSX depth metrics
- **Component Features**: No detection of React.memo, forwardRef, or HOC patterns

### 🛣️ Planned Enhancements (Roadmap)

#### Phase 1: Enhanced Props Analysis
- **TypeScript Interface Extraction**: Parse TypeScript interfaces for accurate prop types
- **PropTypes Support**: Extract and parse React PropTypes definitions
- **Default Values Detection**: Identify default prop values from component definitions
- **Required/Optional Analysis**: Determine which props are actually required
- **JSDoc Integration**: Extract prop descriptions from JSDoc comments

#### Phase 2: Advanced Hooks Analysis
- **Hook Dependencies Tracking**: Track useEffect and other hook dependencies
- **Builtin vs Custom Classification**: Distinguish between React hooks and custom hooks
- **Hook Usage Patterns**: Identify common patterns and anti-patterns
- **Performance Analysis**: Detect potential performance issues with hooks
- **Line Number Tracking**: Track exact line numbers for better debugging

#### Phase 3: Advanced Component Detection
- **Higher-Order Components (HOC)**: Detect and analyze HOC patterns
- **React.forwardRef Detection**: Identify components using forwardRef
- **React.memo Detection**: Detect memoized components
- **Compound Components**: Identify compound component patterns
- **Render Props**: Detect render prop patterns

#### Phase 4: Enhanced Metrics
- **Lines of Code Counting**: Accurate LOC metrics per component
- **JSX Elements Analysis**: Count and analyze JSX element usage
- **JSX Depth Analysis**: Measure JSX nesting complexity
- **Import/Export Mapping**: Complete dependency relationship analysis
- **Component Size Metrics**: File size, component size analysis

#### Phase 5: Advanced Features
- **Component Relationships**: Map parent-child component relationships
- **Pattern Detection**: Identify architectural patterns automatically
- **Best Practices Analysis**: Check adherence to React best practices
- **Performance Insights**: Identify optimization opportunities
- **Migration Support**: Analyze compatibility for React version upgrades

#### Phase 6: Developer Experience
- **Advanced CLI Options**: More sophisticated filtering and output options
- **Multiple Output Formats**: Markdown, HTML, CSV export options
- **Interactive Reports**: Generate interactive HTML reports
- **IDE Integration**: VS Code extension for real-time analysis
- **CI/CD Integration**: Quality gates and automated reporting

## 🛠️ Current Usage

### Basic Analysis

```typescript
import { ComponentExtractorPlugin } from './src/plugins/component-extractor/index.js';

const plugin = new ComponentExtractorPlugin();
const result = await plugin.extract('/path/to/react/project');

if (result.success) {
  const components = result.data;
  
  console.log(`Found ${components.length} components`);
  
  // Find complex components
  const complexComponents = components.filter(c => c.complexity && c.complexity > 10);
  console.log(`Complex components: ${complexComponents.length}`);
  
  // Group by category
  const byCategory = components.reduce((acc, comp) => {
    acc[comp.category] = (acc[comp.category] || 0) + 1;
    return acc;
  }, {});
  console.log('Components by category:', byCategory);
}
```

### CLI Usage

```bash
# Analyze all components
npm run cli analyze-components /path/to/project

# Analyze specific directory
npm run cli analyze-components /path/to/project src/components

# Output to file
npm run cli analyze-components /path/to/project --output components.json
```

## 📚 Integration Examples

### Basic Documentation Generation

```typescript
// Generate simple component documentation
const result = await plugin.extract(projectPath);
if (result.success) {
  const components = result.data;
  
  // Generate markdown documentation
  let markdown = '# Components\n\n';
  
  for (const component of components) {
    markdown += `## ${component.name}\n`;
    markdown += `- **Type**: ${component.type}\n`;
    markdown += `- **File**: ${component.relativePath}\n`;
    markdown += `- **Category**: ${component.category}\n`;
    markdown += `- **Complexity**: ${component.complexity || 'N/A'}\n`;
    
    if (component.hooks?.length) {
      markdown += `- **Hooks**: ${component.hooks.join(', ')}\n`;
    }
    
    if (component.props?.length) {
      markdown += `- **Props**: ${component.props.map(p => p.name).join(', ')}\n`;
    }
    
    markdown += '\n';
  }
  
  await fs.writeFile('./docs/components.md', markdown);
}
```

### Code Quality Analysis

```typescript
// Analyze component complexity for code quality
const result = await plugin.extract(projectPath);
if (result.success) {
  const components = result.data;
  
  const complexComponents = components
    .filter(c => c.complexity && c.complexity > 10)
    .sort((a, b) => (b.complexity || 0) - (a.complexity || 0));
  
  if (complexComponents.length > 0) {
    console.log('⚠️  High complexity components that need refactoring:');
    for (const comp of complexComponents) {
      console.log(`  - ${comp.name} (${comp.complexity}) in ${comp.relativePath}`);
    }
  }
  
  // Calculate project health score
  const avgComplexity = components.reduce((sum, c) => sum + (c.complexity || 0), 0) / components.length;
  const healthScore = Math.max(0, 100 - (avgComplexity * 10));
  
  console.log(`\nProject Health Score: ${healthScore.toFixed(1)}/100`);
}
```

## 🔗 Related Documentation

- **[Plugin Development Guide](../plugin-development.md)** - How to create new plugins
- **[Common Utilities](../common-utilities.md)** - Shared utilities used by all plugins
- **[API Reference](../api-reference.md)** - Complete API documentation

## 📄 Technical Implementation

### Dependencies
- **@babel/types**: AST node type checking
- **@babel/traverse**: AST traversal functionality
- **Node.js path**: File path utilities

### Core Functions
- `extractComponentsFromAST()`: Main extraction logic
- `isReactComponent()`: Component validation
- `containsJSX()`: JSX detection
- `calculateComplexity()`: Complexity calculation
- `extractProps()`: Basic props extraction
- `extractHookUsage()`: Hook detection

### File Structure
```
src/plugins/component-extractor/
├── index.ts           # Main plugin export
├── plugin.ts          # Plugin implementation class
├── types.ts           # TypeScript interfaces
├── extractor.ts       # Core extraction logic (current file)
├── processor.ts       # File processing utilities
└── formatter.ts       # Output formatting
```
