# String Contexts Analysis for i18n Detection

## 🟢 SHOULD BE TRANSLATED (User-facing content)

### 1. JSX Text Content
```jsx
<h1>Welcome to our app</h1>
<p>Please enter your email address</p>
<span>Loading...</span>
```
**AST Context**: `JSXText` node
**Detection**: Direct JSXText nodes should always be considered

### 2. User-facing JSX Attributes
```jsx
<img alt="Profile picture" />
<button title="Click to save your changes" />
<input placeholder="Enter your name" />
<meta content="Welcome to our amazing app" />
```
**AST Context**: `JSXAttribute` with semantic attribute names
**Detection**: Attributes like `alt`, `title`, `placeholder`, `content`, `label`

### 3. User-facing Props
```jsx
<Modal message="Are you sure you want to delete this item?" />
<Toast text="Successfully saved!" />
<ErrorBoundary fallbackText="Something went wrong" />
```
**AST Context**: `StringLiteral` as JSXAttribute value with semantic prop names
**Detection**: Props like `message`, `text`, `title`, `description`, `label`

### 4. Template Literals in JSX
```jsx
<p>{`Hello ${name}! Welcome back.`}</p>
<div>{`You have ${count} messages`}</div>
```
**AST Context**: `TemplateLiteral` within JSX context
**Detection**: Template literals that are children of JSX elements

### 5. User-facing Error/Success Messages
```jsx
throw new Error("Please enter a valid email address");
const errorMsg = "Password must be at least 8 characters";
console.error("Failed to save user data");
```
**AST Context**: `StringLiteral` in error contexts or user-facing variables
**Detection**: Strings that look like user messages (complete sentences, proper grammar)

### 6. Configuration Objects with User-facing Text
```jsx
const options = [
  { label: "Save Draft", value: "draft" },
  { label: "Publish Now", value: "publish" }
];

const notifications = {
  success: "Changes saved successfully!",
  error: "Failed to save changes"
};
```
**AST Context**: `ObjectProperty` with semantic keys
**Detection**: Object properties with keys like `label`, `title`, `message`, `text`, `description`

---

## 🔴 SHOULD NOT BE TRANSLATED (Technical/Infrastructure)

### 1. Import/Export Statements
```jsx
import React from 'react';
import Button from '@/components/ui/button';
export { default } from './Component';
```
**AST Context**: `ImportDeclaration`, `ExportDeclaration`
**Detection**: Any string within import/export statements

### 2. CSS Classes and Styling
```jsx
<div className="flex space-y-4 text-red-500" />
<div style={{ position: "absolute", display: "flex" }} />
const styles = { backgroundColor: "red" };
```
**AST Context**: `JSXAttribute` with name `className`, `style`, or `sx`
**Detection**: Styling-related attributes and CSS property names/values

### 3. Technical HTML/React Attributes
```jsx
<div data-testid="user-profile" id="main-content" />
<input ref={inputRef} key="email-field" />
<button type="submit" role="button" />
```
**AST Context**: `JSXAttribute` with technical attribute names
**Detection**: Attributes like `data-*`, `aria-*`, `id`, `key`, `ref`, `type`, `role`

### 4. File Paths and URLs
```jsx
import utils from '../utils';
import api from '../../lib/api';
fetch('/api/users');
<Link href="/dashboard" />
```
**AST Context**: Path-like strings in imports, URLs in API calls
**Detection**: Strings starting with `/`, `./`, `../`, `@/`, or containing file extensions

### 5. Technical Object Keys and Values
```jsx
const config = {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  mode: "cors"
};

const buttonProps = {
  type: "button",
  variant: "primary",
  size: "medium"
};
```
**AST Context**: `ObjectProperty` with technical keys/values
**Detection**: Technical property names and enum-like values

### 6. Environment Variables and Constants
```jsx
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const nodeEnv = "production";
const VERSION = "1.2.3";
```
**AST Context**: Environment variable access, constant definitions
**Detection**: Strings with `NEXT_PUBLIC_`, `NODE_ENV`, version patterns

### 7. JavaScript Keywords and Library Names
```jsx
export default Component;
import { useEffect } from 'react';
const lodash = require('lodash');
```
**AST Context**: Language keywords, library names
**Detection**: JavaScript reserved words, common library names

### 8. CSS Units and Values
```jsx
const styles = {
  width: "100px",
  height: "50vh",
  color: "#ff0000",
  background: "rgb(255, 255, 255)"
};
```
**AST Context**: CSS unit patterns, color values
**Detection**: Strings matching CSS unit patterns, color patterns

---

## 🟡 CONTEXT-DEPENDENT (Needs Smart Detection)

### 1. Variable Assignments
```jsx
// TRANSLATABLE
const welcomeMessage = "Welcome to our platform!";
const errorText = "Please try again later";

// NOT TRANSLATABLE  
const apiEndpoint = "api/users";
const fileExtension = ".json";
```
**Detection Strategy**: Analyze variable name semantics + string content patterns

### 2. Function Arguments
```jsx
// TRANSLATABLE
console.log("User successfully logged in");
alert("Please save your work before continuing");

// NOT TRANSLATABLE
fetch("api/data");
document.getElementById("header");
```
**Detection Strategy**: Function name context + string content analysis

### 3. Object Property Values
```jsx
// TRANSLATABLE
const ui = {
  welcomeTitle: "Welcome Back!",
  submitButton: "Save Changes"
};

// NOT TRANSLATABLE
const config = {
  httpMethod: "GET",
  contentType: "application/json"
};
```
**Detection Strategy**: Property key semantics + value content patterns

### 4. Conditional Expressions
```jsx
// TRANSLATABLE
const message = isError ? "Something went wrong" : "Success!";

// NOT TRANSLATABLE
const method = isPost ? "POST" : "GET";
```
**Detection Strategy**: Context analysis + content patterns

---

## 🎯 DETECTION ALGORITHM

### Priority Order:
1. **AST Context Check**: Is this in an import/export/technical context? → EXCLUDE
2. **Attribute/Property Semantics**: Is this a technical attribute/property? → EXCLUDE  
3. **Content Pattern Analysis**: Does this look like user-facing text? → INCLUDE/EXCLUDE
4. **Variable/Function Context**: What is the semantic context? → INCLUDE/EXCLUDE

### Implementation Strategy:
1. **Strict AST Filtering**: Use AST parent types to exclude obvious technical contexts
2. **Semantic Attribute Lists**: Maintain lists of technical vs user-facing attribute names
3. **Content Pattern Matching**: Use regex patterns for CSS classes, URLs, technical strings
4. **Contextual Analysis**: Analyze variable names and function contexts for ambiguous cases
