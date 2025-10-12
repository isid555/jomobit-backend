const SubscriptionService = require('../services/subscriptionService');
const logger = require('../utils/logger');
const razorpay = require('../config/razorpay.config');
const Plan = require('../models/Plan');
/**
 * Subscription Controller
 * Handles subscription and payment management endpoints
 */
class SubscriptionController {
  constructor() {
    this.subscriptionService = new SubscriptionService();
    
    // Bind all methods that use 'this' to preserve context
    this.createSubscription = this.createSubscription.bind(this);
    this.getCurrentSubscription = this.getCurrentSubscription.bind(this);
    this.getSubscriptionHistory = this.getSubscriptionHistory.bind(this);
    this.upgradeSubscription = this.upgradeSubscription.bind(this);
    this.cancelSubscription = this.cancelSubscription.bind(this);
    this.getBillingHistory = this.getBillingHistory.bind(this);
    this.getAvailablePlans = this.getAvailablePlans.bind(this);
    this.getPlanById = this.getPlanById.bind(this);
    this.processRazorpayWebhook = this.processRazorpayWebhook.bind(this);
    this.getSubscriptionAnalytics = this.getSubscriptionAnalytics.bind(this);
    this.getAdminSubscriptions = this.getAdminSubscriptions.bind(this);
    this.processScheduledCancellations = this.processScheduledCancellations.bind(this);
  }

  /**
   * Create new subscription
   * POST /api/subscriptions/create
   */
  async createSubscription(req, res) {
    try {
      const userId = req.user.id; // Auth0 ID
      const { planId, totalCount = 1, customerNotify = true, notes = {} } = req.body;

      // Validate planId
      if (!planId) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Plan ID is required'
        });
      }

      // Get user by Auth0 ID
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const user = userResult.user;
      const actualUserId = user._id;

      // Fetch Plan from database to get razorpayPlanId, pricing, and features
      const plan = await Plan.getByPlanId(planId);
      if (!plan) {
        return res.status(400).json({
          success: false,
          error: 'Plan not found',
          message: 'Invalid plan ID provided'
        });
      }

      // Check for existing active subscription
      const Subscription = require('../models/Subscription');
      const existingSubscription = await Subscription.getUserActiveSubscription(actualUserId);
      if (existingSubscription) {
        return res.status(409).json({
          success: false,
          error: 'Active subscription exists',
          message: 'User already has an active subscription',
          subscription: existingSubscription.toObject()
        });
      }

      // Get or create Razorpay customer using user email and name
      let razorpayCustomerId;
      try {
        // Try to find existing customer by email
        const customers = await razorpay.customers.all({ email: user.email });
        
        if (customers.items && customers.items.length > 0) {
          razorpayCustomerId = customers.items[0].id;
          logger.info('Found existing Razorpay customer', {
            customerId: razorpayCustomerId,
            email: user.email
          });
        } else {
          // Create new customer
          const customer = await razorpay.customers.create({
            name: user.metadata?.name || user.email,
            email: user.email,
            notes: {
              userId: actualUserId.toString()
            }
          });
          razorpayCustomerId = customer.id;
          logger.info('Created new Razorpay customer', {
            customerId: razorpayCustomerId,
            email: user.email
          });
        }
      } catch (error) {
        logger.error('Error creating/fetching Razorpay customer:', error);
        return res.status(500).json({
          success: false,
          error: 'Razorpay error',
          message: 'Failed to create or fetch customer in Razorpay'
        });
      }

      // Create Razorpay subscription with plan_id, customer_id, total_count, customer_notify
      let razorpaySubscription;
      try {
        razorpaySubscription = await razorpay.subscriptions.create({
          plan_id: plan.razorpayPlanId,
          customer_id: razorpayCustomerId,
          total_count: totalCount,
          customer_notify: customerNotify ? 1 : 0,
          notes: {
            userId: actualUserId.toString(),
            planId: plan.planId,
            ...notes
          }
        });

        logger.info('Created Razorpay subscription', {
          razorpaySubscriptionId: razorpaySubscription.id,
          planId: plan.planId,
          userId: actualUserId
        });
      } catch (error) {
        logger.error('Error creating Razorpay subscription:', error);
        return res.status(500).json({
          success: false,
          error: 'Razorpay error',
          message: 'Failed to create subscription in Razorpay',
          details: error.message
        });
      }

      // Create local Subscription record with status='created' and billing details from Plan
      const subscriptionData = {
        userId: actualUserId,
        planId: plan._id,
        razorpaySubscriptionId: razorpaySubscription.id,
        razorpayCustomerId: razorpayCustomerId,
        status: 'created',
        billing: {
          amount: plan.pricing.amount,
          currency: plan.pricing.currency,
          interval: plan.pricing.interval,
          intervalCount: plan.pricing.intervalCount
        },
        shortUrl: razorpaySubscription.short_url,
        totalCount: razorpaySubscription.total_count,
        paidCount: razorpaySubscription.paid_count || 0,
        remainingCount: razorpaySubscription.remaining_count || totalCount,
        startAt: razorpaySubscription.start_at ? new Date(razorpaySubscription.start_at * 1000) : null,
        endAt: razorpaySubscription.end_at ? new Date(razorpaySubscription.end_at * 1000) : null,
        chargeAt: razorpaySubscription.charge_at ? new Date(razorpaySubscription.charge_at * 1000) : null
      };

      const subscription = await Subscription.createSubscription(subscriptionData);

      logger.info('Local subscription created', {
        subscriptionId: subscription._id,
        razorpaySubscriptionId: razorpaySubscription.id,
        userId: actualUserId,
        planId: plan.planId
      });

      // Return subscription with razorpaySubscriptionId, short_url, and plan details
      res.status(201).json({
        success: true,
        message: 'Subscription created successfully. Please complete payment using the provided URL.',
        subscription: {
          _id: subscription._id,
          razorpaySubscriptionId: razorpaySubscription.id,
          short_url: razorpaySubscription.short_url,
          status: subscription.status,
          billing: subscription.billing,
          totalCount: subscription.totalCount,
          paidCount: subscription.paidCount,
          remainingCount: subscription.remainingCount,
          createdAt: subscription.createdAt
        },
        plan: {
          _id: plan._id,
          name: plan.name,
          planId: plan.planId,
          description: plan.description,
          pricing: plan.pricing,
          features: plan.features,
          tier: plan.tier
        }
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error creating subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create subscription'
      });
    }
  }

  /**
   * Get user's current subscription
   * GET /api/subscriptions/current
   */
  async getCurrentSubscription(req, res) {
    try {
      const userId = req.user.id; // Auth0 ID, need to convert to actual user ID

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const Subscription = require('../models/Subscription');
      const subscription = await Subscription.getUserActiveSubscription(actualUserId);

      if (!subscription) {
        return res.json({
          success: true,
          subscription: null,
          message: 'No active subscription found'
        });
      }

      res.json({
        success: true,
        subscription: subscription.toObject()
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error fetching current subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch current subscription'
      });
    }
  }

  /**
   * Get user's subscription history
   * GET /api/subscriptions/history
   */
  async getSubscriptionHistory(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 10, skip = 0 } = req.query;

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const Subscription = require('../models/Subscription');
      const subscriptions = await Subscription.getUserSubscriptionHistory(actualUserId, {
        limit: parseInt(limit),
        skip: parseInt(skip)
      });

      const totalCount = await Subscription.countDocuments({ userId: actualUserId });

      res.json({
        success: true,
        subscriptions: subscriptions.map(sub => sub.toObject()),
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: parseInt(skip) + subscriptions.length < totalCount
        }
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error fetching subscription history:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch subscription history'
      });
    }
  }

  /**
   * Upgrade subscription
   * POST /api/subscriptions/upgrade
   */
  async upgradeSubscription(req, res) {
    try {
      const userId = req.user.id;
      const { newPlanId, immediate = true, reason = 'user_upgrade' } = req.body;

      if (!newPlanId) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'New plan ID is required'
        });
      }

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const result = await this.subscriptionService.upgradeSubscription(actualUserId, newPlanId, {
        immediate,
        reason
      });

      logger.info('Subscription upgraded', {
        userId: actualUserId,
        subscriptionId: result.subscription._id,
        fromPlan: result.oldPlan.planId,
        toPlan: result.newPlan.planId,
        changeType: result.changeType,
        proratedAmount: result.proratedAmount
      });

      res.json({
        success: true,
        message: result.message,
        subscription: result.subscription,
        oldPlan: result.oldPlan,
        newPlan: result.newPlan,
        changeType: result.changeType,
        proratedAmount: result.proratedAmount
      });

    } catch (error) {
      if (error.name === 'SubscriptionError') {
        const statusCode = error.code === 'NO_ACTIVE_SUBSCRIPTION' ? 404 : 
                          error.code === 'PLAN_NOT_FOUND' ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.code,
          message: error.message,
          details: error.details
        });
      }

      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error upgrading subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to upgrade subscription'
      });
    }
  }

  /**
   * Cancel subscription
   * POST /api/subscriptions/cancel
   */
  async cancelSubscription(req, res) {
    try {
      const userId = req.user.id;
      const { immediately = false, reason = 'user_cancellation' } = req.body;

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const result = await this.subscriptionService.cancelSubscription(actualUserId, {
        immediately,
        reason
      });

      logger.info('Subscription cancelled', {
        userId: actualUserId,
        subscriptionId: result.subscription._id,
        immediately,
        reason
      });

      res.json({
        success: true,
        message: result.message,
        subscription: result.subscription,
        cancelledImmediately: result.cancelledImmediately
      });

    } catch (error) {
      if (error.name === 'SubscriptionError') {
        const statusCode = error.code === 'NO_ACTIVE_SUBSCRIPTION' ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.code,
          message: error.message,
          details: error.details
        });
      }

      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error cancelling subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to cancel subscription'
      });
    }
  }

  /**
   * Get billing history
   * GET /api/subscriptions/billing
   */
  async getBillingHistory(req, res) {
    try {
      const userId = req.user.id;
      const { 
        limit = 10, 
        skip = 0, 
        startDate, 
        endDate 
      } = req.query;

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const options = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) })
      };

      const result = await this.subscriptionService.getBillingHistory(actualUserId, options);

      res.json({
        success: true,
        billingHistory: result.billingHistory,
        pagination: result.pagination,
        summary: result.summary
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error fetching billing history:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch billing history'
      });
    }
  }



  /**
   * Create Razorpay Plans
   * POST /api/subscriptions/plans/razorpay
   */

  async createRazorpayPlan(req, res) {
    try {
      const planData = req.body;

      // Step 1️⃣ — Create Plan in DB first (inactive by default)
      const plan = await Plan.create({
        ...planData,
        status: 'inactive'
      });

      // Step 2️⃣ — If Free Plan, skip Razorpay creation
      if (plan.pricing.amount === 0) {
        plan.status = 'active';
        await plan.save();

        return res.status(201).json({
          success: true,
          message: 'Free plan created and activated successfully (no Razorpay required)',
          data: plan
        });
      }

      // Step 3️⃣ — Validate Razorpay parameters before proceeding
      if (!plan.pricing.interval || !plan.pricing.currency) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan interval or currency for Razorpay plan creation'
        });
      }

      // Step 4️⃣ — Create plan on Razorpay
      const razorpayPlan = await razorpay.plans.create({
        period: plan.pricing.interval,
        interval: plan.pricing.intervalCount || 1,
        item: {
          name: plan.name,
          amount: plan.pricing.amount * 100, // convert ₹ → paise
          currency: plan.pricing.currency,
          description: plan.description || `${plan.name} plan`
        },
        notes: {
          tier: plan.tier,
          createdBy: 'system'
        }
      });

      // Step 5️⃣ — Update the DB plan with Razorpay details & activate
      plan.razorpayPlanId = razorpayPlan.id;
      plan.metadata = {
        razorpayItemId: razorpayPlan.item.id,
        razorpayCreatedAt: razorpayPlan.created_at,
        razorpayNotes: razorpayPlan.notes
      };
      plan.status = 'active';
      await plan.save();

      // Step 6️⃣ — Respond to client
      return res.status(201).json({
        success: true,
        message: 'Plan created successfully and synced with Razorpay',
        data: plan
      });

    } catch (error) {
      console.error('Error creating Razorpay plan:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create Razorpay plan',
        error: error.message
      });
    }
  }

  /**
   * Create Available plans
   * POST /api/subscriptions/plans
   */
  async createPlans(req, res) {
    try{
      const Plan = require('../models/Plan');
      const plans = await Plan.createDefaultPlans();

      res.json({
        success: true,
        plans: plans.map(plan => plan.toObject())
      });
    }
    catch(error){
      logger.error('Error creating default plans:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create default plans'
      });
    }
  }
  /**
   * Get available plans
   * GET /api/subscriptions/plans
   */
  async getAvailablePlans(req, res) {
    try {
      const Plan = require('../models/Plan');
      const plans = await Plan.getPublicPlans();

      res.json({
        success: true,
        plans: plans.map(plan => plan.toObject())
      });

    } catch (error) {
      logger.error('Error fetching available plans:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch available plans'
      });
    }
  }

  /**
   * Get plan by ID
   * GET /api/subscriptions/plans/:planId
   */
  async getPlanById(req, res) {
    try {
      const { planId } = req.params;

      const Plan = require('../models/Plan');
      const plan = await Plan.getByPlanId(planId);

      if (!plan) {
        return res.status(404).json({
          success: false,
          error: 'Plan not found',
          message: 'Subscription plan not found'
        });
      }

      res.json({
        success: true,
        plan: plan.toObject()
      });

    } catch (error) {
      logger.error('Error fetching plan by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch plan'
      });
    }
  }

  /**
   * Process Razorpay subscription webhook
   * POST /api/subscriptions/webhooks/razorpay
   */
  async processRazorpayWebhook(req, res) {
    try {
      const webhookData = req.body;
      const { event } = webhookData;

      logger.info('Processing Razorpay subscription webhook', {
        event,
        subscriptionId: webhookData.payload?.subscription?.entity?.id
      });

      let result;

      switch (event) {
        case 'subscription.activated':
        case 'subscription.charged':
          result = await this.subscriptionService.createSubscription(webhookData.payload);
          break;

        case 'subscription.completed':
        case 'payment.captured':
          result = await this.subscriptionService.processSubscriptionRenewal(webhookData.payload);
          break;

        case 'payment.failed':
          result = await this.subscriptionService.processFailedPayment(webhookData.payload);
          break;

        case 'subscription.cancelled':
        case 'subscription.halted':
          // Handle subscription cancellation from Razorpay side
          logger.info('Subscription cancelled via Razorpay', {
            subscriptionId: webhookData.payload?.subscription?.entity?.id
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
        logger.error('Subscription webhook processing error:', {
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
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process webhook'
      });
    }
  }

  /**
   * Get subscription analytics (Admin only)
   * GET /api/subscriptions/admin/analytics
   */
  async getSubscriptionAnalytics(req, res) {
    try {
      const { startDate, endDate, planId } = req.query;

      const filters = {
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(planId && { planId })
      };

      const result = await this.subscriptionService.getSubscriptionAnalytics(filters);

      res.json({
        success: true,
        analytics: result.analytics
      });

    } catch (error) {
      logger.error('Error fetching subscription analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch subscription analytics'
      });
    }
  }

  /**
   * Get all subscriptions (Admin only)
   * GET /api/subscriptions/admin
   */
  async getAdminSubscriptions(req, res) {
    try {
      const {
        userId,
        planId,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      // Build query
      const query = {};
      if (userId) query.userId = userId;
      if (planId) query.planId = planId;
      if (status) query.status = status;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const Subscription = require('../models/Subscription');
      const subscriptions = await Subscription.find(query)
        .populate('userId', 'email metadata.name')
        .populate('planId')
        .sort(sort)
        .limit(parseInt(limit))
        .skip(skip)
        .exec();

      const total = await Subscription.countDocuments(query);

      res.json({
        success: true,
        subscriptions: subscriptions.map(sub => sub.toObject()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        filters: { userId, planId, status, startDate, endDate }
      });

    } catch (error) {
      logger.error('Error fetching admin subscriptions:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch subscriptions'
      });
    }
  }

  /**
   * Process scheduled cancellations (Admin only)
   * POST /api/subscriptions/admin/process-cancellations
   */
  async processScheduledCancellations(req, res) {
    try {
      const result = await this.subscriptionService.processScheduledCancellations();

      logger.info('Scheduled cancellations processed', {
        processedSubscriptions: result.processedSubscriptions,
        successfulCancellations: result.successfulCancellations,
        failedCancellations: result.failedCancellations
      });

      res.json({
        success: true,
        message: 'Scheduled cancellations processed successfully',
        results: {
          processedSubscriptions: result.processedSubscriptions,
          successfulCancellations: result.successfulCancellations,
          failedCancellations: result.failedCancellations
        }
      });

    } catch (error) {
      logger.error('Error processing scheduled cancellations:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process scheduled cancellations'
      });
    }
  }
}

module.exports = new SubscriptionController();