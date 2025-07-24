# Enhanced Usage Guide

## 🚀 Getting Started

### Option 1: Local Installation (Recommended for now)

```bash
# Clone and build the server
git clone https://github.com/devalma/mcp-talk-to-project-next-js.git
cd mcp-talk-to-project-next-js
npm install
npm run build
```

### Option 2: Using npx (Now Available!)

```bash
# Use npx to run without installation
npx mcp-talk-to-project-next-js /path/to/your/nextjs/project

# Or with environment variable
export NEXTJS_PROJECT_PATH="/path/to/your/nextjs/project"
npx mcp-talk-to-project-next-js
```

### Current Setup Instructions

### Current Setup Instructions

1. **Build the server:**
   ```bash
   git clone https://github.com/devalma/mcp-talk-to-project-next-js.git
   cd mcp-talk-to-project-next-js
   npm install
   npm run build
   ```

2. **Test with demo project:**
   ```bash
   npm run test
   # This creates a demo Next.js project and shows what the server can extract
   ```

3. **Test with your own project:**
   ```bash
   export NEXTJS_PROJECT_PATH="/path/to/your/nextjs/project"
   npm run cli analyze components
   ```

4. **Configure Claude Desktop:**
   - Copy configuration from README.md to your Claude Desktop config
   - Update the paths to match your system
   - Restart Claude Desktop

## 🎯 Analysis Modes

All tools now support **three flexible analysis modes**:

### **Mode: "all" (Overview)**
Get a basic overview and listing of all elements.
```json
{"mode": "all"}
```

### **Mode: "specific" (Targeted)**
Target specific elements using pattern matching.
```json
{"mode": "specific", "componentPattern": "Button"}
{"mode": "specific", "pagePattern": "api/*"}
{"mode": "specific", "hookPattern": "use*"}
```

### **Mode: "detailed" (Comprehensive)**
Get comprehensive analysis with full details.
```json
{"mode": "detailed", "includeProps": true, "includeHooks": true}
```

## 🛠️ Enhanced Usage with Claude

### **Component Analysis**

**"Show me all components in the project"**
```json
{"tool": "analyze_components", "args": {"mode": "all"}}
```

**"Find all Button components"**
```json
{"tool": "analyze_components", "args": {"mode": "specific", "componentPattern": "*Button*"}}
```

**"Analyze components in detail with props and hooks"**
```json
{"tool": "analyze_components", "args": {"mode": "detailed", "includeProps": true, "includeHooks": true, "format": "markdown"}}
```

### **Hook Analysis**

**"What hooks are used in this project?"**
```json
{"tool": "analyze_hooks", "args": {"mode": "all"}}
```

**"Find all custom hooks"**
```json
{"tool": "analyze_hooks", "args": {"mode": "specific", "hookPattern": "use*", "includeBuiltIn": false}}
```

**"Analyze useState usage in detail"**
```json
{"tool": "analyze_hooks", "args": {"mode": "detailed", "hookPattern": "useState"}}
```

### **Page Analysis**

**"Show me the routing structure"**
```json
{"tool": "analyze_pages", "args": {"mode": "all"}}
```

**"Analyze only API routes"**
```json
{"tool": "analyze_pages", "args": {"mode": "specific", "pagePattern": "api/*"}}
```

**"Get detailed page analysis with data fetching methods"**
```json
{"tool": "analyze_pages", "args": {"mode": "detailed", "includeApiRoutes": true}}
```

### **Feature Analysis**

**"How is this project organized into features?"**
```json
{"tool": "analyze_features", "args": {"mode": "all"}}
```

**"Analyze authentication features"**
```json
{"tool": "analyze_features", "args": {"mode": "specific", "featurePattern": "*auth*"}}
```

**"Get detailed feature analysis with TypeScript types"**
```json
{"tool": "analyze_features", "args": {"mode": "detailed", "includeTypes": true}}
```

### **Pattern Analysis**

**"Find all React patterns"**
```json
{"tool": "analyze_patterns", "args": {"mode": "all"}}
```

**"Find Context Provider patterns"**
```json
{"tool": "analyze_patterns", "args": {"mode": "specific", "patternType": "context"}}
```

**"Analyze HOC patterns in detail"**
```json
{"tool": "analyze_patterns", "args": {"mode": "detailed", "patternType": "hoc"}}
```

### **Project Overview**

**"Give me a comprehensive project overview"**
```json
{"tool": "get_project_overview", "args": {"format": "markdown"}}
```

### **Help & Documentation**

**"Show me help information"**
```json
{"tool": "get_help", "args": {"format": "markdown"}}
```

## 📊 Enhanced Output Examples

### Components
```json
{
  "components": [
    {
      "name": "Button",
      "type": "functional",
      "file": "components/Button.js",
      "props": [
        {"name": "children", "required": true},
        {"name": "onClick", "required": false},
        {"name": "variant", "required": false, "defaultValue": "primary"}
      ],
      "hooks": ["useState"],
      "exports": "default",
      "category": "shared"
    }
  ]
}
```

### Hooks
```json
{
  "hooks": [
    {
      "name": "useAuth",
      "file": "hooks/useAuth.js",
      "type": "custom",
      "parameters": [],
      "returns": ["user", "login", "logout", "loading"],
      "dependencies": ["useState", "useEffect", "useContext"]
    }
  ]
}
```

### Pages
```json
{
  "pages": [
    {
      "route": "/blog/[slug]",
      "file": "pages/blog/[slug].js",
      "component": "BlogPost",
      "type": "dynamic",
      "dataFetching": ["getStaticProps", "getStaticPaths"],
      "dynamicParams": ["slug"]
    }
  ]
}
```

## 🎯 Advanced Features

- **Pattern Detection**: Find HOCs, render props, context patterns
- **Feature Analysis**: Understand code organization and module boundaries
- **Type Information**: Extract TypeScript interfaces and types (when enabled)
- **Performance**: Built-in caching for large codebases
- **Error Handling**: Graceful degradation when files can't be parsed

## 🔧 Configuration Options

Environment variables:
- `NEXTJS_PROJECT_PATH`: Path to Next.js project (required)
- `CACHE_ENABLED`: Enable AST caching (default: true)
- `MAX_FILE_SIZE`: Maximum file size to parse (default: 1MB)

## 🧪 Development

- `npm run dev`: Run in development mode with tsx
- `npm run build`: Build TypeScript to JavaScript
- `npm run test`: Run test script
- `npm run clean`: Clean build directory

## 📦 Project Structure

```
mcp-talk-to-project-next-js/
├── src/                    # TypeScript source
│   ├── index.ts           # MCP server entry point
│   ├── extractors/        # Feature extraction modules
│   ├── parsers/           # AST parsing utilities
│   ├── utils/             # File and caching utilities
│   └── types/             # TypeScript interfaces
├── dist/                  # Compiled JavaScript
├── demo.js               # Demo script
├── test.js               # Test script
└── claude-config.json    # Example Claude config
```
