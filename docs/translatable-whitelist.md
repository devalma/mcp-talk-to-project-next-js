# What SHOULD Be Translated - Whitelist Approach

## 🎯 Core Principle: Only Include What We're Confident Is User-Facing

Instead of excluding technical content (blacklist), we include only content we're confident is user-facing (whitelist).

## ✅ DEFINITE TRANSLATABLE CONTEXTS

### 1. Direct JSX Text Content
```jsx
<h1>Welcome to our app</h1>
<p>Please enter your email</p>
<span>Loading...</span>
```
**Detection**: JSXText nodes
**Confidence**: 100% - This is always user-facing

### 2. User-Facing JSX Attributes (Specific List)
```jsx
<img alt="Profile picture" />
<button title="Save your changes" />
<input placeholder="Enter your name" />
<meta content="App description" />
```
**Detection**: JSXAttribute where attribute name is in TRANSLATABLE_ATTRIBUTES list
**Translatable Attributes**: `alt`, `title`, `placeholder`, `aria-label`, `content` (meta), `label`

### 3. User-Facing Component Props (Specific List)  
```jsx
<Modal message="Are you sure?" />
<Toast text="Success!" />
<Button label="Save Changes" />
<ErrorBoundary fallbackText="Error occurred" />
```
**Detection**: JSXAttribute where prop name is in TRANSLATABLE_PROPS list
**Translatable Props**: `message`, `text`, `label`, `title`, `description`, `content`, `fallbackText`, `errorMessage`, `successMessage`, `warningMessage`, `infoMessage`

### 4. Template Literals in JSX Context
```jsx
<p>{`Hello ${name}!`}</p>
<div>{`You have ${count} messages`}</div>
```
**Detection**: TemplateLiteral that is a direct child of JSX elements
**Confidence**: High - Templates in JSX are usually for user display

### 5. Object Properties with User-Facing Keys
```jsx
const messages = {
  welcome: "Welcome back!",
  error: "Something went wrong",
  success: "Changes saved"
};

const menuItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" }
];
```
**Detection**: ObjectProperty where key name is in TRANSLATABLE_OBJECT_KEYS list
**Translatable Keys**: `message`, `text`, `label`, `title`, `description`, `content`, `placeholder`, `alt`, `error`, `success`, `warning`, `info`, `welcome`, `goodbye`, `hello`, `thanks`

---

## 🔧 IMPLEMENTATION STRATEGY

### Whitelist-Based Detection Algorithm:

```typescript
function shouldTranslateString(path: any, text: string): boolean {
  const parent = path.parent;
  
  // 1. JSX Text - Always translatable
  if (parent?.type === 'JSXText') {
    return true;
  }
  
  // 2. JSX Attributes - Only specific ones
  if (parent?.type === 'JSXAttribute') {
    const attrName = parent.name?.name;
    return TRANSLATABLE_ATTRIBUTES.includes(attrName);
  }
  
  // 3. Object Properties - Only specific keys
  if (parent?.type === 'ObjectProperty' || parent?.type === 'Property') {
    const keyName = parent.key?.name || parent.key?.value;
    return TRANSLATABLE_OBJECT_KEYS.includes(keyName);
  }
  
  // 4. Template Literals in JSX
  if (parent?.type === 'TemplateLiteral') {
    return isInJSXContext(path);
  }
  
  // Default: Don't translate (conservative approach)
  return false;
}
```

### Predefined Lists:

```typescript
const TRANSLATABLE_ATTRIBUTES = [
  'alt',           // <img alt="Description" />
  'title',         // <button title="Tooltip" />
  'placeholder',   // <input placeholder="Enter text" />
  'aria-label',    // <div aria-label="Close button" />
  'content',       // <meta content="Description" />
  'label'          // <label>Text</label>
];

const TRANSLATABLE_PROPS = [
  'message',       // <Modal message="Confirm?" />
  'text',          // <Toast text="Success!" />
  'label',         // <Button label="Save" />
  'title',         // <Card title="Welcome" />
  'description',   // <Meta description="Page desc" />
  'content',       // <Tooltip content="Help text" />
  'fallbackText',  // <ErrorBoundary fallbackText="Error" />
  'errorMessage',  // <Form errorMessage="Invalid" />
  'successMessage',// <Form successMessage="Saved" />
  'warningMessage',// <Alert warningMessage="Warning" />
  'infoMessage'    // <Alert infoMessage="Info" />
];

const TRANSLATABLE_OBJECT_KEYS = [
  // Core UI text
  'message', 'text', 'label', 'title', 'description', 'content',
  'placeholder', 'alt', 'tooltip', 'hint', 'help',
  
  // Status messages
  'error', 'success', 'warning', 'info', 'loading',
  'errorMessage', 'successMessage', 'warningMessage', 'infoMessage',
  
  // Common greetings/actions
  'welcome', 'goodbye', 'hello', 'thanks', 'please', 'sorry',
  'save', 'cancel', 'delete', 'edit', 'create', 'update',
  'submit', 'confirm', 'continue', 'back', 'next', 'finish',
  
  // Navigation/Menu
  'name', 'displayName', 'menuTitle', 'breadcrumb'
];
```

---

## 📊 CONTENT QUALITY FILTERS

Even within translatable contexts, apply content filters:

### Include Only If:
1. **Length**: >= 2 characters (exclude single chars like "x", "y")
2. **Human Language**: Contains letters (not just numbers/symbols)
3. **Sentence-like**: Has word characters and common punctuation
4. **Not Technical**: Doesn't match technical patterns

### Content Pattern Filters:
```typescript
function isTranslatableContent(text: string): boolean {
  // Too short
  if (text.length < 2) return false;
  
  // Only whitespace
  if (!text.trim()) return false;
  
  // Only numbers/symbols
  if (!/[a-zA-Z]/.test(text)) return false;
  
  // Technical patterns to exclude
  const technicalPatterns = [
    /^[A-Z_]+$/, // CONSTANTS
    /^[\d\.\-]+$/, // Version numbers
    /^#[0-9a-f]{3,8}$/i, // Color codes
    /^\d+(px|em|rem|vh|vw|%)$/, // CSS units
    /^(left|right|center|top|bottom|middle)$/, // CSS positions
    /^(flex|grid|block|inline|none|auto)$/, // CSS display values
  ];
  
  return !technicalPatterns.some(pattern => pattern.test(text));
}
```

---

## 🎯 BENEFITS OF WHITELIST APPROACH

1. **Conservative**: Only translates what we're confident about
2. **Maintainable**: Clear lists that can be easily updated
3. **Predictable**: Developers know exactly what gets detected
4. **False Positive Resistant**: Won't accidentally translate technical strings
5. **Performance**: Faster than complex blacklist checking

---

## 🔄 ITERATIVE IMPROVEMENT

1. **Start Conservative**: Begin with core translatable contexts
2. **Monitor Results**: Check what legitimate content is missed
3. **Expand Gradually**: Add new contexts/keys based on real needs
4. **User Feedback**: Allow teams to suggest additions to the lists
