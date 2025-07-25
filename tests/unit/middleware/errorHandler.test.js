/**
 * Tests for error handler middleware
 */

const { errorHandler, notFound } = require('../../../src/middleware/errorHandler');
const {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  InternalServerError
} = require('../../../src/utils/errors');
const logger = require('../../../src/utils/logger');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logError: jest.fn(),
  error: jest.fn()
}));

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/test',
      user: { sub: 'user123' },
      correlationId: 'corr123',
      body: { test: 'data' },
      params: { id: '123' },
      query: { page: '1' }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    // Clear mocks
    logger.logError.mockClear();
    logger.error.mockClear();
  });

  describe('errorHandler', () => {
    test('should handle AppError correctly', () => {
      const error = new ValidationError('Invalid input', 'email', 'invalid');
      
      errorHandler(error, req, res, next);

      expect(logger.logError).toHaveBeenCalledWith(error, req, {
        correlationId: 'corr123',
        sessionId: undefined
      });

      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/json',
        'X-Error-Code': 'VALIDATION_ERROR'
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Invalid input',
          code: 'VALIDATION_ERROR',
          status: 'fail',
          details: {
            field: 'email',
            value: 'invalid'
          },
          timestamp: error.timestamp
        },
        correlationId: 'corr123'
      });
    });

    test('should handle Mongoose CastError', () => {
      const error = {
        name: 'CastError',
        value: 'invalid-id',
        path: 'userId',
        kind: 'ObjectId'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Resource not found: invalid-id',
            code: 'NOT_FOUND'
          })
        })
      );
    });

    test('should handle Mongoose duplicate key error', () => {
      const error = {
        code: 11000,
        keyValue: { email: 'test@example.com' },
        collection: 'users'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: "Resource with email 'test@example.com' already exists",
            code: 'DUPLICATE_RESOURCE'
          })
        })
      );
    });

    test('should handle Mongoose validation error', () => {
      const error = {
        name: 'ValidationError',
        errors: {
          email: {
            path: 'email',
            message: 'Email is required',
            value: '',
            kind: 'required'
          },
          name: {
            path: 'name',
            message: 'Name is too short',
            value: 'a',
            kind: 'minlength'
          }
        }
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'REQUEST_VALIDATION_ERROR',
            details: expect.objectContaining({
              validationErrors: expect.arrayContaining([
                expect.objectContaining({
                  field: 'email',
                  message: 'Email is required'
                }),
                expect.objectContaining({
                  field: 'name',
                  message: 'Name is too short'
                })
              ])
            })
          })
        })
      );
    });

    test('should handle JWT JsonWebTokenError', () => {
      const error = {
        name: 'JsonWebTokenError',
        message: 'invalid signature'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Invalid JWT token',
            code: 'INVALID_TOKEN'
          })
        })
      );
    });

    test('should handle JWT TokenExpiredError', () => {
      const error = {
        name: 'TokenExpiredError',
        expiredAt: new Date('2023-01-01')
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'JWT token has expired',
            code: 'TOKEN_EXPIRED'
          })
        })
      );
    });

    test('should handle Auth0 InsufficientScopeError', () => {
      const error = {
        name: 'InsufficientScopeError',
        expected: ['read:users'],
        actual: ['read:profile']
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Insufficient permissions for this operation',
            code: 'AUTHORIZATION_ERROR'
          })
        })
      );
    });

    test('should handle Auth0 UnauthorizedError', () => {
      const error = {
        name: 'UnauthorizedError',
        code: 'credentials_required',
        inner: { message: 'No authorization token was found' }
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Authentication required',
            code: 'AUTHENTICATION_ERROR'
          })
        })
      );
    });

    test('should handle rate limiting errors', () => {
      const error = {
        name: 'TooManyRequestsError',
        status: 429,
        limit: 100,
        windowMs: 60000,
        retryAfter: 30
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'RATE_LIMIT_EXCEEDED'
          })
        })
      );
    });

    test('should handle database connection errors', () => {
      const error = {
        name: 'MongoNetworkError',
        message: 'Connection failed',
        code: 'ECONNREFUSED'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Database operation failed',
            code: 'DATABASE_ERROR'
          })
        })
      );
    });

    test('should handle non-operational errors', () => {
      const error = new Error('Unexpected error');

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        'Non-operational error encountered',
        expect.objectContaining({
          error: {
            name: 'Error',
            message: 'Unexpected error',
            stack: error.stack
          }
        })
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'An unexpected error occurred',
            code: 'INTERNAL_SERVER_ERROR'
          })
        })
      );
    });

    test('should include stack trace in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new ValidationError('Test error');

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.any(String)
          })
        })
      );

      delete process.env.NODE_ENV;
    });

    test('should remove sensitive information in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new InternalServerError('Internal error', {
        originalError: 'Sensitive info',
        stack: 'Stack trace'
      });

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.error.details.originalError).toBeUndefined();
      expect(response.error.details.stack).toBeUndefined();

      delete process.env.NODE_ENV;
    });

    test('should add correlation ID to response', () => {
      const error = new ValidationError('Test error');

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'corr123'
        })
      );
    });

    test('should set appropriate headers', () => {
      const error = new ValidationError('Test error');

      errorHandler(error, req, res, next);

      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/json',
        'X-Error-Code': 'VALIDATION_ERROR'
      });
    });
  });

  describe('notFound', () => {
    test('should create NotFoundError for unknown routes', () => {
      req.originalUrl = '/unknown/route';

      notFound(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Route not found: /unknown/route',
          statusCode: 404,
          code: 'NOT_FOUND'
        })
      );
    });
  });

  describe('Express-validator errors', () => {
    test('should handle express-validator errors', () => {
      const error = {
        array: jest.fn().mockReturnValue([
          {
            param: 'email',
            msg: 'Invalid email format',
            value: 'invalid-email',
            location: 'body'
          },
          {
            path: 'password',
            msg: 'Password too short',
            value: '123',
            location: 'body'
          }
        ])
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'REQUEST_VALIDATION_ERROR',
            details: expect.objectContaining({
              validationErrors: expect.arrayContaining([
                expect.objectContaining({
                  field: 'email',
                  message: 'Invalid email format',
                  value: 'invalid-email',
                  location: 'body'
                }),
                expect.objectContaining({
                  field: 'password',
                  message: 'Password too short',
                  value: '123',
                  location: 'body'
                })
              ])
            })
          })
        })
      );
    });
  });
});