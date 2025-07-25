const request = require('supertest');
const crypto = require('crypto');
const app = require('../../../src/app');
const User = require('../../../src/models/User');
const Subscription = require('../../../src/models/Subscription');
const Plan = require('../../../src/models/Plan');
const CreditWallet = require('../../../src/models/CreditWallet');
const { TestDataFactory, mockWebhookPayloads } = require('../../fixtures/testData');

describe('Razorpay Webhooks Integration', () => {
  let testUser;
  let testPlan;
  let webhookSecret;

  beforeEach(async () => {
    // Create test user
    const userData = TestDataFactory.createUserData();
    testUser = await User.create(userData);

    // Create test plan
    const planData = TestDataFactory.createPlanData({
      name: 'plus',
      price: 2500, // ₹25.00
      features: { credits: 50, profiles: 3 }
    });
    testPlan = await Plan.create(planData);

    // Create initial wallet
    await CreditWallet.create({
      userId: testUser._id,
      defaultCredits: 3,
      subscriptionCredits: 0,
      reservedCredits: 0
    });

    webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test-webhook-secret';
  });

  const generateWebhookSignature = (payload, secret) => {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  };

  describe('POST /webhooks/razorpay/subscription-created', () => {
    it('should create subscription and grant credits on successful payment', async () => {
      const payload = {
        entity: 'event',
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: 'sub_test123',
              plan_id: testPlan.razorpayPlanId,
              customer_id: 'cust_test123',
              status: 'active',
              current_start: Math.floor(Date.now() / 1000),
              current_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
              created_at: Math.floor(Date.now() / 1000)
            }
          },
          payment: {
            entity: {
              id: 'pay_test123',
              amount: 2500,
              currency: 'INR',
              status: 'captured'
            }
          }
        }
      };

      const signature = generateWebhookSignature(payload, webhookSecret);

      const response = await request(app)
        .post('/webhooks/razorpay/subscription-created')
        .send(payload)
        .set('X-Razorpay-Signature', signature)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify subscription was created
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: 'sub_test123'
      });
      expect(subscription).toBeTruthy();
      expect(subscription.userId).toEqual(testUser._id);
      expect(subscription.status).toBe('active');

      // Verify credits were granted
      const wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.subscriptionCredits).toBe(50);
      expect(wallet.totalCredits).toBe(53); // 3 default + 50 subscription
    });

    it('should handle subscription upgrade with prorated pricing', async () => {
      // Create existing subscription
      const existingSubscription = await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_existing',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days left
      });

      // Create pro plan
      const proPlan = await Plan.create({
        name: 'pro',
        price: 5900, // ₹59.00
        features: { credits: 120, profiles: 8 },
        razorpayPlanId: 'plan_pro123'
      });

      const payload = {
        entity: 'event',
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: 'sub_upgraded123',
              plan_id: proPlan.razorpayPlanId,
              customer_id: 'cust_test123',
              status: 'active',
              current_start: Math.floor(Date.now() / 1000),
              current_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
            }
          },
          payment: {
            entity: {
              id: 'pay_upgrade123',
              amount: 3450, // Prorated amount
              currency: 'INR',
              status: 'captured'
            }
          }
        }
      };

      const signature = generateWebhookSignature(payload, webhookSecret);

      const response = await request(app)
        .post('/webhooks/razorpay/subscription-created')
        .send(payload)
        .set('X-Razorpay-Signature', signature)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify old subscription was cancelled
      const oldSub = await Subscription.findById(existingSubscription._id);
      expect(oldSub.status).toBe('cancelled');

      // Verify new subscription was created
      const newSub = await Subscription.findOne({
        razorpaySubscriptionId: 'sub_upgraded123'
      });
      expect(newSub).toBeTruthy();
      expect(newSub.planId).toEqual(proPlan._id);

      // Verify credits were updated
      const wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.subscriptionCredits).toBe(120);
    });

    it('should validate webhook signature', async () => {
      const payload = mockWebhookPayloads.razorpayPaymentSuccess;
      const invalidSignature = 'invalid-signature';

      const response = await request(app)
        .post('/webhooks/razorpay/subscription-created')
        .send(payload)
        .set('X-Razorpay-Signature', invalidSignature)
        .expect(401);

      expect(response.body.error).toContain('signature');
    });
  });

  describe('POST /webhooks/razorpay/subscription-cancelled', () => {
    let activeSubscription;

    beforeEach(async () => {
      activeSubscription = await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_active123',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
      });
    });

    it('should cancel subscription but maintain access until period end', async () => {
      const payload = {
        entity: 'event',
        event: 'subscription.cancelled',
        payload: {
          subscription: {
            entity: {
              id: 'sub_active123',
              status: 'cancelled',
              ended_at: Math.floor((Date.now() + 20 * 24 * 60 * 60 * 1000) / 1000)
            }
          }
        }
      };

      const signature = generateWebhookSignature(payload, webhookSecret);

      const response = await request(app)
        .post('/webhooks/razorpay/subscription-cancelled')
        .send(payload)
        .set('X-Razorpay-Signature', signature)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify subscription status
      const subscription = await Subscription.findById(activeSubscription._id);
      expect(subscription.status).toBe('cancelled');
      expect(subscription.cancelAtPeriodEnd).toBe(true);

      // Verify credits are still available until period end
      const wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.subscriptionCredits).toBeGreaterThan(0);
    });

    it('should handle immediate cancellation', async () => {
      const payload = {
        entity: 'event',
        event: 'subscription.cancelled',
        payload: {
          subscription: {
            entity: {
              id: 'sub_active123',
              status: 'cancelled',
              ended_at: Math.floor(Date.now() / 1000) // Immediate cancellation
            }
          }
        }
      };

      const signature = generateWebhookSignature(payload, webhookSecret);

      await request(app)
        .post('/webhooks/razorpay/subscription-cancelled')
        .send(payload)
        .set('X-Razorpay-Signature', signature)
        .expect(200);

      // Verify subscription credits were removed immediately
      const wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.subscriptionCredits).toBe(0);
      expect(wallet.defaultCredits).toBe(3); // Default credits remain
    });
  });

  describe('POST /webhooks/razorpay/payment-failed', () => {
    it('should handle failed payment and notify user', async () => {
      const payload = {
        entity: 'event',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed123',
              amount: 2500,
              currency: 'INR',
              status: 'failed',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Payment failed due to insufficient funds'
            }
          }
        }
      };

      const signature = generateWebhookSignature(payload, webhookSecret);

      const response = await request(app)
        .post('/webhooks/razorpay/payment-failed')
        .send(payload)
        .set('X-Razorpay-Signature', signature)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Payment failure processed');

      // Verify notification was sent (would need to mock notification service)
      // This would typically trigger an email or push notification to the user
    });
  });

  describe('Webhook Security and Validation', () => {
    it('should reject webhooks without signature', async () => {
      const payload = mockWebhookPayloads.razorpayPaymentSuccess;

      const response = await request(app)
        .post('/webhooks/razorpay/subscription-created')
        .send(payload)
        .expect(401);

      expect(response.body.error).toContain('signature required');
    });

    it('should validate payload structure', async () => {
      const invalidPayload = {
        entity: 'event',
        // Missing required fields
      };

      const signature = generateWebhookSignature(invalidPayload, webhookSecret);

      const response = await request(app)
        .post('/webhooks/razorpay/subscription-created')
        .send(invalidPayload)
        .set('X-Razorpay-Signature', signature)
        .expect(400);

      expect(response.body.error).toContain('validation');
    });

    it('should handle webhook replay attacks', async () => {
      const payload = mockWebhookPayloads.razorpayPaymentSuccess;
      const signature = generateWebhookSignature(payload, webhookSecret);
      const webhookId = 'webhook_replay_test';

      // First request should succeed
      const response1 = await request(app)
        .post('/webhooks/razorpay/subscription-created')
        .send(payload)
        .set('X-Razorpay-Signature', signature)
        .set('X-Webhook-Id', webhookId)
        .expect(200);

      // Duplicate request should be rejected
      const response2 = await request(app)
        .post('/webhooks/razorpay/subscription-created')
        .send(payload)
        .set('X-Razorpay-Signature', signature)
        .set('X-Webhook-Id', webhookId)
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(response2.body.message).toContain('already processed');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const payload = mockWebhookPayloads.razorpayPaymentSuccess;
      const signature = generateWebhookSignature(payload, webhookSecret);

      // Mock database error
      const originalCreate = Subscription.create;
      Subscription.create = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/webhooks/razorpay/subscription-created')
        .send(payload)
        .set('X-Razorpay-Signature', signature)
        .expect(500);

      expect(response.body.error).toContain('Internal server error');

      // Restore original method
      Subscription.create = originalCreate;
    });

    it('should handle partial failures in subscription creation', async () => {
      const payload = {
        entity: 'event',
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: 'sub_partial_fail',
              plan_id: 'non_existent_plan',
              customer_id: 'cust_test123',
              status: 'active'
            }
          }
        }
      };

      const signature = generateWebhookSignature(payload, webhookSecret);

      const response = await request(app)
        .post('/webhooks/razorpay/subscription-created')
        .send(payload)
        .set('X-Razorpay-Signature', signature)
        .expect(400);

      expect(response.body.error).toContain('Plan not found');

      // Verify no partial data was created
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: 'sub_partial_fail'
      });
      expect(subscription).toBeNull();
    });
  });

  describe('Billing History', () => {
    it('should record billing history for successful payments', async () => {
      const payload = {
        entity: 'event',
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: 'sub_billing_test',
              plan_id: testPlan.razorpayPlanId,
              status: 'active'
            }
          },
          payment: {
            entity: {
              id: 'pay_billing_test',
              amount: 2500,
              currency: 'INR',
              status: 'captured',
              method: 'card',
              created_at: Math.floor(Date.now() / 1000)
            }
          }
        }
      };

      const signature = generateWebhookSignature(payload, webhookSecret);

      await request(app)
        .post('/webhooks/razorpay/subscription-created')
        .send(payload)
        .set('X-Razorpay-Signature', signature)
        .expect(200);

      // Verify billing history was recorded
      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: 'sub_billing_test'
      });

      expect(subscription.billingHistory).toHaveLength(1);
      expect(subscription.billingHistory[0].amount).toBe(2500);
      expect(subscription.billingHistory[0].currency).toBe('INR');
      expect(subscription.billingHistory[0].paymentMethod).toBe('card');
      expect(subscription.billingHistory[0].razorpayPaymentId).toBe('pay_billing_test');
      expect(subscription.billingHistory[0].status).toBe('captured');
    });
  });
});