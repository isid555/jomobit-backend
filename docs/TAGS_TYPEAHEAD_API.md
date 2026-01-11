# Tags Typeahead API

## Overview

The Tags Typeahead API provides autocomplete suggestions for template tags as users type. It returns the most relevant tags sorted by usage frequency, making it easy to implement a responsive tag search experience.

---

## Endpoint

```
GET /api/templates/tags/typeahead
```

**Authentication:** Not required (public endpoint)

---

## Request

### Query Parameters

| Parameter | Type   | Required | Default | Max | Description                          |
|-----------|--------|----------|---------|-----|--------------------------------------|
| `q`       | string | Yes      | -       | -   | Search query (prefix matching)       |
| `limit`   | number | No       | 8       | 20  | Maximum number of suggestions        |

### Example Requests

```bash
# Basic request
GET /api/templates/tags/typeahead?q=diw

# With custom limit
GET /api/templates/tags/typeahead?q=holi&limit=5
```

---

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "tags": [
    { "tag": "diwali", "count": 150 },
    { "tag": "diwali wishes", "count": 45 },
    { "tag": "diwali greetings", "count": 32 },
    { "tag": "diwali celebration", "count": 28 }
  ],
  "query": "diw",
  "total": 4
}
```

### Response Fields

| Field   | Type    | Description                                    |
|---------|---------|------------------------------------------------|
| success | boolean | Request status                                 |
| tags    | array   | Array of matching tag objects                  |
| tags[].tag | string | The tag name                                |
| tags[].count | number | Number of templates using this tag        |
| query   | string  | The search query (trimmed)                     |
| total   | number  | Total number of results returned               |

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "Validation error",
  "message": "Query parameter 'q' is required"
}
```

### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Failed to fetch tags suggestions"
}
```

---

## Frontend Implementation Guide

### React Example with Debouncing

```tsx
import { useState, useEffect, useCallback } from 'react';
import debounce from 'lodash/debounce';

interface TagSuggestion {
  tag: string;
  count: number;
}

const TagTypeahead = ({ onTagSelect }: { onTagSelect: (tag: string) => void }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Debounced API call
  const fetchSuggestions = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/templates/tags/typeahead?q=${encodeURIComponent(searchQuery)}&limit=8`
        );
        const data = await response.json();
        
        if (data.success) {
          setSuggestions(data.tags);
        }
      } catch (error) {
        console.error('Failed to fetch tag suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300), // 300ms debounce
    []
  );

  useEffect(() => {
    fetchSuggestions(query);
  }, [query, fetchSuggestions]);

  const handleSelect = (tag: string) => {
    onTagSelect(tag);
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder="Search tags..."
        className="w-full px-4 py-2 border rounded-lg"
      />
      
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
          {suggestions.map((item) => (
            <li
              key={item.tag}
              onClick={() => handleSelect(item.tag)}
              className="px-4 py-2 cursor-pointer hover:bg-gray-100 flex justify-between"
            >
              <span>{item.tag}</span>
              <span className="text-gray-400 text-sm">{item.count} templates</span>
            </li>
          ))}
        </ul>
      )}
      
      {isLoading && (
        <div className="absolute right-3 top-3">
          <span className="loading-spinner" />
        </div>
      )}
    </div>
  );
};

export default TagTypeahead;
```

### API Service Function

```typescript
// services/templateApi.ts

interface TagTypeaheadResponse {
  success: boolean;
  tags: Array<{ tag: string; count: number }>;
  query: string;
  total: number;
}

export const getTagSuggestions = async (
  query: string,
  limit: number = 8
): Promise<TagTypeaheadResponse> => {
  const params = new URLSearchParams({
    q: query,
    limit: limit.toString(),
  });

  const response = await fetch(`/api/templates/tags/typeahead?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch tag suggestions');
  }
  
  return response.json();
};
```

---

## Best Practices

1. **Debounce requests** - Use 200-300ms debounce to avoid excessive API calls
2. **Minimum query length** - Consider waiting for 2+ characters before making requests
3. **Show loading state** - Display a spinner while fetching suggestions
4. **Keyboard navigation** - Support arrow keys and Enter for accessibility
5. **Cache results** - Consider caching recent queries to improve UX
6. **Handle empty states** - Show appropriate message when no tags match

---

## Notes

- Tags are matched using **prefix matching** (e.g., "diw" matches "diwali", "diwali wishes")
- Matching is **case-insensitive**
- Results are sorted by **template count** (most popular first)
- Only tags from **active, public templates** are returned
