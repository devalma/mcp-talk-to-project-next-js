# What Should Be Translated — Whitelist Reference

The i18n extractor uses a **whitelist** approach: only strings in contexts we're confident are user-facing are flagged for translation. This avoids false positives on technical strings (HTTP methods, CSS values, import paths, etc.) that a blacklist would have to enumerate exhaustively.

## Priority tiers

### High priority — always translate

**1. JSX text content** — direct text children of JSX elements.

```jsx
<h1>Welcome to our application</h1>
<p>Please enter your email address</p>
<span>Loading...</span>
```

**2. User-facing JSX attributes** — specific allow-listed attribute names.

```jsx
<img alt="User profile picture" />
<button title="Click to save your changes" />
<input placeholder="Enter your email" />
<div aria-label="Close" />
<meta content="App description" />
```

Attributes: `alt`, `title`, `placeholder`, `label`, `aria-label`, `content` (on `meta`).

**3. User message variables** — variables whose names signal user-facing intent.

```jsx
const welcomeMessage = "Welcome back!";
const errorText = "Something went wrong";
const successNotification = "Changes saved successfully";
```

Name fragments: `message`, `text`, `notification`, `alert`, `title`, `description`, `label`.

**4. User-facing object properties** — keys that signal user-facing values.

```jsx
const notifications = {
  success: "Data saved successfully!",
  error: "Failed to save data",
};

const menuItems = [
  { label: "Dashboard" },
  { label: "Settings" },
];
```

Keys: `message`, `text`, `label`, `title`, `description`, `content`, `placeholder`, `tooltip`, `hint`, `help`, `error`, `success`, `warning`, `info`, `loading`, `errorMessage`, `successMessage`, `warningMessage`, `infoMessage`, plus common greetings/actions (`welcome`, `save`, `cancel`, `submit`, `confirm`, `continue`, `back`, `next`, …) and navigation (`displayName`, `menuTitle`, `breadcrumb`).

**5. Form validation messages** — validation rule strings.

```jsx
const validation = {
  required: "This field is required",
  email: "Please enter a valid email",
  password: "Password must be at least 8 characters",
};
```

### Medium priority — context-dependent

**6. User-facing component props** — allow-listed prop names.

```jsx
<Modal title="Confirm Delete" message="Are you sure?" confirmText="Delete" cancelText="Cancel" />
<Toast text="Item deleted successfully" />
<Tooltip content="Click to edit this field" />
```

Props: `message`, `text`, `label`, `title`, `description`, `content`, `fallbackText`, `errorMessage`, `successMessage`, `warningMessage`, `infoMessage`, `confirmText`, `cancelText`, `submitText`.

**7. User-facing alert/prompt messages** — `alert()`, `confirm()` (not `console.log`).

```jsx
alert("Please save your work before leaving");
confirm("Do you want to delete this item?");
```

**8. SEO/meta content** — `<meta>` content and page `<title>`.

```jsx
<meta name="description" content="The best app for managing your tasks" />
<title>Welcome | TaskManager</title>
```

**9. Status/state messages** — human-readable state labels.

```jsx
const loadingStates = {
  idle: "Ready",
  loading: "Loading...",
  success: "Complete",
  error: "Failed",
};
```

**10. Template literals in JSX** — template literals used as JSX children.

```jsx
<p>{`Hello ${name}!`}</p>
<div>{`You have ${count} messages`}</div>
```

### Low priority — usually don't translate

Technical enum values that happen to be strings:

```jsx
const config = {
  method: "POST",      // HTTP method
  type: "button",      // HTML type
  variant: "primary",  // design system variant
  size: "large",       // size identifier
};
```

But **do** translate user-facing fields that live on the same object:

```jsx
const userConfig = {
  displayName: "Large Button",
  description: "A prominent action button",
};
```

---

## Detection algorithm

```typescript
function shouldTranslateString(path: any, text: string): boolean {
  const parent = path.parent;

  // JSX text — always translatable
  if (parent?.type === 'JSXText') return true;

  // JSX attributes — allow-list
  if (parent?.type === 'JSXAttribute') {
    return TRANSLATABLE_ATTRIBUTES.includes(parent.name?.name);
  }

  // Object properties — key allow-list
  if (parent?.type === 'ObjectProperty' || parent?.type === 'Property') {
    const keyName = parent.key?.name || parent.key?.value;
    return TRANSLATABLE_OBJECT_KEYS.includes(keyName);
  }

  // Template literals in JSX context
  if (parent?.type === 'TemplateLiteral') {
    return isInJSXContext(path);
  }

  // Default: don't translate (conservative)
  return false;
}
```

## Content quality filters

Even within a translatable context, apply content-pattern filters:

```typescript
function isTranslatableContent(text: string): boolean {
  if (text.length < 2) return false;             // too short
  if (!text.trim()) return false;                // whitespace only
  if (!/[a-zA-Z]/.test(text)) return false;      // numbers/symbols only

  const technicalPatterns = [
    /^[A-Z_]+$/,                                 // CONSTANTS
    /^[\d\.\-]+$/,                               // version numbers
    /^#[0-9a-f]{3,8}$/i,                         // color codes
    /^\d+(px|em|rem|vh|vw|%)$/,                  // CSS units
    /^(left|right|center|top|bottom|middle)$/,   // CSS positions
    /^(flex|grid|block|inline|none|auto)$/,      // CSS display values
  ];

  return !technicalPatterns.some(p => p.test(text));
}
```

## Why whitelist over blacklist

1. **Conservative** — only flags strings we're confident about.
2. **Maintainable** — a handful of explicit lists, easy to extend.
3. **Predictable** — developers can tell at a glance what the extractor will pick up.
4. **False-positive resistant** — technical strings (`"POST"`, `"flex"`, `"#fff"`) never accidentally slip into translation bundles.
5. **Fast** — list membership is cheaper than pattern-matching an open-ended set of technical idioms.

## Evolution

Start with the High priority tiers. Monitor real projects for legitimate user-facing strings that the extractor misses, then expand the lists or add a validator rather than loosening the overall algorithm.
