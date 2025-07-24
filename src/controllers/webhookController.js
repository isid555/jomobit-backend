const crypto = require('crypto');
const User = require('../models/User');
const SubscriptionService = require('../services/subscriptionService');
const { GenerationService } = require('../services/generationService');
const logger = require('../utils/logger');

/**
 * Webhook Controller
 * Handles webhooks from Auth0 and other third-party services
 */
class WebhookController {
  constructor() {
    this.subscriptionService = new SubscriptionService();
    this.generationService = new GenerationService();
  }
  /**
   * Verify Auth0 webhook signature
   * @param {Object} req - Express request object
   * @param {string} secret - Webhook secret
   * @returns {boolean} True if signature is valid
   */
  verifyAuth0Signature(req, secret) {
    if (!secret) {
      logger.warn('Auth0 webhook secret not configured');
      return false;
    }

    const signature = req.headers['x-auth0-signature'];
    if (!signature) {
      logger.warn('Missing Auth0 webhook signature');
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying Auth0 webhook signature:', error);
      return false;
    }
  }

  /**
   * Handle Auth0 user registration webhook
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleAuth0UserRegistration(req, res) {
    try {
      const { user } = req.body;
      
      if (!user || !user.user_id) {
        logger.warn('Invalid Auth0 user registration webhook payload', { body: req.body });
        return res.status(400).json({ error: 'Invalid payload' });
      }

      logger.info('Processing Auth0 user registration webhook', {
        userId: user.user_id,
        email: user.email,
        emailVerified: user.email_verified
      });

      // Create or update user in database
      const dbUser = await User.createOrUpdateFromAuth0(user);

      // If this is a new user registration, grant default credits
      if (dbUser.isNew || !dbUser.lastLoginAt) {
        // TODO: Grant default credits (will be implemented in credit management task)
        logger.info('New user registered, default credits will be granted', {
          userId: dbUser.auth0Id,
          email: dbUser.email
        });
      }

      logger.info('Auth0 user registration processed successfully', {
        userId: dbUser.auth0Id,
        email: dbUser.email,
        status: dbUser.status
      });

      res.status(200).json({ 
        message: 'User registration processed successfully',
        userId: dbUser._id
      });

    } catch (error) {
      logger.error('Error processing Auth0 user registration webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Auth0 user login webhook
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleAuth0UserLogin(req, res) {
    try {
      const { user } = req.body;
      
      if (!user || !user.user_id) {
        logger.warn('Invalid Auth0 user login webhook payload', { body: req.body });
        return res.status(400).json({ error: 'Invalid payload' });
      }

      logger.info('Processing Auth0 user login webhook', {
        userId: user.user_id,
        email: user.email
      });

      // Update user information and last login
      const dbUser = await User.createOrUpdateFromAuth0({
        ...user,
        last_login: new Date().toISOString()
      });

      logger.info('Auth0 user login processed successfully', {
        userId: dbUser.auth0Id,
        email: dbUser.email,
        lastLoginAt: dbUser.lastLoginAt
      });

      res.status(200).json({ 
        message: 'User login processed successfully',
        userId: dbUser._id
      });

    } catch (error) {
      logger.error('Error processing Auth0 user login webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Auth0 user update webhook
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleAuth0UserUpdate(req, res) {
    try {
      const { user } = req.body;
      
      if (!user || !user.user_id) {
        logger.warn('Invalid Auth0 user update webhook payload', { body: req.body });
        return res.status(400).json({ error: 'Invalid payload' });
      }

      logger.info('Processing Auth0 user update webhook', {
        userId: user.user_id,
        email: user.email,
        emailVerified: user.email_verified
      });

      // Update user information
      const dbUser = await User.createOrUpdateFromAuth0(user);

      logger.info('Auth0 user update processed successfully', {
        userId: dbUser.auth0Id,
        email: dbUser.email,
        status: dbUser.status,
        emailVerified: dbUser.emailVerified
      });

      res.status(200).json({ 
        message: 'User update processed successfully',
        userId: dbUser._id
      });

    } catch (error) {
      logger.error('Error processing Auth0 user update webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Auth0 user deletion webhook
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleAuth0UserDeletion(req, res) {
    try {
      const { user } = req.body;
      
      if (!user || !user.user_id) {
        logger.warn('Invalid Auth0 user deletion webhook payload', { body: req.body });
        return res.status(400).json({ error: 'Invalid payload' });
      }

      logger.info('Processing Auth0 user deletion webhook', {
        userId: user.user_id
      });

      // Find and suspend user instead of deleting (for data integrity)
      const dbUser = await User.findByAuth0Id(user.user_id);
      if (dbUser) {
        await dbUser.suspend();
        logger.info('User suspended due to Auth0 deletion', {
          userId: dbUser.auth0Id,
          email: dbUser.email
        });
      } else {
        logger.warn('User not found for deletion webhook', {
          userId: user.user_id
        });
      }

      res.status(200).json({ 
        message: 'User deletion processed successfully'
      });

    } catch (error) {
      logger.error('Error processing Auth0 user deletion webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Generic Auth0 webhook handler with signature verification
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleAuth0Webhook(req, res) {
    try {
      // Verify webhook signature
      const webhookSecret = process.env.AUTH0_WEBHOOK_SECRET;
      if (webhookSecret && !this.verifyAuth0Signature(req, webhookSecret)) {
        logger.warn('Invalid Auth0 webhook signature', {
          headers: req.headers,
          ip: req.ip
        });
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const { event, user } = req.body;
      
      logger.info('Received Auth0 webhook', {
        event,
        userId: user?.user_id,
        timestamp: new Date().toISOString()
      });

      // Route to appropriate handler based on event type
      switch (event) {
        case 'user_registration':
        case 'post_user_registration':
          return await this.handleAuth0UserRegistration(req, res);
          
        case 'user_login':
        case 'post_login':
          return await this.handleAuth0UserLogin(req, res);
          
        case 'user_update':
        case 'post_user_update':
          return await this.handleAuth0UserUpdate(req, res);
          
        case 'user_deletion':
        case 'post_user_deletion':
          return await this.handleAuth0UserDeletion(req, res);
          
        default:
          logger.warn('Unhandled Auth0 webhook event', { event });
          return res.status(200).json({ 
            message: 'Event received but not processed',
            event 
          });
      }

    } catch (error) {
      logger.error('Error processing Auth0 webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Verify Razorpay webhook signature
   * @param {Object} req - Express request object
   * @param {string} secret - Webhook secret
   * @returns {boolean} True if signature is valid
   */
  verifyRazorpaySignature(req, secret) {
    if (!secret) {
      logger.warn('Razorpay webhook secret not configured');
      return false;
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      logger.warn('Missing Razorpay webhook signature');
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying Razorpay webhook signature:', error);
      return false;
    }
  }

  /**
   * Handle Razorpay webhook
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleRazorpayWebhook(req, res) {
    try {
      // Verify webhook signature
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (webhookSecret && !this.verifyRazorpaySignature(req, webhookSecret)) {
        logger.warn('Invalid Razorpay webhook signature', {
          headers: req.headers,
          ip: req.ip
        });
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const { event, payload } = req.body;
      
      logger.info('Received Razorpay webhook', {
        event,
        subscriptionId: payload?.subscription?.entity?.id,
        paymentId: payload?.payment?.entity?.id,
        timestamp: new Date().toISOString()
      });

      let result;

      switch (event) {
        case 'subscription.activated':
        case 'subscription.charged':
          result = await this.subscriptionService.createSubscription(payload);
          break;

        case 'subscription.completed':
        case 'payment.captured':
          result = await this.subscriptionService.processSubscriptionRenewal(payload);
          break;

        case 'payment.failed':
          result = await this.subscriptionService.processFailedPayment(payload);
          break;

        case 'subscription.cancelled':
        case 'subscription.halted':
          logger.info('Subscription cancelled via Razorpay', {
            subscriptionId: payload?.subscription?.entity?.id
          });
          result = { success: true, message: 'Subscription cancellation noted' };
          break;

        default:
          logger.warn('Unhandled Razorpay webhook event', { event });
          result = { success: true, message: 'Event received but not processed' };
      }

      res.json(result);

    } catch (error) {
      if (error.name === 'SubscriptionError' || error.name === 'PaymentError') {
        logger.error('Razorpay webhook processing error:', {
          error: error.message,
          code: error.code,
          details: error.details
        });
        
        return res.status(400).json({
          success: false,
          error: error.code,
          message: error.message
        });
      }

      logger.error('Error processing Razorpay webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle AI generation webhook (OpenAI, Ideogram, etc.)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleAIGenerationWebhook(req, res) {
    try {
      const webhookData = req.body;
      const { externalJobId, status, result, error } = webhookData;

      logger.info('Received AI generation webhook', {
        externalJobId,
        status,
        hasResult: !!result,
        hasError: !!error,
        provider: req.headers['x-provider'] || 'unknown'
      });

      const processingResult = await this.generationService.processGenerationWebhook(webhookData);

      res.json({
        success: processingResult.success,
        message: processingResult.message,
        jobId: processingResult.jobId
      });

    } catch (error) {
      if (error.name === 'GenerationError') {
        logger.error('AI generation webhook processing error:', {
          error: error.message,
          code: error.code,
          details: error.details
        });
        
        return res.status(400).json({
          success: false,
          error: error.code,
          message: error.message
        });
      }

      logger.error('Error processing AI generation webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle OpenAI webhook specifically
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleOpenAIWebhook(req, res) {
    try {
      // Add OpenAI-specific processing if needed
      req.headers['x-provider'] = 'openai';
      return await this.handleAIGenerationWebhook(req, res);
    } catch (error) {
      logger.error('Error processing OpenAI webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Ideogram webhook specifically
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleIdeogramWebhook(req, res) {
    try {
      // Add Ideogram-specific processing if needed
      req.headers['x-provider'] = 'ideogram';
      return await this.handleAIGenerationWebhook(req, res);
    } catch (error) {
      logger.error('Error processing Ideogram webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Gemini webhook specifically
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleGeminiWebhook(req, res) {
    try {
      // Add Gemini-specific processing if needed
      req.headers['x-provider'] = 'gemini';
      return await this.handleAIGenerationWebhook(req, res);
    } catch (error) {
      logger.error('Error processing Gemini webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Slack webhook for notifications
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleSlackWebhook(req, res) {
    try {
      const { challenge, event } = req.body;

      // Handle Slack URL verification challenge
      if (challenge) {
        logger.info('Slack webhook challenge received');
        return res.json({ challenge });
      }

      // Handle Slack events
      if (event) {
        logger.info('Slack event received', {
          type: event.type,
          user: event.user,
          channel: event.channel
        });

        // Process Slack events as needed
        // This could include handling admin commands, notifications, etc.
        
        res.json({ success: true, message: 'Slack event processed' });
      } else {
        res.json({ success: true, message: 'Slack webhook received' });
      }

    } catch (error) {
      logger.error('Error processing Slack webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new WebhookController();