# What SHOULD Be Translated - Definitive Whitelist

## 🎯 HIGH PRIORITY - Always Translate

### 1. JSX Text Content
```jsx
<h1>Welcome to our application</h1>
<p>Please enter your email address</p>
<span>Loading...</span>
<div>Error: Could not save data</div>
```
**Rule**: All direct text content within JSX elements

### 2. User-facing JSX Attributes
```jsx
<img alt="User profile picture" />
<button title="Click to save your changes" />
<input placeholder="Enter your email" />
<option label="Select your country" />
```
**Attributes to translate**: `alt`, `title`, `placeholder`, `label`, `aria-label`

### 3. User Message Variables
```jsx
const welcomeMessage = "Welcome back!";
const errorText = "Something went wrong";
const successNotification = "Changes saved successfully";
```
**Rule**: Variables with semantic names containing: `message`, `text`, `notification`, `alert`, `title`, `description`, `label`

### 4. User-facing Object Properties
```jsx
const notifications = {
  success: "Data saved successfully!",
  error: "Failed to save data",
  warning: "Please check your input"
};

const menuItems = [
  { label: "Dashboard", icon: "home" },
  { label: "Settings", icon: "gear" }
];
```
**Properties to translate**: `message`, `text`, `label`, `title`, `description`, `placeholder`, `tooltip`, `error`, `success`, `warning`, `info`

### 5. Form Validation Messages
```jsx
const validation = {
  required: "This field is required",
  email: "Please enter a valid email",
  password: "Password must be at least 8 characters"
};
```
**Rule**: Any validation or error message strings

---

## 🟡 MEDIUM PRIORITY - Context Dependent

### 6. User-facing Props in Components
```jsx
<Modal 
  title="Confirm Delete"
  message="Are you sure you want to delete this item?"
  confirmText="Delete"
  cancelText="Cancel"
/>

<Toast text="Item deleted successfully" />
<Tooltip content="Click to edit this field" />
```
**Props to translate**: `title`, `message`, `text`, `content`, `description`, `confirmText`, `cancelText`, `submitText`

### 7. Alert/Console Messages for Users
```jsx
alert("Please save your work before leaving");
confirm("Do you want to delete this item?");
// NOT: console.log("Debug info") - this is for developers
```
**Rule**: Only alerts/prompts that users see, not debug logs

### 8. Meta Content for SEO
```jsx
<meta name="description" content="The best app for managing your tasks" />
<meta property="og:title" content="TaskManager - Get organized" />
<title>Welcome | TaskManager</title>
```
**Rule**: SEO and social media meta content

### 9. Status/State Messages
```jsx
const loadingStates = {
  idle: "Ready",
  loading: "Loading...",
  success: "Complete",
  error: "Failed"
};
```
**Rule**: Human-readable status messages (not technical state values)

---

## 🔴 LOW PRIORITY - Usually Don't Translate

### 10. Technical Enum Values
```jsx
// DON'T TRANSLATE - these are technical identifiers
const config = {
  method: "POST",        // HTTP method
  type: "button",        // HTML type
  variant: "primary",    // Design system variant
  size: "large"          // Size identifier
};

// BUT TRANSLATE - these are user-facing
const userConfig = {
  displayName: "Large Button",  // ✅ User sees this
  description: "A prominent action button"  // ✅ User sees this
};
```

---

## 🎯 DETECTION RULES

### Context-Based Rules:

1. **JSX Text**: Always translate
   ```jsx
   <div>This text</div>  // ✅ TRANSLATE
   ```

2. **JSX Attributes**: Whitelist approach
   ```jsx
   <input placeholder="Enter name" />  // ✅ TRANSLATE (placeholder)
   <div className="flex" />           // ❌ DON'T (className)
   ```

3. **Object Properties**: Key-based detection
   ```jsx
   { message: "Hello" }     // ✅ TRANSLATE (message key)
   { method: "POST" }       // ❌ DON'T (technical key)
   ```

4. **Variable Names**: Semantic detection
   ```jsx
   const welcomeText = "Hi!";    // ✅ TRANSLATE (semantic name)
   const apiUrl = "/api/data";   // ❌ DON'T (technical name)
   ```

### Content Pattern Rules:

1. **Complete Sentences**: Usually translate
   ```jsx
   "Please enter your email address"  // ✅ Complete sentence
   "POST"                            // ❌ Single word/technical
   ```

2. **Length & Grammar**: Translate if natural language
   ```jsx
   "Loading your data..."  // ✅ Natural language
   "flex"                 // ❌ Too short/technical
   ```

3. **Special Characters**: Don't translate technical patterns
   ```jsx
   "Welcome!"              // ✅ Punctuation in natural language
   "../components"         // ❌ Path notation
   "@/lib/utils"          // ❌ Import path
   ```

---

## 🛠️ IMPLEMENTATION STRATEGY

### Whitelist Approach:
1. **Start with JSX Text** - Always translate
2. **JSX Attribute Whitelist** - Only specific attributes
3. **Object Property Whitelist** - Only semantic keys
4. **Variable Name Pattern** - Only user-facing names
5. **Content Validation** - Check if it's natural language

### Priority Order:
1. ✅ **Include**: JSX text content
2. ✅ **Include**: Whitelisted JSX attributes (`alt`, `title`, `placeholder`)
3. ✅ **Include**: Whitelisted object properties (`message`, `text`, `label`)
4. ❌ **Exclude**: Everything else by default
5. ⚠️ **Validate**: Content patterns for edge cases

This approach is much safer and more accurate than trying to exclude everything technical!
