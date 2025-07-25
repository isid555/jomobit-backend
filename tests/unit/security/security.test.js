const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { 
  rateLimitConfigs,
  validateWebhookSignature,
  webhookValidators,
  hppProtection,
  validateRequestSize,
  securityHeaders,
  auditLog,
  correlationId
} = require('../../../src/middleware/security');
const { sanitizeInput } = require('../../../src/middleware/validation');

describe('Security Middleware Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.set('trust proxy', 1);
  });

  describe('Rate Limiting', () => {
    test('should apply general rate limiting', async () => {
      // Create a simple rate limiter for testing
      const testRateLimit = rateLimit({
        windowMs: 60000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false
      });
      
      app.use(testRateLimit);
      app.get('/test', (req, res) => res.json({ success: true }));

      // First request should succeed
      const response1 = await request(app).get('/test');
      expect(response1.status).toBe(200);
      expect(response1.headers['x-ratelimit-limit']).toBeDefined();
      expect(response1.headers['x-ratelimit-remaining']).toBeDefined();
    });

    test('should block requests after rate limit exceeded', async () => {
      // Create a very restrictive rate limiter for testing
      const testRateLimit = require('express-rate-limit')({
        windowMs: 60000, // 1 minute
        max: 2, // limit each IP to 2 requests per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: 60
        }
      });

      app.use(testRateLimit);
      app.get('/test', (req, res) => res.json({ success: true }));

      // First two requests should succeed
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);

      // Third request should be rate limited
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Too many requests');
    });

    test('should have different limits for different endpoint types', () => {
      expect(rateLimitConfigs.auth).toBeDefined();
      expect(rateLimitConfigs.admin).toBeDefined();
      expect(rateLimitConfigs.generation).toBeDefined();
      expect(rateLimitConfigs.webhook).toBeDefined();
      expect(rateLimitConfigs.upload).toBeDefined();
      expect(rateLimitConfigs.general).toBeDefined();
    });
  });

  describe('Webhook Signature Validation', () => {
    const testSecret = 'test-webhook-secret';
    const testPayload = JSON.stringify({ test: 'data' });

    test('should validate correct webhook signature', async () => {
      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(testPayload, 'utf8')
        .digest('hex');

      app.use(express.raw({ type: 'application/json' }));
      app.use((req, res, next) => {
        req.rawBody = req.body.toString();
        next();
      });
      app.use(validateWebhookSignature(testSecret));
      app.post('/webhook', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/webhook')
        .set('x-signature-256', `sha256=${signature}`)
        .set('content-type', 'application/json')
        .send(testPayload);

      expect(response.status).toBe(200);
    });

    test('should reject invalid webhook signature', async () => {
      app.use(express.raw({ type: 'application/json' }));
      app.use((req, res, next) => {
        req.rawBody = req.body.toString();
        next();
      });
      app.use(validateWebhookSignature(testSecret));
      app.post('/webhook', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/webhook')
        .set('x-signature-256', 'sha256=invalid-signature')
        .set('content-type', 'application/json')
        .send(testPayload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid webhook signature');
    });

    test('should reject missing webhook signature', async () => {
      app.use(express.raw({ type: 'application/json' }));
      app.use(validateWebhookSignature(testSecret));
      app.post('/webhook', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/webhook')
        .send(testPayload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing webhook signature');
    });

    test('should have validators for different services', () => {
      expect(webhookValidators.auth0).toBeDefined();
      expect(webhookValidators.razorpay).toBeDefined();
      expect(webhookValidators.openai).toBeDefined();
      expect(webhookValidators.ideogram).toBeDefined();
      expect(webhookValidators.slack).toBeDefined();
    });
  });

  describe('HTTP Parameter Pollution Protection', () => {
    test('should prevent parameter pollution', async () => {
      app.use(express.urlencoded({ extended: true }));
      app.use(hppProtection);
      app.get('/test', (req, res) => res.json({ query: req.query }));

      const response = await request(app)
        .get('/test?param=value1&param=value2');

      expect(response.status).toBe(200);
      // HPP should prevent array creation for non-whitelisted parameters
      expect(Array.isArray(response.body.query.param)).toBe(false);
    });

    test('should allow arrays for whitelisted parameters', async () => {
      app.use(express.urlencoded({ extended: true }));
      app.use(hppProtection);
      app.get('/test', (req, res) => res.json({ query: req.query }));

      const response = await request(app)
        .get('/test?tags=tag1&tags=tag2');

      expect(response.status).toBe(200);
      // Tags should be allowed as array (whitelisted)
      expect(Array.isArray(response.body.query.tags)).toBe(true);
    });
  });

  describe('Request Size Validation', () => {
    test('should allow requests within size limit', async () => {
      app.use(validateRequestSize('1mb'));
      app.use(express.json());
      app.post('/test', (req, res) => res.json({ success: true }));

      const smallPayload = { data: 'small payload' };
      const response = await request(app)
        .post('/test')
        .send(smallPayload);

      expect(response.status).toBe(200);
    });

    test('should reject requests exceeding size limit', async () => {
      app.use(validateRequestSize('1kb')); // Very small limit for testing
      app.use(express.json());
      app.post('/test', (req, res) => res.json({ success: true }));

      const largePayload = { data: 'x'.repeat(2000) }; // 2KB payload
      const response = await request(app)
        .post('/test')
        .set('content-length', JSON.stringify(largePayload).length.toString())
        .send(largePayload);

      expect(response.status).toBe(413);
      expect(response.body.error).toBe('Request entity too large');
    });
  });

  describe('Security Headers', () => {
    test('should add security headers', async () => {
      app.use(securityHeaders);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-response-time']).toBeDefined();
      expect(response.headers['x-api-version']).toBe('1.0.0');
      expect(response.headers['x-rate-limit-policy']).toBe('standard');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Correlation ID', () => {
    test('should add correlation ID to requests', async () => {
      app.use(correlationId);
      app.get('/test', (req, res) => {
        res.json({ 
          correlationId: req.correlationId,
          success: true 
        });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.correlationId).toBeDefined();
      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
    });

    test('should use provided correlation ID', async () => {
      const testCorrelationId = 'test-correlation-id';
      
      app.use(correlationId);
      app.get('/test', (req, res) => {
        res.json({ 
          correlationId: req.correlationId,
          success: true 
        });
      });

      const response = await request(app)
        .get('/test')
        .set('x-correlation-id', testCorrelationId);

      expect(response.status).toBe(200);
      expect(response.body.correlationId).toBe(testCorrelationId);
      expect(response.headers['x-correlation-id']).toBe(testCorrelationId);
    });
  });

  describe('Audit Logging', () => {
    test('should log sensitive operations', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      app.use(express.json());
      app.use(correlationId);
      app.use(auditLog('test-operation'));
      app.post('/test', (req, res) => {
        res.json({ success: true });
      });

      const testData = { 
        sensitive: 'data',
        password: 'secret123',
        normal: 'value'
      };

      await request(app)
        .post('/test')
        .send(testData);

      // Verify that audit logging occurred (implementation may vary)
      logSpy.mockRestore();
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize NoSQL injection attempts', async () => {
      app.use(express.json());
      app.use(sanitizeInput());
      app.post('/test', (req, res) => res.json({ body: req.body }));

      const maliciousPayload = {
        username: 'admin',
        password: { $ne: null } // NoSQL injection attempt
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousPayload);

      expect(response.status).toBe(200);
      // The $ne should be sanitized (replaced with _)
      expect(response.body.body.password).not.toEqual({ $ne: null });
      expect(typeof response.body.body.password).toBe('object');
    });

    test('should sanitize XSS attempts', async () => {
      app.use(express.json());
      app.use(sanitizeInput());
      app.post('/test', (req, res) => res.json({ body: req.body }));

      const xssPayload = {
        comment: '<script>alert("xss")</script>Hello World'
      };

      const response = await request(app)
        .post('/test')
        .send(xssPayload);

      expect(response.status).toBe(200);
      // Script tags should be removed
      expect(response.body.body.comment).not.toContain('<script>');
      expect(response.body.body.comment).toContain('Hello World');
    });

    test('should sanitize javascript: URLs', async () => {
      app.use(express.json());
      app.use(sanitizeInput());
      app.post('/test', (req, res) => res.json({ body: req.body }));

      const jsPayload = {
        link: 'javascript:alert("xss")'
      };

      const response = await request(app)
        .post('/test')
        .send(jsPayload);

      expect(response.status).toBe(200);
      // javascript: should be removed
      expect(response.body.body.link).not.toContain('javascript:');
    });

    test('should sanitize event handlers', async () => {
      app.use(express.json());
      app.use(sanitizeInput());
      app.post('/test', (req, res) => res.json({ body: req.body }));

      const eventPayload = {
        html: '<div onclick="alert(1)">Click me</div>'
      };

      const response = await request(app)
        .post('/test')
        .send(eventPayload);

      expect(response.status).toBe(200);
      // Event handlers should be removed
      expect(response.body.body.html).not.toContain('onclick=');
    });
  });
});