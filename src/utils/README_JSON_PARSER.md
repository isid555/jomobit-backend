# JSON Parser Utility

## Purpose
Robust JSON parsing utility that handles various LLM response formats, including markdown code blocks, extra text, and common formatting issues.

## Problem
LLMs often return JSON wrapped in markdown code blocks or with additional text:
```
```json
{
  "key": "value"
}
```
```

This causes `JSON.parse()` to fail with: `Unexpected token '`'`

## Solution
The `jsonParser` utility implements multiple parsing strategies with automatic fallback.

---

## Usage

### Basic Parsing
```javascript
const { parseJSON } = require('../utils/jsonParser');

const response = `\`\`\`json
{
  "name": "John",
  "age": 30
}
\`\`\``;

const data = parseJSON(response, 'user_data');
// Returns: { name: "John", age: 30 }
```

### Parse JSON Object
```javascript
const { parseJSONObject } = require('../utils/jsonParser');

const response = await llmService.call(...);
const data = parseJSONObject(response, 'template_metadata');
// Ensures result is an object (not array or primitive)
```

### Parse JSON Array
```javascript
const { parseJSONArray } = require('../utils/jsonParser');

const response = await llmService.call(...);
const concepts = parseJSONArray(response, 'concept_generation');
// Ensures result is an array
```

### Safe Parsing with Default
```javascript
const { safeParseJSON } = require('../utils/jsonParser');

const data = safeParseJSON(response, { default: 'value' }, 'optional_data');
// Returns parsed data or default value if parsing fails
```

### Validate Parsed JSON
```javascript
const { parseJSON, validateJSON } = require('../utils/jsonParser');

const data = parseJSON(response, 'user_profile');

const schema = {
  name: 'string',
  age: 'number',
  tags: 'array'
};

validateJSON(data, schema, 'user_profile');
// Throws error if validation fails
```

---

## Parsing Strategies

The parser tries multiple strategies in order:

### 1. Direct Parsing (Best Case)
```javascript
JSON.parse(response)
```

### 2. Remove Markdown Code Blocks
```javascript
// Removes ```json ... ``` or ``` ... ```
response.replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/, '')
```

### 3. Extract JSON from Text
```javascript
// Finds first { or [ and extracts JSON
const jsonMatch = response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
```

### 4. Aggressive Cleanup
```javascript
// Removes text before/after JSON
// Normalizes whitespace
// Removes newlines, tabs, etc.
```

### 5. Fix Common JSON Errors
```javascript
// Fix trailing commas
// Convert single quotes to double quotes
// Quote unquoted keys (last resort)
```

---

## Examples

### Example 1: Markdown Code Block
```javascript
const response = `\`\`\`json
{
  "festival_name": "Diwali",
  "colors": ["red", "gold"]
}
\`\`\``;

const data = parseJSON(response);
// ✅ Works! Returns parsed object
```

### Example 2: Extra Text
```javascript
const response = `Here's the JSON:
{
  "name": "Product",
  "price": 99.99
}
Hope this helps!`;

const data = parseJSON(response);
// ✅ Works! Extracts and parses JSON
```

### Example 3: Trailing Commas
```javascript
const response = `{
  "items": ["a", "b", "c",],
  "count": 3,
}`;

const data = parseJSON(response);
// ✅ Works! Fixes trailing commas
```

### Example 4: Single Quotes
```javascript
const response = `{
  'name': 'John',
  'age': 30
}`;

const data = parseJSON(response);
// ✅ Works! Converts to double quotes
```

---

## Error Handling

### Parsing Failure
```javascript
try {
  const data = parseJSON(response, 'my_context');
} catch (error) {
  // All strategies failed
  // Error includes context and response preview
  console.error(error.message);
  // "Failed to parse JSON response for my_context. Response preview: ..."
}
```

### Safe Parsing
```javascript
const data = safeParseJSON(response, null, 'optional_data');
if (data === null) {
  // Parsing failed, use default logic
}
```

---

## Logging

The parser logs each strategy attempt:

```javascript
// Debug logs (only if direct parsing fails)
logger.debug('Direct JSON parsing failed, trying cleanup strategies', {
  context: 'template_metadata',
  error: 'Unexpected token...'
});

// Error logs (only if all strategies fail)
logger.error('All JSON parsing strategies failed', {
  context: 'template_metadata',
  responsePreview: '...',
  responseLength: 1234
});
```

---

## Best Practices

### 1. Always Provide Context
```javascript
// ❌ Bad
const data = parseJSON(response);

// ✅ Good
const data = parseJSON(response, 'template_metadata_extraction');
```

### 2. Use Type-Specific Functions
```javascript
// ❌ Generic
const data = parseJSON(response);
if (!Array.isArray(data)) throw new Error('Expected array');

// ✅ Type-specific
const data = parseJSONArray(response, 'concepts');
```

### 3. Validate Critical Data
```javascript
const data = parseJSONObject(response, 'user_profile');

validateJSON(data, {
  name: 'string',
  email: 'string',
  age: 'number'
}, 'user_profile');
```

### 4. Use Safe Parsing for Optional Data
```javascript
// ❌ Try-catch for optional data
let metadata = {};
try {
  metadata = parseJSON(response);
} catch (error) {
  // ignore
}

// ✅ Safe parsing
const metadata = safeParseJSON(response, {}, 'optional_metadata');
```

---

## Integration

### Updated Files
All LLM response parsing now uses this utility:

1. `src/services/llm/templateExtractor.js`
   - `parseJSONObject(response, 'template_metadata_extraction')`

2. `src/services/llm/conceptGenerator.js`
   - `parseJSONArray(response, 'concept_generation')`

3. `src/services/posterGeneration/wishingGenerator.js`
   - `parseJSONObject(response, 'wishing_copy_generation')`

4. `src/services/posterGeneration/awarenessGenerator.js`
   - `parseJSONObject(response, 'awareness_copy_and_visual_description')`

5. `src/services/posterGeneration/ctaGenerator.js`
   - `parseJSONObject(response, 'cta_subject_splitting')`
   - `parseJSONObject(response, 'cta_copy_generation')`

---

## Testing

### Test Cases Covered
- ✅ Valid JSON
- ✅ JSON in markdown code blocks (` ```json ... ``` `)
- ✅ JSON with extra text before/after
- ✅ JSON with trailing commas
- ✅ JSON with single quotes
- ✅ JSON with unquoted keys
- ✅ JSON with extra whitespace
- ✅ Malformed JSON (throws error)

### Manual Testing
```javascript
const { parseJSON } = require('./utils/jsonParser');

// Test various formats
const testCases = [
  '{"valid": "json"}',
  '```json\n{"markdown": "block"}\n```',
  'Here is: {"extra": "text"}',
  '{"trailing": "comma",}',
  "{'single': 'quotes'}",
];

testCases.forEach(test => {
  try {
    const result = parseJSON(test, 'test');
    console.log('✅ Parsed:', result);
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }
});
```

---

## Performance

- **Fast Path**: Direct `JSON.parse()` for valid JSON (no overhead)
- **Fallback**: Only tries additional strategies if direct parsing fails
- **Efficient**: Regex operations are optimized and cached
- **Logging**: Debug logs only when needed

---

## Future Enhancements

Potential improvements:
1. Support for YAML responses
2. Support for XML responses
3. Streaming JSON parsing
4. Custom validation schemas (JSON Schema)
5. Automatic type coercion
6. Response caching

---

## Troubleshooting

### Issue: Still getting parse errors
**Solution**: Check the raw response in logs. The parser logs the response preview when all strategies fail.

### Issue: Incorrect data structure
**Solution**: Use `parseJSONObject()` or `parseJSONArray()` instead of generic `parseJSON()`.

### Issue: Validation errors
**Solution**: Check the schema definition matches the actual data structure.

---

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Last Updated**: January 2025
