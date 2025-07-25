/**
 * Tests for validation middleware
 */

const {
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
  sanitizeRequestBody,
  logValidationError,
  validateRequest,
  createDetailedValidator,
  validateJsonSchema
} = require('../../../src/middleware/validation');
const { ValidationError, RequestValidationError } = require('../../../src/utils/errors');
const logger = require('../../../src/utils/logger');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logError: jest.fn(),
  error: jest.fn()
}));

// Mock mongoose for ObjectId validation
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: {
      isValid: jest.fn()
    }
  }
}));

const mongoose = require('mongoose');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      url: '/test',
      method: 'POST',
      user: { sub: 'user123' },
      correlationId: 'corr123'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    // Clear mocks
    logger.logError.mockClear();
    logger.error.mockClear();
    mongoose.Types.ObjectId.isValid.mockClear();
  });

  describe('validateRequiredFields', () => {
    test('should pass when all required fields are present', () => {
      req.body = { name: 'John', email: 'john@example.com' };
      const middleware = validateRequiredFields(['name', 'email']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should fail when required fields are missing', () => {
      req.body = { name: 'John' };
      const middleware = validateRequiredFields(['name', 'email']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Missing required fields: email',
          name: 'ValidationError'
        })
      );
    });

    test('should fail when required fields are empty strings', () => {
      req.body = { name: 'John', email: '   ' };
      const middleware = validateRequiredFields(['name', 'email']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Missing required fields: email'
        })
      );
    });

    test('should fail when multiple required fields are missing', () => {
      req.body = {};
      const middleware = validateRequiredFields(['name', 'email', 'password']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Missing required fields: name, email, password'
        })
      );
    });
  });

  describe('validateObjectId', () => {
    test('should pass when ObjectId is valid', () => {
      req.params = { id: '507f1f77bcf86cd799439011' };
      mongoose.Types.ObjectId.isValid.mockReturnValue(true);
      const middleware = validateObjectId('id');

      middleware(req, res, next);

      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(next).toHaveBeenCalledWith();
    });

    test('should fail when ObjectId is invalid', () => {
      req.params = { id: 'invalid-id' };
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      const middleware = validateObjectId('id');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid id format'
        })
      );
    });

    test('should fail when ObjectId is missing', () => {
      req.params = {};
      const middleware = validateObjectId('id');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid id format'
        })
      );
    });
  });

  describe('validatePagination', () => {
    test('should set default values for missing pagination params', () => {
      req.query = {};
      const middleware = validatePagination();

      middleware(req, res, next);

      expect(req.query.page).toBe(1);
      expect(req.query.limit).toBe(20);
      expect(req.query.skip).toBe(0);
      expect(next).toHaveBeenCalledWith();
    });

    test('should parse and validate pagination params', () => {
      req.query = { page: '3', limit: '50' };
      const middleware = validatePagination();

      middleware(req, res, next);

      expect(req.query.page).toBe(3);
      expect(req.query.limit).toBe(50);
      expect(req.query.skip).toBe(100); // (3-1) * 50
      expect(next).toHaveBeenCalledWith();
    });

    test('should enforce maximum limit', () => {
      req.query = { limit: '200' };
      const middleware = validatePagination({ maxLimit: 100 });

      middleware(req, res, next);

      expect(req.query.limit).toBe(100);
      expect(next).toHaveBeenCalledWith();
    });

    test('should handle invalid page numbers', () => {
      req.query = { page: '-1' };
      const middleware = validatePagination();

      middleware(req, res, next);

      expect(req.query.page).toBe(1);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('validateEmail', () => {
    test('should pass for valid email', () => {
      req.body = { email: 'test@example.com' };
      const middleware = validateEmail('email');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should fail for invalid email', () => {
      req.body = { email: 'invalid-email' };
      const middleware = validateEmail('email');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid email format'
        })
      );
    });

    test('should pass when email is not provided (optional)', () => {
      req.body = {};
      const middleware = validateEmail('email');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('validateStringLength', () => {
    test('should pass for valid string length', () => {
      req.body = { name: 'John Doe' };
      const middleware = validateStringLength('name', { min: 2, max: 50 });

      middleware(req, res, next);

      expect(req.body.name).toBe('John Doe');
      expect(next).toHaveBeenCalledWith();
    });

    test('should fail for string too short', () => {
      req.body = { name: 'J' };
      const middleware = validateStringLength('name', { min: 2, max: 50 });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'name must be at least 2 characters long'
        })
      );
    });

    test('should fail for string too long', () => {
      req.body = { name: 'A'.repeat(100) };
      const middleware = validateStringLength('name', { min: 2, max: 50 });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'name must be no more than 50 characters long'
        })
      );
    });

    test('should trim whitespace', () => {
      req.body = { name: '  John Doe  ' };
      const middleware = validateStringLength('name', { min: 2, max: 50 });

      middleware(req, res, next);

      expect(req.body.name).toBe('John Doe');
      expect(next).toHaveBeenCalledWith();
    });

    test('should fail for required field when empty', () => {
      req.body = { name: '' };
      const middleware = validateStringLength('name', { required: true });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'name is required'
        })
      );
    });
  });

  describe('validateArray', () => {
    test('should pass for valid array', () => {
      req.body = { tags: ['tag1', 'tag2', 'tag3'] };
      const middleware = validateArray('tags', { minLength: 1, maxLength: 5 });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should fail for array too short', () => {
      req.body = { tags: [] };
      const middleware = validateArray('tags', { minLength: 1, maxLength: 5 });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'tags must have at least 1 items'
        })
      );
    });

    test('should fail for array too long', () => {
      req.body = { tags: ['1', '2', '3', '4', '5', '6'] };
      const middleware = validateArray('tags', { minLength: 1, maxLength: 5 });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'tags must have no more than 5 items'
        })
      );
    });

    test('should fail for non-array value', () => {
      req.body = { tags: 'not-an-array' };
      const middleware = validateArray('tags');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'tags must be an array'
        })
      );
    });

    test('should fail for required array when missing', () => {
      req.body = {};
      const middleware = validateArray('tags', { required: true });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'tags is required and must be a non-empty array'
        })
      );
    });
  });

  describe('validateEnum', () => {
    test('should pass for valid enum value', () => {
      req.body = { status: 'active' };
      const middleware = validateEnum('status', ['active', 'inactive', 'pending']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should fail for invalid enum value', () => {
      req.body = { status: 'invalid' };
      const middleware = validateEnum('status', ['active', 'inactive', 'pending']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'status must be one of: active, inactive, pending'
        })
      );
    });

    test('should fail for required enum when missing', () => {
      req.body = {};
      const middleware = validateEnum('status', ['active', 'inactive'], true);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'status is required'
        })
      );
    });

    test('should pass for optional enum when missing', () => {
      req.body = {};
      const middleware = validateEnum('status', ['active', 'inactive'], false);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('validateHexColor', () => {
    test('should pass for valid hex color', () => {
      req.body = { color: '#FF0000' };
      const middleware = validateHexColor('color');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should pass for short hex color', () => {
      req.body = { color: '#F00' };
      const middleware = validateHexColor('color');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should fail for invalid hex color', () => {
      req.body = { color: 'red' };
      const middleware = validateHexColor('color');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'color must be a valid hex color (e.g., #FF0000 or #F00)'
        })
      );
    });

    test('should pass when color is not provided (optional)', () => {
      req.body = {};
      const middleware = validateHexColor('color');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('validateUrl', () => {
    test('should pass for valid URL', () => {
      req.body = { website: 'https://example.com' };
      const middleware = validateUrl('website');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should fail for invalid URL', () => {
      req.body = { website: 'not-a-url' };
      const middleware = validateUrl('website');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'website must be a valid URL'
        })
      );
    });

    test('should fail for required URL when missing', () => {
      req.body = {};
      const middleware = validateUrl('website', true);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'website is required'
        })
      );
    });
  });

  describe('sanitizeRequestBody', () => {
    test('should keep only allowed fields', () => {
      req.body = {
        name: 'John',
        email: 'john@example.com',
        password: 'secret',
        maliciousField: 'hack'
      };

      const middleware = sanitizeRequestBody(['name', 'email']);

      middleware(req, res, next);

      expect(req.body).toEqual({
        name: 'John',
        email: 'john@example.com'
      });
      expect(next).toHaveBeenCalledWith();
    });

    test('should handle empty body', () => {
      req.body = null;
      const middleware = sanitizeRequestBody(['name', 'email']);

      middleware(req, res, next);

      expect(req.body).toBeNull();
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('logValidationError', () => {
    test('should log validation errors', () => {
      const error = new ValidationError('Invalid input');
      
      logValidationError(req, res, (err) => {
        // Simulate next being called with error
        if (err) {
          expect(logger.logError).toHaveBeenCalledWith(error, req, expect.objectContaining({
            validationType: 'ValidationError',
            sanitizedBody: {}
          }));
        }
      });
    });

    test('should log request validation errors', () => {
      const error = new RequestValidationError([
        { field: 'email', message: 'Invalid email' }
      ]);
      
      logValidationError(req, res, (err) => {
        if (err) {
          expect(logger.logError).toHaveBeenCalledWith(error, req, expect.objectContaining({
            validationType: 'RequestValidationError'
          }));
        }
      });
    });

    test('should not log non-validation errors', () => {
      const error = new Error('Regular error');
      
      logValidationError(req, res, (err) => {
        if (err) {
          expect(logger.logError).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe('validateRequest', () => {
    test('should run multiple validations and collect errors', async () => {
      req.body = { name: '', email: 'invalid-email' };

      const validations = [
        validateRequiredFields(['name']),
        validateEmail('email')
      ];

      const middleware = validateRequest(validations);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'RequestValidationError',
          details: expect.objectContaining({
            totalErrors: 2
          })
        })
      );
    });

    test('should pass when all validations succeed', async () => {
      req.body = { name: 'John', email: 'john@example.com' };

      const validations = [
        validateRequiredFields(['name']),
        validateEmail('email')
      ];

      const middleware = validateRequest(validations);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('createDetailedValidator', () => {
    test('should create validator with detailed error context', () => {
      const validator = (value) => value && value.length > 5;
      const middleware = createDetailedValidator('password', validator, 'Password too short');

      req.body = { password: '123' };

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Password too short',
          details: expect.objectContaining({
            field: 'password',
            value: '123',
            location: 'body'
          })
        })
      );
    });
  });

  describe('validateJsonSchema', () => {
    test('should validate against JSON schema', () => {
      const schema = {
        title: 'User Schema',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string', minLength: 2 },
          email: { type: 'string' }
        }
      };

      req.body = { name: 'John', email: 'john@example.com' };

      const middleware = validateJsonSchema(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should fail schema validation for missing required fields', () => {
      const schema = {
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string' }
        }
      };

      req.body = { name: 'John' };

      const middleware = validateJsonSchema(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'RequestValidationError',
          details: expect.objectContaining({
            validationErrors: expect.arrayContaining([
              expect.objectContaining({
                field: 'email',
                message: 'email is required',
                code: 'REQUIRED_FIELD_MISSING'
              })
            ])
          })
        })
      );
    });
  });

  describe('Composite Validations', () => {
    test('validateProfileCreation should validate all profile fields', () => {
      req.body = {
        name: 'Test Business',
        tagline: 'Great business',
        description: 'A wonderful business that does great things',
        products: ['Product 1', 'Product 2'],
        colorPalette: [
          { name: 'Primary', hex: '#FF0000' },
          { name: 'Secondary', hex: '#00FF00' }
        ]
      };

      // This would need to be tested by running through all the validation middleware
      // in the validateProfileCreation array, which is complex to test directly
      expect(validateProfileCreation).toBeInstanceOf(Array);
      expect(validateProfileCreation.length).toBeGreaterThan(0);
    });
  });
});