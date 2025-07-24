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
    const webhookRoutes = require('./routes/webhooks');

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/webhooks', webhookRoutes);

    // Default API endpoint
    this.app.use('/api', (req, res) => {
      res.status(200).json({
        message: 'Jomobit API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: [
          'GET /api/auth/me',
          'POST /api/auth/login',
          'GET /api/auth/permissions',
          'GET /api/auth/admin/users',
          'POST /api/webhooks/auth0'
        ]
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