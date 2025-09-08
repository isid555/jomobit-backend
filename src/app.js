const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { morganMiddleware, requestLogger } = require('./middleware/logging');
const { sanitizeInput } = require('./middleware/validation');
const { 
  rateLimitConfigs, 
  hppProtection, 
  validateRequestSize, 
  securityHeaders, 
  correlationId,
  contentSecurityPolicy
} = require('./middleware/security');
const { setupSwagger } = require('./config/swagger');
const { getSecurityConfig, validateSecurityConfig } = require('./config/security');
const databaseConnection = require('./config/database');
const redisConnection = require('./config/redis');

class App {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeMiddlewares() {
    // Trust proxy for accurate IP addresses (must be first)
    this.app.set('trust proxy', 1);

    // Correlation ID for request tracking
    this.app.use(correlationId);

    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: false, // We'll handle this separately for API
      crossOriginEmbedderPolicy: false
    }));
    this.app.use(securityHeaders);
    this.app.use(contentSecurityPolicy);

    // Request size validation
    this.app.use(validateRequestSize('10mb'));

    // HTTP Parameter Pollution protection
    this.app.use(hppProtection);

    // CORS configuration with enhanced security
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }

        const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:4040').split(',');
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          // Log unauthorized CORS attempts for security monitoring
          logger.warn('CORS blocked request from unauthorized origin', {
            origin,
            allowedOrigins: allowedOrigins.length,
            userAgent: this.req?.get('User-Agent'),
            ip: this.req?.ip,
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
    }));

    // Enhanced rate limiting with different tiers
    this.app.use('/api/auth', rateLimitConfigs.auth);
    this.app.use('/api/admin', rateLimitConfigs.admin);
    this.app.use('/api/posters/generate', rateLimitConfigs.generation);
    this.app.use('/api/webhooks', rateLimitConfigs.webhook);
    this.app.use('/api/templates/admin', rateLimitConfigs.upload);
    this.app.use('/api/', rateLimitConfigs.general);

    // Raw body capture for webhook signature validation
    this.app.use('/api/webhooks', express.raw({ type: 'application/json' }), (req, res, next) => {
      req.rawBody = req.body;
      next();
    });

    // Body parsing middleware with size limits
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        // Store raw body for webhook signature validation
        if (req.url.startsWith('/api/webhooks')) {
          req.rawBody = buf.toString();
        }
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      parameterLimit: 100
    }));

    // Input sanitization and validation
    this.app.use(sanitizeInput());

    // Logging middleware
    this.app.use(morganMiddleware);
    this.app.use(requestLogger);
  }

  initializeRoutes() {
    // Setup Swagger documentation
    setupSwagger(this.app);

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Import routes
    const authRoutes = require('./routes/auth');
    const profileRoutes = require('./routes/profiles');
    const templateRoutes = require('./routes/templates');
    const posterRoutes = require('./routes/posters');
    const subscriptionRoutes = require('./routes/subscriptions');
    const webhookRoutes = require('./routes/webhooks');
    const adminRoutes = require('./routes/admin');

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/profiles', profileRoutes);
    this.app.use('/api/templates', templateRoutes);
    this.app.use('/api/posters', posterRoutes);
    this.app.use('/api/subscriptions', subscriptionRoutes);
    this.app.use('/api/webhooks', webhookRoutes);
    this.app.use('/api/admin', adminRoutes);

    // Default API endpoint
    this.app.use('/api', (req, res) => {
      res.status(200).json({
        message: 'Jomobit API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          auth: [
            'GET /api/auth/me',
            'POST /api/auth/login',
            'GET /api/auth/permissions',
            'GET /api/auth/profile',
            'GET /api/auth/admin/users',
            'POST /api/auth/admin/users/:userId/suspend',
            'POST /api/auth/admin/users/:userId/activate',
            'GET /api/auth/admin/stats'
          ],
          profiles: [
            'POST /api/profiles',
            'GET /api/profiles',
            'GET /api/profiles/search',
            'GET /api/profiles/:profileId',
            'PUT /api/profiles/:profileId',
            'POST /api/profiles/:profileId/deactivate',
            'POST /api/profiles/:profileId/activate',
            'GET /api/profiles/:profileId/generation-summary'
          ],
          templates: [
            'GET /api/templates',
            'GET /api/templates/search',
            'GET /api/templates/filters',
            'GET /api/templates/featured',
            'GET /api/templates/popular',
            'GET /api/templates/recent',
            'GET /api/templates/:templateId',
            'POST /api/templates/admin',
            'GET /api/templates/admin',
            'GET /api/templates/admin/stats'
          ],
          posters: [
            'POST /api/posters/generate',
            'GET /api/posters/history',
            'GET /api/posters/stats',
            'GET /api/posters/:jobId',
            'POST /api/posters/:jobId/cancel',
            'POST /api/posters/:jobId/retry',
            'GET /api/posters/:jobId/share',
            'GET /api/posters/:jobId/download'
          ],
          subscriptions: [
            'GET /api/subscriptions/current',
            'GET /api/subscriptions/history',
            'POST /api/subscriptions/upgrade',
            'POST /api/subscriptions/cancel',
            'GET /api/subscriptions/billing',
            'GET /api/subscriptions/plans',
            'GET /api/subscriptions/plans/:planId'
          ],
          webhooks: [
            'POST /api/webhooks/auth0',
            'POST /api/webhooks/razorpay',
            'POST /api/webhooks/ai/generation',
            'POST /api/webhooks/ai/openai',
            'POST /api/webhooks/ai/ideogram',
            'POST /api/webhooks/ai/gemini',
            'POST /api/webhooks/slack'
          ],
          admin: [
            'GET /api/admin/dashboard',
            'GET /api/admin/health',
            'GET /api/admin/config',
            'GET /api/admin/activity',
            'POST /api/admin/notify',
            'GET /api/admin/export/:type'
          ]
        }
      });
    });
  }

  initializeErrorHandling() {
    // 404 handler
    this.app.use(notFound);
    
    // Global error handler
    this.app.use(errorHandler);
  }

  async connectDatabases() {
    try {
      // Connect to MongoDB
      await databaseConnection.connect();
      
      // Connect to Redis
      // await redisConnection.connect();
      
      logger.info('All database connections established');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async start() {
    try {
      // Validate security configuration
      const securityErrors = validateSecurityConfig();
      if (securityErrors.length > 0) {
        logger.warn('Security configuration issues detected', {
          errors: securityErrors,
          timestamp: new Date().toISOString()
        });
      }

      // Connect to databases
      await this.connectDatabases();

      // Start the server
      this.server = this.app.listen(this.port, () => {
        logger.info(`Server running on port ${this.port}`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          securityConfigValid: securityErrors.length === 0
        });
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      // Close server
      if (this.server) {
        this.server.close(async () => {
          logger.info('HTTP server closed');
          
          try {
            // Close database connections
            await databaseConnection.disconnect();
            await redisConnection.disconnect();
            
            logger.info('All connections closed. Exiting process.');
            process.exit(0);
          } catch (error) {
            logger.error('Error during shutdown:', error);
            process.exit(1);
          }
        });
      }
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  getApp() {
    return this.app;
  }
}

module.exports = App;