const helmet = require('helmet');
const cors = require('cors');
const logger = require('../utils/logger');

/**
 * Security configuration for the Jomobit API
 * This module centralizes all security-related configurations
 */

/**
 * Helmet configuration for security headers
 */
const helmetConfig = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
      imgSrc: ["'none'"],
      connectSrc: ["'self'"],
      fontSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      workerSrc: ["'none'"],
      manifestSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disabled for API compatibility
  
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  
  // Frameguard (X-Frame-Options)
  frameguard: { action: 'deny' },
  
  // Hide Powered By
  hidePoweredBy: true,
  
  // HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // IE No Open
  ieNoOpen: true,
  
  // No Sniff (X-Content-Type-Options)
  noSniff: true,
  
  // Origin Agent Cluster
  originAgentCluster: true,
  
  // Permitted Cross Domain Policies
  permittedCrossDomainPolicies: false,
  
  // Referrer Policy
  referrerPolicy: { policy: 'no-referrer' },
  
  // X-XSS-Protection
  xssFilter: true
};

/**
 * CORS configuration
 */
const corsConfig = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',');
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Log unauthorized CORS attempts for security monitoring
      logger.warn('CORS blocked request from unauthorized origin', {
        origin,
        allowedOrigins: allowedOrigins.length,
        timestamp: new Date().toISOString()
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Correlation-ID',
    'X-Request-ID',
    'X-API-Key',
    'Accept',
    'Accept-Language',
    'Content-Language'
  ],
  exposedHeaders: [
    'X-Correlation-ID',
    'X-Request-ID',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'X-Total-Count',
    'X-Page-Count'
  ],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  preflightContinue: false
};

/**
 * Rate limiting configurations for different endpoint types
 */
const rateLimitConfigs = {
  // General API endpoints
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },

  // Authentication endpoints (more restrictive)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false
  },

  // Poster generation (resource intensive)
  generation: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: 'Too many generation requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },

  // Admin endpoints (very restrictive)
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many admin requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },

  // Webhook endpoints
  webhook: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200,
    message: 'Too many webhook requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },

  // File upload endpoints
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: 'Too many upload requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  }
};

/**
 * Request size limits for different endpoint types
 */
const requestSizeLimits = {
  default: '10mb',
  upload: '50mb',
  webhook: '1mb',
  json: '10mb',
  urlencoded: '10mb'
};

/**
 * Input validation patterns for security
 */
const securityPatterns = {
  // SQL injection patterns
  sqlInjection: [
    /('|\\')|(;|\\;)|(\|)|(\*)|(%)|(<)|(>)|(\{)|(\})|(\[)|(\])/i,
    /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i,
    /(script|javascript|vbscript|onload|onerror|onclick)/i
  ],

  // XSS patterns
  xss: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ],

  // Path traversal patterns
  pathTraversal: [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi
  ],

  // Command injection patterns
  commandInjection: [
    /[;&|`$(){}]/g
  ],

  // Null byte injection
  nullByte: /\0/g
};

/**
 * Webhook signature validation secrets
 */
const webhookSecrets = {
  auth0: process.env.AUTH0_WEBHOOK_SECRET,
  razorpay: process.env.RAZORPAY_WEBHOOK_SECRET,
  openai: process.env.OPENAI_WEBHOOK_SECRET,
  ideogram: process.env.IDEOGRAM_WEBHOOK_SECRET,
  gemini: process.env.GEMINI_WEBHOOK_SECRET,
  slack: process.env.SLACK_WEBHOOK_SECRET
};

/**
 * Security monitoring configuration
 */
const monitoringConfig = {
  // Log security events
  logSecurityEvents: true,
  
  // Alert thresholds
  alertThresholds: {
    rateLimitViolations: 10, // per hour
    authenticationFailures: 5, // per 15 minutes
    webhookSignatureFailures: 3, // per hour
    corsViolations: 5 // per hour
  },
  
  // Sensitive fields to redact in logs
  sensitiveFields: [
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
    'refresh_token',
    'webhook_secret'
  ]
};

/**
 * IP filtering configuration
 */
const ipFilterConfig = {
  // Whitelist (if empty, all IPs are allowed)
  whitelist: (process.env.IP_WHITELIST || '').split(',').filter(ip => ip.trim()),
  
  // Blacklist
  blacklist: (process.env.IP_BLACKLIST || '').split(',').filter(ip => ip.trim()),
  
  // Trust proxy settings
  trustProxy: true
};

/**
 * Environment-specific security settings
 */
const environmentConfig = {
  development: {
    // More lenient settings for development
    rateLimits: {
      ...rateLimitConfigs,
      general: { ...rateLimitConfigs.general, max: 1000 },
      auth: { ...rateLimitConfigs.auth, max: 100 }
    },
    cors: {
      ...corsConfig,
      origin: true // Allow all origins in development
    }
  },
  
  production: {
    // Strict settings for production
    rateLimits: rateLimitConfigs,
    cors: corsConfig,
    
    // Additional production security measures
    requireHttps: true,
    strictTransportSecurity: true,
    contentSecurityPolicy: true
  },
  
  test: {
    // Minimal security for testing
    rateLimits: {
      ...rateLimitConfigs,
      general: { ...rateLimitConfigs.general, max: 10000 }
    },
    cors: {
      ...corsConfig,
      origin: true
    }
  }
};

/**
 * Get security configuration for current environment
 */
const getSecurityConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const baseConfig = {
    helmet: helmetConfig,
    cors: corsConfig,
    rateLimits: rateLimitConfigs,
    requestSizeLimits,
    securityPatterns,
    webhookSecrets,
    monitoring: monitoringConfig,
    ipFilter: ipFilterConfig
  };

  // Merge with environment-specific config
  if (environmentConfig[env]) {
    return {
      ...baseConfig,
      ...environmentConfig[env]
    };
  }

  return baseConfig;
};

/**
 * Validate security configuration
 */
const validateSecurityConfig = () => {
  const config = getSecurityConfig();
  const errors = [];

  // Check webhook secrets
  Object.entries(webhookSecrets).forEach(([service, secret]) => {
    if (!secret) {
      errors.push(`Missing webhook secret for ${service}`);
    }
  });

  // Check CORS origins in production
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
    errors.push('ALLOWED_ORIGINS environment variable not set for production');
  }

  // Log validation results
  if (errors.length > 0) {
    logger.warn('Security configuration validation failed', {
      errors,
      timestamp: new Date().toISOString()
    });
  } else {
    logger.info('Security configuration validated successfully', {
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  }

  return errors;
};

module.exports = {
  helmetConfig,
  corsConfig,
  rateLimitConfigs,
  requestSizeLimits,
  securityPatterns,
  webhookSecrets,
  monitoringConfig,
  ipFilterConfig,
  environmentConfig,
  getSecurityConfig,
  validateSecurityConfig
};