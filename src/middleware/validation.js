const { ValidationError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Validation middleware for request data
 */

/**
 * Validate required fields in request body
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Function} Express middleware
 */
const validateRequiredFields = (requiredFields) => {
  return (req, res, next) => {
    try {
      const missingFields = [];

      for (const field of requiredFields) {
        if (!req.body[field] || (typeof req.body[field] === 'string' && !req.body[field].trim())) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate MongoDB ObjectId format
 * @param {string} paramName - Parameter name to validate
 * @returns {Function} Express middleware
 */
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    try {
      const mongoose = require('mongoose');
      const id = req.params[paramName];

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError(`Invalid ${paramName} format`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate pagination parameters
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware
 */
const validatePagination = (options = {}) => {
  const { maxLimit = 100, defaultLimit = 20 } = options;

  return (req, res, next) => {
    try {
      // Validate and sanitize page
      let page = parseInt(req.query.page) || 1;
      if (page < 1) page = 1;
      req.query.page = page;

      // Validate and sanitize limit
      let limit = parseInt(req.query.limit) || defaultLimit;
      if (limit < 1) limit = defaultLimit;
      if (limit > maxLimit) limit = maxLimit;
      req.query.limit = limit;

      // Validate and sanitize skip
      const skip = (page - 1) * limit;
      req.query.skip = skip;

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate email format
 * @param {string} fieldName - Field name to validate
 * @returns {Function} Express middleware
 */
const validateEmail = (fieldName = 'email') => {
  return (req, res, next) => {
    try {
      const email = req.body[fieldName];

      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new ValidationError(`Invalid ${fieldName} format`);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate string length
 * @param {string} fieldName - Field name to validate
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware
 */
const validateStringLength = (fieldName, options = {}) => {
  const { min = 0, max = Infinity, required = false } = options;

  return (req, res, next) => {
    try {
      const value = req.body[fieldName];

      if (required && (!value || (typeof value === 'string' && !value.trim()))) {
        throw new ValidationError(`${fieldName} is required`);
      }

      if (value && typeof value === 'string') {
        const trimmedValue = value.trim();

        if (trimmedValue.length < min) {
          throw new ValidationError(`${fieldName} must be at least ${min} characters long`);
        }

        if (trimmedValue.length > max) {
          throw new ValidationError(`${fieldName} must be no more than ${max} characters long`);
        }

        // Update the request body with trimmed value
        req.body[fieldName] = trimmedValue;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate array field
 * @param {string} fieldName - Field name to validate
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware
 */
const validateArray = (fieldName, options = {}) => {
  const { minLength = 0, maxLength = Infinity, required = false } = options;

  return (req, res, next) => {
    try {
      const value = req.body[fieldName];

      if (required && (!value || !Array.isArray(value) || value.length === 0)) {
        throw new ValidationError(`${fieldName} is required and must be a non-empty array`);
      }

      if (value) {
        if (!Array.isArray(value)) {
          throw new ValidationError(`${fieldName} must be an array`);
        }

        if (value.length < minLength) {
          throw new ValidationError(`${fieldName} must have at least ${minLength} items`);
        }

        if (value.length > maxLength) {
          throw new ValidationError(`${fieldName} must have no more than ${maxLength} items`);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate enum values
 * @param {string} fieldName - Field name to validate
 * @param {string[]} allowedValues - Array of allowed values
 * @param {boolean} required - Whether field is required
 * @returns {Function} Express middleware
 */
const validateEnum = (fieldName, allowedValues, required = false) => {
  return (req, res, next) => {
    try {
      const value = req.body[fieldName];

      if (required && !value) {
        throw new ValidationError(`${fieldName} is required`);
      }

      if (value && !allowedValues.includes(value)) {
        throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate color hex format
 * @param {string} fieldName - Field name to validate
 * @returns {Function} Express middleware
 */
const validateHexColor = (fieldName) => {
  return (req, res, next) => {
    try {
      const value = req.body[fieldName];

      if (value) {
        const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (!hexRegex.test(value)) {
          throw new ValidationError(`${fieldName} must be a valid hex color (e.g., #FF0000 or #F00)`);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate URL format
 * @param {string} fieldName - Field name to validate
 * @param {boolean} required - Whether field is required
 * @returns {Function} Express middleware
 */
const validateUrl = (fieldName, required = false) => {
  return (req, res, next) => {
    try {
      const value = req.body[fieldName];

      if (required && !value) {
        throw new ValidationError(`${fieldName} is required`);
      }

      if (value) {
        try {
          new URL(value);
        } catch (urlError) {
          throw new ValidationError(`${fieldName} must be a valid URL`);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate business profile creation data
 */
const validateProfileCreation = [
  validateRequiredFields(['name', 'tagline', 'description']),
  validateStringLength('name', { min: 1, max: 100, required: true }),
  validateStringLength('tagline', { min: 1, max: 200, required: true }),
  validateStringLength('description', { min: 1, max: 1000, required: true }),
  validateUrl('logo', false),
  validateArray('products', { maxLength: 20 }),
  validateArray('colorPalette', { maxLength: 10 })
];

/**
 * Validate business profile update data
 */
const validateProfileUpdate = [
  validateStringLength('tagline', { min: 1, max: 200 }),
  validateArray('products', { maxLength: 20 }),
  validateArray('colorPalette', { maxLength: 10 })
];

/**
 * Validate poster generation request
 */
const validatePosterGeneration = [
  validateRequiredFields(['profileId', 'templateId']),
  validateObjectId('profileId'),
  validateObjectId('templateId'),
  validateEnum('priority', ['low', 'normal', 'high'], false)
];

/**
 * Validate template creation data
 */
const validateTemplateCreation = [
  validateRequiredFields(['name', 'category', 'type', 'images', 'aspectRatio']),
  validateStringLength('name', { min: 1, max: 100, required: true }),
  validateStringLength('description', { max: 500 }),
  validateEnum('type', ['social', 'print', 'web', 'story', 'post', 'banner'], true),
  validateEnum('difficulty', ['beginner', 'intermediate', 'advanced'], false),
  validateArray('tags', { maxLength: 20 })
];

/**
 * Validate subscription upgrade request
 */
const validateSubscriptionUpgrade = [
  validateRequiredFields(['newPlanId']),
  validateStringLength('newPlanId', { min: 1, max: 50, required: true })
];

/**
 * Sanitize request data by removing potentially harmful fields
 * @param {string[]} allowedFields - Array of allowed field names
 * @returns {Function} Express middleware
 */
const sanitizeRequestBody = (allowedFields) => {
  return (req, res, next) => {
    try {
      if (req.body && typeof req.body === 'object') {
        const sanitizedBody = {};

        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            sanitizedBody[field] = req.body[field];
          }
        }

        req.body = sanitizedBody;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Log validation errors for monitoring
 */
const logValidationError = (req, res, next) => {
  const originalNext = next;
  next = (error) => {
    if (error instanceof ValidationError) {
      logger.warn('Validation error', {
        error: error.message,
        url: req.url,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
        userId: req.user?.id
      });
    }
    originalNext(error);
  };
  next();
};

module.exports = {
  validateRequiredFields,
  validateObjectId,
  validatePagination,
  validateEmail,
  validateStringLength,
  validateArray,
  validateEnum,
  validateHexColor,
  validateUrl,
  validateProfileCreation,
  validateProfileUpdate,
  validatePosterGeneration,
  validateTemplateCreation,
  validateSubscriptionUpgrade,
  sanitizeRequestBody,
  logValidationError
};