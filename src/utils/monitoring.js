/**
 * Error monitoring and alerting system
 * Provides centralized error tracking, metrics collection, and alerting capabilities
 */

const logger = require('./logger');
const { isOperationalError } = require('./errors');

class ErrorMonitor {
  constructor() {
    this.errorCounts = new Map();
    this.errorRates = new Map();
    this.alertThresholds = {
      errorRate: parseInt(process.env.ERROR_RATE_THRESHOLD) || 10, // errors per minute
      criticalErrors: parseInt(process.env.CRITICAL_ERROR_THRESHOLD) || 5, // critical errors per minute
      responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 5000, // milliseconds
      memoryUsage: parseFloat(process.env.MEMORY_USAGE_THRESHOLD) || 0.9 // 90% of available memory
    };
    this.alertCooldown = new Map();
    this.cooldownPeriod = parseInt(process.env.ALERT_COOLDOWN_PERIOD) || 300000; // 5 minutes
    
    // Initialize monitoring intervals
    this.startMonitoring();
  }

  /**
   * Track an error occurrence
   */
  trackError(error, context = {}) {
    const errorKey = this.getErrorKey(error);
    const timestamp = Date.now();
    const minute = Math.floor(timestamp / 60000);

    // Update error counts
    if (!this.errorCounts.has(errorKey)) {
      this.errorCounts.set(errorKey, new Map());
    }
    
    const errorMinuteCounts = this.errorCounts.get(errorKey);
    errorMinuteCounts.set(minute, (errorMinuteCounts.get(minute) || 0) + 1);

    // Clean old data (keep last 60 minutes)
    this.cleanOldData(errorMinuteCounts, minute - 60);

    // Update error rates
    this.updateErrorRate(errorKey);

    // Check if alert should be triggered
    this.checkAlertThresholds(error, errorKey, context);

    // Log error metrics
    logger.info('Error Tracked', {
      errorKey,
      errorName: error.name,
      errorCode: error.code,
      isOperational: isOperationalError(error),
      currentRate: this.errorRates.get(errorKey) || 0,
      context
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(operation, duration, context = {}) {
    const performanceData = {
      operation,
      duration,
      timestamp: Date.now(),
      ...context
    };

    // Log performance metric
    logger.logPerformance(operation, duration, context);

    // Check for slow operations
    if (duration > this.alertThresholds.responseTime) {
      this.triggerAlert('slow_operation', {
        operation,
        duration,
        threshold: this.alertThresholds.responseTime,
        ...context
      });
    }
  }

  /**
   * Track system health metrics
   */
  trackSystemHealth() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const healthMetrics = {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        usage: memoryUsage.heapUsed / memoryUsage.heapTotal
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      timestamp: Date.now()
    };

    // Check memory usage threshold
    if (healthMetrics.memory.usage > this.alertThresholds.memoryUsage) {
      this.triggerAlert('high_memory_usage', {
        usage: healthMetrics.memory.usage,
        threshold: this.alertThresholds.memoryUsage,
        used: healthMetrics.memory.used,
        total: healthMetrics.memory.total
      });
    }

    logger.debug('System Health', healthMetrics);
    return healthMetrics;
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrors: 0,
      errorsByType: {},
      errorRates: {},
      topErrors: []
    };

    // Calculate total errors and errors by type
    for (const [errorKey, minuteCounts] of this.errorCounts.entries()) {
      let totalForError = 0;
      for (const count of minuteCounts.values()) {
        totalForError += count;
      }
      
      stats.totalErrors += totalForError;
      stats.errorsByType[errorKey] = totalForError;
      stats.errorRates[errorKey] = this.errorRates.get(errorKey) || 0;
    }

    // Get top errors
    stats.topErrors = Object.entries(stats.errorsByType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([errorKey, count]) => ({ errorKey, count, rate: stats.errorRates[errorKey] }));

    return stats;
  }

  /**
   * Generate health report
   */
  generateHealthReport() {
    const errorStats = this.getErrorStats();
    const systemHealth = this.trackSystemHealth();
    
    const report = {
      timestamp: new Date().toISOString(),
      service: 'jomobit-backend-api',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      errors: errorStats,
      system: systemHealth,
      alerts: {
        thresholds: this.alertThresholds,
        recentAlerts: this.getRecentAlerts()
      }
    };

    logger.info('Health Report Generated', report);
    return report;
  }

  /**
   * Private methods
   */
  getErrorKey(error) {
    return `${error.name}:${error.code || 'NO_CODE'}`;
  }

  updateErrorRate(errorKey) {
    const minuteCounts = this.errorCounts.get(errorKey);
    if (!minuteCounts) return;

    // Calculate errors in the last minute
    const currentMinute = Math.floor(Date.now() / 60000);
    const errorsLastMinute = minuteCounts.get(currentMinute) || 0;
    
    this.errorRates.set(errorKey, errorsLastMinute);
  }

  cleanOldData(dataMap, cutoffMinute) {
    for (const minute of dataMap.keys()) {
      if (minute < cutoffMinute) {
        dataMap.delete(minute);
      }
    }
  }

  checkAlertThresholds(error, errorKey, context) {
    const errorRate = this.errorRates.get(errorKey) || 0;
    const isCritical = !isOperationalError(error) || error.statusCode >= 500;

    // Check error rate threshold
    if (errorRate >= this.alertThresholds.errorRate) {
      this.triggerAlert('high_error_rate', {
        errorKey,
        errorName: error.name,
        rate: errorRate,
        threshold: this.alertThresholds.errorRate,
        context
      });
    }

    // Check critical error threshold
    if (isCritical && errorRate >= this.alertThresholds.criticalErrors) {
      this.triggerAlert('critical_errors', {
        errorKey,
        errorName: error.name,
        rate: errorRate,
        threshold: this.alertThresholds.criticalErrors,
        context
      });
    }
  }

  triggerAlert(alertType, data) {
    const alertKey = `${alertType}:${data.errorKey || data.operation || 'system'}`;
    const now = Date.now();

    // Check cooldown period
    if (this.alertCooldown.has(alertKey)) {
      const lastAlert = this.alertCooldown.get(alertKey);
      if (now - lastAlert < this.cooldownPeriod) {
        return; // Skip alert due to cooldown
      }
    }

    // Update cooldown
    this.alertCooldown.set(alertKey, now);

    const alert = {
      type: alertType,
      timestamp: new Date().toISOString(),
      service: 'jomobit-backend-api',
      environment: process.env.NODE_ENV || 'development',
      severity: this.getAlertSeverity(alertType),
      data
    };

    // Log alert
    logger.warn('Alert Triggered', alert);

    // Send to external monitoring services
    this.sendToExternalServices(alert);
  }

  getAlertSeverity(alertType) {
    const severityMap = {
      'high_error_rate': 'warning',
      'critical_errors': 'critical',
      'slow_operation': 'warning',
      'high_memory_usage': 'warning',
      'database_connection_error': 'critical',
      'external_service_error': 'warning'
    };

    return severityMap[alertType] || 'info';
  }

  async sendToExternalServices(alert) {
    // Send to Slack if configured
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await this.sendSlackAlert(alert);
      } catch (error) {
        logger.error('Failed to send Slack alert', { error: error.message, alert });
      }
    }

    // Send to other monitoring services (Datadog, New Relic, etc.)
    if (process.env.DATADOG_API_KEY) {
      try {
        await this.sendDatadogAlert(alert);
      } catch (error) {
        logger.error('Failed to send Datadog alert', { error: error.message, alert });
      }
    }
  }

  async sendSlackAlert(alert) {
    const fetch = require('node-fetch');
    
    const color = {
      'info': '#36a64f',
      'warning': '#ff9500',
      'critical': '#ff0000'
    }[alert.severity] || '#36a64f';

    const slackMessage = {
      text: `🚨 Alert: ${alert.type}`,
      attachments: [{
        color,
        title: `${alert.service} - ${alert.type}`,
        fields: [
          {
            title: 'Environment',
            value: alert.environment,
            short: true
          },
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Timestamp',
            value: alert.timestamp,
            short: false
          },
          {
            title: 'Details',
            value: JSON.stringify(alert.data, null, 2),
            short: false
          }
        ]
      }]
    };

    const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }
  }

  async sendDatadogAlert(alert) {
    // Placeholder for Datadog integration
    // Implementation would depend on specific Datadog API requirements
    logger.debug('Datadog alert would be sent here', alert);
  }

  getRecentAlerts(limit = 10) {
    // This would typically be stored in a database or cache
    // For now, return empty array as placeholder
    return [];
  }

  startMonitoring() {
    // System health monitoring every 30 seconds
    setInterval(() => {
      this.trackSystemHealth();
    }, 30000);

    // Clean up old error data every 5 minutes
    setInterval(() => {
      const cutoffMinute = Math.floor(Date.now() / 60000) - 60;
      for (const [errorKey, minuteCounts] of this.errorCounts.entries()) {
        this.cleanOldData(minuteCounts, cutoffMinute);
        if (minuteCounts.size === 0) {
          this.errorCounts.delete(errorKey);
          this.errorRates.delete(errorKey);
        }
      }
    }, 300000);

    // Generate health report every hour
    setInterval(() => {
      this.generateHealthReport();
    }, 3600000);
  }
}

// Create singleton instance
const errorMonitor = new ErrorMonitor();

// Middleware to integrate with Express
const monitoringMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Track request
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Track performance
    const operation = `${req.method} ${req.route?.path || req.path}`;
    errorMonitor.trackPerformance(operation, duration, {
      statusCode: res.statusCode,
      userId: req.user?.sub,
      correlationId: req.correlationId
    });
  });

  next();
};

// Error tracking middleware
const errorTrackingMiddleware = (err, req, res, next) => {
  // Track the error
  errorMonitor.trackError(err, {
    url: req.url,
    method: req.method,
    userId: req.user?.sub,
    correlationId: req.correlationId,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  next(err);
};

module.exports = {
  ErrorMonitor,
  errorMonitor,
  monitoringMiddleware,
  errorTrackingMiddleware
};