const logger = require('../utils/logger');
const { 
  AppError,
  ValidationError,
  RequestValidationError,
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  InvalidTokenError,
  NotFoundError,
  ConflictError,
  DuplicateResourceError,
  InternalServerError,
  DatabaseError,
  ExternalServiceError,
  RateLimitError,
  isOperationalError,
  createErrorResponse
} = require('../utils/errors');

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Use structured logging for errors
  logger.logError(err, req, {
    correlationId: req.correlationId,
    sessionId: req.sessionId
  });

  // Transform known error types into our custom error classes
  error = transformError(err);

  // Handle specific error types with detailed responses
  if (error.name === 'CastError') {
    error = new NotFoundError('Resource', error.value, {
      field: error.path,
      kind: error.kind
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    error = new DuplicateResourceError('Resource', field, value, {
      collection: error.collection
    });
  }

  // Mongoose validation error
  if (error.name === 'ValidationError' && error.errors) {
    const validationErrors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message,
      value: err.value,
      kind: err.kind
    }));
    
    error = new RequestValidationError(validationErrors, {
      model: error.constructor.name
    });
  }

  // Express-validator errors
  if (error.array && typeof error.array === 'function') {
    const validationErrors = error.array().map(err => ({
      field: err.param || err.path,
      message: err.msg,
      value: err.value,
      location: err.location
    }));
    
    error = new RequestValidationError(validationErrors);
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    error = new InvalidTokenError('Invalid JWT token', {
      originalError: error.message
    });
  }

  if (error.name === 'TokenExpiredError') {
    error = new TokenExpiredError('JWT token has expired', {
      expiredAt: error.expiredAt
    });
  }

  // Auth0 specific errors
  if (error.name === 'InsufficientScopeError') {
    error = new AuthorizationError('Insufficient permissions for this operation', {
      requiredScopes: error.expected,
      providedScopes: error.actual
    });
  }

  if (error.name === 'UnauthorizedError') {
    error = new AuthenticationError('Authentication required', {
      code: error.code,
      inner: error.inner
    });
  }

  // Rate limiting errors
  if (error.name === 'TooManyRequestsError' || error.status === 429) {
    error = new RateLimitError(error.limit, error.windowMs, {
      retryAfter: error.retryAfter
    });
  }

  // Database connection errors
  if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
    error = new DatabaseError('Database operation failed', 'connection', {
      originalError: error.message,
      code: error.code
    });
  }

  // Ensure we have a proper error object
  if (!isOperationalError(error)) {
    // Log non-operational errors with full stack trace
    logger.error('Non-operational error encountered', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      request: {
        method: req.method,
        url: req.url,
        userId: req.user?.sub
      }
    });

    // Convert to operational error
    error = new InternalServerError('An unexpected error occurred', {
      originalError: error.message,
      errorId: generateErrorId()
    });
  }

  // Create standardized error response
  const errorResponse = createErrorResponse(
    error, 
    process.env.NODE_ENV === 'development'
  );

  // Add request correlation ID if available
  if (req.correlationId) {
    errorResponse.correlationId = req.correlationId;
  }

  // Security: Don't expose sensitive information in production
  if (process.env.NODE_ENV === 'production') {
    // Remove sensitive fields from error details
    if (errorResponse.error.details) {
      delete errorResponse.error.details.originalError;
      delete errorResponse.error.details.stack;
    }
  }

  // Set appropriate headers
  res.set({
    'Content-Type': 'application/json',
    'X-Error-Code': error.code || 'UNKNOWN_ERROR'
  });

  // Send error response
  res.status(error.statusCode || 500).json(errorResponse);
};

// Transform various error types into our custom error classes
function transformError(err) {
  // If it's already our custom error, return as-is
  if (isOperationalError(err)) {
    return err;
  }

  // Handle specific third-party library errors
  switch (err.constructor.name) {
    case 'ValidationError':
      return err; // Let the main handler deal with it
    case 'CastError':
      return err; // Let the main handler deal with it
    case 'MongoError':
      return new DatabaseError(err.message, 'query', {
        code: err.code,
        codeName: err.codeName
      });
    default:
      return err;
  }
}

// Generate unique error ID for tracking
function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 404 handler
const notFound = (req, res, next) => {
  const error = new NotFoundError('Route', req.originalUrl);
  next(error);
};

module.exports = {
  errorHandler,
  notFound,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  InternalServerError
};