const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const User = require('../models/User');
const CreditService = require('./creditService');
const logger = require('../utils/logger');

/**
 * Custom error classes for subscription operations
 */
class SubscriptionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SubscriptionError';
    this.code = code;
    this.details = details;
  }
}

class PaymentError extends Error {
  constructor(message, code, razorpayData = {}) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.razorpayData = razorpayData;
  }
}

/**
 * Subscription and Payment Management Service
 * Handles Razorpay integration and subscription lifecycle
 */
class SubscriptionService {
  constructor(options = {}) {
    this.creditService = options.creditService || new CreditService();
    this.useTransactions = options.useTransactions !== false;
  }

  /**
   * Create new subscription from Razorpay webhook
   * @param {Object} webhookData - Razorpay webhook payload
   * @returns {Promise<Object>} Created subscription
   */
  async createSubscription(webhookData) {
    const session = this.useTransactions ? await mongoose.startSession() : null;
    
    try {
      const result = this.useTransactions 
        ? await session.withTransaction(() => this._createSubscriptionCore(webhookData, session))
        : await this._createSubscriptionCore(webhookData, null);
      
      return result;
    } catch (error) {
      logger.error('Error creating subscription', {
        webhookData,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      if (session) await session.endSession();
    }
  }

  async _createSubscriptionCore(webhookData, session) {
    const { subscription: razorpaySubscription, payment } = webhookData;
    
    // Find user by customer ID or email
    const user = await this._findUserFromWebhook(webhookData, session);
    if (!user) {
      throw new SubscriptionError(
        'User not found for subscription',
        'USER_NOT_FOUND',
        { customerId: razorpaySubscription.customer_id }
      );
    }

    // Find plan by Razorpay plan ID
    const plan = await Plan.getByRazorpayId(razorpaySubscription.plan_id);
    if (!plan) {
      throw new SubscriptionError(
        'Plan not found for subscription',
        'PLAN_NOT_FOUND',
        { planId: razorpaySubscription.plan_id }
      );
    }

    // Check for existing active subscription
    const existingSubscription = await Subscription.getUserActiveSubscription(user._id);
    if (existingSubscription) {
      throw new SubscriptionError(
        'User already has an active subscription',
        'ACTIVE_SUBSCRIPTION_EXISTS',
        { existingSubscriptionId: existingSubscription._id }
      );
    }

    // Calculate period dates
    const currentPeriodStart = new Date(razorpaySubscription.current_start * 1000);
    const currentPeriodEnd = new Date(razorpaySubscription.current_end * 1000);

    // Create subscription
    const subscriptionData = {
      userId: user._id,
      planId: plan._id,
      razorpaySubscriptionId: razorpaySubscription.id,
      currentPeriodStart,
      currentPeriodEnd,
      billing: {
        currency: plan.pricing.currency,
        amount: plan.pricing.amount,
        interval: plan.pricing.interval,
        intervalCount: plan.pricing.intervalCount
      },
      status: razorpaySubscription.status === 'active' ? 'active' : 'pending'
    };

    // Handle trial period if exists
    if (razorpaySubscription.trial_start && razorpaySubscription.trial_end) {
      subscriptionData.trialStart = new Date(razorpaySubscription.trial_start * 1000);
      subscriptionData.trialEnd = new Date(razorpaySubscription.trial_end * 1000);
    }

    const subscription = await Subscription.createSubscription(subscriptionData);
    if (session) await subscription.save({ session });

    // Add initial payment to billing history if payment exists
    if (payment) {
      await subscription.addPayment({
        razorpayPaymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.method,
        paidAt: new Date(payment.created_at * 1000),
        webhookData: payment
      });
    }

    // Grant subscription credits if subscription is active
    if (subscription.status === 'active') {
      await this._grantSubscriptionCredits(subscription, plan, session);
    }

    logger.info('Subscription created successfully', {
      subscriptionId: subscription._id,
      userId: user._id,
      planId: plan._id,
      razorpaySubscriptionId: razorpaySubscription.id
    });

    return {
      success: true,
      subscription: subscription.toObject(),
      plan: plan.toObject(),
      user: { id: user._id, email: user.email }
    };
  }

  /**
   * Process subscription renewal from Razorpay webhook
   * @param {Object} webhookData - Razorpay webhook payload
   * @returns {Promise<Object>} Updated subscription
   */
  async processSubscriptionRenewal(webhookData) {
    const session = this.useTransactions ? await mongoose.startSession() : null;
    
    try {
      const result = this.useTransactions 
        ? await session.withTransaction(() => this._processSubscriptionRenewalCore(webhookData, session))
        : await this._processSubscriptionRenewalCore(webhookData, null);
      
      return result;
    } catch (error) {
      logger.error('Error processing subscription renewal', {
        webhookData,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      if (session) await session.endSession();
    }
  }

  async _processSubscriptionRenewalCore(webhookData, session) {
    const { subscription: razorpaySubscription, payment } = webhookData;
    
    // Find subscription
    const subscription = await Subscription.getByRazorpayId(razorpaySubscription.id);
    if (!subscription) {
      throw new SubscriptionError(
        'Subscription not found',
        'SUBSCRIPTION_NOT_FOUND',
        { razorpaySubscriptionId: razorpaySubscription.id }
      );
    }

    // Update subscription period
    const newPeriodStart = new Date(razorpaySubscription.current_start * 1000);
    const newPeriodEnd = new Date(razorpaySubscription.current_end * 1000);
    
    await subscription.updatePeriod(newPeriodStart, newPeriodEnd);
    subscription.status = 'active';
    if (session) await subscription.save({ session });

    // Add payment to billing history
    if (payment) {
      await subscription.addPayment({
        razorpayPaymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.method,
        paidAt: new Date(payment.created_at * 1000),
        webhookData: payment
      });
    }

    // Grant new monthly credits and expire old ones
    const plan = await Plan.findById(subscription.planId);
    if (plan) {
      // First expire existing subscription credits
      await this.creditService.expireSubscriptionCredits(new Date());
      
      // Then grant new credits for the new period
      await this._grantSubscriptionCredits(subscription, plan, session);
    }

    logger.info('Subscription renewed successfully', {
      subscriptionId: subscription._id,
      userId: subscription.userId,
      newPeriodStart,
      newPeriodEnd
    });

    return {
      success: true,
      subscription: subscription.toObject(),
      plan: plan?.toObject(),
      message: 'Subscription renewed successfully'
    };
  }

  /**
   * Process subscription upgrade with prorated pricing
   * @param {string|ObjectId} userId - User ID
   * @param {string} newPlanId - New plan ID
   * @param {Object} options - Upgrade options
   * @returns {Promise<Object>} Upgrade result
   */
  async upgradeSubscription(userId, newPlanId, options = {}) {
    const session = this.useTransactions ? await mongoose.startSession() : null;
    
    try {
      const result = this.useTransactions 
        ? await session.withTransaction(() => this._upgradeSubscriptionCore(userId, newPlanId, options, session))
        : await this._upgradeSubscriptionCore(userId, newPlanId, options, session);
      
      return result;
    } catch (error) {
      logger.error('Error upgrading subscription', {
        userId,
        newPlanId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      if (session) await session.endSession();
    }
  }

  async _upgradeSubscriptionCore(userId, newPlanId, options, session) {
    const { immediate = true, reason = 'user_upgrade' } = options;
    
    // Get current subscription
    const currentSubscription = await Subscription.getUserActiveSubscription(userId);
    if (!currentSubscription) {
      throw new SubscriptionError(
        'No active subscription found for user',
        'NO_ACTIVE_SUBSCRIPTION',
        { userId }
      );
    }

    // Get new plan
    const newPlan = await Plan.getByPlanId(newPlanId);
    if (!newPlan) {
      throw new SubscriptionError(
        'New plan not found',
        'PLAN_NOT_FOUND',
        { planId: newPlanId }
      );
    }

    const currentPlan = await Plan.findById(currentSubscription.planId);
    if (!currentPlan) {
      throw new SubscriptionError(
        'Current plan not found',
        'CURRENT_PLAN_NOT_FOUND',
        { planId: currentSubscription.planId }
      );
    }

    // Calculate prorated amount
    const changeDate = new Date();
    const proratedAmount = currentPlan.calculateProratedAmount(
      newPlan,
      changeDate,
      currentSubscription.currentPeriodEnd
    );

    // Determine change type
    const changeType = newPlan.pricing.amount > currentPlan.pricing.amount ? 'upgrade' : 
                      newPlan.pricing.amount < currentPlan.pricing.amount ? 'downgrade' : 'change';

    // Update subscription plan
    await currentSubscription.changePlan(newPlan._id, changeType, proratedAmount, reason);
    
    // Update billing information
    currentSubscription.billing = {
      currency: newPlan.pricing.currency,
      amount: newPlan.pricing.amount,
      interval: newPlan.pricing.interval,
      intervalCount: newPlan.pricing.intervalCount
    };

    if (session) await currentSubscription.save({ session });

    // Grant additional credits if upgrading
    if (changeType === 'upgrade' && immediate) {
      // Calculate prorated credits for remaining period
      const remainingDays = Math.ceil(
        (currentSubscription.currentPeriodEnd - changeDate) / (1000 * 60 * 60 * 24)
      );
      const totalDays = currentPlan.pricing.interval === 'monthly' ? 30 : 365;
      const creditDifference = newPlan.features.credits.monthly - currentPlan.features.credits.monthly;
      const proratedCredits = Math.floor((creditDifference * remainingDays) / totalDays);

      if (proratedCredits > 0) {
        await this.creditService.grantSubscriptionCredits(
          userId,
          proratedCredits,
          currentSubscription.currentPeriodEnd,
          currentSubscription._id.toString(),
          {
            reason: 'plan_upgrade',
            proratedCredits: true,
            originalCredits: creditDifference,
            remainingDays,
            totalDays
          }
        );
      }
    }

    logger.info('Subscription upgraded successfully', {
      subscriptionId: currentSubscription._id,
      userId,
      fromPlan: currentPlan.planId,
      toPlan: newPlan.planId,
      changeType,
      proratedAmount
    });

    return {
      success: true,
      subscription: currentSubscription.toObject(),
      oldPlan: currentPlan.toObject(),
      newPlan: newPlan.toObject(),
      changeType,
      proratedAmount,
      message: `Subscription ${changeType}d successfully`
    };
  }

  /**
   * Cancel subscription
   * @param {string|ObjectId} userId - User ID
   * @param {Object} options - Cancellation options
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelSubscription(userId, options = {}) {
    const session = this.useTransactions ? await mongoose.startSession() : null;
    
    try {
      const result = this.useTransactions 
        ? await session.withTransaction(() => this._cancelSubscriptionCore(userId, options, session))
        : await this._cancelSubscriptionCore(userId, options, session);
      
      return result;
    } catch (error) {
      logger.error('Error cancelling subscription', {
        userId,
        options,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      if (session) await session.endSession();
    }
  }

  async _cancelSubscriptionCore(userId, options, session) {
    const { immediately = false, reason = 'user_cancellation' } = options;
    
    // Get current subscription
    const subscription = await Subscription.getUserActiveSubscription(userId);
    if (!subscription) {
      throw new SubscriptionError(
        'No active subscription found for user',
        'NO_ACTIVE_SUBSCRIPTION',
        { userId }
      );
    }

    // Cancel subscription
    await subscription.cancel(immediately, reason);
    if (session) await subscription.save({ session });

    // If cancelled immediately, expire subscription credits
    if (immediately) {
      await this.creditService.expireSubscriptionCredits(new Date());
    }

    logger.info('Subscription cancelled successfully', {
      subscriptionId: subscription._id,
      userId,
      immediately,
      reason
    });

    return {
      success: true,
      subscription: subscription.toObject(),
      cancelledImmediately: immediately,
      message: immediately 
        ? 'Subscription cancelled immediately' 
        : 'Subscription will be cancelled at the end of current period'
    };
  }

  /**
   * Process failed payment webhook
   * @param {Object} webhookData - Razorpay webhook payload
   * @returns {Promise<Object>} Processing result
   */
  async processFailedPayment(webhookData) {
    try {
      const { subscription: razorpaySubscription, payment } = webhookData;
      
      // Find subscription
      const subscription = await Subscription.getByRazorpayId(razorpaySubscription.id);
      if (!subscription) {
        throw new SubscriptionError(
          'Subscription not found',
          'SUBSCRIPTION_NOT_FOUND',
          { razorpaySubscriptionId: razorpaySubscription.id }
        );
      }

      // Add failed payment to billing history
      if (payment) {
        await subscription.addPayment({
          razorpayPaymentId: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: 'failed',
          paymentMethod: payment.method,
          paidAt: new Date(payment.created_at * 1000),
          failureReason: payment.error_description || 'Payment failed',
          webhookData: payment
        });
      }

      // Update subscription status if needed
      if (razorpaySubscription.status === 'halted' || razorpaySubscription.status === 'cancelled') {
        subscription.status = 'cancelled';
        await subscription.save();
      }

      logger.warn('Failed payment processed', {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        paymentId: payment?.id,
        failureReason: payment?.error_description
      });

      return {
        success: true,
        subscription: subscription.toObject(),
        paymentFailed: true,
        message: 'Failed payment processed'
      };
    } catch (error) {
      logger.error('Error processing failed payment', {
        webhookData,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get user's billing history
   * @param {string|ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Billing history
   */
  async getBillingHistory(userId, options = {}) {
    try {
      const { limit = 10, skip = 0, startDate, endDate } = options;
      
      // Get user's subscriptions
      const subscriptions = await Subscription.getUserSubscriptionHistory(userId, {
        limit: 100, // Get more subscriptions to aggregate billing history
        skip: 0
      });

      // Aggregate billing history from all subscriptions
      let allPayments = [];
      subscriptions.forEach(subscription => {
        const payments = subscription.billingHistory.map(payment => ({
          ...payment.toObject(),
          subscriptionId: subscription._id,
          planName: subscription.planId?.name || 'Unknown Plan'
        }));
        allPayments = allPayments.concat(payments);
      });

      // Filter by date range if provided
      if (startDate || endDate) {
        allPayments = allPayments.filter(payment => {
          const paymentDate = new Date(payment.paidAt);
          if (startDate && paymentDate < startDate) return false;
          if (endDate && paymentDate > endDate) return false;
          return true;
        });
      }

      // Sort by payment date (newest first)
      allPayments.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

      // Apply pagination
      const paginatedPayments = allPayments.slice(skip, skip + limit);

      // Calculate totals
      const totalAmount = allPayments
        .filter(payment => payment.status === 'paid')
        .reduce((sum, payment) => sum + payment.amount, 0);

      const totalPayments = allPayments.length;
      const successfulPayments = allPayments.filter(payment => payment.status === 'paid').length;
      const failedPayments = allPayments.filter(payment => payment.status === 'failed').length;

      return {
        success: true,
        billingHistory: paginatedPayments,
        pagination: {
          total: totalPayments,
          limit,
          skip,
          hasMore: skip + limit < totalPayments
        },
        summary: {
          totalAmount,
          totalPayments,
          successfulPayments,
          failedPayments,
          successRate: totalPayments > 0 ? (successfulPayments / totalPayments * 100).toFixed(2) : 0
        }
      };
    } catch (error) {
      logger.error('Error getting billing history', {
        userId,
        options,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get subscription analytics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Subscription analytics
   */
  async getSubscriptionAnalytics(filters = {}) {
    try {
      const { startDate, endDate, planId } = filters;
      
      // Get subscription statistics
      const stats = await Subscription.getSubscriptionStats({ startDate, endDate });
      
      // Get plan-specific analytics if planId provided
      let planAnalytics = null;
      if (planId) {
        const plan = await Plan.findById(planId);
        if (plan) {
          const planSubscriptions = await Subscription.find({
            planId,
            ...(startDate || endDate ? {
              createdAt: {
                ...(startDate && { $gte: startDate }),
                ...(endDate && { $lte: endDate })
              }
            } : {})
          });

          planAnalytics = {
            plan: plan.toObject(),
            totalSubscriptions: planSubscriptions.length,
            activeSubscriptions: planSubscriptions.filter(sub => sub.status === 'active').length,
            revenue: planSubscriptions
              .filter(sub => sub.status === 'active')
              .reduce((sum, sub) => sum + sub.billing.amount, 0)
          };
        }
      }

      // Get churn rate (cancelled subscriptions in the period)
      const churnQuery = {
        status: 'cancelled',
        ...(startDate || endDate ? {
          cancelledAt: {
            ...(startDate && { $gte: startDate }),
            ...(endDate && { $lte: endDate })
          }
        } : {})
      };
      const churnedSubscriptions = await Subscription.countDocuments(churnQuery);
      const churnRate = stats.total > 0 ? (churnedSubscriptions / stats.total * 100).toFixed(2) : 0;

      return {
        success: true,
        analytics: {
          ...stats,
          churnRate: parseFloat(churnRate),
          churnedSubscriptions,
          ...(planAnalytics && { planAnalytics })
        }
      };
    } catch (error) {
      logger.error('Error getting subscription analytics', {
        filters,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Process subscription cancellation at period end (scheduled job)
   * @returns {Promise<Object>} Processing result
   */
  async processScheduledCancellations() {
    try {
      const subscriptionsToCancel = await Subscription.getSubscriptionsToCancel();
      
      const results = [];
      for (const subscription of subscriptionsToCancel) {
        try {
          subscription.status = 'cancelled';
          subscription.cancelledAt = new Date();
          await subscription.save();

          // Expire subscription credits immediately
          await this.creditService.expireSubscriptionCredits(new Date());

          results.push({
            subscriptionId: subscription._id,
            userId: subscription.userId,
            success: true
          });

          logger.info('Subscription cancelled at period end', {
            subscriptionId: subscription._id,
            userId: subscription.userId
          });
        } catch (error) {
          results.push({
            subscriptionId: subscription._id,
            userId: subscription.userId,
            success: false,
            error: error.message
          });

          logger.error('Error cancelling subscription at period end', {
            subscriptionId: subscription._id,
            userId: subscription.userId,
            error: error.message
          });
        }
      }

      return {
        success: true,
        processedSubscriptions: results.length,
        successfulCancellations: results.filter(r => r.success).length,
        failedCancellations: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      logger.error('Error processing scheduled cancellations', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Helper methods

  /**
   * Find user from webhook data
   * @private
   */
  async _findUserFromWebhook(webhookData, session = null) {
    const { subscription, customer } = webhookData;
    
    // Try to find by customer email first
    if (customer?.email) {
      const query = User.findOne({ email: customer.email });
      const user = session ? await query.session(session) : await query;
      if (user) return user;
    }

    // Try to find by customer ID in metadata
    if (subscription?.notes?.userId) {
      const query = User.findById(subscription.notes.userId);
      const user = session ? await query.session(session) : await query;
      if (user) return user;
    }

    return null;
  }

  /**
   * Grant subscription credits for a plan
   * @private
   */
  async _grantSubscriptionCredits(subscription, plan, session = null) {
    const creditsToGrant = plan.features.credits.monthly;
    if (creditsToGrant > 0) {
      await this.creditService.grantSubscriptionCredits(
        subscription.userId,
        creditsToGrant,
        subscription.currentPeriodEnd,
        subscription._id.toString(),
        {
          planId: plan._id,
          planName: plan.name,
          grantedAt: new Date(),
          source: 'subscription_activation'
        }
      );
    }
  }
}

// Export error classes for use in other modules
SubscriptionService.SubscriptionError = SubscriptionError;
SubscriptionService.PaymentError = PaymentError;

module.exports = SubscriptionService;