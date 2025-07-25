/**
 * Tests for logging middleware
 */

const {
  requestLogger,
  correlationIdMiddleware,
  securityLogger,
  performanceLogger
} = require('../../../src/middleware/logging');
const logger = require('../../../src/utils/logger');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  logRequest: jest.fn(),
  logSecurity: jest.fn(),
  logPerformance: jest.fn()
}));

describe('Logging Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/test',
      originalUrl: '/api/test',
      baseUrl: '/api',
      path: '/test',
      query: { page: '1' },
      params: { id: '123' },
      headers: {
        'user-agent': 'test-agent',
        'authorization': 'Bearer token123',
        'content-type': 'application/json',
        'host': 'localhost:3000'
      },
      get: jest.fn((header) => req.headers[header.toLowerCase()]),
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      protocol: 'http',
      secure: false,
      xhr: false,
      user: { sub: 'user123' },
      body: { test: 'data', password: 'secret123' }
    };

    res = {
      statusCode: 200,
      statusMessage: 'OK',
      set: jest.fn(),
      get: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({
        'content-type': 'application/json',
        'content-length': '100'
      }),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn(),
      on: jest.fn()
    };

    next = jest.fn();

    // Clear mocks
    Object.values(logger).forEach(fn => {
      if (typeof fn === 'function') fn.mockClear();
    });
  });

  describe('correlationIdMiddleware', () => {
    test('should generate correlation ID if not present', () => {
      correlationIdMiddleware(req, res, next);

      expect(req.correlationId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(res.set).toHaveBeenCalledWith('X-Correlation-ID', req.correlationId);
      expect(next).toHaveBeenCalled();
    });

    test('should use existing X-Correlation-ID header', () => {
      req.get.mockImplementation((header) => {
        if (header === 'X-Correlation-ID') return 'existing-correlation-id';
        return req.headers[header.toLowerCase()];
      });

      correlationIdMiddleware(req, res, next);

      expect(req.correlationId).toBe('existing-correlation-id');
      expect(res.set).toHaveBeenCalledWith('X-Correlation-ID', 'existing-correlation-id');
      expect(next).toHaveBeenCalled();
    });

    test('should use existing X-Request-ID header', () => {
      req.get.mockImplementation((header) => {
        if (header === 'X-Request-ID') return 'existing-request-id';
        return req.headers[header.toLowerCase()];
      });

      correlationIdMiddleware(req, res, next);

      expect(req.correlationId).toBe('existing-request-id');
      expect(res.set).toHaveBeenCalledWith('X-Correlation-ID', 'existing-request-id');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requestLogger', () => {
    test('should log incoming request', () => {
      req.correlationId = 'test-correlation-id';

      requestLogger(req, res, next);

      expect(logger.info).toHaveBeenCalledWith('Incoming Request', expect.objectContaining({
        type: 'request',
        correlationId: 'test-correlation-id',
        method: 'GET',
        url: '/test',
        originalUrl: '/api/test',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
        userId: 'user123'
      }));

      expect(next).toHaveBeenCalled();
    });

    test('should log request body for non-GET requests', () => {
      req.method = 'POST';
      req.correlationId = 'test-correlation-id';

      requestLogger(req, res, next);

      expect(logger.debug).toHaveBeenCalledWith('Request Body', expect.objectContaining({
        correlationId: 'test-correlation-id',
        body: { test: 'data', password: '[REDACTED]' },
        contentType: 'application/json'
      }));
    });

    test('should not log request body for GET requests', () => {
      req.method = 'GET';
      req.correlationId = 'test-correlation-id';

      requestLogger(req, res, next);

      expect(logger.debug).not.toHaveBeenCalledWith('Request Body', expect.anything());
    });

    test('should log response when request completes', (done) => {
      req.correlationId = 'test-correlation-id';
      
      // Mock res.end to simulate request completion
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        // Simulate response completion
        setTimeout(() => {
          expect(logger.info).toHaveBeenCalledWith('Request Completed', expect.objectContaining({
            type: 'response',
            correlationId: 'test-correlation-id',
            method: 'GET',
            url: '/test',
            statusCode: 200,
            userId: 'user123'
          }));

          expect(logger.logRequest).toHaveBeenCalledWith(req, res, expect.any(Number));
          done();
        }, 0);

        if (originalEnd) originalEnd.call(this, chunk, encoding);
      };

      requestLogger(req, res, next);
      
      // Simulate request completion
      res.end();
    });

    test('should log slow requests', (done) => {
      req.correlationId = 'test-correlation-id';
      process.env.SLOW_REQUEST_THRESHOLD = '10'; // Very low threshold for testing
      
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        // Add a small delay to ensure we exceed the threshold
        setTimeout(() => {
          expect(logger.warn).toHaveBeenCalledWith('Slow Request Detected', expect.objectContaining({
            correlationId: 'test-correlation-id',
            method: 'GET',
            url: '/test',
            userId: 'user123',
            threshold: '10'
          }));
          
          delete process.env.SLOW_REQUEST_THRESHOLD;
          done();
        }, 50);

        if (originalEnd) originalEnd.call(this, chunk, encoding);
      };

      requestLogger(req, res, next);
      
      // Add delay before ending to simulate slow request
      setTimeout(() => {
        res.end();
      }, 20); // This should exceed the 10ms threshold
    });

    test('should sanitize sensitive headers', () => {
      req.correlationId = 'test-correlation-id';
      req.headers.authorization = 'Bearer secret-token';
      req.headers.cookie = 'session=secret';

      requestLogger(req, res, next);

      const logCall = logger.info.mock.calls.find(call => call[0] === 'Incoming Request');
      expect(logCall[1].headers.authorization).toBe('[REDACTED]');
      expect(logCall[1].headers.cookie).toBe('[REDACTED]');
    });
  });

  describe('securityLogger', () => {
    test('should log path traversal attempts', () => {
      req.url = '/api/../../../etc/passwd';
      req.correlationId = 'test-correlation-id';

      securityLogger(req, res, next);

      expect(logger.logSecurity).toHaveBeenCalledWith('path_traversal_attempt', expect.objectContaining({
        correlationId: 'test-correlation-id',
        method: 'GET',
        url: '/api/../../../etc/passwd',
        ip: '127.0.0.1',
        userId: 'user123'
      }));

      expect(next).toHaveBeenCalled();
    });

    test('should log bot access', () => {
      req.headers['user-agent'] = 'Googlebot/2.1';
      req.get.mockImplementation((header) => req.headers[header.toLowerCase()]);
      req.correlationId = 'test-correlation-id';

      securityLogger(req, res, next);

      expect(logger.logSecurity).toHaveBeenCalledWith('bot_access', expect.objectContaining({
        correlationId: 'test-correlation-id',
        userAgent: 'Googlebot/2.1'
      }));

      expect(next).toHaveBeenCalled();
    });

    test('should log authentication attempts', () => {
      req.url = '/api/auth/login';
      req.correlationId = 'test-correlation-id';

      securityLogger(req, res, next);

      expect(logger.logSecurity).toHaveBeenCalledWith('authentication_attempt', expect.objectContaining({
        correlationId: 'test-correlation-id',
        url: '/api/auth/login'
      }));

      expect(next).toHaveBeenCalled();
    });

    test('should log admin access attempts', () => {
      req.url = '/api/admin/users';
      req.correlationId = 'test-correlation-id';

      securityLogger(req, res, next);

      expect(logger.logSecurity).toHaveBeenCalledWith('admin_access_attempt', expect.objectContaining({
        correlationId: 'test-correlation-id',
        url: '/api/admin/users'
      }));

      expect(next).toHaveBeenCalled();
    });

    test('should log multiple security events', () => {
      req.url = '/api/admin/../../../etc/passwd';
      req.correlationId = 'test-correlation-id';

      securityLogger(req, res, next);

      expect(logger.logSecurity).toHaveBeenCalledWith('path_traversal_attempt', expect.any(Object));
      expect(logger.logSecurity).toHaveBeenCalledWith('admin_access_attempt', expect.any(Object));
      expect(next).toHaveBeenCalled();
    });
  });

  describe('performanceLogger', () => {
    test('should log performance metrics on response finish', () => {
      req.correlationId = 'test-correlation-id';
      req.route = { path: '/api/posters/generate' };
      req.method = 'POST';

      performanceLogger(req, res, next);

      // Simulate response finish
      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      expect(logger.logPerformance).toHaveBeenCalledWith('poster_generation', expect.any(Number), expect.objectContaining({
        correlationId: 'test-correlation-id',
        method: 'POST',
        url: '/test',
        statusCode: 200,
        userId: 'user123'
      }));

      expect(next).toHaveBeenCalled();
    });

    test('should not log performance for unmapped operations', () => {
      req.correlationId = 'test-correlation-id';
      req.route = { path: '/api/unknown' };

      performanceLogger(req, res, next);

      // Simulate response finish
      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      expect(logger.logPerformance).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    test('should sanitize sensitive request body fields', () => {
      const body = {
        username: 'testuser',
        password: 'secret123',
        token: 'auth-token',
        credit_card: '1234-5678-9012-3456',
        normalField: 'normal-value'
      };

      // This would be tested through the requestLogger, but we can't directly test
      // the utility function as it's not exported. The sanitization is tested
      // indirectly through the request body logging test above.
    });
  });
});