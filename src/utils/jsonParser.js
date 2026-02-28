/**
 * JSON Parser Utility
 * Robust JSON parsing that handles various LLM response formats
 */

const logger = require('./logger');

/**
 * Parse JSON from LLM response with various fallback strategies
 * @param {string} response - Raw LLM response
 * @param {string} context - Context for logging (e.g., 'template_extraction')
 * @returns {Object} Parsed JSON object
 * @throws {Error} If parsing fails after all strategies
 */
function parseJSON(response, context = 'unknown') {
    if (!response || typeof response !== 'string') {
        throw new Error('Invalid response: must be a non-empty string');
    }

    // Strategy 1: Try direct parsing (best case)
    try {
        return JSON.parse(response);
    } catch (error) {
        logger.debug('Direct JSON parsing failed, trying cleanup strategies', {
            context,
            error: error.message
        });
    }

    // Strategy 2: Remove markdown code blocks
    let cleaned = response.trim();

    // Remove ```json ... ``` or ``` ... ```
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
    cleaned = cleaned.replace(/\n?```\s*$/, '');

    try {
        return JSON.parse(cleaned);
    } catch (error) {
        logger.debug('Markdown removal failed, trying more aggressive cleanup', {
            context,
            error: error.message
        });
    }

    // Strategy 3: Extract JSON from text (find first { or [)
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[1]);
        } catch (error) {
            logger.debug('JSON extraction failed', {
                context,
                error: error.message
            });
        }
    }

    // Strategy 4: Remove common LLM artifacts
    cleaned = cleaned
        .replace(/^[^{\[]*/, '') // Remove text before first { or [
        .replace(/[^}\]]*$/, '') // Remove text after last } or ]
        .replace(/\n/g, ' ')     // Replace newlines with spaces
        .replace(/\r/g, '')      // Remove carriage returns
        .replace(/\t/g, ' ')     // Replace tabs with spaces
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch (error) {
        logger.debug('Aggressive cleanup failed', {
            context,
            error: error.message
        });
    }

    // Strategy 5: Try to fix common JSON errors
    try {
        // Fix trailing commas
        let fixed = cleaned.replace(/,(\s*[}\]])/g, '$1');

        // Fix single quotes to double quotes (risky but sometimes works)
        fixed = fixed.replace(/'/g, '"');

        // Fix unquoted keys (very risky, last resort)
        fixed = fixed.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

        return JSON.parse(fixed);
    } catch (error) {
        logger.debug('JSON fixing failed', {
            context,
            error: error.message
        });
    }

    // All strategies failed
    logger.error('All JSON parsing strategies failed', {
        context,
        responsePreview: response.substring(0, 200),
        responseLength: response.length
    });

    throw new Error(`Failed to parse JSON response for ${context}. Response preview: ${response.substring(0, 100)}...`);
}

/**
 * Safely parse JSON with a default fallback
 * @param {string} response - Raw LLM response
 * @param {Object} defaultValue - Default value if parsing fails
 * @param {string} context - Context for logging
 * @returns {Object} Parsed JSON or default value
 */
function safeParseJSON(response, defaultValue = null, context = 'unknown') {
    try {
        return parseJSON(response, context);
    } catch (error) {
        logger.warn('JSON parsing failed, using default value', {
            context,
            error: error.message,
            hasDefault: defaultValue !== null
        });
        return defaultValue;
    }
}

/**
 * Extract and parse JSON array from response
 * @param {string} response - Raw LLM response
 * @param {string} context - Context for logging
 * @returns {Array} Parsed JSON array
 * @throws {Error} If result is not an array
 */
function parseJSONArray(response, context = 'unknown') {
    const parsed = parseJSON(response, context);

    if (!Array.isArray(parsed)) {
        throw new Error(`Expected array but got ${typeof parsed} for ${context}`);
    }

    return parsed;
}

/**
 * Extract and parse JSON object from response
 * @param {string} response - Raw LLM response
 * @param {string} context - Context for logging
 * @returns {Object} Parsed JSON object
 * @throws {Error} If result is not an object
 */
function parseJSONObject(response, context = 'unknown') {
    const parsed = parseJSON(response, context);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(`Expected object but got ${Array.isArray(parsed) ? 'array' : typeof parsed} for ${context}`);
    }

    return parsed;
}

/**
 * Validate parsed JSON against a schema
 * @param {Object} data - Parsed JSON data
 * @param {Object} schema - Schema definition
 * @param {string} context - Context for logging
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
function validateJSON(data, schema, context = 'unknown') {
    const errors = [];

    for (const [key, type] of Object.entries(schema)) {
        if (!(key in data)) {
            errors.push(`Missing required field: ${key}`);
            continue;
        }

        const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];

        if (type === 'array' && !Array.isArray(data[key])) {
            errors.push(`Field ${key} should be array but got ${actualType}`);
        } else if (type !== 'array' && actualType !== type) {
            errors.push(`Field ${key} should be ${type} but got ${actualType}`);
        }
    }

    if (errors.length > 0) {
        logger.error('JSON validation failed', {
            context,
            errors
        });
        throw new Error(`JSON validation failed for ${context}: ${errors.join(', ')}`);
    }

    return true;
}

module.exports = {
    parseJSON,
    safeParseJSON,
    parseJSONArray,
    parseJSONObject,
    validateJSON
};
