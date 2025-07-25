/**
 * Tests for centralized error classes
 */

const {
  AppError,
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  InvalidTokenError,
  ValidationError,
  RequestValidationError,
  NotFoundError,
  ConflictError,
  DuplicateResourceError,
  CreditInsufficientError,
  CreditOperationError,
  ProfileNotFoundError,
  PlanLimitExceededError,
  ProfileOperationError,
  ProfileValidationError,
  UserNotFoundError,
  UserAlreadyExistsError,
  UserOperationError,
  TemplateNotFoundError,
  TemplateOperationError,
  TemplateValidationError,
  GenerationError,
  GenerationValidationError,
  AIProviderError,
  GenerationTimeoutError,
  SubscriptionError,
  PaymentError,
  PaymentRequiredError,
  ExternalServiceError,
  WebhookValidationError,
  RateLimitError,
  DatabaseError,
  DatabaseConnectionError,
  InternalServerError,
  ServiceUnavailableError,
  isOperationalError,
  createErrorResponse
} = require('../../../src/utils/errors');

describe('Error Classes', () => {
  describe('AppError (Base Error)', () => {
    test('should create error with all properties', () => {
      const error = new AppError('Test message', 400, 'TEST_CODE', { key: 'value' });
      
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(400);
      expect(error.status).toBe('fail');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ key: 'value' });
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeDefined();
      expect(error.name).toBe('AppError');
    });

    test('should set status to "error" for 5xx codes', () => {
      const error = new AppError('Server error', 500);
      expect(error.status).toBe('error');
    });

    test('should set status to "fail" for 4xx codes', () => {
      const error = new AppError('Client error', 400);
      expect(error.status).toBe('fail');
    });

    test('should serialize to JSON correctly', () => {
      const error = new AppError('Test message', 400, 'TEST_CODE', { key: 'value' });
      const json = error.toJSON();
      
      expect(json).toEqual({
        name: 'AppError',
        message: 'Test message',
        statusCode: 400,
        status: 'fail',
        code: 'TEST_CODE',
        details: { key: 'value' },
        timestamp: error.timestamp
      });
    });
  });

  describe('Authentication Errors', () => {
    test('AuthenticationError should have correct defaults', () => {
      const error = new AuthenticationError();
      
      expect(error.message).toBe('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('AuthorizationError should have correct defaults', () => {
      const error = new AuthorizationError();
      
      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });

    test('TokenExpiredError should have correct defaults', () => {
      const error = new TokenExpiredError();
      
      expect(error.message).toBe('Token has expired');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('TOKEN_EXPIRED');
    });

    test('InvalidTokenError should have correct defaults', () => {
      const error = new InvalidTokenError();
      
      expect(error.message).toBe('Invalid token provided');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Validation Errors', () => {
    test('ValidationError should include field and value', () => {
      const error = new ValidationError('Invalid email', 'email', 'invalid-email');
      
      expect(error.message).toBe('Invalid email');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details.field).toBe('email');
      expect(error.details.value).toBe('invalid-email');
    });

    test('RequestValidationError should handle array of errors', () => {
      const errors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Password too short' }
      ];
      
      const error = new RequestValidationError(errors);
      
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('REQUEST_VALIDATION_ERROR');
      expect(error.details.validationErrors).toEqual(errors);
    });

    test('RequestValidationError should handle string error', () => {
      const error = new RequestValidationError('Validation failed');
      
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('Resource Errors', () => {
    test('NotFoundError should format message correctly', () => {
      const error = new NotFoundError('User', 'user123');
      
      expect(error.message).toBe('User not found: user123');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.details.resource).toBe('User');
      expect(error.details.identifier).toBe('user123');
    });

    test('NotFoundError should work without identifier', () => {
      const error = new NotFoundError('User');
      
      expect(error.message).toBe('User not found');
    });

    test('DuplicateResourceError should format message correctly', () => {
      const error = new DuplicateResourceError('User', 'email', 'test@example.com');
      
      expect(error.message).toBe("User with email 'test@example.com' already exists");
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('DUPLICATE_RESOURCE');
    });
  });

  describe('Credit System Errors', () => {
    test('CreditInsufficientError should include required and available amounts', () => {
      const error = new CreditInsufficientError(10, 5);
      
      expect(error.message).toBe('Insufficient credits: required 10, available 5');
      expect(error.statusCode).toBe(402);
      expect(error.code).toBe('INSUFFICIENT_CREDITS');
      expect(error.details.required).toBe(10);
      expect(error.details.available).toBe(5);
    });

    test('CreditOperationError should include operation and userId', () => {
      const error = new CreditOperationError('Credit operation failed', 'reserveCredits', 'user123');
      
      expect(error.message).toBe('Credit operation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CREDIT_OPERATION_ERROR');
      expect(error.details.operation).toBe('reserveCredits');
      expect(error.details.userId).toBe('user123');
    });
  });

  describe('Profile System Errors', () => {
    test('ProfileNotFoundError should extend NotFoundError', () => {
      const error = new ProfileNotFoundError('profile123');
      
      expect(error.message).toBe('Business profile not found: profile123');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('PROFILE_NOT_FOUND');
    });

    test('PlanLimitExceededError should include limit details', () => {
      const error = new PlanLimitExceededError(3, 3, 'Free', 'profiles');
      
      expect(error.message).toBe('Plan limit exceeded: 3/3 profiles for Free plan');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('PLAN_LIMIT_EXCEEDED');
      expect(error.details.currentCount).toBe(3);
      expect(error.details.limit).toBe(3);
      expect(error.details.planName).toBe('Free');
    });
  });

  describe('Generation System Errors', () => {
    test('AIProviderError should include provider and operation', () => {
      const error = new AIProviderError('API rate limit exceeded', 'openai', 'generateImage');
      
      expect(error.message).toBe('API rate limit exceeded');
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('AI_PROVIDER_ERROR');
      expect(error.details.provider).toBe('openai');
      expect(error.details.operation).toBe('generateImage');
    });

    test('GenerationTimeoutError should include timeout details', () => {
      const error = new GenerationTimeoutError('job123', 30000);
      
      expect(error.message).toBe('Generation job job123 timed out after 30000ms');
      expect(error.statusCode).toBe(408);
      expect(error.code).toBe('GENERATION_TIMEOUT');
      expect(error.details.jobId).toBe('job123');
      expect(error.details.timeout).toBe(30000);
    });
  });

  describe('Payment System Errors', () => {
    test('PaymentError should include Razorpay data', () => {
      const razorpayData = { payment_id: 'pay_123', status: 'failed' };
      const error = new PaymentError('Payment failed', 'PAYMENT_FAILED', razorpayData);
      
      expect(error.message).toBe('Payment failed');
      expect(error.statusCode).toBe(402);
      expect(error.code).toBe('PAYMENT_FAILED');
      expect(error.details.razorpayData).toEqual(razorpayData);
    });

    test('PaymentRequiredError should have correct defaults', () => {
      const error = new PaymentRequiredError();
      
      expect(error.message).toBe('Payment required to access this resource');
      expect(error.statusCode).toBe(402);
      expect(error.code).toBe('PAYMENT_REQUIRED');
    });
  });

  describe('External Service Errors', () => {
    test('ExternalServiceError should include service name', () => {
      const error = new ExternalServiceError('Auth0', 'User creation failed');
      
      expect(error.message).toBe('External service error (Auth0): User creation failed');
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.details.service).toBe('Auth0');
    });

    test('WebhookValidationError should include source', () => {
      const error = new WebhookValidationError('Invalid signature', 'razorpay');
      
      expect(error.message).toBe('Invalid signature');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('WEBHOOK_VALIDATION_ERROR');
      expect(error.details.source).toBe('razorpay');
    });
  });

  describe('Rate Limiting Errors', () => {
    test('RateLimitError should include limit details', () => {
      const error = new RateLimitError(100, 60000);
      
      expect(error.message).toBe('Rate limit exceeded: 100 requests per 60000ms');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.details.limit).toBe(100);
      expect(error.details.windowMs).toBe(60000);
    });
  });

  describe('Database Errors', () => {
    test('DatabaseError should include operation', () => {
      const error = new DatabaseError('Connection failed', 'connect');
      
      expect(error.message).toBe('Connection failed');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.details.operation).toBe('connect');
    });

    test('DatabaseConnectionError should extend DatabaseError', () => {
      const error = new DatabaseConnectionError();
      
      expect(error.message).toBe('Database connection failed');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_CONNECTION_ERROR');
    });
  });

  describe('Server Errors', () => {
    test('InternalServerError should have correct defaults', () => {
      const error = new InternalServerError();
      
      expect(error.message).toBe('Internal server error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    test('ServiceUnavailableError should include service', () => {
      const error = new ServiceUnavailableError('Redis', 'Cache service down');
      
      expect(error.message).toBe('Cache service down');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.details.service).toBe('Redis');
    });
  });

  describe('Utility Functions', () => {
    test('isOperationalError should return true for AppError instances', () => {
      const error = new AppError('Test error', 400);
      expect(isOperationalError(error)).toBe(true);
    });

    test('isOperationalError should return false for regular Error instances', () => {
      const error = new Error('Regular error');
      expect(isOperationalError(error)).toBe(false);
    });

    test('createErrorResponse should format error correctly', () => {
      const error = new ValidationError('Invalid input', 'email', 'invalid');
      const response = createErrorResponse(error);
      
      expect(response).toEqual({
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
        }
      });
    });

    test('createErrorResponse should include stack in development', () => {
      const error = new AppError('Test error', 500);
      const response = createErrorResponse(error, true);
      
      expect(response.error.stack).toBeDefined();
    });

    test('createErrorResponse should exclude empty details', () => {
      const error = new AppError('Test error', 500, 'TEST_CODE', {});
      const response = createErrorResponse(error);
      
      expect(response.error.details).toBeUndefined();
    });
  });
});