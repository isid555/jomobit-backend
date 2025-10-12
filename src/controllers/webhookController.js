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
   * Record payment with idempotent creation
   * @param {Object} paymentEntity - Razorpay payment entity
   * @param {Object} subscription - Subscription document
   * @param {boolean} grantCredits - Whether to grant credits for this payment
   * @returns {Promise<Object>} Payment record
   */
  async recordPayment(paymentEntity, subscription, grantCredits = false) {
    const Payment = require('../models/Payment');
    const CreditService = require('../services/creditService');

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

      // Create or get payment (idempotent)
      const payment = await Payment.createOrGet(paymentData);

      // Check if payment was already processed
      if (payment.processed) {
        logger.info('Payment deduplication: already processed, skipping credit operations', {
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
    const CreditService = require('../services/creditService');
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
        {
          paymentId: payment.razorpayPaymentId,
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
   * Handle Razorpay webhook with comprehensive event routing
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleRazorpayWebhook(req, res) {
    const startTime = Date.now();
    const WebhookEvent = require('../models/WebhookEvent');
    const Subscription = require('../models/Subscription');

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

      const { event, payload, created_at } = req.body;
      const subscriptionEntity = payload?.subscription?.entity;
      const paymentEntity = payload?.payment?.entity;

      const razorpaySubscriptionId = subscriptionEntity?.id;
      const razorpayPaymentId = paymentEntity?.id;

      logger.info('Received Razorpay webhook', {
        event,
        razorpaySubscriptionId,
        razorpayPaymentId,
        timestamp: new Date().toISOString()
      });

      // Generate unique key for deduplication
      const uniqueKey = WebhookEvent.generateUniqueKey(
        event,
        razorpaySubscriptionId,
        razorpayPaymentId,
        created_at
      );

      // Check if webhook was already processed
      const existingWebhook = await WebhookEvent.isProcessed(uniqueKey);
      if (existingWebhook) {
        const processingTime = Date.now() - startTime;
        logger.info('Duplicate webhook detected, skipping processing', {
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

      // Find subscription if available
      let subscription = null;
      if (razorpaySubscriptionId) {
        subscription = await Subscription.findOne({ razorpaySubscriptionId });
      }

      // Route to appropriate handler based on event type
      let result;
      try {
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

          case 'payment.failed':
            result = await this.handlePaymentFailed(payload, webhookEvent, subscription);
            break;

          default:
            logger.warn('Unhandled Razorpay webhook event', { event });
            result = { success: true, message: 'Event received but not processed' };
        }

        // Mark webhook as processed
        if (subscription) {
          await WebhookEvent.markProcessed(uniqueKey, subscription._id, subscription.userId);
        } else {
          await WebhookEvent.markProcessed(uniqueKey, null, null);
        }

        const processingTime = Date.now() - startTime;
        logger.info('Webhook processed successfully', {
          event,
          uniqueKey,
          processingTime: `${processingTime}ms`
        });

        res.status(200).json({
          success: true,
          message: result.message || 'Webhook processed successfully',
          processingTime: `${processingTime}ms`
        });

      } catch (handlerError) {
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

      logger.error('Error processing Razorpay webhook', {
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

      // Update subscription status to 'authenticated'
      subscription.status = 'authenticated';
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
        // Find user by razorpayCustomerId
        const User = require('../models/User');
        const user = await User.findOne({ razorpayCustomerId: subscriptionEntity.customer_id });

        if (!user) {
          throw new Error(`User not found for Razorpay customer ID: ${subscriptionEntity.customer_id}`);
        }

        // Find plan by razorpayPlanId
        const plan = await Plan.findOne({ razorpayPlanId: subscriptionEntity.plan_id });

        if (!plan) {
          throw new Error(`Plan not found for Razorpay plan ID: ${subscriptionEntity.plan_id}`);
        }

        // Create new subscription
        subscription = await Subscription.create({
          userId: user._id,
          planId: plan._id,
          razorpaySubscriptionId: subscriptionEntity.id,
          razorpayCustomerId: subscriptionEntity.customer_id,
          status: 'active',
          currentPeriodStart: new Date(subscriptionEntity.current_start * 1000),
          currentPeriodEnd: new Date(subscriptionEntity.current_end * 1000),
          billing: {
            amount: plan.pricing.amount,
            currency: plan.pricing.currency,
            interval: plan.pricing.interval,
            intervalCount: plan.pricing.intervalCount || 1
          },
          paidCount: subscriptionEntity.paid_count || 0,
          totalCount: subscriptionEntity.total_count || 0,
          remainingCount: subscriptionEntity.remaining_count || 0,
          chargeAt: subscriptionEntity.charge_at ? new Date(subscriptionEntity.charge_at * 1000) : null,
          startAt: subscriptionEntity.start_at ? new Date(subscriptionEntity.start_at * 1000) : null,
          endAt: subscriptionEntity.end_at ? new Date(subscriptionEntity.end_at * 1000) : null
        });

        logger.info('New subscription created from activated event', {
          subscriptionId: subscription._id,
          userId: subscription.userId,
          planId: subscription.planId
        });
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
    const CreditService = require('../services/creditService');

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
   * User cancelled subscription
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
        subscriptionId: subscription?._id
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

      // Do NOT expire credits immediately - let them use until currentPeriodEnd
      logger.info('Subscription cancelled, credits valid until period end', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        status: subscription.status,
        endedAt: subscription.endedAt,
        cancelledAt: subscription.cancelledAt,
        currentPeriodEnd: subscription.currentPeriodEnd
      });

      return {
        success: true,
        message: 'Subscription cancelled, credits valid until period end',
        subscriptionId: subscription._id,
        userId: subscription.userId
      };
    } catch (error) {
      logger.error('Error handling subscription.cancelled event', {
        razorpaySubscriptionId: payload.subscription?.entity?.id,
        subscriptionId: subscription?._id,
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

      const payment = await Payment.createOrGet(paymentData);

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