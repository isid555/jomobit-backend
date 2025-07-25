/**
 * Tests for error monitoring and alerting system
 */

const {
  ErrorMonitor,
  errorMonitor,
  monitoringMiddleware,
  errorTrackingMiddleware
} = require('../../../src/utils/monitoring');
const { AppError, ValidationError, InternalServerError } = require('../../../src/utils/errors');
const logger = require('../../../src/utils/logger');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logPerformance: jest.fn(),
  logError: jest.fn()
}));

// Mock node-fetch for Slack webhook testing
jest.mock('node-fetch', () => jest.fn());

describe('Error Monitoring System', () => {
  let monitor;
  let req, res, next;

  beforeEach(() => {
    monitor = new ErrorMonitor();
    
    req = {
      method: 'GET',
      url: '/test',
      path: '/test',
      route: { path: '/api/test' },
      user: { sub: 'user123' },
      correlationId: 'corr123',
      get: jest.fn().mockReturnValue('test-agent'),
      ip: '127.0.0.1'
    };

    res = {
      statusCode: 200,
      on: jest.fn()
    };

    next = jest.fn();

    // Clear mocks
    Object.values(logger).forEach(fn => {
      if (typeof fn === 'function') fn.mockClear();
    });

    // Clear environment variables
    delete process.env.ERROR_RATE_THRESHOLD;
    delete process.env.CRITICAL_ERROR_THRESHOLD;
    delete process.env.RESPONSE_TIME_THRESHOLD;
    delete process.env.MEMORY_USAGE_THRESHOLD;
    delete process.env.ALERT_COOLDOWN_PERIOD;
    delete process.env.SLACK_WEBHOOK_URL;
  });

  describe('ErrorMonitor', () => {
    test('should initialize with default thresholds', () => {
      expect(monitor.alertThresholds).toEqual({
        errorRate: 10,
        criticalErrors: 5,
        responseTime: 5000,
        memoryUsage: 0.9
      });
    });

    test('should use environment variables for thresholds', () => {
      process.env.ERROR_RATE_THRESHOLD = '20';
      process.env.CRITICAL_ERROR_THRESHOLD = '3';
      process.env.RESPONSE_TIME_THRESHOLD = '3000';
      process.env.MEMORY_USAGE_THRESHOLD = '0.8';
      
      const customMonitor = new ErrorMonitor();
      
      expect(customMonitor.alertThresholds).toEqual({
        errorRate: 20,
        criticalErrors: 3,
        responseTime: 3000,
        memoryUsage: 0.8
      });
    });

    describe('trackError', () => {
      test('should track error occurrence', () => {
        const error = new ValidationError('Invalid input');
        const context = { userId: 'user123' };

        monitor.trackError(error, context);

        expect(logger.info).toHaveBeenCalledWith('Error Tracked', expect.objectContaining({
          errorKey: 'ValidationError:VALIDATION_ERROR',
          errorName: 'ValidationError',
          errorCode: 'VALIDATION_ERROR',
          isOperational: true,
          context
        }));
      });

      test('should update error counts and rates', () => {
        const error = new ValidationError('Invalid input');

        monitor.trackError(error);
        monitor.trackError(error);

        const errorKey = 'ValidationError:VALIDATION_ERROR';
        expect(monitor.errorCounts.has(errorKey)).toBe(true);
        expect(monitor.errorRates.has(errorKey)).toBe(true);
      });

      test('should trigger alert for high error rate', () => {
        const error = new ValidationError('Invalid input');
        monitor.alertThresholds.errorRate = 1; // Set low threshold for testing

        const triggerAlertSpy = jest.spyOn(monitor, 'triggerAlert').mockImplementation();

        // Track multiple errors to exceed threshold
        monitor.trackError(error);
        monitor.trackError(error);

        expect(triggerAlertSpy).toHaveBeenCalledWith('high_error_rate', expect.objectContaining({
          errorKey: 'ValidationError:VALIDATION_ERROR',
          errorName: 'ValidationError',
          rate: expect.any(Number),
          threshold: 1
        }));

        triggerAlertSpy.mockRestore();
      });

      test('should trigger alert for critical errors', () => {
        const error = new InternalServerError('Server error');
        monitor.alertThresholds.criticalErrors = 1;

        const triggerAlertSpy = jest.spyOn(monitor, 'triggerAlert').mockImplementation();

        monitor.trackError(error);
        monitor.trackError(error);

        expect(triggerAlertSpy).toHaveBeenCalledWith('critical_errors', expect.objectContaining({
          errorKey: 'InternalServerError:INTERNAL_SERVER_ERROR',
          errorName: 'InternalServerError'
        }));

        triggerAlertSpy.mockRestore();
      });
    });

    describe('trackPerformance', () => {
      test('should track performance metrics', () => {
        const operation = 'poster_generation';
        const duration = 1500;
        const context = { userId: 'user123' };

        monitor.trackPerformance(operation, duration, context);

        expect(logger.logPerformance).toHaveBeenCalledWith(operation, duration, context);
      });

      test('should trigger alert for slow operations', () => {
        const operation = 'poster_generation';
        const duration = 6000; // Exceeds default threshold of 5000ms
        
        const triggerAlertSpy = jest.spyOn(monitor, 'triggerAlert').mockImplementation();

        monitor.trackPerformance(operation, duration);

        expect(triggerAlertSpy).toHaveBeenCalledWith('slow_operation', expect.objectContaining({
          operation,
          duration,
          threshold: 5000
        }));

        triggerAlertSpy.mockRestore();
      });
    });

    describe('trackSystemHealth', () => {
      test('should track system health metrics', () => {
        const healthMetrics = monitor.trackSystemHealth();

        expect(healthMetrics).toHaveProperty('memory');
        expect(healthMetrics).toHaveProperty('cpu');
        expect(healthMetrics).toHaveProperty('uptime');
        expect(healthMetrics).toHaveProperty('timestamp');

        expect(logger.debug).toHaveBeenCalledWith('System Health', healthMetrics);
      });

      test('should trigger alert for high memory usage', () => {
        // Mock process.memoryUsage to return high memory usage
        const originalMemoryUsage = process.memoryUsage;
        process.memoryUsage = jest.fn().mockReturnValue({
          heapUsed: 950 * 1024 * 1024, // 950MB
          heapTotal: 1000 * 1024 * 1024, // 1GB (95% usage)
          external: 10 * 1024 * 1024,
          rss: 1000 * 1024 * 1024
        });

        const triggerAlertSpy = jest.spyOn(monitor, 'triggerAlert').mockImplementation();

        monitor.trackSystemHealth();

        expect(triggerAlertSpy).toHaveBeenCalledWith('high_memory_usage', expect.objectContaining({
          usage: 0.95,
          threshold: 0.9
        }));

        triggerAlertSpy.mockRestore();
        process.memoryUsage = originalMemoryUsage;
      });
    });

    describe('getErrorStats', () => {
      test('should return error statistics', () => {
        const error1 = new ValidationError('Invalid input');
        const error2 = new InternalServerError('Server error');

        monitor.trackError(error1);
        monitor.trackError(error1);
        monitor.trackError(error2);

        const stats = monitor.getErrorStats();

        expect(stats.totalErrors).toBe(3);
        expect(stats.errorsByType).toHaveProperty('ValidationError:VALIDATION_ERROR', 2);
        expect(stats.errorsByType).toHaveProperty('InternalServerError:INTERNAL_SERVER_ERROR', 1);
        expect(stats.topErrors).toHaveLength(2);
        expect(stats.topErrors[0]).toEqual({
          errorKey: 'ValidationError:VALIDATION_ERROR',
          count: 2,
          rate: expect.any(Number)
        });
      });
    });

    describe('generateHealthReport', () => {
      test('should generate comprehensive health report', () => {
        const error = new ValidationError('Invalid input');
        monitor.trackError(error);

        const report = monitor.generateHealthReport();

        expect(report).toHaveProperty('timestamp');
        expect(report).toHaveProperty('service', 'jomobit-backend-api');
        expect(report).toHaveProperty('environment');
        expect(report).toHaveProperty('version');
        expect(report).toHaveProperty('uptime');
        expect(report).toHaveProperty('errors');
        expect(report).toHaveProperty('system');
        expect(report).toHaveProperty('alerts');

        expect(logger.info).toHaveBeenCalledWith('Health Report Generated', report);
      });
    });

    describe('triggerAlert', () => {
      test('should trigger alert and log it', () => {
        const alertType = 'high_error_rate';
        const data = { errorKey: 'TestError:TEST_CODE', rate: 15 };

        monitor.triggerAlert(alertType, data);

        expect(logger.warn).toHaveBeenCalledWith('Alert Triggered', expect.objectContaining({
          type: alertType,
          service: 'jomobit-backend-api',
          severity: 'warning',
          data
        }));
      });

      test('should respect cooldown period', () => {
        const alertType = 'high_error_rate';
        const data = { errorKey: 'TestError:TEST_CODE' };

        monitor.triggerAlert(alertType, data);
        monitor.triggerAlert(alertType, data); // Should be skipped due to cooldown

        expect(logger.warn).toHaveBeenCalledTimes(1);
      });

      test('should determine correct alert severity', () => {
        expect(monitor.getAlertSeverity('high_error_rate')).toBe('warning');
        expect(monitor.getAlertSeverity('critical_errors')).toBe('critical');
        expect(monitor.getAlertSeverity('slow_operation')).toBe('warning');
        expect(monitor.getAlertSeverity('unknown_alert')).toBe('info');
      });
    });

    describe('sendSlackAlert', () => {
      test('should send Slack alert when webhook URL is configured', async () => {
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
        
        const fetch = require('node-fetch');
        fetch.mockResolvedValue({ ok: true });

        const alert = {
          type: 'high_error_rate',
          service: 'jomobit-backend-api',
          environment: 'test',
          severity: 'warning',
          timestamp: new Date().toISOString(),
          data: { errorKey: 'TestError:TEST_CODE', rate: 15 }
        };

        await monitor.sendSlackAlert(alert);

        expect(fetch).toHaveBeenCalledWith(
          'https://hooks.slack.com/test',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('high_error_rate')
          })
        );
      });

      test('should handle Slack API errors', async () => {
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
        
        const fetch = require('node-fetch');
        fetch.mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request' });

        const alert = {
          type: 'test_alert',
          service: 'test',
          environment: 'test',
          severity: 'info',
          timestamp: new Date().toISOString(),
          data: {}
        };

        await expect(monitor.sendSlackAlert(alert)).rejects.toThrow('Slack API error: 400 Bad Request');
      });
    });
  });

  describe('Middleware Functions', () => {
    describe('monitoringMiddleware', () => {
      test('should track performance on response finish', () => {
        const trackPerformanceSpy = jest.spyOn(errorMonitor, 'trackPerformance');

        monitoringMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();

        // Simulate response finish
        const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
        finishCallback();

        expect(trackPerformanceSpy).toHaveBeenCalledWith(
          'GET /api/test',
          expect.any(Number),
          expect.objectContaining({
            statusCode: 200,
            userId: 'user123',
            correlationId: 'corr123'
          })
        );

        trackPerformanceSpy.mockRestore();
      });
    });

    describe('errorTrackingMiddleware', () => {
      test('should track error and pass it to next middleware', () => {
        const error = new ValidationError('Invalid input');
        const trackErrorSpy = jest.spyOn(errorMonitor, 'trackError');

        errorTrackingMiddleware(error, req, res, next);

        expect(trackErrorSpy).toHaveBeenCalledWith(error, expect.objectContaining({
          url: '/test',
          method: 'GET',
          userId: 'user123',
          correlationId: 'corr123',
          userAgent: 'test-agent',
          ip: '127.0.0.1'
        }));

        expect(next).toHaveBeenCalledWith(error);

        trackErrorSpy.mockRestore();
      });
    });
  });

  describe('Utility Functions', () => {
    test('should generate correct error key', () => {
      const error1 = new ValidationError('Test');
      const error2 = new AppError('Test', 500, null);

      expect(monitor.getErrorKey(error1)).toBe('ValidationError:VALIDATION_ERROR');
      expect(monitor.getErrorKey(error2)).toBe('AppError:NO_CODE');
    });

    test('should clean old data correctly', () => {
      const dataMap = new Map();
      dataMap.set(100, 5);
      dataMap.set(101, 3);
      dataMap.set(102, 7);

      monitor.cleanOldData(dataMap, 101);

      expect(dataMap.has(100)).toBe(false);
      expect(dataMap.has(101)).toBe(true);
      expect(dataMap.has(102)).toBe(true);
    });
  });
});