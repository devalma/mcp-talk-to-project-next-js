# i18n Validator System Documentation

## Overview

The i18n analyzer uses a sophisticated 7-validator system to accurately detect translatable strings while avoiding false positives. Each validator specializes in a specific type of content with whitelist-based detection.

## 🎯 Validator Architecture

### Validator Priority System
- **HIGH PRIORITY**: Always translate (Validators 1-3)
- **MEDIUM PRIORITY**: Context dependent (Validators 4-7)
- **LOW PRIORITY**: Usually don't translate (Not implemented as validators - filtered out)

## 📋 Complete Validator List

### Validator 1: JSX Text Content ✨ HIGH PRIORITY
**Purpose**: Direct text content within JSX elements  
**Type**: `jsx-text`  
**Rule**: All direct text content within JSX elements should be translated

```jsx
// ✅ SHOULD BE TRANSLATED
<h1>Welcome to our application</h1>
<p>Please enter your email address</p>
<span>Loading...</span>
<div>Error: Could not save data</div>
<button>Save Changes</button>
```

**Detection**: Automatically detects all text nodes within JSX elements

---

### Validator 2: User-facing JSX Attributes ✨ HIGH PRIORITY  
**Purpose**: User-facing HTML attributes  
**Type**: `jsx-attribute`  
**Rule**: Only specific user-facing attributes (whitelist approach)

```jsx
// ✅ SHOULD BE TRANSLATED (whitelisted attributes)
<img alt="User profile picture" />
<button title="Click to save your changes" />
<input placeholder="Enter your email" />
<option label="Select your country" />
<div aria-label="Close dialog" />

// ❌ NOT TRANSLATED (technical attributes)
<div className="flex justify-center" />
<input type="email" />
<button onClick={handleClick} />
```

**Whitelisted Attributes**: `alt`, `title`, `placeholder`, `label`, `aria-label`

---

### Validator 3: User Message Variables ✨ HIGH PRIORITY
**Purpose**: Variables with semantic names indicating user-facing content  
**Type**: `variable-declaration`  
**Rule**: Variables with semantic names containing specific keywords

```jsx
// ✅ SHOULD BE TRANSLATED (semantic variable names)
const welcomeMessage = "Welcome back!";
const errorText = "Something went wrong";
const successNotification = "Changes saved successfully";
const userTitle = "Account Settings";
const confirmLabel = "Yes, I agree";

// ❌ NOT TRANSLATED (technical variable names)
const apiUrl = "/api/users";
const configData = "production";
const methodType = "POST";
```

**Semantic Keywords**: `message`, `text`, `notification`, `alert`, `title`, `description`, `label`

---

### Validator 4: User-facing Object Properties 🔶 MEDIUM PRIORITY
**Purpose**: Object properties that contain user-facing text  
**Type**: `object-property`  
**Rule**: Object properties with semantic keys (whitelist approach)

```jsx
// ✅ SHOULD BE TRANSLATED (semantic property names)
const notifications = {
  success: "Data saved successfully!",
  error: "Failed to save data",
  warning: "Please check your input"
};

const menuItems = [
  { label: "Dashboard", icon: "home" },
  { label: "Settings", icon: "gear" }
];

// ❌ NOT TRANSLATED (technical properties)
const config = {
  method: "POST",
  timeout: 5000,
  retries: 3
};
```

**Whitelisted Properties**: `message`, `text`, `label`, `title`, `description`, `placeholder`, `tooltip`, `error`, `success`, `warning`, `info`

---

### Validator 5: Form Validation Messages 🔶 MEDIUM PRIORITY
**Purpose**: Form validation and error messages  
**Type**: `form-validation`  
**Rule**: Validation message strings in objects and variables

```jsx
// ✅ SHOULD BE TRANSLATED
const validation = {
  required: "This field is required",
  email: "Please enter a valid email",
  password: "Password must be at least 8 characters"
};

const formErrors = {
  invalidInput: "Please check your input",
  serverError: "Unable to process request"
};
```

**Detection**: Combines object property validation with validation-specific context

---

### Validator 6: Component Props 🔶 MEDIUM PRIORITY
**Purpose**: Props passed to React components (distinguished from HTML attributes)  
**Type**: `component-prop`  
**Rule**: User-facing props in component calls (capitalized component names)

```jsx
// ✅ SHOULD BE TRANSLATED (component props)
<Modal 
  title="Confirm Delete"
  message="Are you sure you want to delete this item?"
  confirmText="Delete"
  cancelText="Cancel"
/>

<Toast text="Item deleted successfully" />
<Tooltip content="Click to edit this field" />

// ❌ NOT TRANSLATED (HTML attributes - handled by Validator 2)
<input placeholder="Enter email" />
<img alt="Profile picture" />
```

**Whitelisted Props**: `title`, `message`, `text`, `content`, `description`, `confirmText`, `cancelText`, `submitText`, `tooltip`, `placeholder`, `label`, `errorText`, `successText`, `warningText`, `infoText`, `helperText`, `hintText`, `statusText`, `actionText`, `buttonText`

**Component Detection**: Elements with capitalized names (React components) vs lowercase (HTML elements)

---

### Validator 7: Alert/Console Messages 🔶 MEDIUM PRIORITY
**Purpose**: User-facing alert and prompt messages (excludes developer console)  
**Type**: `alert-message`  
**Rule**: Only user-facing browser dialogs, not developer console messages

```jsx
// ✅ SHOULD BE TRANSLATED (user-facing dialogs)
alert("Please save your work before leaving");
confirm("Do you want to delete this item?");
prompt("Please enter your name:");

// ❌ NOT TRANSLATED (developer console - filtered out)
console.log("Debug: Component mounted");
console.error("API request failed");
console.warn("Deprecated method used");
console.info("Cache hit ratio: 85%");
```

**User-facing Functions**: `alert`, `confirm`, `prompt`  
**Developer Functions** (filtered): `console.log`, `console.debug`, `console.info`, `console.warn`, `console.error`, `console.trace`, etc.

---

## 🔍 Detection Strategy

### Whitelist Approach
Instead of trying to exclude technical strings, we use a **whitelist approach**:

1. **Start with known user-facing patterns** (JSX text, specific attributes, semantic variables)
2. **Use context-aware detection** (component vs HTML element distinction)
3. **Apply content validation** (natural language patterns, length, punctuation)
4. **Filter out technical patterns** (paths, URLs, debug messages, single words)

### Content Validation Rules

#### ✅ Accept if:
- Contains spaces (natural language)
- Has proper punctuation (`.!?:,`)
- Has mixed case (proper capitalization)
- Length ≥ 3 characters with meaningful content
- Contains question marks (confirmations) or exclamations (alerts)

#### ❌ Reject if:
- Very short (≤ 2 characters)
- Only numbers or symbols
- Technical patterns (paths, URLs, CSS classes)
- Boolean strings (`"true"`, `"false"`)
- ALL_CAPS constants
- Single technical words (`"flex"`, `"POST"`, `"button"`)

## 📊 Output Categories

### By Validator Type:
- `jsx-text`: Direct JSX text content
- `jsx-attribute`: HTML attributes (alt, title, placeholder, etc.)
- `variable-declaration`: Semantic variable names
- `object-property`: User-facing object properties
- `form-validation`: Validation messages
- `component-prop`: React component props
- `alert-message`: User-facing browser dialogs

### By Priority:
- **High Priority**: jsx-text, jsx-attribute, variable-declaration
- **Medium Priority**: object-property, form-validation, component-prop, alert-message

## 🎯 Usage Examples

### CLI Usage
```bash
# Full project analysis
node cli.js /path/to/project i18n --format=json

# Target specific directory
node cli.js /path/to/project/src/components i18n --format=text

# Single file analysis
node cli.js /path/to/project/src/pages/dashboard.tsx i18n

# Focus on high-priority validators
node cli.js /path/to/project i18n --path=src/components --format=markdown
```

### Expected Output Structure
```json
{
  "totalUntranslatedStrings": 146,
  "untranslatedStringsByType": {
    "jsx-text": 43,
    "jsx-attribute": 29, 
    "variable-declaration": 34,
    "object-property": 15,
    "form-validation": 8,
    "component-prop": 40,
    "alert-message": 23
  }
}
```

## 🚀 Benefits

1. **Zero False Positives**: Whitelist approach prevents technical strings from being flagged
2. **Comprehensive Coverage**: 7 specialized validators catch different types of user-facing content
3. **Smart Context Awareness**: Distinguishes between component props and HTML attributes
4. **Priority-based**: Focus on high-priority strings first
5. **Path Targeting**: Analyze specific parts of large projects
6. **Modular Architecture**: Easy to extend with additional validators

## 🔧 Technical Implementation

### Validator Registry System
- Central registry manages all validators
- Each validator implements the `BaseValidator` interface
- Modular architecture with separate files for each validator
- Easy to add new validators or modify existing ones

### AST Analysis
- Uses Babel parser for accurate JavaScript/TypeScript/JSX parsing
- Multiple AST node visitors for different string types
- Context-aware detection (parent element analysis)
- Location tracking for precise error reporting

### Content Processing
- Multi-stage validation (basic → semantic → content patterns)
- Configurable whitelist/blacklist patterns
- Natural language detection heuristics
- Intelligent filtering of technical content
