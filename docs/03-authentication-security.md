# Chapter 3: Authentication & Security

## Table of Contents
- [Authentication Overview](#authentication-overview)
- [Auth0 Integration](#auth0-integration)
- [JWT Token Validation](#jwt-token-validation)
- [Authorization & RBAC](#authorization--rbac)
- [Security Middleware](#security-middleware)
- [Rate Limiting](#rate-limiting)
- [Input Validation & Sanitization](#input-validation--sanitization)
- [Webhook Security](#webhook-security)
- [Security Best Practices](#security-best-practices)

## Authentication Overview

Jomobit uses Auth0 as the primary identity provider, implementing OAuth 2.0 and JWT tokens for secure authentication. The system supports multiple authentication flows and provides comprehensive security measures.

### Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Auth0
    participant API
    participant Database
    
    Client->>Auth0: Login request
    Auth0-->>Client: JWT Access Token
    Client->>API: API request with JWT
    API->>API: Validate JWT signature
    API->>Auth0: Verify token (if needed)
    API->>Database: Find/create user
    Database-->>API: User data
    API-->>Client: Authenticated response
```

### Supported Authentication Methods

1. **Web Application Flow**: Standard OAuth 2.0 for web applications
2. **Single Page Application (SPA)**: PKCE flow for frontend applications
3. **Mobile Application**: Native mobile authentication
4. **Machine-to-Machine**: Service-to-service authentication

## Auth0 Integration

### Configuration

The Auth0 integration is configured in `src/config/auth0.js`:

```javascript
// Auth0 Configuration
const auth0Config = {
  domain: process.env.AUTH0_DOMAIN,
  audience: process.env.AUTH0_AUDIENCE,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  tokenSigningAlg: 'RS256'
};
```

### Required Environment Variables

```bash
# Auth0 Configuration
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=https://api.jomobit.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_WEBHOOK_SECRET=your-webhook-secret
```

### Auth0 Setup Steps

1. **Create Auth0 Application**:
   - Application Type: Regular Web Application
   - Token Endpoint Authentication Method: POST
   - Grant Types: Authorization Code, Refresh Token

2. **Configure API**:
   - Create API in Auth0 Dashboard
   - Set Identifier as `AUTH0_AUDIENCE`
   - Enable RBAC and Add Permissions in Access Token

3. **Set Up Custom Claims**:
   ```javascript
   // Auth0 Rule for custom claims
   function addCustomClaims(user, context, callback) {
     const namespace = 'https://jomobit.com/';
     context.accessToken[namespace + 'roles'] = user.app_metadata?.roles || ['user'];
     context.accessToken[namespace + 'permissions'] = user.permissions || [];
     callback(null, user, context);
   }
   ```

### User Synchronization

Users are automatically synchronized from Auth0 to the local database:

```javascript
// User model method for Auth0 sync
async createOrUpdateFromAuth0(auth0User) {
  const userData = {
    auth0Id: auth0User.user_id,
    email: auth0User.email?.toLowerCase(),
    emailVerified: auth0User.email_verified || false,
    status: auth0User.email_verified ? 'active' : 'pending',
    metadata: {
      name: auth0User.name,
      given_name: auth0User.given_name,
      family_name: auth0User.family_name,
      nickname: auth0User.nickname,
      picture: auth0User.picture,
      locale: auth0User.locale,
      updated_at: new Date(auth0User.updated_at)
    },
    roles: auth0User['https://jomobit.com/roles'] || ['user'],
    permissions: auth0User.permissions || [],
    lastSyncAt: new Date()
  };

  return this.findOneAndUpdate(
    { auth0Id: auth0User.user_id },
    userData,
    { upsert: true, new: true, runValidators: true }
  );
}
```

## JWT Token Validation

### JWT Middleware

The JWT validation middleware is implemented in `src/middleware/auth.js`:

```javascript
const { auth } = require('express-oauth2-jwt-bearer');

// JWT validation middleware
const jwtCheck = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
  tokenSigningAlg: 'RS256'
});

// Enhanced auth middleware with user context
const authenticateUser = async (req, res, next) => {
  try {
    // JWT is already validated by jwtCheck
    const auth0Id = req.auth.sub;
    
    // Find or create user in database
    const user = await User.findByAuth0Id(auth0Id);
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check user status
    if (user.status === 'suspended') {
      return res.status(403).json({
        error: 'Account suspended',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    // Add user to request context
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};
```

### Token Structure

JWT tokens contain the following claims:

```json
{
  "iss": "https://your-domain.auth0.com/",
  "sub": "auth0|user-id",
  "aud": "https://api.jomobit.com",
  "iat": 1642680000,
  "exp": 1642766400,
  "azp": "client-id",
  "scope": "read:profile write:profile",
  "https://jomobit.com/roles": ["user"],
  "https://jomobit.com/permissions": ["read:own_profile", "write:own_profile"]
}
```

### Token Validation Process

1. **Signature Verification**: Validate JWT signature using Auth0 public keys
2. **Claims Validation**: Verify issuer, audience, and expiration
3. **User Lookup**: Find user in local database
4. **Status Check**: Verify user account status
5. **Context Setting**: Add user to request context

## Authorization & RBAC

### Role-Based Access Control

The system implements RBAC with three primary roles:

| Role | Description | Permissions |
|------|-------------|-------------|
| **user** | Standard user | Own profile, generate posters, manage subscriptions |
| **admin** | Administrator | All user permissions + user management, system admin |
| **moderator** | Content moderator | User permissions + template management |

### Permission System

Permissions are granular and follow the pattern `action:resource`:

```javascript
// User permissions
const USER_PERMISSIONS = [
  'read:own_profile',
  'write:own_profile',
  'read:own_business_profiles',
  'write:own_business_profiles',
  'read:templates',
  'create:generation_jobs',
  'read:own_generation_jobs',
  'read:own_subscriptions',
  'write:own_subscriptions'
];

// Admin permissions (includes all user permissions)
const ADMIN_PERMISSIONS = [
  ...USER_PERMISSIONS,
  'read:all_users',
  'write:all_users',
  'read:all_business_profiles',
  'read:all_generation_jobs',
  'read:all_subscriptions',
  'write:templates',
  'read:system_stats',
  'write:system_config'
];
```

### Authorization Middleware

```javascript
// Role-based authorization
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRoles = req.user.roles || [];
    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: userRoles
      });
    }

    next();
  };
};

// Permission-based authorization
const requirePermission = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permissions,
        current: userPermissions
      });
    }

    next();
  };
};
```

### Usage Examples

```javascript
// Protect routes with roles
app.get('/api/admin/users', 
  jwtCheck, 
  authenticateUser, 
  requireRole(['admin']), 
  adminController.getUsers
);

// Protect routes with permissions
app.post('/api/profiles', 
  jwtCheck, 
  authenticateUser, 
  requirePermission(['write:own_business_profiles']), 
  profileController.createProfile
);
```

## Security Middleware

### Helmet.js Configuration

Security headers are configured using Helmet.js:

```javascript
const helmetConfig = {
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
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'no-referrer' }
};
```

### CORS Configuration

Cross-Origin Resource Sharing is configured with strict origin validation:

```javascript
const corsConfig = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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
    'X-API-Key'
  ],
  exposedHeaders: [
    'X-Correlation-ID',
    'X-Request-ID',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ]
};
```

## Rate Limiting

### Tiered Rate Limiting

Different endpoints have different rate limits based on their resource intensity:

```javascript
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
    skipSuccessfulRequests: true
  },

  // Poster generation (resource intensive)
  generation: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: 'Too many generation requests, please try again later.'
  },

  // Admin endpoints (very restrictive)
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many admin requests, please try again later.'
  },

  // Webhook endpoints
  webhook: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200,
    message: 'Too many webhook requests, please try again later.'
  }
};
```

### Rate Limit Implementation

```javascript
const rateLimit = require('express-rate-limit');

// Apply rate limits to different route groups
app.use('/api/auth', rateLimit(rateLimitConfigs.auth));
app.use('/api/admin', rateLimit(rateLimitConfigs.admin));
app.use('/api/posters/generate', rateLimit(rateLimitConfigs.generation));
app.use('/api/webhooks', rateLimit(rateLimitConfigs.webhook));
app.use('/api/', rateLimit(rateLimitConfigs.general));
```

### Rate Limit Headers

Clients receive rate limit information in response headers:

```http
X-Rate-Limit-Limit: 100
X-Rate-Limit-Remaining: 95
X-Rate-Limit-Reset: 1642680000
```

## Input Validation & Sanitization

### Joi Schema Validation

All API inputs are validated using Joi schemas:

```javascript
const Joi = require('joi');

// Business profile validation schema
const businessProfileSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  tagline: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().min(1).max(1000).required(),
  logo: Joi.string().uri().optional(),
  colorPalette: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().required(),
      hex: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).required()
    })
  ).max(10).optional(),
  products: Joi.array().items(
    Joi.string().trim().max(100)
  ).max(20).optional()
});

// Validation middleware
const validateBusinessProfile = (req, res, next) => {
  const { error, value } = businessProfileSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  req.validatedData = value;
  next();
};
```

### Input Sanitization

Multiple layers of input sanitization prevent injection attacks:

```javascript
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// MongoDB injection prevention
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn('MongoDB injection attempt detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      key,
      timestamp: new Date().toISOString()
    });
  }
}));

// XSS prevention
app.use(xss());

// HTTP Parameter Pollution prevention
app.use(hpp({
  whitelist: ['tags', 'categories'] // Allow arrays for these parameters
}));
```

### Security Pattern Detection

Custom middleware detects common attack patterns:

```javascript
const securityPatterns = {
  sqlInjection: [
    /('|\\')|(;|\\;)|(\|)|(\*)|(%)|(<)|(>)|(\{)|(\})|(\[)|(\])/i,
    /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i
  ],
  xss: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ],
  pathTraversal: [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi
  ]
};

const detectSecurityThreats = (req, res, next) => {
  const checkInput = (input, type) => {
    const patterns = securityPatterns[type];
    return patterns.some(pattern => pattern.test(input));
  };

  const inputs = [
    JSON.stringify(req.body),
    JSON.stringify(req.query),
    JSON.stringify(req.params)
  ].join(' ');

  Object.keys(securityPatterns).forEach(threatType => {
    if (checkInput(inputs, threatType)) {
      logger.warn(`Security threat detected: ${threatType}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
  });

  next();
};
```

## Webhook Security

### Signature Validation

All webhooks validate signatures to ensure authenticity:

```javascript
const crypto = require('crypto');

// Auth0 webhook signature validation
const validateAuth0Webhook = (req, res, next) => {
  const signature = req.headers['x-auth0-signature'];
  const secret = process.env.AUTH0_WEBHOOK_SECRET;
  
  if (!signature || !secret) {
    return res.status(401).json({
      error: 'Missing webhook signature or secret',
      code: 'WEBHOOK_AUTH_FAILED'
    });
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )) {
    logger.warn('Invalid Auth0 webhook signature', {
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    return res.status(401).json({
      error: 'Invalid webhook signature',
      code: 'INVALID_SIGNATURE'
    });
  }

  next();
};

// Razorpay webhook signature validation
const validateRazorpayWebhook = (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.warn('Invalid Razorpay webhook signature', {
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    return res.status(401).json({
      error: 'Invalid webhook signature',
      code: 'INVALID_SIGNATURE'
    });
  }

  next();
};
```

### Webhook Rate Limiting

Webhooks have separate rate limiting to prevent abuse:

```javascript
// Webhook-specific rate limiting
const webhookRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // Higher limit for legitimate webhook traffic
  message: 'Too many webhook requests',
  skip: (req) => {
    // Skip rate limiting for verified webhooks
    return req.webhookVerified === true;
  }
});

app.use('/api/webhooks', webhookRateLimit);
```

## Security Best Practices

### 1. Environment Security

```bash
# Use strong secrets
AUTH0_WEBHOOK_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 64)

# Restrict CORS origins in production
ALLOWED_ORIGINS=https://app.jomobit.com,https://admin.jomobit.com

# Use secure database connections
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/jomobit?ssl=true
REDIS_URL=rediss://user:pass@redis.example.com:6380
```

### 2. Logging Security Events

```javascript
// Security event logging
const logSecurityEvent = (event, details) => {
  logger.warn('Security event', {
    event,
    ...details,
    timestamp: new Date().toISOString(),
    severity: 'HIGH'
  });
};

// Usage examples
logSecurityEvent('INVALID_JWT', { ip: req.ip, userAgent: req.get('User-Agent') });
logSecurityEvent('RATE_LIMIT_EXCEEDED', { ip: req.ip, endpoint: req.path });
logSecurityEvent('UNAUTHORIZED_ACCESS', { userId: req.user?.id, resource: req.path });
```

### 3. Security Headers

```javascript
// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
```

### 4. Database Security

```javascript
// MongoDB security best practices
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferMaxEntries: 0,
  bufferCommands: false,
  // Enable SSL in production
  ssl: process.env.NODE_ENV === 'production',
  sslValidate: process.env.NODE_ENV === 'production'
};
```

### 5. Error Handling Security

```javascript
// Secure error responses
const errorHandler = (err, req, res, next) => {
  // Log full error details
  logger.error('Application error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Return sanitized error to client
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(isDevelopment && { stack: err.stack })
  });
};
```

---

**Next Chapter**: [Database Design](./04-database-design.md) - Learn about MongoDB schemas, relationships, and data modeling strategies.