# Quick Reference Guide

## 🎯 Analysis Modes

| Mode | Purpose | Performance | Use Case |
|------|---------|-------------|----------|
| `all` | Quick overview | Fastest | Initial exploration |
| `specific` | Targeted analysis | Moderate | Finding specific elements |
| `detailed` | Comprehensive | Thorough | Deep analysis & reviews |

## 🔍 Pattern Matching

| Pattern | Matches | Example Use |
|---------|---------|-------------|
| `exact` | Exact name | `"Button"` → Button component only |
| `*text*` | Contains text | `"*Button*"` → all components with "Button" |
| `text*` | Starts with | `"Auth*"` → AuthProvider, AuthContext, etc. |
| `*text` | Ends with | `"*Modal"` → ConfirmModal, UserModal, etc. |
| `path/*` | Directory | `"api/*"` → all API routes |

## 📋 Tool Quick Reference

### analyze_components
```json
{
  "mode": "all|specific|detailed",
  "componentPattern": "Button|*Modal*|Auth*",
  "includeProps": true,
  "includeHooks": true,
  "format": "text|markdown|json"
}
```

### analyze_hooks
```json
{
  "mode": "all|specific|detailed", 
  "hookPattern": "use*|useState|*Auth*",
  "includeBuiltIn": true,
  "includeCustom": true,
  "format": "text|markdown|json"
}
```

### analyze_pages
```json
{
  "mode": "all|specific|detailed",
  "pagePattern": "api/*|[slug]|blog/**",
  "includeApiRoutes": true,
  "format": "text|markdown|json"
}
```

### analyze_features
```json
{
  "mode": "all|specific|detailed",
  "featurePattern": "auth|*admin*|user*",
  "includeTypes": true,
  "format": "text|markdown|json"
}
```

### analyze_patterns
```json
{
  "mode": "all|specific|detailed",
  "patternType": "hooks|context|hoc|render-props|all",
  "patternPattern": "with*|*Provider|use*",
  "format": "text|markdown|json"
}
```

### analyze_i18n
```json
{
  "mode": "all|specific|detailed",
  "languages": ["en", "es", "fr"],
  "includeUntranslated": true,
  "includeMissing": true,
  "filePattern": "src/components/**",
  "format": "text|markdown|json"
}
```

## 💬 Claude Examples

### Basic Analysis
```
"Show me all components in this project"
"What pages does this app have?"
"List all hooks used in the project"
```

### Targeted Analysis
```
"Find all Button components"
"Show me API routes only"
"Find authentication-related features"
"Analyze custom hooks only"
"Check translation coverage for Spanish"
"Find untranslated strings in components"
```

### Detailed Analysis
```
"Analyze components in detail with props and hooks"
"Give me comprehensive page analysis"
"Show detailed feature breakdown with TypeScript types"
"Analyze i18n setup with missing translation keys"
```

### i18n-Specific Examples
```
"Analyze internationalization setup"
"Find missing translation keys"
"Show untranslated strings in the codebase"
"Check translation coverage across all languages"
"Analyze i18n for components only"
```

### Format Specifications
```
"Analyze components and format as markdown"
"Get project overview in JSON format"
"Show hook analysis in plain text"
```

## 🎨 Output Format Examples

### Text Format
```
Components Analysis
==================

1. Button (functional)
   File: components/Button.js
   Props: children, onClick, variant
   Hooks: useState

2. Header (functional)
   File: components/Header.js
   Props: title, user
   Hooks: useContext, useEffect
```

### Markdown Format
```markdown
# Components Analysis

## Button
- **Type**: Functional Component
- **File**: `components/Button.js`
- **Props**: `children`, `onClick`, `variant`
- **Hooks**: `useState`

## Header
- **Type**: Functional Component  
- **File**: `components/Header.js`
- **Props**: `title`, `user`
- **Hooks**: `useContext`, `useEffect`
```

### JSON Format
```json
{
  "components": [
    {
      "name": "Button",
      "type": "functional",
      "file": "components/Button.js",
      "props": ["children", "onClick", "variant"],
      "hooks": ["useState"]
    }
  ]
}
```

## 🚀 Common Workflows

### New Project Exploration
1. `get_project_overview` - Get basic project info
2. `analyze_components` with `mode: "all"` - See all components
3. `analyze_pages` with `mode: "all"` - Understand routing
4. `analyze_features` with `mode: "detailed"` - Understand architecture

### Debugging Specific Issues
1. Use `mode: "specific"` with patterns to find relevant code
2. Use `mode: "detailed"` for comprehensive analysis
3. Check patterns with `analyze_patterns` for architectural insights

### Code Review & Refactoring
1. `analyze_components` with `mode: "detailed"` - Full component analysis
2. `analyze_patterns` - Identify architectural patterns
3. `analyze_features` with `includeTypes: true` - TypeScript analysis
4. Export results as JSON for further processing

## ⚡ Performance Tips

- Use `mode: "all"` for quick overviews
- Use specific patterns to narrow focus
- Use `mode: "detailed"` only when needed
- Specify `path` parameter to limit scope
- Use appropriate output format for your needs
