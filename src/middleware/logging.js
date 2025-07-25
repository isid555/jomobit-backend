const morgan = require('morgan');
const logger = require('../utils/logger');

// Create a stream object with a 'write' function that will be used by `morgan`
const stream = {
  write: (message) => logger.http(message.trim()),
};

// Skip Morgan logging in test environment unless explicitly enabled
const skip = () => {
  return process.env.NODE_ENV === 'test' && !process.env.ENABLE_HTTP_LOGGING;
};

// Custom Morgan token for correlation ID
morgan.token('correlation-id', (req) => req.correlationId);
morgan.token('user-id', (req) => req.user?.sub || 'anonymous');
morgan.token('real-ip', (req) => req.ip || req.connection.remoteAddress);

// Build the morgan middleware with custom format
const morganMiddleware = morgan(
  ':real-ip :user-id [:correlation-id] :method :url :status :res[content-length] - :response-time ms ":user-agent"',
  { 
    stream, 
    skip,
    // Custom format for structured logging
    immediate: false // Log after response
  }
);

// Correlation ID middleware - adds unique ID to each request
const correlationIdMiddleware = (req, res, next) => {
  // Generate or use existing correlation ID
  req.correlationId = req.get('X-Correlation-ID') || 
                     req.get('X-Request-ID') || 
                     generateCorrelationId();
  
  // Add correlation ID to response headers
  res.set('X-Correlation-ID', req.correlationId);
  
  next();
};

// Enhanced request logging middleware with structured logging
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const startTime = new Date();
  
  // Extract request details
  const requestDetails = {
    correlationId: req.correlationId,
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    query: req.query,
    params: req.params,
    headers: sanitizeHeaders(req.headers),
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.sub,
    sessionId: req.sessionId,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer'),
    origin: req.get('Origin'),
    host: req.get('Host'),
    protocol: req.protocol,
    secure: req.secure,
    xhr: req.xhr
  };

  // Log incoming request
  logger.info('Incoming Request', {
    type: 'request',
    ...requestDetails,
    timestamp: startTime.toISOString()
  });

  // Log request body for non-GET requests (with sanitization)
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    logger.debug('Request Body', {
      correlationId: req.correlationId,
      body: sanitizeRequestBody(req.body),
      contentType: req.get('Content-Type')
    });
  }

  // Override res.end to log response details
  const originalEnd = res.end;
  const originalSend = res.send;
  const originalJson = res.json;
  
  let responseBody = null;
  let responseSize = 0;

  // Capture response body for logging (in development only)
  if (process.env.NODE_ENV === 'development') {
    res.send = function(body) {
      responseBody = body;
      responseSize = Buffer.byteLength(body || '', 'utf8');
      return originalSend.call(this, body);
    };

    res.json = function(obj) {
      responseBody = obj;
      responseSize = Buffer.byteLength(JSON.stringify(obj || {}), 'utf8');
      return originalJson.call(this, obj);
    };
  }

  res.end = function(chunk, encoding) {
    const endTime = new Date();
    const duration = endTime.getTime() - start;
    
    // Calculate response size if not already set
    if (!responseSize && chunk) {
      responseSize = Buffer.byteLength(chunk, encoding || 'utf8');
    }

    // Prepare response details
    const responseDetails = {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      duration: `${duration}ms`,
      durationMs: duration,
      responseSize: responseSize || res.get('Content-Length'),
      contentType: res.get('Content-Type'),
      userId: req.user?.sub,
      headers: sanitizeHeaders(res.getHeaders()),
      timestamp: endTime.toISOString()
    };

    // Determine log level based on status code
    let logLevel = 'info';
    if (res.statusCode >= 400 && res.statusCode < 500) {
      logLevel = 'warn';
    } else if (res.statusCode >= 500) {
      logLevel = 'error';
    }

    // Log response
    logger[logLevel]('Request Completed', {
      type: 'response',
      ...responseDetails
    });

    // Log response body in development for debugging
    if (process.env.NODE_ENV === 'development' && responseBody && res.statusCode >= 400) {
      logger.debug('Response Body', {
        correlationId: req.correlationId,
        statusCode: res.statusCode,
        body: sanitizeResponseBody(responseBody)
      });
    }

    // Log slow requests
    if (duration > (process.env.SLOW_REQUEST_THRESHOLD || 1000)) {
      logger.warn('Slow Request Detected', {
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        userId: req.user?.sub,
        threshold: process.env.SLOW_REQUEST_THRESHOLD || 1000
      });
    }

    // Use the custom logRequest method
    logger.logRequest(req, res, duration);

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Security audit logging middleware
const securityLogger = (req, res, next) => {
  // Log security-relevant events
  const securityEvents = [];

  // Check for suspicious patterns
  if (req.url.includes('../') || req.url.includes('..\\')) {
    securityEvents.push('path_traversal_attempt');
  }

  if (req.get('User-Agent')?.includes('bot') || req.get('User-Agent')?.includes('crawler')) {
    securityEvents.push('bot_access');
  }

  // Log authentication attempts
  if (req.url.includes('/auth/') || req.headers.authorization) {
    securityEvents.push('authentication_attempt');
  }

  // Log admin access attempts
  if (req.url.includes('/admin/')) {
    securityEvents.push('admin_access_attempt');
  }

  // Log security events
  securityEvents.forEach(event => {
    logger.logSecurity(event, {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?.sub
    });
  });

  next();
};

// Performance monitoring middleware
const performanceLogger = (req, res, next) => {
  const start = process.hrtime.bigint();
  
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    
    // Log performance metrics for specific operations
    const operation = getOperationName(req);
    if (operation) {
      logger.logPerformance(operation, duration, {
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        userId: req.user?.sub
      });
    }
  });
  
  next();
};

// Utility functions
function generateCorrelationId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeHeaders(headers) {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token'
  ];
  
  const sanitized = { ...headers };
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

function sanitizeRequestBody(body) {
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
    'social_security'
  ];
  
  const sanitized = { ...body };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

function sanitizeResponseBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  // Only log error responses or specific debug info
  if (body.success === false || body.error) {
    return {
      success: body.success,
      error: body.error ? {
        message: body.error.message,
        code: body.error.code,
        status: body.error.status
      } : undefined
    };
  }
  
  return '[RESPONSE_BODY_OMITTED]';
}

function getOperationName(req) {
  // Map routes to operation names for performance tracking
  const operationMap = {
    'POST /api/posters/generate': 'poster_generation',
    'GET /api/templates': 'template_browse',
    'POST /api/profiles': 'profile_create',
    'PUT /api/profiles': 'profile_update',
    'POST /api/subscriptions': 'subscription_create',
    'GET /api/admin/insights': 'admin_insights'
  };
  
  const key = `${req.method} ${req.route?.path || req.path}`;
  return operationMap[key] || null;
}

module.exports = {
  morganMiddleware,
  requestLogger,
  correlationIdMiddleware,
  securityLogger,
  performanceLogger
};