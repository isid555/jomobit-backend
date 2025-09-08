const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const crypto = require('crypto');
const hpp = require('hpp');
const logger = require('../utils/logger');

/**
 * Enhanced rate limiting with different tiers for different endpoints
 */
const createRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    message = 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator, // Use default IP key generator
    onLimitReached = null
  } = options;

  


  const config = {
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator,
    handler: (req, res, next, options) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        limit: options.max,
        windowMs: options.windowMs,
        timestamp: new Date().toISOString()
      });

      if (onLimitReached) {
        onLimitReached(req, res, next, options);
      }

      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    }
  };

  // Only add keyGenerator if it's defined
  if (keyGenerator) {
    config.keyGenerator = keyGenerator;
  }

  return rateLimit(config);

};

/**
 * Different rate limiting configurations for different endpoint types
 */
const rateLimitConfigs = {
  // General API endpoints
  general: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: 'Too many requests from this IP, please try again later.'
  }),

  // Authentication endpoints (more restrictive)
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true
  }),

  // Poster generation (resource intensive)
  generation: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: 'Too many generation requests, please try again later.'
  }),

  // Admin endpoints (very restrictive)
  admin: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many admin requests, please try again later.'
  }),

  // Webhook endpoints
  webhook: createRateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200,
    message: 'Too many webhook requests, please try again later.'
  }),

  // File upload endpoints
  upload: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: 'Too many upload requests, please try again later.'
  })
};

/**
 * Slow down middleware for progressive delays
 */
const createSlowDown = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    delayAfter = 50,
    delayMs = 500,
    maxDelayMs = 20000,
    skipFailedRequests = false,
    skipSuccessfulRequests = false
  } = options;

  return slowDown({
    windowMs,
    delayAfter,
    delayMs,
    maxDelayMs,
    skipFailedRequests,
    skipSuccessfulRequests,
    onLimitReached: (req, res, options) => {
      logger.warn('Slow down limit reached', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        delayAfter: options.delayAfter,
        currentDelay: options.delay,
        timestamp: new Date().toISOString()
      });
    }
  });
};

/**
 * Webhook signature validation middleware
 */
const validateWebhookSignature = (secretKey, headerName = 'x-signature-256') => {
  return (req, res, next) => {
    try {
      const signature = req.get(headerName);
      
      if (!signature) {
        logger.warn('Missing webhook signature', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.url,
          method: req.method,
          headers: Object.keys(req.headers),
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          error: 'Missing webhook signature',
          code: 'MISSING_SIGNATURE'
        });
      }

      // Get raw body for signature verification
      const rawBody = req.rawBody || JSON.stringify(req.body);
      
      // Calculate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(rawBody, 'utf8')
        .digest('hex');
      
      const expectedSignatureWithPrefix = `sha256=${expectedSignature}`;
      
      // Compare signatures using timing-safe comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignatureWithPrefix)
      );

      if (!isValid) {
        logger.warn('Invalid webhook signature', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.url,
          method: req.method,
          providedSignature: signature.substring(0, 20) + '...',
          timestamp: new Date().toISOString()
        });
        
        return res.status(401).json({
          error: 'Invalid webhook signature',
          code: 'INVALID_SIGNATURE'
        });
      }

      logger.info('Webhook signature validated successfully', {
        ip: req.ip,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
      });

      next();
    } catch (error) {
      logger.error('Webhook signature validation error', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
      });
      
      res.status(500).json({
        error: 'Signature validation failed',
        code: 'SIGNATURE_VALIDATION_ERROR'
      });
    }
  };
};

/**
 * Specific webhook signature validators for different services
 */
const webhookValidators = {
  auth0: validateWebhookSignature(process.env.AUTH0_WEBHOOK_SECRET, 'x-auth0-signature'),
  razorpay: validateWebhookSignature(process.env.RAZORPAY_WEBHOOK_SECRET, 'x-razorpay-signature'),
  openai: validateWebhookSignature(process.env.OPENAI_WEBHOOK_SECRET, 'x-openai-signature'),
  ideogram: validateWebhookSignature(process.env.IDEOGRAM_WEBHOOK_SECRET, 'x-ideogram-signature'),
  slack: validateWebhookSignature(process.env.SLACK_WEBHOOK_SECRET, 'x-slack-signature')
};

/**
 * HTTP Parameter Pollution (HPP) protection
 */
const hppProtection = hpp({
  whitelist: ['tags', 'categories', 'types', 'filters'] // Allow arrays for these parameters
});

/**
 * Request size validation middleware
 */
const validateRequestSize = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        logger.warn('Request size exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.url,
          method: req.method,
          contentLength: sizeInBytes,
          maxSize: maxSizeInBytes,
          timestamp: new Date().toISOString()
        });
        
        return res.status(413).json({
          error: 'Request entity too large',
          maxSize: maxSize,
          receivedSize: `${Math.round(sizeInBytes / 1024 / 1024 * 100) / 100}MB`
        });
      }
    }
    
    next();
  };
};

/**
 * Parse size string to bytes
 */
function parseSize(size) {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = size.toString().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmg]?b)$/);
  
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }
  
  const [, number, unit] = match;
  return parseFloat(number) * units[unit];
}

/**
 * Security headers middleware (additional to helmet)
 */
const securityHeaders = (req, res, next) => {
  // Additional security headers not covered by helmet
  res.setHeader('X-Request-ID', req.id || crypto.randomUUID());
  res.setHeader('X-Response-Time', Date.now());
  
  // Custom security headers for API
  res.setHeader('X-API-Version', '1.0.0');
  res.setHeader('X-Rate-Limit-Policy', 'standard');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};

/**
 * IP whitelist/blacklist middleware
 */
const ipFilter = (options = {}) => {
  const { whitelist = [], blacklist = [], trustProxy = true } = options;
  
  return (req, res, next) => {
    const clientIP = trustProxy ? 
      req.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip : 
      req.connection.remoteAddress;
    
    // Check blacklist first
    if (blacklist.length > 0 && blacklist.includes(clientIP)) {
      logger.warn('Blocked IP attempt', {
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        reason: 'blacklisted',
        timestamp: new Date().toISOString()
      });
      
      return res.status(403).json({
        error: 'Access denied',
        code: 'IP_BLOCKED'
      });
    }
    
    // Check whitelist if configured
    if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
      logger.warn('Non-whitelisted IP attempt', {
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        reason: 'not_whitelisted',
        timestamp: new Date().toISOString()
      });
      
      return res.status(403).json({
        error: 'Access denied',
        code: 'IP_NOT_WHITELISTED'
      });
    }
    
    next();
  };
};

/**
 * Request correlation ID middleware
 */
const correlationId = (req, res, next) => {
  const correlationId = req.get('x-correlation-id') || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
};

/**
 * Audit logging middleware for sensitive operations
 */
const auditLog = (operation) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Log request
    logger.info('Audit log - Request', {
      operation,
      correlationId: req.correlationId,
      userId: req.user?.sub,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      requestBody: sanitizeForAudit(req.body)
    });
    
    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(data) {
      const duration = Date.now() - startTime;
      
      logger.info('Audit log - Response', {
        operation,
        correlationId: req.correlationId,
        userId: req.user?.sub,
        statusCode: res.statusCode,
        duration,
        timestamp: new Date().toISOString(),
        responseData: sanitizeForAudit(data)
      });
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Sanitize data for audit logging
 */
function sanitizeForAudit(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization',
    'credit_card', 'ssn', 'social_security', 'api_key',
    'access_token', 'refresh_token', 'webhook_secret'
  ];
  
  const sanitized = JSON.parse(JSON.stringify(data));
  
  function recursiveSanitize(obj) {
    if (Array.isArray(obj)) {
      return obj.map(recursiveSanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = recursiveSanitize(value);
        }
      }
      return result;
    }
    
    return obj;
  }
  
  return recursiveSanitize(sanitized);
}

/**
 * Content Security Policy for API responses
 */
const contentSecurityPolicy = (req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'none'; " +
    "script-src 'none'; " +
    "style-src 'none'; " +
    "img-src 'none'; " +
    "connect-src 'self'; " +
    "font-src 'none'; " +
    "object-src 'none'; " +
    "media-src 'none'; " +
    "frame-src 'none';"
  );
  next();
};

module.exports = {
  rateLimitConfigs,
  createRateLimit,
  createSlowDown,
  validateWebhookSignature,
  webhookValidators,
  hppProtection,
  validateRequestSize,
  securityHeaders,
  ipFilter,
  correlationId,
  auditLog,
  contentSecurityPolicy
};