/**
 * Centralized error classes for the Jomobit Backend API
 * This file contains all custom error classes used throughout the application
 */

/**
 * Base application error class
 * All custom errors should extend this class
 */
class AppError extends Error {
  constructor(message, statusCode, code = null, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      status: this.status,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Authentication and Authorization Errors
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', details = {}) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', details = {}) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

class TokenExpiredError extends AppError {
  constructor(message = 'Token has expired', details = {}) {
    super(message, 401, 'TOKEN_EXPIRED', details);
  }
}

class InvalidTokenError extends AppError {
  constructor(message = 'Invalid token provided', details = {}) {
    super(message, 401, 'INVALID_TOKEN', details);
  }
}

/**
 * Validation Errors
 */
class ValidationError extends AppError {
  constructor(message, field = null, value = null, details = {}) {
    super(message, 400, 'VALIDATION_ERROR', {
      field,
      value,
      ...details
    });
  }
}

class RequestValidationError extends AppError {
  constructor(errors, details = {}) {
    const message = Array.isArray(errors) 
      ? errors.map(err => err.message || err).join(', ')
      : errors;
    
    super(message, 400, 'REQUEST_VALIDATION_ERROR', {
      validationErrors: errors,
      ...details
    });
  }
}

/**
 * Resource Errors
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource', identifier = null, details = {}) {
    const message = identifier 
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;
    
    super(message, 404, 'NOT_FOUND', {
      resource,
      identifier,
      ...details
    });
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = {}) {
    super(message, 409, 'CONFLICT', details);
  }
}

class DuplicateResourceError extends AppError {
  constructor(resource, field, value, details = {}) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      409,
      'DUPLICATE_RESOURCE',
      { resource, field, value, ...details }
    );
  }
}

/**
 * Credit System Errors
 */
class CreditInsufficientError extends AppError {
  constructor(required, available, details = {}) {
    super(
      `Insufficient credits: required ${required}, available ${available}`,
      402,
      'INSUFFICIENT_CREDITS',
      { required, available, ...details }
    );
  }
}

class CreditOperationError extends AppError {
  constructor(message, operation, userId = null, details = {}) {
    super(message, 400, 'CREDIT_OPERATION_ERROR', {
      operation,
      userId,
      ...details
    });
  }
}

/**
 * Profile System Errors
 */
class ProfileNotFoundError extends NotFoundError {
  constructor(profileId, details = {}) {
    super('Business profile', profileId, details);
    this.code = 'PROFILE_NOT_FOUND';
  }
}

class PlanLimitExceededError extends AppError {
  constructor(currentCount, limit, planName, resource = 'profiles', details = {}) {
    super(
      `Plan limit exceeded: ${currentCount}/${limit} ${resource} for ${planName} plan`,
      403,
      'PLAN_LIMIT_EXCEEDED',
      { currentCount, limit, planName, resource, ...details }
    );
  }
}

class ProfileOperationError extends AppError {
  constructor(message, operation, userId = null, profileId = null, details = {}) {
    super(message, 400, 'PROFILE_OPERATION_ERROR', {
      operation,
      userId,
      profileId,
      ...details
    });
  }
}

class ProfileValidationError extends ValidationError {
  constructor(message, field = null, value = null, details = {}) {
    super(message, field, value, details);
    this.code = 'PROFILE_VALIDATION_ERROR';
  }
}

/**
 * User System Errors
 */
class UserNotFoundError extends NotFoundError {
  constructor(identifier, details = {}) {
    super('User', identifier, details);
    this.code = 'USER_NOT_FOUND';
  }
}

class UserAlreadyExistsError extends ConflictError {
  constructor(identifier, details = {}) {
    super(`User already exists: ${identifier}`, {
      identifier,
      ...details
    });
    this.code = 'USER_ALREADY_EXISTS';
  }
}

class UserOperationError extends AppError {
  constructor(message, operation, userId = null, details = {}) {
    super(message, 400, 'USER_OPERATION_ERROR', {
      operation,
      userId,
      ...details
    });
  }
}

/**
 * Template System Errors
 */
class TemplateNotFoundError extends NotFoundError {
  constructor(identifier, details = {}) {
    super('Template', identifier, details);
    this.code = 'TEMPLATE_NOT_FOUND';
  }
}

class TemplateOperationError extends AppError {
  constructor(message, operation, templateId = null, details = {}) {
    super(message, 400, 'TEMPLATE_OPERATION_ERROR', {
      operation,
      templateId,
      ...details
    });
  }
}

class TemplateValidationError extends ValidationError {
  constructor(message, field = null, details = {}) {
    super(message, field, null, details);
    this.code = 'TEMPLATE_VALIDATION_ERROR';
  }
}

/**
 * Generation System Errors
 */
class GenerationError extends AppError {
  constructor(message, code = 'GENERATION_ERROR', details = {}) {
    super(message, 400, code, details);
  }
}

class GenerationValidationError extends ValidationError {
  constructor(message, field, value, details = {}) {
    super(message, field, value, details);
    this.code = 'GENERATION_VALIDATION_ERROR';
  }
}

class AIProviderError extends AppError {
  constructor(message, provider, operation, details = {}) {
    super(message, 502, 'AI_PROVIDER_ERROR', {
      provider,
      operation,
      ...details
    });
  }
}

class GenerationTimeoutError extends AppError {
  constructor(jobId, timeout, details = {}) {
    super(
      `Generation job ${jobId} timed out after ${timeout}ms`,
      408,
      'GENERATION_TIMEOUT',
      { jobId, timeout, ...details }
    );
  }
}

/**
 * Subscription and Payment Errors
 */
class SubscriptionError extends AppError {
  constructor(message, code = 'SUBSCRIPTION_ERROR', details = {}) {
    super(message, 400, code, details);
  }
}

class PaymentError extends AppError {
  constructor(message, code = 'PAYMENT_ERROR', razorpayData = {}, details = {}) {
    super(message, 402, code, {
      razorpayData,
      ...details
    });
  }
}

class PaymentRequiredError extends AppError {
  constructor(message = 'Payment required to access this resource', details = {}) {
    super(message, 402, 'PAYMENT_REQUIRED', details);
  }
}

/**
 * External Service Errors
 */
class ExternalServiceError extends AppError {
  constructor(service, message, statusCode = 502, details = {}) {
    super(
      `External service error (${service}): ${message}`,
      statusCode,
      'EXTERNAL_SERVICE_ERROR',
      { service, ...details }
    );
  }
}

class WebhookValidationError extends AppError {
  constructor(message, source, details = {}) {
    super(message, 400, 'WEBHOOK_VALIDATION_ERROR', {
      source,
      ...details
    });
  }
}

/**
 * Rate Limiting Errors
 */
class RateLimitError extends AppError {
  constructor(limit, windowMs, details = {}) {
    super(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      429,
      'RATE_LIMIT_EXCEEDED',
      { limit, windowMs, ...details }
    );
  }
}

/**
 * Database Errors
 */
class DatabaseError extends AppError {
  constructor(message, operation, details = {}) {
    super(message, 500, 'DATABASE_ERROR', {
      operation,
      ...details
    });
  }
}

class DatabaseConnectionError extends DatabaseError {
  constructor(message = 'Database connection failed', details = {}) {
    super(message, 'connection', details);
    this.code = 'DATABASE_CONNECTION_ERROR';
  }
}

/**
 * Server Errors
 */
class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details = {}) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service, message = 'Service temporarily unavailable', details = {}) {
    super(message, 503, 'SERVICE_UNAVAILABLE', {
      service,
      ...details
    });
  }
}

/**
 * Utility function to check if an error is operational
 */
function isOperationalError(error) {
  return error instanceof AppError && error.isOperational;
}

/**
 * Utility function to create error response object
 */
function createErrorResponse(error, includeStack = false) {
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.code,
      status: error.status
    }
  };

  if (error.details && Object.keys(error.details).length > 0) {
    response.error.details = error.details;
  }

  if (error.timestamp) {
    response.error.timestamp = error.timestamp;
  }

  if (includeStack && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
}

module.exports = {
  // Base errors
  AppError,
  
  // Authentication & Authorization
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  InvalidTokenError,
  
  // Validation
  ValidationError,
  RequestValidationError,
  
  // Resources
  NotFoundError,
  ConflictError,
  DuplicateResourceError,
  
  // Credit System
  CreditInsufficientError,
  CreditOperationError,
  
  // Profile System
  ProfileNotFoundError,
  PlanLimitExceededError,
  ProfileOperationError,
  ProfileValidationError,
  
  // User System
  UserNotFoundError,
  UserAlreadyExistsError,
  UserOperationError,
  
  // Template System
  TemplateNotFoundError,
  TemplateOperationError,
  TemplateValidationError,
  
  // Generation System
  GenerationError,
  GenerationValidationError,
  AIProviderError,
  GenerationTimeoutError,
  
  // Subscription & Payment
  SubscriptionError,
  PaymentError,
  PaymentRequiredError,
  
  // External Services
  ExternalServiceError,
  WebhookValidationError,
  
  // Rate Limiting
  RateLimitError,
  
  // Database
  DatabaseError,
  DatabaseConnectionError,
  
  // Server
  InternalServerError,
  ServiceUnavailableError,
  
  // Utilities
  isOperationalError,
  createErrorResponse
};