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

  // At top of controller
  parseRawBodyIfNeeded(req) {
    // If req.body is Buffer (raw), parse
    if (Buffer.isBuffer(req.body)) {
      try {
        const str = req.body.toString('utf8');
        return JSON.parse(str);
      } catch (err) {
        logger.error('Failed to parse raw buffer body', { error: err.message, stack: err.stack });
        throw new Error('Invalid JSON payload');
      }
    }

    // If req.rawBody exists and is string, try parse
    if (typeof req.rawBody === 'string') {
      try {
        return JSON.parse(req.rawBody);
      } catch (err) {
        logger.error('Failed to parse req.rawBody string', { error: err.message, stack: err.stack });
        throw new Error('Invalid JSON payload');
      }
    }

    // If req.body is already object, return it
    if (req.body && typeof req.body === 'object') {
      return req.body;
    }

    // otherwise invalid payload
    throw new Error('Invalid or missing payload');
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
   * Verify Razorpay webhook signature using HMAC SHA256
   * @param {Object} req - Express request object
   * @param {string} secret - Webhook secret
   * @returns {boolean} True if signature is valid
   */
  verifyRazorpaySignature(req, secret) {
    if (!secret) {
      logger.warn('Razorpay webhook secret not configured');
      return false;
    }

    const signatureHeader = req.headers['x-razorpay-signature'];
    if (!signatureHeader) {
      logger.warn('Missing Razorpay webhook signature');
      return false;
    }

    // ✅ Use the raw body, not JSON.stringify(req.body)
    // const rawBody = req.rawBody || JSON.stringify(req.body);
    // Prefer raw buffer:
    let rawBuffer;
    if (Buffer.isBuffer(req.body)) {
      rawBuffer = req.body;
    } else if (req.rawBody && typeof req.rawBody === 'string') {
      rawBuffer = Buffer.from(req.rawBody, 'utf8');
    } else if (req.body && typeof req.body === 'object') {
      // last resort: this may not match Razorpay's bytes exactly — prefer raw
      rawBuffer = Buffer.from(JSON.stringify(req.body), 'utf8');
    } else {
      logger.warn('No raw payload available for signature verification');
      return false;
    }


    try {
      // const expectedSignature = crypto
      //   .createHmac('sha256', secret)
      //   .update(rawBody, 'utf8')
      //   .digest('hex');

      const expectedHex = crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
      const receivedHex = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;

      // if (expectedHex.length !== receivedHex.length) return false;

      // return (
      //     expectedHex.length !== receivedHex.length &&
      //     // crypto.timingSafeEqual(
      //     //   Buffer.from(expectedSignature, 'hex'),
      //     //   Buffer.from(signature, 'hex')
      //     // )
      //     crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(receivedHex, 'hex'))
      // );

      logger.info("expectedHex: ", expectedHex.length);
      logger.info("receivedHex: ", receivedHex.length);


      if (expectedHex.length !== receivedHex.length) return false;

      logger.info("length are same comparision is failing");

      return crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(receivedHex, 'hex'));

    } catch (error) {
      logger.error('Error verifying Razorpay webhook signature:', error);
      return false;
    }
  }

  /**
   * Record payment with idempotent creation
   * @param {Object} paymentEntity - Razorpay payment entity
   * @param {Object} subscription - Subscription document
   * @param {boolean} grantCredits - Whether to grant credits for this payment
   * @returns {Promise<Object>} Payment record
   */
  async recordPayment(paymentEntity, subscription, grantCredits = false) {
    const Payment = require('../models/Payment');
    const { CreditService } = require('../services/creditService');

    try {
      logger.info('Recording payment', {
        paymentId: paymentEntity.id,
        subscriptionId: subscription._id,
        userId: subscription.userId,
        amount: paymentEntity.amount / 100,
        currency: paymentEntity.currency,
        status: paymentEntity.status,
        grantCredits
      });

      // Early deduplication check - check if payment already exists and is processed
      const existingPayment = await Payment.findOne({
        razorpayPaymentId: paymentEntity.id
      });

      if (existingPayment) {
        if (existingPayment.processed) {
          logger.info('Payment deduplication: already processed, skipping all operations', {
            paymentId: existingPayment.razorpayPaymentId,
            userId: subscription.userId,
            subscriptionId: subscription._id,
            creditsGranted: existingPayment.creditsGranted,
            originalProcessedAt: existingPayment.processedAt,
            deduplicationDetected: true
          });
          return existingPayment;
        }

        logger.info('Payment exists but not processed, continuing with credit grant', {
          paymentId: existingPayment.razorpayPaymentId,
          userId: subscription.userId
        });
      }

      // Prepare payment data
      const paymentData = {
        razorpayPaymentId: paymentEntity.id,
        razorpayInvoiceId: paymentEntity.invoice_id,
        subscriptionId: subscription._id,
        userId: subscription.userId,
        amount: paymentEntity.amount / 100, // Convert from paise to rupees
        currency: paymentEntity.currency,
        status: paymentEntity.status,
        method: paymentEntity.method,
        capturedAt: paymentEntity.captured_at ? new Date(paymentEntity.captured_at * 1000) : null,
        errorCode: paymentEntity.error_code,
        errorDescription: paymentEntity.error_description,
        card: paymentEntity.card ? {
          last4: paymentEntity.card.last4,
          network: paymentEntity.card.network,
          type: paymentEntity.card.type,
          issuer: paymentEntity.card.issuer
        } : null,
        webhookData: paymentEntity,
        processed: false
      };

      // Create or get payment (idempotent) with error handling
      let payment;
      try {
        const result = await Payment.createOrGet(paymentData);
        payment = result.payment;

        if (!result.created) {
          logger.info('Payment already exists (race condition detected)', {
            paymentId: payment.razorpayPaymentId,
            existingProcessed: payment.processed
          });
        }
      } catch (error) {
        // Handle duplicate key error gracefully
        if (error.code === 11000) {
          logger.info('Duplicate payment detected during creation, fetching existing', {
            paymentId: paymentEntity.id
          });
          payment = await Payment.findOne({
            razorpayPaymentId: paymentEntity.id
          });

          if (!payment) {
            throw new Error('Payment not found after duplicate key error');
          }
        } else {
          throw error;
        }
      }

      // Check if payment was already processed (double-check after creation)
      if (payment.processed) {
        logger.info('Payment deduplication: already processed after fetch, skipping credit operations', {
          paymentId: payment.razorpayPaymentId,
          userId: subscription.userId,
          subscriptionId: subscription._id,
          creditsGranted: payment.creditsGranted,
          originalProcessedAt: payment.processedAt,
          deduplicationDetected: true
        });
        return payment;
      }

      // Grant credits if requested and payment is captured
      if (grantCredits && paymentEntity.status === 'captured') {
        await this.grantCreditsForSubscription(subscription, payment);
      }

      logger.info('Payment recorded successfully', {
        paymentId: payment.razorpayPaymentId,
        subscriptionId: subscription._id,
        userId: subscription.userId,
        amount: payment.amount,
        creditsGranted: grantCredits && paymentEntity.status === 'captured'
      });

      return payment;
    } catch (error) {
      logger.error('Error recording payment', {
        paymentId: paymentEntity.id,
        subscriptionId: subscription._id,
        userId: subscription.userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Grant credits for subscription payment (expires old credits and grants new ones)
   * @param {Object} subscription - Subscription document
   * @param {Object} payment - Payment document
   * @returns {Promise<void>}
   */
  async grantCreditsForSubscription(subscription, payment) {
    const { CreditService } = require('../services/creditService'); // ✅ Destructure

    const Plan = require('../models/Plan');

    try {
      const creditService = new CreditService();

      // Get plan details to determine credit amount
      const plan = await Plan.findById(subscription.planId);
      if (!plan) {
        throw new Error(`Plan not found: ${subscription.planId}`);
      }

      const creditAmount = plan.features?.credits?.monthly || plan.features?.credits?.amount || 0;

      if (creditAmount <= 0) {
        logger.warn('Plan has no credits to grant', {
          planId: plan._id,
          planName: plan.name,
          subscriptionId: subscription._id,
          userId: subscription.userId
        });
        return;
      }

      // Expire old subscription credits first
      const CreditWallet = require('../models/CreditWallet');
      const wallet = await CreditWallet.findByUserId(subscription.userId);

      if (wallet && wallet.subscriptionCredits > 0) {
        logger.info('Expiring old subscription credits before granting new ones', {
          userId: subscription.userId,
          subscriptionId: subscription._id,
          oldCredits: wallet.subscriptionCredits,
          oldExpiry: wallet.subscriptionCreditExpiry,
          source: 'subscription_renewal'
        });

        await creditService.expireSubscriptionCredits(new Date());
      }

      // Grant new subscription credits
      const expiryDate = subscription.currentPeriodEnd;

      logger.info('Granting subscription credits', {
        userId: subscription.userId,
        amount: creditAmount,
        expiryDate,
        subscriptionId: subscription._id,
        paymentId: payment.razorpayPaymentId,
        planId: subscription.planId,
        planName: plan.name,
        source: 'subscription_payment'
      });

      await creditService.grantSubscriptionCredits(
        subscription.userId,
        creditAmount,
        expiryDate,
        subscription._id.toString(),
        payment.razorpayPaymentId,
        {
          planId: subscription.planId,
          source: 'subscription_payment'
        }
      );

      // Update payment record
      payment.creditsGranted = creditAmount;
      payment.processed = true;
      payment.processedAt = new Date();
      await payment.save();

      logger.info('Credits granted successfully for subscription payment', {
        userId: subscription.userId,
        amount: creditAmount,
        expiryDate,
        paymentId: payment.razorpayPaymentId,
        subscriptionId: subscription._id,
        planName: plan.name,
        source: 'subscription_payment'
      });
    } catch (error) {
      logger.error('Error granting credits for subscription', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        paymentId: payment.razorpayPaymentId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Grant subscription credits WITHOUT payment (for immediate upgrades via subscription.updated)
   * Used when subscription.updated webhook arrives without payment entity
   * 
   * @param {Object} subscription - Subscription document (must be populated with planId)
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Result object
   */
  async grantSubscriptionCreditsWithoutPayment(subscription, metadata = {}) {
    const Plan = require('../models/Plan');
    const { CreditService } = require('../services/creditService');

    try {
      const creditService = new CreditService();

      // Get plan details
      const plan = await Plan.findById(subscription.planId);
      if (!plan) {
        throw new Error(`Plan not found: ${subscription.planId}`);
      }

      const creditAmount = plan.features?.credits?.monthly || plan.features?.credits?.amount || 0;

      if (creditAmount <= 0) {
        logger.warn('Plan has no credits to grant', {
          planId: plan._id,
          planName: plan.name,
          subscriptionId: subscription._id,
          userId: subscription.userId
        });
        return {
          success: true,
          creditsGranted: 0,
          oldCreditsExpired: 0,
          message: 'No credits to grant for this plan'
        };
      }

      // Use existing grantSubscriptionCredits with paymentId = null
      // The core function handles null paymentId gracefully:
      // - Skips payment deduplication check
      // - Skips payment record update
      // - Still expires old credits and grants new credits atomically
      const expiryDate = subscription.currentPeriodEnd;

      logger.info('Granting subscription credits without payment', {
        userId: subscription.userId,
        amount: creditAmount,
        expiryDate,
        subscriptionId: subscription._id,
        planId: subscription.planId,
        planName: plan.name,
        source: metadata.source || 'subscription_updated_immediate',
        changeType: metadata.changeType
      });

      const result = await creditService.grantSubscriptionCredits(
        subscription.userId,
        creditAmount,
        expiryDate,
        subscription._id.toString(),
        null, // paymentId = null (no payment for subscription.updated)
        {
          planId: subscription.planId,
          ...metadata
        }
      );

      logger.info('Credits granted successfully without payment', {
        userId: subscription.userId,
        amount: creditAmount,
        expiryDate,
        subscriptionId: subscription._id,
        planName: plan.name,
        oldCreditsExpired: result.oldCreditsExpired || 0,
        changeType: metadata.changeType
      });

      return {
        success: true,
        creditsGranted: creditAmount,
        oldCreditsExpired: result.oldCreditsExpired || 0,
        message: `${creditAmount} subscription credits granted successfully`
      };

    } catch (error) {
      logger.error('Error granting credits without payment', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle Razorpay webhook with comprehensive event routing
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // async handleRazorpayWebhook(req, res) {
  //   const startTime = Date.now();
  //   const WebhookEvent = require('../models/WebhookEvent');
  //   const Subscription = require('../models/Subscription');

  //   try {
  //     // Verify webhook signature
  //     const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  //     if (webhookSecret && !this.verifyRazorpaySignature(req, webhookSecret)) {
  //       logger.warn('Invalid Razorpay webhook signature', {
  //         headers: req.headers,
  //         ip: req.ip
  //       });
  //       return res.status(401).json({ error: 'Invalid signature' });
  //     }

  //     // logger.info("parsing raw body manually");
  //     // ✅ Parse the raw buffer manually now that signature is verified
  //     // req.body = JSON.parse(req.body.toString('utf8'));
  //     logger.info('parsing raw body safely');
  //     req.body = this.parseRawBodyIfNeeded(req);   // uses helper above

  //     const { event, payload, created_at } = req.body;
  //     const subscriptionEntity = payload?.subscription?.entity;
  //     const paymentEntity = payload?.payment?.entity;

  //     const razorpaySubscriptionId = subscriptionEntity?.id;
  //     const razorpayPaymentId = paymentEntity?.id;

  //     logger.info('Received Razorpay webhook', {
  //       event,
  //       razorpaySubscriptionId,
  //       razorpayPaymentId,
  //       timestamp: new Date().toISOString()
  //     });

  //     // Generate unique key for deduplication
  //     const uniqueKey = WebhookEvent.generateUniqueKey(
  //       event,
  //       razorpaySubscriptionId,
  //       razorpayPaymentId,
  //       created_at
  //     );

  //     // Check if webhook was already processed
  //     const existingWebhook = await WebhookEvent.isProcessed(uniqueKey);
  //     if (existingWebhook) {
  //       const processingTime = Date.now() - startTime;
  //       logger.info('Duplicate webhook detected, skipping processing', {
  //         uniqueKey,
  //         event,
  //         originalProcessedAt: existingWebhook.processedAt,
  //         processingTime: `${processingTime}ms`
  //       });
  //       return res.status(200).json({
  //         success: true,
  //         message: 'Webhook already processed',
  //         processingTime: `${processingTime}ms`
  //       });
  //     }

  //     // Record webhook event
  //     const requestMeta = {
  //       ip: req.ip,
  //       userAgent: req.headers['user-agent'],
  //       headers: {
  //         'x-razorpay-signature': req.headers['x-razorpay-signature'],
  //         'content-type': req.headers['content-type']
  //       }
  //     };

  //     const webhookEvent = await WebhookEvent.recordWebhook(
  //       {
  //         uniqueKey,
  //         event,
  //         razorpaySubscriptionId,
  //         razorpayPaymentId,
  //         rawBody: req.body
  //       },
  //       requestMeta
  //     );

  //     // Find subscription if available
  //     let subscription = null;
  //     if (razorpaySubscriptionId) {
  //       subscription = await Subscription.findOne({ razorpaySubscriptionId });
  //     }

  //     // Route to appropriate handler based on event type
  //     let result;
  //     try {
  //       switch (event) {
  //         case 'subscription.authenticated':
  //           result = await this.handleAuthenticated(payload, webhookEvent, subscription);
  //           break;

  //         case 'subscription.activated':
  //           result = await this.handleActivated(payload, webhookEvent, subscription);
  //           break;

  //         case 'subscription.charged':
  //           result = await this.handleCharged(payload, webhookEvent, subscription);
  //           break;

  //         case 'subscription.pending':
  //           result = await this.handlePending(payload, webhookEvent, subscription);
  //           break;

  //         case 'subscription.halted':
  //           result = await this.handleHalted(payload, webhookEvent, subscription);
  //           break;

  //         case 'subscription.completed':
  //           result = await this.handleCompleted(payload, webhookEvent, subscription);
  //           break;

  //         case 'subscription.cancelled':
  //           result = await this.handleCancelled(payload, webhookEvent, subscription);
  //           break;

  //         case 'payment.failed':
  //           result = await this.handlePaymentFailed(payload, webhookEvent, subscription);
  //           break;

  //         default:
  //           logger.warn('Unhandled Razorpay webhook event', { event });
  //           result = { success: true, message: 'Event received but not processed' };
  //       }

  //       // Mark webhook as processed
  //       if (subscription) {
  //         await WebhookEvent.markProcessed(uniqueKey, subscription._id, subscription.userId);
  //       } else {
  //         await WebhookEvent.markProcessed(uniqueKey, null, null);
  //       }

  //       const processingTime = Date.now() - startTime;
  //       logger.info('Webhook processed successfully', {
  //         event,
  //         uniqueKey,
  //         processingTime: `${processingTime}ms`
  //       });

  //       res.status(200).json({
  //         success: true,
  //         message: result.message || 'Webhook processed successfully',
  //         processingTime: `${processingTime}ms`
  //       });

  //     } catch (handlerError) {
  //       // Mark webhook as failed
  //       await WebhookEvent.markFailed(uniqueKey, {
  //         message: handlerError.message,
  //         stack: handlerError.stack,
  //         code: handlerError.code
  //       });

  //       throw handlerError;
  //     }

  //   } catch (error) {
  //     const processingTime = Date.now() - startTime;

  //     logger.error('Error processing Razorpay webhook', {
  //       event: req.body?.event,
  //       error: error.message,
  //       stack: error.stack,
  //       processingTime: `${processingTime}ms`
  //     });

  //     res.status(500).json({
  //       success: false,
  //       error: 'Internal server error',
  //       message: error.message,
  //       processingTime: `${processingTime}ms`
  //     });
  //   }
  // }

  // ============================================
  // 2. FIXED handleRazorpayWebhook (webhookController.js)
  // ============================================
  async handleRazorpayWebhook(req, res) {
    const startTime = Date.now();
    const WebhookEvent = require('../models/WebhookEvent');
    const Subscription = require('../models/Subscription');

    logger.info('🚀 [WEBHOOK-HANDLER] Starting handler', {
      url: req.url,
      method: req.method,
      signatureVerified: req.signatureVerified,
      hasRawBodyBuffer: !!req.rawBodyBuffer,
      timestamp: new Date().toISOString()
    });

    try {
      // ⚠️ REMOVE DUPLICATE VERIFICATION - Already verified in middleware
      // Just check if middleware verification passed
      if (!req.signatureVerified) {
        logger.error('❌ [WEBHOOK-HANDLER] Signature not verified by middleware', {
          url: req.url,
          ip: req.ip
        });
        return res.status(401).json({
          error: 'Signature verification required',
          code: 'NOT_VERIFIED'
        });
      }

      logger.info('✅ [WEBHOOK-HANDLER] Signature pre-verified by middleware');

      // Parse body if it's still a Buffer
      if (Buffer.isBuffer(req.body)) {
        logger.info('📦 [WEBHOOK-HANDLER] Parsing Buffer body', {
          bufferLength: req.body.length
        });
        try {
          req.body = JSON.parse(req.body.toString('utf8'));
          logger.info('✅ [WEBHOOK-HANDLER] Body parsed successfully', {
            event: req.body.event,
            hasPayload: !!req.body.payload
          });
        } catch (parseError) {
          logger.error('❌ [WEBHOOK-HANDLER] Failed to parse body', {
            error: parseError.message,
            bodyPreview: req.body.toString('utf8').substring(0, 200)
          });
          return res.status(400).json({
            error: 'Invalid JSON payload',
            code: 'INVALID_JSON'
          });
        }
      }

      const { event, payload, created_at } = req.body;
      const subscriptionEntity = payload?.subscription?.entity;
      const paymentEntity = payload?.payment?.entity;

      const razorpaySubscriptionId = subscriptionEntity?.id;
      const razorpayPaymentId = paymentEntity?.id;

      logger.info('📋 [WEBHOOK-HANDLER] Webhook details', {
        event,
        razorpaySubscriptionId,
        razorpayPaymentId,
        createdAt: created_at,
        hasSubscription: !!subscriptionEntity,
        hasPayment: !!paymentEntity
      });

      // Generate unique key for deduplication
      const uniqueKey = WebhookEvent.generateUniqueKey(
        event,
        razorpaySubscriptionId,
        razorpayPaymentId,
        created_at
      );

      logger.info('🔑 [WEBHOOK-HANDLER] Generated unique key', {
        uniqueKey,
        event
      });

      // Check if webhook was already processed
      const existingWebhook = await WebhookEvent.isProcessed(uniqueKey);
      if (existingWebhook) {
        const processingTime = Date.now() - startTime;
        logger.info('⏭️ [WEBHOOK-HANDLER] Duplicate webhook, skipping', {
          uniqueKey,
          event,
          originalProcessedAt: existingWebhook.processedAt,
          processingTime: `${processingTime}ms`
        });
        return res.status(200).json({
          success: true,
          message: 'Webhook already processed',
          processingTime: `${processingTime}ms`
        });
      }

      // Record webhook event
      const requestMeta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        headers: {
          'x-razorpay-signature': req.headers['x-razorpay-signature'],
          'content-type': req.headers['content-type']
        }
      };

      logger.info('💾 [WEBHOOK-HANDLER] Recording webhook event', {
        uniqueKey,
        event,
        hasRequestMeta: !!requestMeta
      });

      const webhookEvent = await WebhookEvent.recordWebhook(
        {
          uniqueKey,
          event,
          razorpaySubscriptionId,
          razorpayPaymentId,
          rawBody: req.body
        },
        requestMeta
      );

      logger.info('✅ [WEBHOOK-HANDLER] Webhook recorded', {
        webhookEventId: webhookEvent._id,
        uniqueKey
      });

      // Find subscription if available
      let subscription = null;
      if (razorpaySubscriptionId) {
        subscription = await Subscription.findOne({ razorpaySubscriptionId });
        logger.info('🔍 [WEBHOOK-HANDLER] Subscription lookup', {
          razorpaySubscriptionId,
          found: !!subscription,
          subscriptionId: subscription?._id
        });
      }

      // Route to appropriate handler based on event type
      let result;
      try {
        logger.info(`🎬 [WEBHOOK-HANDLER] Routing to ${event} handler`);

        switch (event) {
          case 'subscription.authenticated':
            result = await this.handleAuthenticated(payload, webhookEvent, subscription);
            break;

          case 'subscription.activated':
            result = await this.handleActivated(payload, webhookEvent, subscription);
            break;

          case 'subscription.charged':
            result = await this.handleCharged(payload, webhookEvent, subscription);
            break;

          case 'subscription.updated':
            result = await this.handleUpdated(payload, webhookEvent, subscription);
            break;

          case 'subscription.pending':
            result = await this.handlePending(payload, webhookEvent, subscription);
            break;

          case 'subscription.halted':
            result = await this.handleHalted(payload, webhookEvent, subscription);
            break;

          case 'subscription.completed':
            result = await this.handleCompleted(payload, webhookEvent, subscription);
            break;

          case 'subscription.cancelled':
            result = await this.handleCancelled(payload, webhookEvent, subscription);
            break;

          // case 'payment.failed':
          // result = await this.handlePaymentFailed(payload, webhookEvent, subscription);
          // break;

          default:
            logger.warn('⚠️ [WEBHOOK-HANDLER] Unhandled event type', { event });
            result = { success: true, message: 'Event received but not processed' };
        }

        logger.info('✅ [WEBHOOK-HANDLER] Event handler completed', {
          event,
          resultMessage: result.message
        });

        // Mark webhook as processed
        if (subscription) {
          await WebhookEvent.markProcessed(uniqueKey, subscription._id, subscription.userId);
          logger.info('✅ [WEBHOOK-HANDLER] Marked as processed with subscription', {
            uniqueKey,
            subscriptionId: subscription._id
          });
        } else {
          await WebhookEvent.markProcessed(uniqueKey, null, null);
          logger.info('✅ [WEBHOOK-HANDLER] Marked as processed without subscription', {
            uniqueKey
          });
        }

        const processingTime = Date.now() - startTime;
        logger.info('🎉 [WEBHOOK-HANDLER] Webhook processing complete', {
          event,
          uniqueKey,
          processingTime: `${processingTime}ms`,
          success: true
        });

        res.status(200).json({
          success: true,
          message: result.message || 'Webhook processed successfully',
          processingTime: `${processingTime}ms`
        });

      } catch (handlerError) {
        logger.error('❌ [WEBHOOK-HANDLER] Handler error', {
          event,
          error: handlerError.message,
          stack: handlerError.stack,
          uniqueKey
        });

        // Mark webhook as failed
        await WebhookEvent.markFailed(uniqueKey, {
          message: handlerError.message,
          stack: handlerError.stack,
          code: handlerError.code
        });

        throw handlerError;
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error('❌ [WEBHOOK-HANDLER] Fatal error', {
        event: req.body?.event,
        error: error.message,
        stack: error.stack,
        processingTime: `${processingTime}ms`
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
        processingTime: `${processingTime}ms`
      });
    }
  }

  /**
   * Handle subscription.authenticated event
   * First payment/authorization succeeded
   * @param {Object} payload - Webhook payload
   * @param {Object} webhookEvent - WebhookEvent document
   * @param {Object} subscription - Subscription document
   * @returns {Promise<Object>} Result object
   */
  async handleAuthenticated(payload, webhookEvent, subscription) {
    const Subscription = require('../models/Subscription');

    try {
      const subscriptionEntity = payload.subscription.entity;
      const paymentEntity = payload.payment?.entity;

      logger.info('Processing subscription.authenticated event', {
        razorpaySubscriptionId: subscriptionEntity.id,
        subscriptionId: subscription?._id,
        paymentId: paymentEntity?.id
      });

      if (!subscription) {
        throw new Error(`Subscription not found for Razorpay ID: ${subscriptionEntity.id}`);
      }

      // Ensure status is active
      if (subscription.status !== 'active') {
        subscription.status = 'authenticated';
      }

      // Update subscription status to 'authenticated'
      // subscription.status = 'authenticated';
      subscription.authAttempts = subscriptionEntity.auth_attempts || 0;
      subscription.startAt = subscriptionEntity.start_at ? new Date(subscriptionEntity.start_at * 1000) : null;
      subscription.chargeAt = subscriptionEntity.charge_at ? new Date(subscriptionEntity.charge_at * 1000) : null;

      await subscription.save();

      // Record payment without granting credits
      if (paymentEntity) {
        await this.recordPayment(paymentEntity, subscription, false);
      }

      logger.info('Subscription authenticated successfully', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        status: subscription.status,
        authAttempts: subscription.authAttempts
      });

      return {
        success: true,
        message: 'Subscription authenticated successfully',
        subscriptionId: subscription._id,
        userId: subscription.userId
      };
    } catch (error) {
      logger.error('Error handling subscription.authenticated event', {
        razorpaySubscriptionId: payload.subscription?.entity?.id,
        subscriptionId: subscription?._id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle subscription.activated event
   * Subscription became active
   * @param {Object} payload - Webhook payload
   * @param {Object} webhookEvent - WebhookEvent document
   * @param {Object} subscription - Subscription document
   * @returns {Promise<Object>} Result object
   */
  async handleActivated(payload, webhookEvent, subscription) {

    const Subscription = require('../models/Subscription');
    const Plan = require('../models/Plan');

    try {
      const subscriptionEntity = payload.subscription.entity;
      const paymentEntity = payload.payment?.entity;

      logger.info('Processing subscription.activated event', {
        razorpaySubscriptionId: subscriptionEntity.id,
        subscriptionId: subscription?._id,
        paymentId: paymentEntity?.id
      });

      // Create subscription if new, or update existing
      if (!subscription) {
        throw new Error(`Subscription not found for Razorpay ID: ${subscriptionEntity.id}`);

        // Find user by razorpaySubscriptionId
        // const User = require('../models/User');
        // const user = await User.findOne({ razorpaySubscriptionId: subscriptionEntity.id });

        // if (!user) {
        //   throw new Error(`User not found for Razorpay subscription ID: ${subscriptionEntity.id}`);
        // }

        // Find plan by razorpayPlanId
        // const plan = await Plan.findOne({ razorpayPlanId: subscriptionEntity.plan_id });

        // if (!plan) {
        //   throw new Error(`Plan not found for Razorpay plan ID: ${subscriptionEntity.plan_id}`);
        // }

        // Create new subscription
        // subscription = await Subscription.create({
        //   userId: user._id,
        //   planId: plan._id,
        //   razorpaySubscriptionId: subscriptionEntity.id,
        //   razorpayCustomerId: subscriptionEntity.customer_id,
        //   status: 'active',
        //   currentPeriodStart: new Date(subscriptionEntity.current_start * 1000),
        //   currentPeriodEnd: new Date(subscriptionEntity.current_end * 1000),
        //   billing: {
        //     amount: plan.pricing.amount,
        //     currency: plan.pricing.currency,
        //     interval: plan.pricing.interval,
        //     intervalCount: plan.pricing.intervalCount || 1
        //   },
        //   paidCount: subscriptionEntity.paid_count || 0,
        //   totalCount: subscriptionEntity.total_count || 0,
        //   remainingCount: subscriptionEntity.remaining_count || 0,
        //   chargeAt: subscriptionEntity.charge_at ? new Date(subscriptionEntity.charge_at * 1000) : null,
        //   startAt: subscriptionEntity.start_at ? new Date(subscriptionEntity.start_at * 1000) : null,
        //   endAt: subscriptionEntity.end_at ? new Date(subscriptionEntity.end_at * 1000) : null
        // });

        // logger.info('New subscription created from activated event', {
        //   subscriptionId: subscription._id,
        //   userId: subscription.userId,
        //   planId: subscription.planId
        // });
      } else {
        // Update existing subscription
        subscription.status = 'active';
        subscription.currentPeriodStart = new Date(subscriptionEntity.current_start * 1000);
        subscription.currentPeriodEnd = new Date(subscriptionEntity.current_end * 1000);
        subscription.paidCount = subscriptionEntity.paid_count || subscription.paidCount;
        subscription.remainingCount = subscriptionEntity.remaining_count || subscription.remainingCount;
        subscription.chargeAt = subscriptionEntity.charge_at ? new Date(subscriptionEntity.charge_at * 1000) : null;

        await subscription.save();

        logger.info('Subscription updated to active', {
          subscriptionId: subscription._id,
          userId: subscription.userId
        });
      }

      // Record payment and grant credits atomically
      if (paymentEntity) {
        await this.recordPayment(paymentEntity, subscription, true);
      }

      logger.info('Subscription activated successfully', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd
      });

      return {
        success: true,
        message: 'Subscription activated successfully',
        subscriptionId: subscription._id,
        userId: subscription.userId
      };
    } catch (error) {
      logger.error('Error handling subscription.activated event', {
        razorpaySubscriptionId: payload.subscription?.entity?.id,
        subscriptionId: subscription?._id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle subscription.charged event
   * Recurring payment succeeded
   * @param {Object} payload - Webhook payload
   * @param {Object} webhookEvent - WebhookEvent document
   * @param {Object} subscription - Subscription document
   * @returns {Promise<Object>} Result object
   */
  async handleCharged(payload, webhookEvent, subscription) {
    try {
      const subscriptionEntity = payload.subscription.entity;
      const paymentEntity = payload.payment?.entity;

      logger.info('Processing subscription.charged event', {
        razorpaySubscriptionId: subscriptionEntity.id,
        subscriptionId: subscription?._id,
        paymentId: paymentEntity?.id
      });

      if (!subscription) {
        throw new Error(`Subscription not found for Razorpay ID: ${subscriptionEntity.id}`);
      }

      // Update billing period
      subscription.currentPeriodStart = new Date(subscriptionEntity.current_start * 1000);
      subscription.currentPeriodEnd = new Date(subscriptionEntity.current_end * 1000);

      // Update payment tracking
      subscription.paidCount = subscriptionEntity.paid_count || subscription.paidCount;
      subscription.remainingCount = subscriptionEntity.remaining_count || subscription.remainingCount;
      subscription.chargeAt = subscriptionEntity.charge_at ? new Date(subscriptionEntity.charge_at * 1000) : null;

      // Ensure status is active
      if (subscription.status !== 'active') {
        subscription.status = 'active';
      }

      await subscription.save();

      // Record payment with deduplication check and grant credits
      // This will expire old credits and grant new credits atomically
      if (paymentEntity) {
        await this.recordPayment(paymentEntity, subscription, true);
      }

      logger.info('Subscription charged successfully', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        paidCount: subscription.paidCount,
        currentPeriodEnd: subscription.currentPeriodEnd
      });

      return {
        success: true,
        message: 'Subscription charged successfully',
        subscriptionId: subscription._id,
        userId: subscription.userId
      };
    } catch (error) {
      logger.error('Error handling subscription.charged event', {
        razorpaySubscriptionId: payload.subscription?.entity?.id,
        subscriptionId: subscription?._id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle subscription.updated event
   * Triggered when subscription is updated immediately (proration charge for upgrades)
   * Note: subscription.updated does NOT contain payment entity
   * 
   * @param {Object} payload - Webhook payload
   * @param {Object} webhookEvent - Webhook event record
   * @param {Object} subscription - Subscription document
   * @returns {Promise<Object>} Result object
   */
  async handleUpdated(payload, webhookEvent, subscription) {
    try {
      const subscriptionEntity = payload.subscription.entity;

      logger.info('Processing subscription.updated event', {
        razorpaySubscriptionId: subscriptionEntity.id,
        subscriptionId: subscription?._id,
        status: subscriptionEntity.status,
        planId: subscriptionEntity.plan_id,
        hasScheduledChanges: subscriptionEntity.has_scheduled_changes
      });

      if (!subscription) {
        throw new Error(`Subscription not found for Razorpay ID: ${subscriptionEntity.id}`);
      }

      // Update subscription details
      subscription.status = subscriptionEntity.status;
      subscription.currentPeriodStart = new Date(subscriptionEntity.current_start * 1000);
      subscription.currentPeriodEnd = new Date(subscriptionEntity.current_end * 1000);
      subscription.paidCount = subscriptionEntity.paid_count || subscription.paidCount;
      subscription.remainingCount = subscriptionEntity.remaining_count || subscription.remainingCount;
      subscription.totalCount = subscriptionEntity.total_count || subscription.totalCount;
      subscription.chargeAt = subscriptionEntity.charge_at ? new Date(subscriptionEntity.charge_at * 1000) : null;

      // Check if plan was changed (immediate upgrade)
      const Plan = require('../models/Plan');

      // Get current plan from DB (this is the OLD plan since controller didn't update it)
      const currentPlan = await Plan.findById(subscription.planId);
      if (!currentPlan) {
        logger.error('Current plan not found', {
          planId: subscription.planId,
          subscriptionId: subscription._id
        });
        throw new Error(`Current plan not found: ${subscription.planId}`);
      }

      const currentPlanRazorpayId = currentPlan.razorpayPlanId;
      const newPlanRazorpayId = subscriptionEntity.plan_id;

      // Check if plan changed by comparing DB plan with Razorpay plan
      if (currentPlanRazorpayId !== newPlanRazorpayId) {
        // Plan changed! This is an immediate upgrade confirmed by Razorpay
        logger.info('Plan change detected in subscription.updated', {
          subscriptionId: subscription._id,
          userId: subscription.userId,
          oldPlanRazorpayId: currentPlanRazorpayId,
          newPlanRazorpayId: newPlanRazorpayId,
          hasScheduledChanges: subscriptionEntity.has_scheduled_changes
        });

        // Find new plan in database
        const newPlan = await Plan.findOne({ razorpayPlanId: newPlanRazorpayId });

        if (!newPlan) {
          logger.error('New plan not found in database', {
            razorpayPlanId: newPlanRazorpayId,
            subscriptionId: subscription._id
          });
          throw new Error(`Plan not found for Razorpay plan ID: ${newPlanRazorpayId}`);
        }

        // Determine changeType using FULL business logic (same as controller)
        const currentAmount = currentPlan.pricing.amount;
        const newAmount = newPlan.pricing.amount;
        const currentInterval = currentPlan.pricing.interval;
        const newInterval = newPlan.pricing.interval;

        const intervalPriority = {
          'daily': 1,
          'weekly': 2,
          'monthly': 3,
          'yearly': 4
        };

        const currentIntervalPriority = intervalPriority[currentInterval] || 3;
        const newIntervalPriority = intervalPriority[newInterval] || 3;

        let changeType;
        let changeReason;

        // Rule 1: More money upfront = UPGRADE
        if (newAmount > currentAmount) {
          changeType = 'upgrade';
          changeReason = 'higher_price';
        }
        // Rule 2: Same price but longer commitment = UPGRADE
        else if (newAmount === currentAmount && newIntervalPriority > currentIntervalPriority) {
          changeType = 'upgrade';
          changeReason = 'longer_commitment';
        }
        // Rule 3: Less money upfront = DOWNGRADE
        else if (newAmount < currentAmount) {
          changeType = 'downgrade';
          changeReason = 'lower_price';
        }
        // Rule 4: Same price but shorter commitment = DOWNGRADE
        else if (newAmount === currentAmount && newIntervalPriority < currentIntervalPriority) {
          changeType = 'downgrade';
          changeReason = 'shorter_commitment';
        }
        // Rule 5: No change
        else {
          changeType = 'change';
          changeReason = 'no_price_change';
        }

        logger.info('Plan change confirmed by Razorpay', {
          subscriptionId: subscription._id,
          userId: subscription.userId,
          changeType,
          changeReason,
          oldPlanAmount: currentPlan.pricing.amount,
          oldPlanInterval: currentPlan.pricing.interval,
          newPlanAmount: newPlan.pricing.amount,
          newPlanInterval: newPlan.pricing.interval,
          oldPlanName: currentPlan.name,
          newPlanName: newPlan.name
        });

        // NOW update the DB (webhook is source of truth)
        subscription.planId = newPlan._id;
        subscription.billing = {
          amount: newPlan.pricing.amount,
          currency: newPlan.pricing.currency,
          interval: newPlan.pricing.interval,
          intervalCount: newPlan.pricing.intervalCount || 1
        };

        // Clear scheduledChange if it exists (plan change completed)
        if (subscription.scheduledChange) {
          logger.info('Clearing scheduledChange after plan change', {
            subscriptionId: subscription._id,
            userId: subscription.userId,
            scheduledChange: subscription.scheduledChange
          });
          subscription.scheduledChange = undefined;
        }

        await subscription.save();

        logger.info('Subscription plan updated in database', {
          subscriptionId: subscription._id,
          userId: subscription.userId,
          oldPlanId: currentPlan._id,
          oldPlanName: currentPlan.name,
          newPlanId: newPlan._id,
          newPlanName: newPlan.name,
          changeType
        });

        // Grant credits WITHOUT payment (subscription.updated has no payment entity)
        // This will expire old credits and grant new credits atomically
        try {
          const creditResult = await this.grantSubscriptionCreditsWithoutPayment(subscription, {
            source: 'subscription_updated_immediate',
            changeType: changeType,
            oldPlanId: currentPlan._id,
            oldPlanName: currentPlan.name,
            newPlanId: newPlan._id,
            newPlanName: newPlan.name,
            webhookEvent: 'subscription.updated'
          });

          logger.info('Credits granted for immediate plan change', {
            subscriptionId: subscription._id,
            userId: subscription.userId,
            changeType,
            creditsGranted: creditResult.creditsGranted,
            oldCreditsExpired: creditResult.oldCreditsExpired,
            oldPlanName: currentPlan.name,
            newPlanName: newPlan.name
          });
        } catch (creditError) {
          logger.error('Error granting credits for immediate plan change', {
            subscriptionId: subscription._id,
            userId: subscription.userId,
            changeType,
            error: creditError.message,
            stack: creditError.stack,
            note: 'Subscription updated but credits not granted - CRITICAL ERROR'
          });
          // Don't throw - subscription was updated successfully
          // But this is a critical error that needs investigation
        }

        return {
          success: true,
          message: 'Subscription updated with immediate plan change',
          subscriptionId: subscription._id,
          userId: subscription.userId,
          planChanged: true,
          changeType: changeType,
          oldPlan: currentPlan.name,
          newPlan: newPlan.name
        };
      }

      // No plan change - just a regular update (quantity, status, etc.)
      await subscription.save();

      logger.info('Subscription updated successfully (no plan change)', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        status: subscription.status
      });

      return {
        success: true,
        message: 'Subscription updated successfully',
        subscriptionId: subscription._id,
        userId: subscription.userId,
        planChanged: false
      };

    } catch (error) {
      logger.error('Error handling subscription.updated event', {
        razorpaySubscriptionId: payload.subscription?.entity?.id,
        subscriptionId: subscription?._id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle subscription.pending event
   * Payment failed, retries in progress
   * @param {Object} payload - Webhook payload
   * @param {Object} webhookEvent - WebhookEvent document
   * @param {Object} subscription - Subscription document
   * @returns {Promise<Object>} Result object
   */
  async handlePending(payload, webhookEvent, subscription) {
    try {
      const subscriptionEntity = payload.subscription.entity;

      logger.warn('Processing subscription.pending event - payment retry in progress', {
        razorpaySubscriptionId: subscriptionEntity.id,
        subscriptionId: subscription?._id,
        authAttempts: subscriptionEntity.auth_attempts
      });

      if (!subscription) {
        throw new Error(`Subscription not found for Razorpay ID: ${subscriptionEntity.id}`);
      }

      // Set status to 'pending'
      subscription.status = 'pending';

      // Increment authAttempts
      subscription.authAttempts = subscriptionEntity.auth_attempts || (subscription.authAttempts + 1);

      await subscription.save();

      // Do NOT expire credits - wait for halted or success
      logger.info('Subscription set to pending, awaiting payment retry', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        authAttempts: subscription.authAttempts,
        status: subscription.status
      });

      return {
        success: true,
        message: 'Subscription pending, awaiting payment retry',
        subscriptionId: subscription._id,
        userId: subscription.userId
      };
    } catch (error) {
      logger.error('Error handling subscription.pending event', {
        razorpaySubscriptionId: payload.subscription?.entity?.id,
        subscriptionId: subscription?._id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle subscription.halted event
   * All retry attempts exhausted
   * @param {Object} payload - Webhook payload
   * @param {Object} webhookEvent - WebhookEvent document
   * @param {Object} subscription - Subscription document
   * @returns {Promise<Object>} Result object
   */
  async handleHalted(payload, webhookEvent, subscription) {
    const { CreditService } = require('../services/creditService');

    try {
      const subscriptionEntity = payload.subscription.entity;

      logger.error('Processing subscription.halted event - all payment retries exhausted', {
        razorpaySubscriptionId: subscriptionEntity.id,
        subscriptionId: subscription?._id,
        userId: subscription?.userId,
        authAttempts: subscriptionEntity.auth_attempts,
        totalAttempts: subscriptionEntity.auth_attempts
      });

      if (!subscription) {
        throw new Error(`Subscription not found for Razorpay ID: ${subscriptionEntity.id}`);
      }

      // Set status to 'halted'
      subscription.status = 'halted';
      subscription.authAttempts = subscriptionEntity.auth_attempts || subscription.authAttempts;

      await subscription.save();

      // Expire credits immediately using creditService
      const creditService = new CreditService();
      const expiryResult = await creditService.expireSubscriptionCredits(new Date());

      logger.warn('Subscription halted, credits expired immediately', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        authAttempts: subscription.authAttempts,
        status: subscription.status,
        creditsExpired: expiryResult.totalExpired || 0,
        reason: 'payment_retries_exhausted'
      });

      return {
        success: true,
        message: 'Subscription halted, credits expired',
        subscriptionId: subscription._id,
        userId: subscription.userId
      };
    } catch (error) {
      logger.error('Error handling subscription.halted event', {
        razorpaySubscriptionId: payload.subscription?.entity?.id,
        subscriptionId: subscription?._id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle subscription.completed event
   * All billing cycles completed
   * @param {Object} payload - Webhook payload
   * @param {Object} webhookEvent - WebhookEvent document
   * @param {Object} subscription - Subscription document
   * @returns {Promise<Object>} Result object
   */
  async handleCompleted(payload, webhookEvent, subscription) {
    try {
      const subscriptionEntity = payload.subscription.entity;

      logger.info('Processing subscription.completed event', {
        razorpaySubscriptionId: subscriptionEntity.id,
        subscriptionId: subscription?._id
      });

      if (!subscription) {
        throw new Error(`Subscription not found for Razorpay ID: ${subscriptionEntity.id}`);
      }

      // Set status to 'completed'
      subscription.status = 'completed';

      // Set endedAt timestamp
      subscription.endedAt = subscriptionEntity.ended_at
        ? new Date(subscriptionEntity.ended_at * 1000)
        : new Date();

      await subscription.save();

      // Do NOT expire credits immediately - let them use until currentPeriodEnd
      logger.info('Subscription completed, credits valid until period end', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        status: subscription.status,
        endedAt: subscription.endedAt,
        currentPeriodEnd: subscription.currentPeriodEnd
      });

      return {
        success: true,
        message: 'Subscription completed, credits valid until period end',
        subscriptionId: subscription._id,
        userId: subscription.userId
      };
    } catch (error) {
      logger.error('Error handling subscription.completed event', {
        razorpaySubscriptionId: payload.subscription?.entity?.id,
        subscriptionId: subscription?._id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle subscription.cancelled event
   * Fires when subscription is cancelled at cycle end
   * @param {Object} payload - Webhook payload
   * @param {Object} webhookEvent - WebhookEvent document
   * @param {Object} subscription - Subscription document
   * @returns {Promise<Object>} Result object
   */
  async handleCancelled(payload, webhookEvent, subscription) {
    try {
      const subscriptionEntity = payload.subscription.entity;

      logger.info('Processing subscription.cancelled event', {
        razorpaySubscriptionId: subscriptionEntity.id,
        subscriptionId: subscription?._id,
        userId: subscription?.userId,
        event: 'subscription.cancelled'
      });

      if (!subscription) {
        throw new Error(`Subscription not found for Razorpay ID: ${subscriptionEntity.id}`);
      }

      // Set status to 'cancelled'
      subscription.status = 'cancelled';

      // Set endedAt timestamp
      subscription.endedAt = subscriptionEntity.ended_at
        ? new Date(subscriptionEntity.ended_at * 1000)
        : new Date();

      // Set cancelledAt if not already set
      if (!subscription.cancelledAt) {
        subscription.cancelledAt = new Date();
      }

      await subscription.save();

      logger.info('Subscription status updated to cancelled', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        status: subscription.status,
        endedAt: subscription.endedAt,
        cancelledAt: subscription.cancelledAt
      });

      // Expire subscription credits immediately and revoke access
      const { CreditService } = require('../services/creditService');
      const creditService = new CreditService();

      try {
        const creditResult = await creditService.expireUserSubscriptionCredits(
          subscription.userId,
          'subscription_cancelled',
          {
            subscriptionId: subscription._id.toString(),
            razorpaySubscriptionId: subscriptionEntity.id,
            cancelledAt: subscription.cancelledAt,
            source: 'webhook_subscription_cancelled'
          }
        );

        logger.info('Subscription credits expired and access revoked', {
          subscriptionId: subscription._id,
          userId: subscription.userId,
          creditsExpired: creditResult.creditsExpired,
          status: 'cancelled',
          accessRevoked: true,
          event: 'subscription.cancelled'
        });

        return {
          success: true,
          message: 'Subscription cancelled, credits expired, and access revoked',
          subscriptionId: subscription._id,
          userId: subscription.userId,
          creditsExpired: creditResult.creditsExpired,
          accessRevoked: true
        };

      } catch (creditError) {
        logger.error('Error expiring credits during cancellation', {
          subscriptionId: subscription._id,
          userId: subscription.userId,
          error: creditError.message,
          stack: creditError.stack,
          note: 'Subscription status updated but credit expiry failed'
        });

        // Don't throw - subscription is already cancelled
        // Return partial success
        return {
          success: true,
          message: 'Subscription cancelled but credit expiry failed',
          subscriptionId: subscription._id,
          userId: subscription.userId,
          creditsExpired: 0,
          accessRevoked: true,
          warning: 'Credit expiry failed, may need manual intervention'
        };
      }

    } catch (error) {
      logger.error('Error handling subscription.cancelled event', {
        razorpaySubscriptionId: payload.subscription?.entity?.id,
        subscriptionId: subscription?._id,
        userId: subscription?.userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle payment.failed event
   * Payment attempt failed
   * @param {Object} payload - Webhook payload
   * @param {Object} webhookEvent - WebhookEvent document
   * @param {Object} subscription - Subscription document
   * @returns {Promise<Object>} Result object
   */
  async handlePaymentFailed(payload, webhookEvent, subscription) {
    const Payment = require('../models/Payment');

    try {
      const paymentEntity = payload.payment.entity;

      logger.error('Processing payment.failed event', {
        razorpayPaymentId: paymentEntity.id,
        subscriptionId: subscription?._id,
        userId: subscription?.userId,
        amount: paymentEntity.amount / 100,
        currency: paymentEntity.currency,
        method: paymentEntity.method,
        errorCode: paymentEntity.error_code,
        errorDescription: paymentEntity.error_description,
        errorSource: paymentEntity.error_source,
        errorStep: paymentEntity.error_step,
        errorReason: paymentEntity.error_reason,
        retryCount: subscription?.authAttempts || 0
      });

      // Record failed payment with error details
      const paymentData = {
        razorpayPaymentId: paymentEntity.id,
        razorpayInvoiceId: paymentEntity.invoice_id,
        subscriptionId: subscription?._id,
        userId: subscription?.userId,
        amount: paymentEntity.amount / 100, // Convert from paise to rupees
        currency: paymentEntity.currency,
        status: 'failed',
        method: paymentEntity.method,
        errorCode: paymentEntity.error_code,
        errorDescription: paymentEntity.error_description,
        webhookData: paymentEntity,
        processed: true, // Mark as processed since we're recording the failure
        processedAt: new Date()
      };

      const { payment } = await Payment.createOrGet(paymentData);

      // Do not change subscription status - pending/halted handles that
      logger.warn('Failed payment recorded', {
        paymentId: payment.razorpayPaymentId,
        subscriptionId: subscription?._id,
        userId: subscription?.userId,
        amount: payment.amount,
        currency: payment.currency,
        failureReason: paymentEntity.error_description,
        errorCode: paymentEntity.error_code,
        retryCount: subscription?.authAttempts || 0,
        paymentMethod: paymentEntity.method
      });

      return {
        success: true,
        message: 'Failed payment recorded',
        paymentId: payment.razorpayPaymentId,
        subscriptionId: subscription?._id
      };
    } catch (error) {
      logger.error('Error handling payment.failed event', {
        razorpayPaymentId: payload.payment?.entity?.id,
        subscriptionId: subscription?._id,
        error: error.message,
        stack: error.stack
      });
      throw error;
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