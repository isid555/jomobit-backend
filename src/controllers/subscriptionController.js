const SubscriptionService = require('../services/subscriptionService');
const logger = require('../utils/logger');
const razorpay = require('../config/razorpay.config');
const Plan = require('../models/Plan');

/**
 * Determine change type from BUSINESS REVENUE perspective
 * Philosophy: Money NOW > Money LATER, Annual commitment > Monthly flexibility
 * 
 * @param {Object} currentPlan - Current plan
 * @param {Object} newPlan - New plan
 * @returns {Object} { changeType, reason, description }
 */
function determineChangeType(currentPlan, newPlan) {
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

  logger.info('Determining change type from business perspective', {
    currentPlan: currentPlan.planId,
    currentAmount,
    currentInterval,
    currentIntervalPriority,
    newPlan: newPlan.planId,
    newAmount,
    newInterval,
    newIntervalPriority
  });

  // Rule 1: More money upfront = UPGRADE
  if (newAmount > currentAmount) {
    return {
      changeType: 'upgrade',
      reason: 'higher_price',
      description: `New plan costs more (₹${newAmount / 100} vs ₹${currentAmount / 100})`
    };
  }

  // Rule 2: Same price but longer commitment = UPGRADE
  if (newAmount === currentAmount && newIntervalPriority > currentIntervalPriority) {
    return {
      changeType: 'upgrade',
      reason: 'longer_commitment',
      description: `Same price but longer billing interval (${newInterval} vs ${currentInterval})`
    };
  }

  // Rule 3: Less money upfront = DOWNGRADE
  if (newAmount < currentAmount) {
    return {
      changeType: 'downgrade',
      reason: 'lower_price',
      description: `New plan costs less (₹${newAmount / 100} vs ₹${currentAmount / 100})`
    };
  }

  // Rule 4: Same price but shorter commitment = DOWNGRADE
  if (newAmount === currentAmount && newIntervalPriority < currentIntervalPriority) {
    return {
      changeType: 'downgrade',
      reason: 'shorter_commitment',
      description: `Same price but shorter billing interval (${newInterval} vs ${currentInterval})`
    };
  }

  // Rule 5: No change
  return {
    changeType: 'change',
    reason: 'no_price_change',
    description: 'No price or interval change'
  };
}

/**
 * Get 10-year cycle count based on billing interval
 * This ensures all subscriptions have a long-term horizon that refreshes on plan changes
 * 
 * @param {string} interval - Billing interval (daily, weekly, monthly, yearly)
 * @returns {number} Number of cycles for 10 years
 */
function getTenYearCycle(interval) {
  const tenYearCycles = {
    'daily': 3650,   // 10 years = 3650 days
    'weekly': 520,   // 10 years ≈ 520 weeks
    'monthly': 120,  // 10 years = 120 months
    'yearly': 10     // 10 years = 10 years
  };
  
  return tenYearCycles[interval] || 120; // Default to monthly if unknown
}

/**
 * Calculate remaining_count for Razorpay when billing intervals differ
 * Razorpay requires this parameter when changing between different billing periods
 * 
 * @param {Object} currentPlan - Current plan with pricing.interval
 * @param {Object} newPlan - New plan with pricing.interval
 * @param {Object} subscription - Current subscription with totalCount, remainingCount
 * @param {boolean} isScheduled - Whether this is a scheduled change (cycle_end) or immediate
 * @returns {number|null} remaining_count value, or null if not needed
 */
function calculateRemainingCount(currentPlan, newPlan, subscription, isScheduled) {
  // If intervals are the same, no need for remaining_count
  if (currentPlan.pricing.interval === newPlan.pricing.interval) {
    return null;
  }

  // Always refresh to 10-year cycle for new plan
  const remainingCount = getTenYearCycle(newPlan.pricing.interval);

  logger.info('Refreshing to 10-year cycle on plan change', {
    currentInterval: currentPlan.pricing.interval,
    newInterval: newPlan.pricing.interval,
    remainingCount: remainingCount,
    changeType: isScheduled ? 'scheduled' : 'immediate',
    duration: '10 years'
  });

  return remainingCount;
}

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
    this.getSubscriptionById = this.getSubscriptionById.bind(this);
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
      const { planId, customerNotify = true, notes = {} } = req.body;
      // Note: totalCount is no longer accepted from user input
      // It's calculated automatically based on plan interval (10-year cycle)

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

      // Calculate 10-year cycle based on plan interval
      const totalCount = getTenYearCycle(plan.pricing.interval);

      logger.info('Creating subscription with 10-year cycle', {
        planId: plan.planId,
        interval: plan.pricing.interval,
        totalCount: totalCount,
        duration: '10 years'
      });

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
          userId: actualUserId,
          calculatedTotalCount: totalCount,
          razorpayTotalCount: razorpaySubscription.total_count,
          razorpayPaidCount: razorpaySubscription.paid_count,
          razorpayRemainingCount: razorpaySubscription.remaining_count,
          duration: '10 years'
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
        // Use requested totalCount, not Razorpay's response (Razorpay may return 0 for unlimited)
        totalCount: totalCount,
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
        return res.status(404).json({
          success: false,
          error: 'No active subscription',
          message: 'No active subscription found'
        });
      }

      // Return subscription with plan, status, currentPeriodEnd, cancelAtPeriodEnd, scheduledChange
      res.json({
        success: true,
        subscription: {
          _id: subscription._id,
          userId: subscription.userId,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt,
          scheduledChange: subscription.scheduledChange,
          billing: subscription.billing,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt
        },
        plan: subscription.planId ? {
          _id: subscription.planId._id,
          name: subscription.planId.name,
          planId: subscription.planId.planId,
          description: subscription.planId.description,
          pricing: subscription.planId.pricing,
          features: subscription.planId.features,
          tier: subscription.planId.tier
        } : null
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
   * Get subscription by ID
   * GET /api/subscriptions/:id
   */
  async getSubscriptionById(req, res) {
    try {
      const userId = req.user.id; // Auth0 ID
      const { id } = req.params;

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const Subscription = require('../models/Subscription');

      // Find subscription by ID
      const subscription = await Subscription.findById(id).populate('planId').exec();

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found',
          message: 'Subscription not found'
        });
      }

      // Verify user owns the subscription (authorization check)
      if (subscription.userId.toString() !== actualUserId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You are not authorized to view this subscription'
        });
      }

      // Return subscription with billing, planChanges, and plan details
      res.json({
        success: true,
        subscription: {
          _id: subscription._id,
          userId: subscription.userId,
          status: subscription.status,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt,
          billing: subscription.billing,
          planChanges: subscription.planChanges,
          scheduledChange: subscription.scheduledChange,
          paidCount: subscription.paidCount,
          totalCount: subscription.totalCount,
          remainingCount: subscription.remainingCount,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt
        },
        plan: subscription.planId ? {
          _id: subscription.planId._id,
          name: subscription.planId.name,
          planId: subscription.planId.planId,
          description: subscription.planId.description,
          pricing: subscription.planId.pricing,
          features: subscription.planId.features,
          tier: subscription.planId.tier
        } : null
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid subscription ID',
          message: 'Invalid subscription ID format'
        });
      }

      logger.error('Error fetching subscription by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch subscription'
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
      const { newPlanId, immediate = false, reason = 'user_upgrade' } = req.body;

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

      // Find user's active subscription
      const Subscription = require('../models/Subscription');
      const subscription = await Subscription.getUserActiveSubscription(actualUserId);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'NO_ACTIVE_SUBSCRIPTION',
          message: 'No active subscription found'
        });
      }

      // Validate newPlanId and fetch new Plan
      const newPlan = await Plan.getByPlanId(newPlanId);
      if (!newPlan) {
        return res.status(400).json({
          success: false,
          error: 'PLAN_NOT_FOUND',
          message: 'Invalid plan ID provided'
        });
      }

      // Get current plan
      const currentPlan = await Plan.findById(subscription.planId);
      if (!currentPlan) {
        return res.status(500).json({
          success: false,
          error: 'CURRENT_PLAN_NOT_FOUND',
          message: 'Current plan not found'
        });
      }

      // Check if trying to change to the same plan
      if (currentPlan._id.toString() === newPlan._id.toString()) {
        return res.status(400).json({
          success: false,
          error: 'SAME_PLAN',
          message: 'Cannot change to the same plan'
        });
      }

      // Determine changeType using business logic
      const changeResult = determineChangeType(currentPlan, newPlan);
      const changeType = changeResult.changeType;

      logger.info('Change type determined', {
        userId: actualUserId,
        subscriptionId: subscription._id,
        fromPlan: currentPlan.planId,
        toPlan: newPlan.planId,
        changeType: changeResult.changeType,
        reason: changeResult.reason,
        description: changeResult.description
      });

      // IMPORTANT: Downgrades are ALWAYS scheduled, never immediate
      // Protect business revenue by preventing immediate refunds
      let effectiveImmediate = immediate;
      if (changeType === 'downgrade' && immediate === true) {
        logger.info('Downgrade requested with immediate=true, forcing scheduled change', {
          userId: actualUserId,
          subscriptionId: subscription._id,
          fromPlan: currentPlan.planId,
          toPlan: newPlan.planId,
          fromAmount: currentPlan.pricing.amount,
          toAmount: newPlan.pricing.amount,
          reason: changeResult.reason,
          note: 'Downgrades are always scheduled to protect revenue and prevent immediate refunds'
        });

        // Override immediate flag for downgrades
        effectiveImmediate = false;
      }

      // Handle immediate upgrade/downgrade
      if (effectiveImmediate === true) {
        logger.info('Processing immediate plan change', {
          userId: actualUserId,
          subscriptionId: subscription._id,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          fromPlan: currentPlan.planId,
          toPlan: newPlan.planId,
          changeType: changeType
        });

        try {
          // Update subscription in Razorpay with immediate effect
          const updateParams = {
            plan_id: newPlan.razorpayPlanId,
            schedule_change_at: 'now',
            quantity: 1
          };

          // Calculate remaining_count if billing intervals differ
          const remainingCount = calculateRemainingCount(currentPlan, newPlan, subscription, false);
          if (remainingCount !== null) {
            updateParams.remaining_count = remainingCount;
          }

          const razorpayResponse = await razorpay.subscriptions.update(
            subscription.razorpaySubscriptionId,
            updateParams
          );

          logger.info('Razorpay subscription updated successfully', {
            razorpaySubscriptionId: subscription.razorpaySubscriptionId,
            newPlanId: newPlan.razorpayPlanId,
            razorpayStatus: razorpayResponse.status,
            paidCount: razorpayResponse.paid_count,
            remainingCount: razorpayResponse.remaining_count
          });

          // DON'T update subscription.planId here - let webhook do it!
          // This allows webhook to detect the plan change by comparing DB vs Razorpay

          // Update Razorpay sync fields only
          if (razorpayResponse.paid_count !== undefined) {
            subscription.paidCount = razorpayResponse.paid_count;
          }
          if (razorpayResponse.remaining_count !== undefined) {
            subscription.remainingCount = razorpayResponse.remaining_count;
          }
          if (razorpayResponse.charge_at) {
            subscription.chargeAt = new Date(razorpayResponse.charge_at * 1000);
          }

          // Record the plan change intent in history (for audit trail only)
          subscription.planChanges.push({
            fromPlanId: currentPlan._id,
            toPlanId: newPlan._id,
            changeType: changeType,
            effectiveDate: new Date(),
            reason: reason || 'immediate_upgrade'
          });

          // Clear any scheduled changes
          subscription.scheduledChange = undefined;

          await subscription.save();

          logger.info('Immediate plan change requested, waiting for webhook confirmation', {
            userId: actualUserId,
            subscriptionId: subscription._id,
            fromPlan: currentPlan.planId,
            toPlan: newPlan.planId,
            changeType: changeType,
            note: 'Subscription and credits will be updated when subscription.updated webhook arrives'
          });

          // Return success response
          return res.json({
            success: true,
            message: `Plan ${changeType} initiated successfully. Changes will be confirmed by payment processor.`,
            immediate: true,
            subscription: {
              _id: subscription._id,
              status: subscription.status,
              currentPeriodEnd: subscription.currentPeriodEnd,
              paidCount: subscription.paidCount,
              remainingCount: subscription.remainingCount
            },
            oldPlan: {
              _id: currentPlan._id,
              name: currentPlan.name,
              planId: currentPlan.planId,
              pricing: currentPlan.pricing,
              features: currentPlan.features
            },
            newPlan: {
              _id: newPlan._id,
              name: newPlan.name,
              planId: newPlan.planId,
              pricing: newPlan.pricing,
              features: newPlan.features
            },
            changeType: changeType,
            effectiveDate: new Date()
          });

        } catch (razorpayError) {
          logger.error('Error updating Razorpay subscription', {
            razorpaySubscriptionId: subscription.razorpaySubscriptionId,
            newPlanId: newPlan.razorpayPlanId,
            error: razorpayError.message,
            errorCode: razorpayError.statusCode,
            errorDescription: razorpayError.error?.description
          });

          return res.status(500).json({
            success: false,
            error: 'RAZORPAY_UPDATE_FAILED',
            message: 'Failed to update subscription in Razorpay',
            details: razorpayError.error?.description || razorpayError.message
          });
        }
      }

      // Handle scheduled upgrade/downgrade
      logger.info('Scheduling plan change for end of billing cycle', {
        userId: actualUserId,
        subscriptionId: subscription._id,
        fromPlan: currentPlan.planId,
        toPlan: newPlan.planId,
        changeType: changeType,
        effectiveDate: subscription.currentPeriodEnd
      });

      // Call Razorpay immediately with schedule_change_at: 'cycle_end'
      // Let Razorpay handle the timing instead of relying on our cron job
      try {
        const updateParams = {
          plan_id: newPlan.razorpayPlanId,
          schedule_change_at: 'cycle_end',
          quantity: 1
        };

        // Calculate remaining_count if billing intervals differ
        // Razorpay requires this even for cycle_end changes when periods differ
        const remainingCount = calculateRemainingCount(currentPlan, newPlan, subscription, true);
        if (remainingCount !== null) {
          updateParams.remaining_count = remainingCount;
        }

        const razorpayResponse = await razorpay.subscriptions.update(
          subscription.razorpaySubscriptionId,
          updateParams
        );

        logger.info('Razorpay subscription scheduled for cycle_end change', {
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          newPlanId: newPlan.razorpayPlanId,
          scheduleChangeAt: 'cycle_end',
          razorpayStatus: razorpayResponse.status
        });

        // Store scheduledChange for UI/audit purposes only
        // Razorpay is now the source of truth for execution
        subscription.scheduledChange = {
          newPlanId: newPlan._id,
          changeType: changeType,
          effectiveDate: subscription.currentPeriodEnd,
          requestedAt: new Date(),
          reason: reason,
          razorpayScheduled: true // Flag to indicate Razorpay is handling it
        };

        await subscription.save();

        logger.info('Plan change scheduled', {
          userId: actualUserId,
          subscriptionId: subscription._id,
          fromPlan: currentPlan.planId,
          toPlan: newPlan.planId,
          changeType: changeType,
          effectiveDate: subscription.currentPeriodEnd
        });

        // Return subscription with oldPlan, newPlan, changeType, scheduledFor date
        res.json({
          success: true,
          message: `Plan ${changeType} scheduled for ${subscription.currentPeriodEnd.toISOString()}`,
          immediate: false,
          subscription: {
            _id: subscription._id,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            scheduledChange: subscription.scheduledChange
          },
          oldPlan: {
            _id: currentPlan._id,
            name: currentPlan.name,
            planId: currentPlan.planId,
            pricing: currentPlan.pricing,
            features: currentPlan.features
          },
          newPlan: {
            _id: newPlan._id,
            name: newPlan.name,
            planId: newPlan.planId,
            pricing: newPlan.pricing,
            features: newPlan.features
          },
          changeType: changeType,
          scheduledFor: subscription.currentPeriodEnd
        });

      } catch (razorpayError) {
        logger.error('Error scheduling plan change in Razorpay', {
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          newPlanId: newPlan.razorpayPlanId,
          error: razorpayError.message,
          errorCode: razorpayError.statusCode,
          errorDescription: razorpayError.error?.description
        });

        return res.status(500).json({
          success: false,
          error: 'RAZORPAY_SCHEDULE_FAILED',
          message: 'Failed to schedule plan change in Razorpay',
          details: razorpayError.error?.description || razorpayError.message
        });
      }

    } catch (error) {
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

      // Find user's active subscription
      const Subscription = require('../models/Subscription');
      const subscription = await Subscription.getUserActiveSubscription(actualUserId);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'NO_ACTIVE_SUBSCRIPTION',
          message: 'No active subscription found'
        });
      }

      // If immediately=true: cancel on Razorpay immediately and set status='cancelled'
      if (immediately) {
        try {
          // Cancel on Razorpay
          await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId);

          subscription.status = 'cancelled';
          subscription.cancelledAt = new Date();
          if (reason) {
            subscription.cancellationReason = reason;
          }
          await subscription.save();

          logger.info('Subscription cancelled immediately', {
            userId: actualUserId,
            subscriptionId: subscription._id,
            razorpaySubscriptionId: subscription.razorpaySubscriptionId
          });

          return res.json({
            success: true,
            message: 'Subscription cancelled immediately',
            subscription: {
              _id: subscription._id,
              status: subscription.status,
              cancelledAt: subscription.cancelledAt,
              accessUntil: subscription.currentPeriodEnd
            }
          });
        } catch (razorpayError) {
          logger.error('Error cancelling subscription on Razorpay:', razorpayError);
          return res.status(500).json({
            success: false,
            error: 'Razorpay error',
            message: 'Failed to cancel subscription on Razorpay'
          });
        }
      }

      // If immediately=false: set cancelAtPeriodEnd=true
      subscription.cancelAtPeriodEnd = true;
      if (reason) {
        subscription.cancellationReason = reason;
      }
      await subscription.save();

      logger.info('Subscription scheduled for cancellation', {
        userId: actualUserId,
        subscriptionId: subscription._id,
        cancelAtPeriodEnd: true,
        accessUntil: subscription.currentPeriodEnd
      });

      // Return subscription with cancelledAt and accessUntil dates
      res.json({
        success: true,
        message: 'Subscription will be cancelled at the end of the current billing period',
        subscription: {
          _id: subscription._id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: null,
          accessUntil: subscription.currentPeriodEnd
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
    try {
      const Plan = require('../models/Plan');
      const plans = await Plan.createDefaultPlans();

      res.json({
        success: true,
        plans: plans.map(plan => plan.toObject())
      });
    }
    catch (error) {
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