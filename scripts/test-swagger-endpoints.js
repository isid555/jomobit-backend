#!/usr/bin/env node

/**
 * Comprehensive Swagger API Endpoint Testing Script
 * 
 * This script tests all documented API endpoints through the Swagger specification
 * to ensure they are properly documented and functional.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  maxRetries: 3,
  testToken: process.env.TEST_JWT_TOKEN || null,
  adminToken: process.env.ADMIN_JWT_TOKEN || null
};

// Test results tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

/**
 * Logger utility with colors and timestamps
 */
const logger = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${new Date().toISOString()} - ${msg}`),
  warning: (msg) => console.log(`\x1b[33m[WARNING]\x1b[0m ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${new Date().toISOString()} - ${msg}`),
  debug: (msg) => {
    if (process.env.DEBUG) {
      console.log(`\x1b[35m[DEBUG]\x1b[0m ${new Date().toISOString()} - ${msg}`);
    }
  }
};

/**
 * HTTP client with retry logic and proper error handling
 */
class ApiClient {
  constructor(baseUrl, timeout = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: timeout,
      validateStatus: () => true // Don't throw on HTTP errors
    });
  }

  async request(method, path, options = {}) {
    const config = {
      method,
      url: path,
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...options.headers
      },
      ...options
    };

    try {
      const response = await this.client.request(config);
      return {
        status: response.status,
        headers: response.headers,
        data: response.data,
        success: response.status >= 200 && response.status < 300
      };
    } catch (error) {
      return {
        status: 0,
        error: error.message,
        success: false
      };
    }
  }

  setAuthToken(token) {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }
}

/**
 * Test suite for different endpoint categories
 */
class SwaggerEndpointTester {
  constructor() {
    this.client = new ApiClient(CONFIG.baseUrl, CONFIG.timeout);
    this.swaggerSpec = null;
  }

  async initialize() {
    logger.info('Initializing Swagger endpoint tester...');
    
    // Try to fetch Swagger specification from running server
    try {
      const response = await this.client.request('GET', '/api-docs/swagger.json');
      if (response.success) {
        this.swaggerSpec = response.data;
        logger.success(`Loaded Swagger specification with ${Object.keys(this.swaggerSpec.paths || {}).length} paths`);
        return;
      }
    } catch (error) {
      logger.warning(`Could not fetch from running server: ${error.message}`);
    }
    
    // Fallback: Load specification directly from config file
    try {
      logger.info('Attempting to load Swagger spec directly from config...');
      const path = require('path');
      const configPath = path.join(__dirname, '..', 'src', 'config', 'swagger.js');
      
      // Clear require cache to get fresh config
      delete require.cache[require.resolve(configPath)];
      const { swaggerSpec } = require(configPath);
      
      this.swaggerSpec = swaggerSpec;
      logger.success(`Loaded Swagger specification directly from config with ${Object.keys(this.swaggerSpec.paths || {}).length} paths`);
    } catch (error) {
      logger.error(`Failed to initialize: ${error.message}`);
      process.exit(1);
    }
  }

  async testHealthEndpoints() {
    logger.info('Testing health and utility endpoints...');
    
    const healthTests = [
      { path: '/health', description: 'Health check endpoint' },
      { path: '/api-docs/status', description: 'API status endpoint' },
      { path: '/api-docs/test-utils', description: 'Test utilities page' }
    ];

    for (const test of healthTests) {
      await this.runSingleTest('GET', test.path, test.description, false);
    }
  }

  async testAuthenticationEndpoints() {
    logger.info('Testing authentication endpoints...');
    
    if (!CONFIG.testToken) {
      logger.warning('No test JWT token provided, skipping authenticated endpoint tests');
      return;
    }

    this.client.setAuthToken(CONFIG.testToken);

    const authTests = [
      { path: '/api/auth/profile', description: 'Get user profile' },
      { path: '/api/auth/validate', description: 'Validate token' }
    ];

    for (const test of authTests) {
      await this.runSingleTest('GET', test.path, test.description, true);
    }
  }

  async testProfileEndpoints() {
    logger.info('Testing profile management endpoints...');
    
    if (!CONFIG.testToken) {
      logger.warning('Skipping profile tests - no auth token');
      return;
    }

    this.client.setAuthToken(CONFIG.testToken);

    const profileTests = [
      { method: 'GET', path: '/api/profiles', description: 'List user profiles' },
      { method: 'GET', path: '/api/profiles/stats', description: 'Get profile statistics' }
    ];

    for (const test of profileTests) {
      await this.runSingleTest(test.method, test.path, test.description, true);
    }
  }

  async testTemplateEndpoints() {
    logger.info('Testing template endpoints...');
    
    if (!CONFIG.testToken) {
      logger.warning('Skipping template tests - no auth token');
      return;
    }

    this.client.setAuthToken(CONFIG.testToken);

    const templateTests = [
      { method: 'GET', path: '/api/templates', description: 'List templates' },
      { method: 'GET', path: '/api/templates/categories', description: 'Get template categories' },
      { method: 'GET', path: '/api/templates/featured', description: 'Get featured templates' }
    ];

    for (const test of templateTests) {
      await this.runSingleTest(test.method, test.path, test.description, true);
    }
  }

  async testPosterEndpoints() {
    logger.info('Testing poster generation endpoints...');
    
    if (!CONFIG.testToken) {
      logger.warning('Skipping poster tests - no auth token');
      return;
    }

    this.client.setAuthToken(CONFIG.testToken);

    const posterTests = [
      { method: 'GET', path: '/api/posters/history', description: 'Get poster history' },
      { method: 'GET', path: '/api/posters/stats', description: 'Get poster statistics' }
    ];

    for (const test of posterTests) {
      await this.runSingleTest(test.method, test.path, test.description, true);
    }
  }

  async testSubscriptionEndpoints() {
    logger.info('Testing subscription endpoints...');
    
    if (!CONFIG.testToken) {
      logger.warning('Skipping subscription tests - no auth token');
      return;
    }

    this.client.setAuthToken(CONFIG.testToken);

    const subscriptionTests = [
      { method: 'GET', path: '/api/subscriptions/current', description: 'Get current subscription' },
      { method: 'GET', path: '/api/subscriptions/plans', description: 'List available plans' },
      { method: 'GET', path: '/api/subscriptions/usage', description: 'Get usage statistics' }
    ];

    for (const test of subscriptionTests) {
      await this.runSingleTest(test.method, test.path, test.description, true);
    }
  }

  async testAdminEndpoints() {
    logger.info('Testing admin endpoints...');
    
    if (!CONFIG.adminToken) {
      logger.warning('Skipping admin tests - no admin token provided');
      return;
    }

    this.client.setAuthToken(CONFIG.adminToken);

    const adminTests = [
      { method: 'GET', path: '/api/admin/dashboard', description: 'Get admin dashboard' },
      { method: 'GET', path: '/api/admin/users', description: 'List users (admin)' },
      { method: 'GET', path: '/api/admin/analytics', description: 'Get platform analytics' }
    ];

    for (const test of adminTests) {
      await this.runSingleTest(test.method, test.path, test.description, true);
    }
  }

  async runSingleTest(method, path, description, requiresAuth = false) {
    testResults.total++;
    
    try {
      logger.debug(`Testing ${method} ${path} - ${description}`);
      
      const startTime = Date.now();
      const response = await this.client.request(method, path);
      const duration = Date.now() - startTime;

      // Determine if test passed based on response
      let passed = false;
      let message = '';

      if (response.success) {
        passed = true;
        message = `✅ ${method} ${path} - ${response.status} (${duration}ms)`;
        testResults.passed++;
      } else if (response.status === 401 && requiresAuth) {
        // Expected for endpoints requiring auth when no token provided
        passed = true;
        message = `⚠️  ${method} ${path} - 401 Unauthorized (expected without valid token)`;
        testResults.passed++;
      } else if (response.status === 404) {
        message = `❌ ${method} ${path} - 404 Not Found (endpoint may not be implemented)`;
        testResults.failed++;
        testResults.errors.push({ path, method, status: 404, description });
      } else {
        message = `❌ ${method} ${path} - ${response.status} ${response.error || ''}`;
        testResults.failed++;
        testResults.errors.push({ path, method, status: response.status, error: response.error, description });
      }

      if (passed) {
        logger.success(message);
      } else {
        logger.error(message);
      }

      // Log response details in debug mode
      if (process.env.DEBUG && response.data) {
        logger.debug(`Response data: ${JSON.stringify(response.data, null, 2)}`);
      }

    } catch (error) {
      testResults.total++;
      testResults.failed++;
      testResults.errors.push({ path, method, error: error.message, description });
      logger.error(`❌ ${method} ${path} - Exception: ${error.message}`);
    }
  }

  async validateSwaggerSpec() {
    logger.info('Validating Swagger specification...');
    
    if (!this.swaggerSpec) {
      logger.error('No Swagger specification loaded');
      return;
    }

    // Check required fields
    const requiredFields = ['openapi', 'info', 'paths'];
    for (const field of requiredFields) {
      if (!this.swaggerSpec[field]) {
        logger.error(`Missing required field: ${field}`);
        testResults.errors.push({ error: `Missing required field: ${field}` });
      }
    }

    // Check paths
    const paths = Object.keys(this.swaggerSpec.paths || {});
    logger.info(`Found ${paths.length} documented paths`);

    // Check for common issues
    let issuesFound = 0;
    for (const [path, pathObj] of Object.entries(this.swaggerSpec.paths || {})) {
      for (const [method, operation] of Object.entries(pathObj)) {
        if (!operation.summary) {
          logger.warning(`Missing summary for ${method.toUpperCase()} ${path}`);
          issuesFound++;
        }
        if (!operation.responses) {
          logger.warning(`Missing responses for ${method.toUpperCase()} ${path}`);
          issuesFound++;
        }
      }
    }

    if (issuesFound === 0) {
      logger.success('Swagger specification validation passed');
    } else {
      logger.warning(`Found ${issuesFound} documentation issues`);
    }
  }

  generateReport() {
    logger.info('Generating test report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: testResults.total,
        passed: testResults.passed,
        failed: testResults.failed,
        skipped: testResults.skipped,
        successRate: testResults.total > 0 ? ((testResults.passed / testResults.total) * 100).toFixed(2) : 0
      },
      errors: testResults.errors,
      configuration: {
        baseUrl: CONFIG.baseUrl,
        hasTestToken: !!CONFIG.testToken,
        hasAdminToken: !!CONFIG.adminToken
      }
    };

    // Write report to file
    const reportPath = path.join(__dirname, '..', 'swagger-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Console summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SWAGGER API TESTING REPORT');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⏭️  Skipped: ${report.summary.skipped}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}%`);
    console.log(`📄 Full report saved to: ${reportPath}`);
    
    if (testResults.errors.length > 0) {
      console.log('\n🔍 ERRORS SUMMARY:');
      testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.method || 'N/A'} ${error.path || 'N/A'} - ${error.error || error.status || 'Unknown error'}`);
      });
    }
    
    console.log('='.repeat(60));
    
    return report;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🧪 Starting Swagger API Endpoint Testing');
  console.log(`🌐 Base URL: ${CONFIG.baseUrl}`);
  console.log(`🔑 Test Token: ${CONFIG.testToken ? 'Provided' : 'Not provided'}`);
  console.log(`👑 Admin Token: ${CONFIG.adminToken ? 'Provided' : 'Not provided'}`);
  console.log('');

  const tester = new SwaggerEndpointTester();
  
  try {
    await tester.initialize();
    await tester.validateSwaggerSpec();
    
    // Run all test suites
    await tester.testHealthEndpoints();
    await tester.testAuthenticationEndpoints();
    await tester.testProfileEndpoints();
    await tester.testTemplateEndpoints();
    await tester.testPosterEndpoints();
    await tester.testSubscriptionEndpoints();
    await tester.testAdminEndpoints();
    
    // Generate final report
    const report = tester.generateReport();
    
    // Exit with appropriate code
    process.exit(report.summary.failed > 0 ? 1 : 0);
    
  } catch (error) {
    logger.error(`Test execution failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection at ${promise}: ${reason}`);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { SwaggerEndpointTester, CONFIG };