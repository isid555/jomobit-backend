const { ValidationError, RequestValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const { body, param, query, validationResult } = require('express-validator');
const Joi = require('joi');

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
 * Enhanced validation error logging with detailed context
 */
const logValidationError = (req, res, next) => {
  const originalNext = next;
  next = (error) => {
    if (error instanceof ValidationError || error instanceof RequestValidationError) {
      logger.logError(error, req, {
        validationType: error.constructor.name,
        validationDetails: error.details || {},
        sanitizedBody: sanitizeBodyForLogging(req.body)
      });
    }
    originalNext(error);
  };
  next();
};

/**
 * Comprehensive validation middleware that combines multiple validations
 * @param {Function[]} validations - Array of validation middleware functions
 * @returns {Function} Express middleware
 */
const validateRequest = (validations) => {
  return async (req, res, next) => {
    const errors = [];
    
    try {
      // Run all validations and collect errors
      for (const validation of validations) {
        try {
          await new Promise((resolve, reject) => {
            validation(req, res, (error) => {
              if (error) reject(error);
              else resolve();
            });
          });
        } catch (error) {
          if (error instanceof ValidationError) {
            errors.push({
              field: error.details?.field || 'unknown',
              message: error.message,
              code: error.code,
              value: error.details?.value
            });
          } else {
            errors.push({
              field: 'unknown',
              message: error.message,
              code: 'VALIDATION_ERROR'
            });
          }
        }
      }

      if (errors.length > 0) {
        const requestValidationError = new RequestValidationError(errors, {
          url: req.url,
          method: req.method,
          totalErrors: errors.length
        });
        
        return next(requestValidationError);
      }

      next();
    } catch (error) {
      logger.error('Validation middleware error', {
        error: error.message,
        stack: error.stack,
        correlationId: req.correlationId
      });
      
      return next(new ValidationError('Validation processing failed'));
    }
  };
};

/**
 * Enhanced validation with detailed error context
 * @param {string} fieldName - Field name to validate
 * @param {Function} validator - Validation function
 * @param {string} errorMessage - Custom error message
 * @returns {Function} Express middleware
 */
const createDetailedValidator = (fieldName, validator, errorMessage) => {
  return (req, res, next) => {
    try {
      const value = req.body[fieldName] || req.params[fieldName] || req.query[fieldName];
      
      if (!validator(value)) {
        throw new ValidationError(errorMessage, fieldName, value, {
          validator: validator.name,
          location: req.body[fieldName] ? 'body' : req.params[fieldName] ? 'params' : 'query'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate JSON schema
 * @param {Object} schema - JSON schema object
 * @returns {Function} Express middleware
 */
const validateJsonSchema = (schema) => {
  return (req, res, next) => {
    try {
      // This would require a JSON schema validation library like Ajv
      // For now, we'll implement basic validation
      const errors = validateAgainstSchema(req.body, schema);
      
      if (errors.length > 0) {
        const requestValidationError = new RequestValidationError(errors, {
          schema: schema.title || 'unknown',
          schemaVersion: schema.version || '1.0'
        });
        
        return next(requestValidationError);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Basic schema validation (placeholder for full JSON schema validation)
 */
function validateAgainstSchema(data, schema) {
  const errors = [];
  
  if (schema.required) {
    for (const field of schema.required) {
      if (!data[field]) {
        errors.push({
          field,
          message: `${field} is required`,
          code: 'REQUIRED_FIELD_MISSING',
          value: data[field]
        });
      }
    }
  }

  if (schema.properties) {
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      const value = data[field];
      
      if (value !== undefined) {
        if (fieldSchema.type && typeof value !== fieldSchema.type) {
          errors.push({
            field,
            message: `${field} must be of type ${fieldSchema.type}`,
            code: 'INVALID_TYPE',
            value,
            expectedType: fieldSchema.type,
            actualType: typeof value
          });
        }
        
        if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
          errors.push({
            field,
            message: `${field} must be at least ${fieldSchema.minLength} characters`,
            code: 'MIN_LENGTH_VIOLATION',
            value,
            minLength: fieldSchema.minLength,
            actualLength: value.length
          });
        }
        
        if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
          errors.push({
            field,
            message: `${field} must be no more than ${fieldSchema.maxLength} characters`,
            code: 'MAX_LENGTH_VIOLATION',
            value,
            maxLength: fieldSchema.maxLength,
            actualLength: value.length
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Input sanitization middleware to prevent XSS and NoSQL injection
 */
const sanitizeInput = () => {
  return [
    mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        logger.warn('Potential NoSQL injection attempt detected', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.url,
          method: req.method,
          sanitizedKey: key,
          timestamp: new Date().toISOString()
        });
      }
    }),
    (req, res, next) => {
      // Additional XSS protection for string fields
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObjectStrings(req.body);
      }
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObjectStrings(req.query);
      }
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObjectStrings(req.params);
      }
      next();
    }
  ];
};

/**
 * Recursively sanitize string values in an object
 */
function sanitizeObjectStrings(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '')
              .trim();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObjectStrings);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObjectStrings(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Express-validator based validation schemas
 */
const validationSchemas = {
  profileCreation: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters')
      .matches(/^[a-zA-Z0-9\s\-_&.]+$/)
      .withMessage('Name contains invalid characters'),
    
    body('tagline')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Tagline must be between 1 and 200 characters'),
    
    body('description')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Description must be between 1 and 1000 characters'),
    
    body('logo')
      .optional()
      .isURL()
      .withMessage('Logo must be a valid URL'),
    
    body('products')
      .optional()
      .isArray({ max: 20 })
      .withMessage('Products must be an array with maximum 20 items'),
    
    body('products.*')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Each product must be between 1 and 100 characters'),
    
    body('colorPalette')
      .optional()
      .isArray({ max: 10 })
      .withMessage('Color palette must be an array with maximum 10 items'),
    
    body('colorPalette.*.hex')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage('Invalid hex color format')
  ],

  posterGeneration: [
    body('profileId')
      .isMongoId()
      .withMessage('Invalid profile ID format'),
    
    body('templateId')
      .isMongoId()
      .withMessage('Invalid template ID format'),
    
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high'])
      .withMessage('Priority must be low, normal, or high')
  ],

  subscriptionUpgrade: [
    body('newPlanId')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Plan ID must be between 1 and 50 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Plan ID contains invalid characters')
  ]
};

/**
 * Handle express-validator validation results
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    logger.warn('Validation errors detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      errors: formattedErrors,
      timestamp: new Date().toISOString()
    });

    const requestValidationError = new RequestValidationError(formattedErrors, {
      url: req.url,
      method: req.method,
      totalErrors: formattedErrors.length
    });
    
    return next(requestValidationError);
  }
  
  next();
};

/**
 * Joi schema validation middleware
 */
const validateWithJoi = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const formattedErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
        code: detail.type
      }));

      logger.warn('Joi validation errors detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        errors: formattedErrors,
        timestamp: new Date().toISOString()
      });

      const requestValidationError = new RequestValidationError(formattedErrors, {
        url: req.url,
        method: req.method,
        totalErrors: formattedErrors.length,
        validator: 'joi'
      });
      
      return next(requestValidationError);
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

/**
 * Common Joi schemas
 */
const joiSchemas = {
  profileCreation: Joi.object({
    name: Joi.string().trim().min(1).max(100).pattern(/^[a-zA-Z0-9\s\-_&.]+$/).required(),
    tagline: Joi.string().trim().min(1).max(200).required(),
    description: Joi.string().trim().min(1).max(1000).required(),
    logo: Joi.string().uri().optional(),
    products: Joi.array().items(Joi.string().trim().min(1).max(100)).max(20).optional(),
    colorPalette: Joi.array().items(
      Joi.object({
        name: Joi.string().trim().min(1).max(50).required(),
        hex: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required()
      })
    ).max(10).optional(),
    typography: Joi.object({
      primary: Joi.string().trim().min(1).max(50).optional(),
      secondary: Joi.string().trim().min(1).max(50).optional()
    }).optional(),
    address: Joi.object({
      street: Joi.string().trim().max(200).optional(),
      city: Joi.string().trim().max(100).optional(),
      state: Joi.string().trim().max(100).optional(),
      country: Joi.string().trim().max(100).optional(),
      zipCode: Joi.string().trim().max(20).optional()
    }).optional()
  }),

  posterGeneration: Joi.object({
    profileId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    templateId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    priority: Joi.string().valid('low', 'normal', 'high').optional(),
    customPrompt: Joi.string().trim().max(500).optional()
  }),

  templateCreation: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().trim().max(500).optional(),
    category: Joi.string().trim().min(1).max(50).required(),
    type: Joi.string().valid('social', 'print', 'web', 'story', 'post', 'banner').required(),
    difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
    aspectRatio: Joi.string().pattern(/^\d+:\d+$/).required(),
    tags: Joi.array().items(Joi.string().trim().min(1).max(30)).max(20).optional(),
    images: Joi.array().items(Joi.string().uri()).min(1).max(5).required(),
    metadata: Joi.object().optional()
  })
};

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeBodyForLogging(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'credit_card',
    'ssn',
    'social_security',
    'api_key',
    'access_token',
    'refresh_token'
  ];
  
  const sanitized = { ...body };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

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
  logValidationError,
  validateRequest,
  createDetailedValidator,
  validateJsonSchema,
  sanitizeInput,
  validationSchemas,
  handleValidationErrors,
  validateWithJoi,
  joiSchemas
};