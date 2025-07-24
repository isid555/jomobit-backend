const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const SubscriptionService = require('../../../src/services/subscriptionService');
const { CreditService } = require('../../../src/services/creditService');
const Subscription = require('../../../src/models/Subscription');
const Plan = require('../../../src/models/Plan');
const User = require('../../../src/models/User');

describe('SubscriptionService', () => {
  let mongoServer;
  let subscriptionService;
  let creditService;
  let testUser;
  let testPlan;
  let freePlan;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    
    // Create test services
    creditService = new CreditService({ useTransactions: false });
    subscriptionService = new SubscriptionService({ 
      creditService,
      useTransactions: false 
    });

    // Create test user
    testUser = await User.create({
      auth0Id: 'auth0|test123',
      email: 'test@example.com',
      status: 'active',
      metadata: {
        name: 'Test User'
      }
    });

    // Create test plans
    freePlan = await Plan.create({
      name: 'Free',
      planId: 'free',
      description: 'Free plan',
      pricing: {
        amount: 0,
        currency: 'INR',
        interval: 'monthly'
      },
      features: {
        credits: { monthly: 3 },
        businessProfiles: { limit: 1 },
        templates: { access: 'basic' },
        aiProviders: {
          llm: ['openai'],
          diffusion: ['openai']
        }
      },
      tier: 'free',
      razorpayPlanId: 'plan_free123'
    });

    testPlan = await Plan.create({
      name: 'Plus',
      planId: 'plus',
      description: 'Plus plan',
      pricing: {
        amount: 2500,
        currency: 'INR',
        interval: 'monthly'
      },
      features: {
        credits: { monthly: 50 },
        businessProfiles: { limit: 3 },
        templates: { access: 'premium' },
        aiProviders: {
          llm: ['openai', 'gemini'],
          diffusion: ['openai', 'ideogram']
        }
      },
      tier: 'basic',
      razorpayPlanId: 'plan_test123'
    });
  });

  describe('createSubscription', () => {
    it('should create subscription from Razorpay webhook', async () => {
      const webhookData = {
        subscription: {
          id: 'sub_test123',
          plan_id: 'plan_test123',
          customer_id: 'cust_test123',
          status: 'active',
          current_start: Math.floor(Date.now() / 1000),
          current_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
        },
        customer: {
          email: 'test@example.com'
        },
        payment: {
          id: 'pay_test123',
          amount: 2500,
          currency: 'INR',
          status: 'paid',
          method: 'card',
          created_at: Math.floor(Date.now() / 1000)
        }
      };

      const result = await subscriptionService.createSubscription(webhookData);

      expect(result.success).toBe(true);
      expect(result.subscription).toBeDefined();
      expect(result.subscription.userId.toString()).toBe(testUser._id.toString());
      expect(result.subscription.planId.toString()).toBe(testPlan._id.toString());
      expect(result.subscription.razorpaySubscriptionId).toBe('sub_test123');
      expect(result.subscription.status).toBe('active');
      expect(result.subscription.billingHistory).toHaveLength(1);
      expect(result.subscription.billingHistory[0].razorpayPaymentId).toBe('pay_test123');
    });

    it('should throw error if user not found', async () => {
      const webhookData = {
        subscription: {
          id: 'sub_test123',
          plan_id: 'plan_test123',
          customer_id: 'cust_test123',
          status: 'active',
          current_start: Math.floor(Date.now() / 1000),
          current_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
        },
        customer: {
          email: 'nonexistent@example.com'
        }
      };

      await expect(subscriptionService.createSubscription(webhookData))
        .rejects.toThrow('User not found for subscription');
    });

    it('should throw error if plan not found', async () => {
      const webhookData = {
        subscription: {
          id: 'sub_test123',
          plan_id: 'plan_nonexistent',
          customer_id: 'cust_test123',
          status: 'active',
          current_start: Math.floor(Date.now() / 1000),
          current_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
        },
        customer: {
          email: 'test@example.com'
        }
      };

      await expect(subscriptionService.createSubscription(webhookData))
        .rejects.toThrow('Plan not found for subscription');
    });

    it('should throw error if user already has active subscription', async () => {
      // Create existing subscription
      await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_existing123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billing: {
          currency: 'INR',
          amount: 2500,
          interval: 'monthly'
        },
        status: 'active'
      });

      const webhookData = {
        subscription: {
          id: 'sub_test123',
          plan_id: 'plan_test123',
          customer_id: 'cust_test123',
          status: 'active',
          current_start: Math.floor(Date.now() / 1000),
          current_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
        },
        customer: {
          email: 'test@example.com'
        }
      };

      await expect(subscriptionService.createSubscription(webhookData))
        .rejects.toThrow('User already has an active subscription');
    });

    it('should handle trial period correctly', async () => {
      const trialStart = Math.floor(Date.now() / 1000);
      const trialEnd = Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000);

      const webhookData = {
        subscription: {
          id: 'sub_test123',
          plan_id: 'plan_test123',
          customer_id: 'cust_test123',
          status: 'active',
          current_start: Math.floor(Date.now() / 1000),
          current_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
          trial_start: trialStart,
          trial_end: trialEnd
        },
        customer: {
          email: 'test@example.com'
        }
      };

      const result = await subscriptionService.createSubscription(webhookData);

      expect(result.success).toBe(true);
      expect(result.subscription.trialStart).toBeDefined();
      expect(result.subscription.trialEnd).toBeDefined();
      expect(new Date(result.subscription.trialStart).getTime()).toBe(trialStart * 1000);
      expect(new Date(result.subscription.trialEnd).getTime()).toBe(trialEnd * 1000);
    });
  });

  describe('processSubscriptionRenewal', () => {
    let existingSubscription;

    beforeEach(async () => {
      existingSubscription = await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_test123',
        currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(),
        billing: {
          currency: 'INR',
          amount: 2500,
          interval: 'monthly'
        },
        status: 'active'
      });
    });

    it('should process subscription renewal successfully', async () => {
      const newPeriodStart = Math.floor(Date.now() / 1000);
      const newPeriodEnd = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000);

      const webhookData = {
        subscription: {
          id: 'sub_test123',
          current_start: newPeriodStart,
          current_end: newPeriodEnd
        },
        payment: {
          id: 'pay_renewal123',
          amount: 2500,
          currency: 'INR',
          status: 'paid',
          method: 'card',
          created_at: Math.floor(Date.now() / 1000)
        }
      };

      const result = await subscriptionService.processSubscriptionRenewal(webhookData);

      expect(result.success).toBe(true);
      expect(result.subscription.status).toBe('active');
      expect(new Date(result.subscription.currentPeriodStart).getTime()).toBe(newPeriodStart * 1000);
      expect(new Date(result.subscription.currentPeriodEnd).getTime()).toBe(newPeriodEnd * 1000);
      expect(result.subscription.billingHistory).toHaveLength(1);
      expect(result.subscription.billingHistory[0].razorpayPaymentId).toBe('pay_renewal123');
    });

    it('should throw error if subscription not found', async () => {
      const webhookData = {
        subscription: {
          id: 'sub_nonexistent',
          current_start: Math.floor(Date.now() / 1000),
          current_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
        }
      };

      await expect(subscriptionService.processSubscriptionRenewal(webhookData))
        .rejects.toThrow('Subscription not found');
    });
  });

  describe('upgradeSubscription', () => {
    let currentSubscription;
    let proPlan;

    beforeEach(async () => {
      // Create Pro plan
      proPlan = await Plan.create({
        name: 'Pro',
        planId: 'pro',
        description: 'Pro plan',
        pricing: {
          amount: 5900,
          currency: 'INR',
          interval: 'monthly'
        },
        features: {
          credits: { monthly: 120 },
          businessProfiles: { limit: 8 },
          templates: { access: 'all' },
          aiProviders: {
            llm: ['openai', 'gemini'],
            diffusion: ['openai', 'ideogram']
          }
        },
        tier: 'premium',
        razorpayPlanId: 'plan_pro123'
      });

      // Create current subscription
      currentSubscription = await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_test123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billing: {
          currency: 'INR',
          amount: 2500,
          interval: 'monthly'
        },
        status: 'active'
      });
    });

    it('should upgrade subscription successfully', async () => {
      const result = await subscriptionService.upgradeSubscription(
        testUser._id,
        'pro',
        { reason: 'user_upgrade' }
      );

      expect(result.success).toBe(true);
      expect(result.changeType).toBe('upgrade');
      expect(result.subscription.planId.toString()).toBe(proPlan._id.toString());
      expect(result.subscription.billing.amount).toBe(5900);
      expect(result.proratedAmount).toBeGreaterThan(0);
      expect(result.subscription.planChanges).toHaveLength(1);
      expect(result.subscription.planChanges[0].changeType).toBe('upgrade');
      expect(result.subscription.planChanges[0].fromPlanId).toEqual(testPlan._id);
      expect(result.subscription.planChanges[0].toPlanId).toEqual(proPlan._id);
    });

    it('should downgrade subscription successfully', async () => {
      const result = await subscriptionService.upgradeSubscription(
        testUser._id,
        'free',
        { reason: 'user_downgrade' }
      );

      expect(result.success).toBe(true);
      expect(result.changeType).toBe('downgrade');
      expect(result.subscription.planId.toString()).toBe(freePlan._id.toString());
      expect(result.subscription.billing.amount).toBe(0);
      expect(result.proratedAmount).toBeLessThan(0);
    });

    it('should throw error if no active subscription found', async () => {
      await Subscription.findByIdAndUpdate(currentSubscription._id, { status: 'cancelled' });

      await expect(subscriptionService.upgradeSubscription(testUser._id, 'pro'))
        .rejects.toThrow('No active subscription found for user');
    });

    it('should throw error if new plan not found', async () => {
      await expect(subscriptionService.upgradeSubscription(testUser._id, 'nonexistent'))
        .rejects.toThrow('New plan not found');
    });
  });

  describe('cancelSubscription', () => {
    let activeSubscription;

    beforeEach(async () => {
      activeSubscription = await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_test123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billing: {
          currency: 'INR',
          amount: 2500,
          interval: 'monthly'
        },
        status: 'active'
      });
    });

    it('should cancel subscription at period end', async () => {
      const result = await subscriptionService.cancelSubscription(
        testUser._id,
        { reason: 'user_cancellation' }
      );

      expect(result.success).toBe(true);
      expect(result.cancelledImmediately).toBe(false);
      expect(result.subscription.cancelAtPeriodEnd).toBe(true);
      expect(result.subscription.status).toBe('active'); // Still active until period end
      expect(result.subscription.cancellationReason).toBe('user_cancellation');
    });

    it('should cancel subscription immediately', async () => {
      const result = await subscriptionService.cancelSubscription(
        testUser._id,
        { immediately: true, reason: 'user_cancellation' }
      );

      expect(result.success).toBe(true);
      expect(result.cancelledImmediately).toBe(true);
      expect(result.subscription.status).toBe('cancelled');
      expect(result.subscription.cancelledAt).toBeDefined();
      expect(result.subscription.cancellationReason).toBe('user_cancellation');
    });

    it('should throw error if no active subscription found', async () => {
      await Subscription.findByIdAndUpdate(activeSubscription._id, { status: 'cancelled' });

      await expect(subscriptionService.cancelSubscription(testUser._id))
        .rejects.toThrow('No active subscription found for user');
    });
  });

  describe('processFailedPayment', () => {
    let activeSubscription;

    beforeEach(async () => {
      activeSubscription = await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_test123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billing: {
          currency: 'INR',
          amount: 2500,
          interval: 'monthly'
        },
        status: 'active'
      });
    });

    it('should process failed payment successfully', async () => {
      const webhookData = {
        subscription: {
          id: 'sub_test123',
          status: 'active'
        },
        payment: {
          id: 'pay_failed123',
          amount: 2500,
          currency: 'INR',
          status: 'failed',
          method: 'card',
          created_at: Math.floor(Date.now() / 1000),
          error_description: 'Insufficient funds'
        }
      };

      const result = await subscriptionService.processFailedPayment(webhookData);

      expect(result.success).toBe(true);
      expect(result.paymentFailed).toBe(true);
      expect(result.subscription.billingHistory).toHaveLength(1);
      expect(result.subscription.billingHistory[0].status).toBe('failed');
      expect(result.subscription.billingHistory[0].failureReason).toBe('Insufficient funds');
    });

    it('should cancel subscription if Razorpay status is halted', async () => {
      const webhookData = {
        subscription: {
          id: 'sub_test123',
          status: 'halted'
        },
        payment: {
          id: 'pay_failed123',
          amount: 2500,
          currency: 'INR',
          status: 'failed',
          method: 'card',
          created_at: Math.floor(Date.now() / 1000),
          error_description: 'Card expired'
        }
      };

      const result = await subscriptionService.processFailedPayment(webhookData);

      expect(result.success).toBe(true);
      expect(result.subscription.status).toBe('cancelled');
    });

    it('should throw error if subscription not found', async () => {
      const webhookData = {
        subscription: {
          id: 'sub_nonexistent',
          status: 'active'
        }
      };

      await expect(subscriptionService.processFailedPayment(webhookData))
        .rejects.toThrow('Subscription not found');
    });
  });

  describe('getBillingHistory', () => {
    let subscription1, subscription2;

    beforeEach(async () => {
      // Create subscriptions with billing history
      subscription1 = await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_test123',
        currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        billing: {
          currency: 'INR',
          amount: 2500,
          interval: 'monthly'
        },
        status: 'cancelled',
        billingHistory: [
          {
            razorpayPaymentId: 'pay_old123',
            amount: 2500,
            currency: 'INR',
            status: 'paid',
            paymentMethod: 'card',
            paidAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
          }
        ]
      });

      subscription2 = await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_test456',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billing: {
          currency: 'INR',
          amount: 2500,
          interval: 'monthly'
        },
        status: 'active',
        billingHistory: [
          {
            razorpayPaymentId: 'pay_recent123',
            amount: 2500,
            currency: 'INR',
            status: 'paid',
            paymentMethod: 'card',
            paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          },
          {
            razorpayPaymentId: 'pay_failed123',
            amount: 2500,
            currency: 'INR',
            status: 'failed',
            paymentMethod: 'card',
            paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            failureReason: 'Card declined'
          }
        ]
      });
    });

    it('should get billing history successfully', async () => {
      const result = await subscriptionService.getBillingHistory(testUser._id);

      expect(result.success).toBe(true);
      expect(result.billingHistory).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.summary.totalPayments).toBe(3);
      expect(result.summary.successfulPayments).toBe(2);
      expect(result.summary.failedPayments).toBe(1);
      expect(result.summary.totalAmount).toBe(5000); // 2 successful payments of 2500 each
      expect(result.summary.successRate).toBe('66.67');
    });

    it('should apply pagination correctly', async () => {
      const result = await subscriptionService.getBillingHistory(testUser._id, {
        limit: 2,
        skip: 1
      });

      expect(result.success).toBe(true);
      expect(result.billingHistory).toHaveLength(2);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.skip).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const result = await subscriptionService.getBillingHistory(testUser._id, {
        startDate,
        endDate
      });

      expect(result.success).toBe(true);
      expect(result.billingHistory).toHaveLength(2); // Only recent payments
      expect(result.summary.totalPayments).toBe(2);
    });
  });

  describe('getSubscriptionAnalytics', () => {
    beforeEach(async () => {
      // Create test subscriptions
      await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_active1',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billing: { currency: 'INR', amount: 2500, interval: 'monthly' },
        status: 'active'
      });

      await Subscription.create({
        userId: testUser._id,
        planId: freePlan._id,
        razorpaySubscriptionId: 'sub_cancelled1',
        currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        billing: { currency: 'INR', amount: 0, interval: 'monthly' },
        status: 'cancelled',
        cancelledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      });
    });

    it('should get subscription analytics successfully', async () => {
      const result = await subscriptionService.getSubscriptionAnalytics();

      expect(result.success).toBe(true);
      expect(result.analytics.total).toBe(2);
      expect(result.analytics.active).toBe(1);
      expect(result.analytics.churnedSubscriptions).toBe(1);
      expect(result.analytics.churnRate).toBe(50);
      expect(result.analytics.monthlyRecurringRevenue).toBe(2500);
    });

    it('should get plan-specific analytics', async () => {
      const result = await subscriptionService.getSubscriptionAnalytics({
        planId: testPlan._id
      });

      expect(result.success).toBe(true);
      expect(result.analytics.planAnalytics).toBeDefined();
      expect(result.analytics.planAnalytics.totalSubscriptions).toBe(1);
      expect(result.analytics.planAnalytics.activeSubscriptions).toBe(1);
      expect(result.analytics.planAnalytics.revenue).toBe(2500);
    });
  });

  describe('processScheduledCancellations', () => {
    beforeEach(async () => {
      // Create subscription scheduled for cancellation
      await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_to_cancel',
        currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() - 1000), // Expired
        billing: { currency: 'INR', amount: 2500, interval: 'monthly' },
        status: 'active',
        cancelAtPeriodEnd: true
      });

      // Create subscription not scheduled for cancellation
      await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billing: { currency: 'INR', amount: 2500, interval: 'monthly' },
        status: 'active',
        cancelAtPeriodEnd: false
      });
    });

    it('should process scheduled cancellations successfully', async () => {
      const result = await subscriptionService.processScheduledCancellations();

      expect(result.success).toBe(true);
      expect(result.processedSubscriptions).toBe(1);
      expect(result.successfulCancellations).toBe(1);
      expect(result.failedCancellations).toBe(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);

      // Verify subscription was cancelled
      const cancelledSub = await Subscription.findOne({ razorpaySubscriptionId: 'sub_to_cancel' });
      expect(cancelledSub.status).toBe('cancelled');
      expect(cancelledSub.cancelledAt).toBeDefined();

      // Verify other subscription remains active
      const activeSub = await Subscription.findOne({ razorpaySubscriptionId: 'sub_active' });
      expect(activeSub.status).toBe('active');
    });
  });

  describe('Error Handling', () => {
    it('should handle SubscriptionError correctly', async () => {
      const error = new SubscriptionService.SubscriptionError(
        'Test error',
        'TEST_ERROR',
        { testData: 'test' }
      );

      expect(error.name).toBe('SubscriptionError');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details.testData).toBe('test');
    });

    it('should handle PaymentError correctly', async () => {
      const error = new SubscriptionService.PaymentError(
        'Payment failed',
        'PAYMENT_FAILED',
        { razorpayData: 'test' }
      );

      expect(error.name).toBe('PaymentError');
      expect(error.code).toBe('PAYMENT_FAILED');
      expect(error.razorpayData.razorpayData).toBe('test');
    });
  });

  describe('Prorated Pricing Calculations', () => {
    let currentSubscription;
    let proPlan;

    beforeEach(async () => {
      // Create Pro plan
      proPlan = await Plan.create({
        name: 'Pro',
        planId: 'pro',
        description: 'Pro plan',
        pricing: {
          amount: 5900,
          currency: 'INR',
          interval: 'monthly'
        },
        features: {
          credits: { monthly: 120 },
          businessProfiles: { limit: 8 }
        },
        tier: 'premium'
      });

      // Create subscription with 15 days remaining
      const periodStart = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const periodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

      currentSubscription = await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_test123',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        billing: {
          currency: 'INR',
          amount: 2500,
          interval: 'monthly'
        },
        status: 'active'
      });
    });

    it('should calculate prorated amount correctly for upgrade', async () => {
      const result = await subscriptionService.upgradeSubscription(testUser._id, 'pro');

      expect(result.success).toBe(true);
      expect(result.changeType).toBe('upgrade');
      expect(result.proratedAmount).toBeGreaterThan(0);
      
      // Should be approximately half the difference (15 days out of 30)
      const expectedDifference = 5900 - 2500; // 3400
      const expectedProrated = Math.round(expectedDifference / 2); // ~1700
      expect(Math.abs(result.proratedAmount - expectedProrated)).toBeLessThan(100);
    });

    it('should calculate prorated amount correctly for downgrade', async () => {
      const result = await subscriptionService.upgradeSubscription(testUser._id, 'free');

      expect(result.success).toBe(true);
      expect(result.changeType).toBe('downgrade');
      expect(result.proratedAmount).toBeLessThan(0);
      
      // Should be approximately negative half of current plan amount
      const expectedProrated = Math.round(-2500 / 2); // ~-1250
      expect(Math.abs(result.proratedAmount - expectedProrated)).toBeLessThan(100);
    });
  });
});