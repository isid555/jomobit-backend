const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const creditService = require('../services/creditService');
const razorpay = require('../config/razorpay.config');
const logger = require('../utils/logger');

/**
 * SubscriptionJobs Class
 * Manages scheduled jobs for subscription and credit management
 */
class SubscriptionJobs {
  constructor() {
    this.jobs = [];
    this.isInitialized = false;
  }

  /**
   * Initialize all scheduled jobs
   * Starts all cron jobs for subscription management
   */
  initializeJobs() {
    if (this.isInitialized) {
      logger.warn('Subscription jobs already initialized');
      return;
    }

    logger.info('Initializing subscription jobs...');

    try {
      // Job 1: Credit expiry job (runs hourly)
      this.scheduleCreditExpiryJob();

      // Job 2: Subscription reconciliation job (runs daily at 1 AM)
      this.scheduleReconciliationJob();

      // Job 3: Scheduled plan change job (runs every 6 hours)
      this.scheduleScheduledPlanChangeJob();

      this.isInitialized = true;
      logger.info('All subscription jobs initialized successfully', {
        jobCount: this.jobs.length
      });
    } catch (error) {
      logger.error('Error initializing subscription jobs', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Schedule credit expiry job
   * Runs hourly to expire credits for subscriptions that have ended
   */
  scheduleCreditExpiryJob() {
    const job = cron.schedule('0 * * * *', async () => {
      await this.runCreditExpiryJob();
    });

    this.jobs.push({ name: 'creditExpiry', job });
    logger.info('Credit expiry job scheduled (runs hourly)');
  }

  /**
   * Schedule subscription reconciliation job
   * Runs daily at 1 AM to reconcile local subscriptions with Razorpay
   */
  scheduleReconciliationJob() {
    const job = cron.schedule('0 1 * * *', async () => {
      await this.runReconciliationJob();
    });

    this.jobs.push({ name: 'reconciliation', job });
    logger.info('Subscription reconciliation job scheduled (runs daily at 1 AM)');
  }

  /**
   * Schedule scheduled plan change job
   * Runs every 6 hours to process scheduled plan changes
   */
  scheduleScheduledPlanChangeJob() {
    const job = cron.schedule('0 */6 * * *', async () => {
      await this.runScheduledPlanChangeJob();
    });

    this.jobs.push({ name: 'scheduledPlanChange', job });
    logger.info('Scheduled plan change job scheduled (runs every 6 hours)');
  }

  /**
   * Run credit expiry job
   * Finds subscriptions with expired periods and expires their credits
   */
  async runCreditExpiryJob() {
    const startTime = Date.now();
    logger.info('Starting credit expiry job');

    let stats = {
      subscriptionsProcessed: 0,
      creditsExpired: 0,
      errors: 0
    };

    try {
      // Find subscriptions with currentPeriodEnd <= now and status not active
      const now = new Date();
      const subscriptions = await Subscription.find({
        currentPeriodEnd: { $lte: now },
        status: { $nin: ['active', 'cancelled', 'completed'] }
      }).populate('userId');

      logger.info(`Found ${subscriptions.length} subscriptions to check for credit expiry`);

      for (const subscription of subscriptions) {
        try {
          // Check if next payment was made by comparing paidCount and currentPeriodStart
          const nextPaymentMade = subscription.currentPeriodStart > subscription.currentPeriodEnd;

          if (!nextPaymentMade) {
            // Expire subscription credits
            const result = await creditService.expireSubscriptionCredits(
              subscription.currentPeriodEnd
            );

            stats.subscriptionsProcessed++;
            stats.creditsExpired += result.totalExpired || 0;

            logger.info('Credits expired for subscription', {
              subscriptionId: subscription._id,
              userId: subscription.userId,
              creditsExpired: result.totalExpired,
              expiryDate: subscription.currentPeriodEnd
            });
          }
        } catch (error) {
          stats.errors++;
          logger.error('Error expiring credits for subscription', {
            subscriptionId: subscription._id,
            error: error.message,
            stack: error.stack
          });
        }
      }

      const executionTime = Date.now() - startTime;
      logger.info('Credit expiry job completed', {
        ...stats,
        executionTimeMs: executionTime
      });

      return stats;
    } catch (error) {
      logger.error('Error running credit expiry job', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Run subscription reconciliation job
   * Fetches subscription status from Razorpay and updates local data
   */
  async runReconciliationJob() {
    const startTime = Date.now();
    logger.info('Starting subscription reconciliation job');

    // Check if reconciliation is enabled
    const reconciliationEnabled = process.env.SUBSCRIPTION_RECONCILIATION_ENABLED !== 'false';
    if (!reconciliationEnabled) {
      logger.info('Subscription reconciliation is disabled');
      return { skipped: true };
    }

    let stats = {
      totalChecked: 0,
      mismatchesFound: 0,
      errors: 0
    };

    try {
      // Fetch active/pending subscriptions in batches of 100
      const batchSize = 100;
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const subscriptions = await Subscription.find({
          status: { $in: ['active', 'pending', 'authenticated'] }
        })
          .limit(batchSize)
          .skip(skip)
          .exec();

        if (subscriptions.length === 0) {
          hasMore = false;
          break;
        }

        logger.info(`Processing batch of ${subscriptions.length} subscriptions`, {
          skip,
          batchSize
        });

        for (const subscription of subscriptions) {
          try {
            // Fetch status from Razorpay API
            const razorpaySubscription = await razorpay.subscriptions.fetch(
              subscription.razorpaySubscriptionId
            );

            stats.totalChecked++;

            // Compare local status with Razorpay status
            const razorpayStatus = this.mapRazorpayStatus(razorpaySubscription.status);
            
            if (subscription.status !== razorpayStatus) {
              // Mismatch found - update local subscription
              logger.warn('Subscription status mismatch detected', {
                subscriptionId: subscription._id,
                razorpaySubscriptionId: subscription.razorpaySubscriptionId,
                localStatus: subscription.status,
                razorpayStatus: razorpayStatus
              });

              subscription.status = razorpayStatus;
              
              // Update other fields from Razorpay
              if (razorpaySubscription.paid_count !== undefined) {
                subscription.paidCount = razorpaySubscription.paid_count;
              }
              if (razorpaySubscription.remaining_count !== undefined) {
                subscription.remainingCount = razorpaySubscription.remaining_count;
              }
              if (razorpaySubscription.charge_at) {
                subscription.chargeAt = new Date(razorpaySubscription.charge_at * 1000);
              }
              if (razorpaySubscription.start_at) {
                subscription.startAt = new Date(razorpaySubscription.start_at * 1000);
              }
              if (razorpaySubscription.end_at) {
                subscription.endAt = new Date(razorpaySubscription.end_at * 1000);
              }
              if (razorpaySubscription.ended_at) {
                subscription.endedAt = new Date(razorpaySubscription.ended_at * 1000);
              }

              await subscription.save();
              stats.mismatchesFound++;

              logger.info('Subscription reconciled', {
                subscriptionId: subscription._id,
                updatedStatus: razorpayStatus
              });
            }
          } catch (error) {
            stats.errors++;
            logger.error('Error reconciling subscription', {
              subscriptionId: subscription._id,
              razorpaySubscriptionId: subscription.razorpaySubscriptionId,
              error: error.message
            });
          }
        }

        skip += batchSize;
      }

      const executionTime = Date.now() - startTime;
      logger.info('Subscription reconciliation job completed', {
        ...stats,
        executionTimeMs: executionTime
      });

      return stats;
    } catch (error) {
      logger.error('Error running subscription reconciliation job', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Run scheduled plan change job
   * Processes scheduled plan changes that are due
   */
  async runScheduledPlanChangeJob() {
    const startTime = Date.now();
    logger.info('Starting scheduled plan change job');

    let stats = {
      planChangesProcessed: 0,
      errors: 0
    };

    try {
      // Find subscriptions with scheduledChange.effectiveDate <= now
      const now = new Date();
      const subscriptions = await Subscription.find({
        'scheduledChange.effectiveDate': { $lte: now },
        'scheduledChange.newPlanId': { $exists: true }
      }).populate('planId scheduledChange.newPlanId');

      logger.info(`Found ${subscriptions.length} scheduled plan changes to process`);

      for (const subscription of subscriptions) {
        try {
          const oldPlan = subscription.planId;
          const newPlan = subscription.scheduledChange.newPlanId;

          // Fetch full plan details if not populated
          const newPlanDetails = newPlan._id ? newPlan : await Plan.findById(newPlan);

          if (!newPlanDetails) {
            throw new Error(`New plan not found: ${newPlan}`);
          }

          logger.info('Processing scheduled plan change', {
            subscriptionId: subscription._id,
            razorpaySubscriptionId: subscription.razorpaySubscriptionId,
            oldPlanId: oldPlan._id,
            newPlanId: newPlanDetails._id,
            changeType: subscription.scheduledChange.changeType
          });

          // Update subscription.planId to scheduledChange.newPlanId
          subscription.planId = newPlanDetails._id;

          // Update billing details from new plan
          subscription.billing = {
            amount: newPlanDetails.pricing.amount,
            currency: newPlanDetails.pricing.currency,
            interval: newPlanDetails.pricing.interval,
            intervalCount: newPlanDetails.pricing.intervalCount
          };

          // Update Razorpay subscription with new plan_id
          try {
            await razorpay.subscriptions.update(
              subscription.razorpaySubscriptionId,
              {
                plan_id: newPlanDetails.razorpayPlanId,
                quantity: 1
              }
            );

            logger.info('Razorpay subscription updated with new plan', {
              razorpaySubscriptionId: subscription.razorpaySubscriptionId,
              newRazorpayPlanId: newPlanDetails.razorpayPlanId
            });
          } catch (razorpayError) {
            logger.error('Error updating Razorpay subscription', {
              razorpaySubscriptionId: subscription.razorpaySubscriptionId,
              error: razorpayError.message
            });
            // Continue with local update even if Razorpay update fails
          }

          // Record change in planChanges array
          subscription.planChanges.push({
            fromPlanId: oldPlan._id || oldPlan,
            toPlanId: newPlanDetails._id,
            changeType: subscription.scheduledChange.changeType,
            effectiveDate: new Date(),
            reason: subscription.scheduledChange.reason || 'Scheduled plan change'
          });

          // Clear scheduledChange field
          subscription.scheduledChange = undefined;

          await subscription.save();
          stats.planChangesProcessed++;

          logger.info('Scheduled plan change completed', {
            subscriptionId: subscription._id,
            oldPlanName: oldPlan.name,
            newPlanName: newPlanDetails.name,
            changeType: subscription.scheduledChange?.changeType
          });
        } catch (error) {
          stats.errors++;
          logger.error('Error processing scheduled plan change', {
            subscriptionId: subscription._id,
            error: error.message,
            stack: error.stack
          });
        }
      }

      const executionTime = Date.now() - startTime;
      logger.info('Scheduled plan change job completed', {
        ...stats,
        executionTimeMs: executionTime
      });

      return stats;
    } catch (error) {
      logger.error('Error running scheduled plan change job', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Map Razorpay subscription status to local status
   * @param {string} razorpayStatus - Razorpay subscription status
   * @returns {string} Local subscription status
   */
  mapRazorpayStatus(razorpayStatus) {
    const statusMap = {
      'created': 'created',
      'authenticated': 'authenticated',
      'active': 'active',
      'pending': 'pending',
      'halted': 'halted',
      'cancelled': 'cancelled',
      'completed': 'completed',
      'expired': 'expired',
      'paused': 'paused'
    };

    return statusMap[razorpayStatus] || razorpayStatus;
  }

  /**
   * Stop all scheduled jobs
   * Useful for graceful shutdown
   */
  stopAllJobs() {
    logger.info('Stopping all subscription jobs');

    for (const { name, job } of this.jobs) {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    }

    this.isInitialized = false;
    this.jobs = [];
  }

  /**
   * Get job status
   * @returns {Object} Status of all jobs
   */
  getJobStatus() {
    return {
      initialized: this.isInitialized,
      jobCount: this.jobs.length,
      jobs: this.jobs.map(({ name }) => ({ name }))
    };
  }
}

// Export singleton instance
const subscriptionJobs = new SubscriptionJobs();
module.exports = subscriptionJobs;
