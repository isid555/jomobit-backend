const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { morganMiddleware, requestLogger } = require('./middleware/logging');
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
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    this.app.use(morganMiddleware);
    this.app.use(requestLogger);

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);
  }

  initializeRoutes() {
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
      await redisConnection.connect();
      
      logger.info('All database connections established');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async start() {
    try {
      // Connect to databases
      await this.connectDatabases();

      // Start the server
      this.server = this.app.listen(this.port, () => {
        logger.info(`Server running on port ${this.port}`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development'
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