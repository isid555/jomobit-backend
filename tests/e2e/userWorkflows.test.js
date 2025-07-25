const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const CreditWallet = require('../../src/models/CreditWallet');
const BusinessProfile = require('../../src/models/BusinessProfile');
const Template = require('../../src/models/Template');
const GenerationJob = require('../../src/models/GenerationJob');
const Subscription = require('../../src/models/Subscription');
const Plan = require('../../src/models/Plan');
const { TestDataFactory } = require('../fixtures/testData');

describe('End-to-End User Workflows', () => {
  let authToken;
  let testUser;
  let testPlan;

  beforeEach(async () => {
    // Create test user with auth token
    const userData = TestDataFactory.createUserData();
    testUser = await User.create(userData);

    // Mock JWT token for authentication
    authToken = 'Bearer mock-jwt-token';

    // Create test plan
    const planData = TestDataFactory.createPlanData({
      name: 'plus',
      features: { credits: 50, profiles: 3 }
    });
    testPlan = await Plan.create(planData);

    // Mock authentication middleware for testing
    jest.mock('../../src/middleware/auth', () => ({
      validateAccessToken: (req, res, next) => {
        req.user = { sub: testUser.auth0Id };
        next();
      },
      checkRequiredPermissions: () => (req, res, next) => next()
    }));
  });

  describe('Complete User Onboarding Flow', () => {
    it('should handle complete user registration and setup', async () => {
      // Step 1: User registration via Auth0 webhook
      const webhookPayload = {
        user_id: testUser.auth0Id,
        email: testUser.email,
        name: 'Test User',
        created_at: new Date().toISOString()
      };

      const webhookResponse = await request(app)
        .post('/webhooks/auth0/user-created')
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body.success).toBe(true);

      // Step 2: Verify user profile endpoint
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', authToken)
        .expect(200);

      expect(profileResponse.body.user.email).toBe(testUser.email);
      expect(profileResponse.body.credits.defaultCredits).toBe(3);

      // Step 3: Create business profile
      const profileData = {
        name: 'Test Business',
        tagline: 'Your trusted partner',
        description: 'A test business',
        colorPalette: [
          { name: 'Primary', hex: '#007bff' }
        ],
        products: ['Product 1'],
        address: {
          city: 'Test City',
          country: 'Test Country'
        }
      };

      const createProfileResponse = await request(app)
        .post('/api/profiles')
        .set('Authorization', authToken)
        .send(profileData)
        .expect(201);

      expect(createProfileResponse.body.profile.name).toBe('Test Business');

      // Step 4: Browse templates
      const templatesResponse = await request(app)
        .get('/api/templates')
        .set('Authorization', authToken)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(templatesResponse.body.templates).toBeDefined();
      expect(templatesResponse.body.pagination).toBeDefined();

      // Step 5: Check credit balance before generation
      const creditsResponse = await request(app)
        .get('/api/auth/credits')
        .set('Authorization', authToken)
        .expect(200);

      expect(creditsResponse.body.totalCredits).toBe(3);
      expect(creditsResponse.body.availableCredits).toBe(3);
    });
  });

  describe('Poster Generation Workflow', () => {
    let businessProfile;
    let template;

    beforeEach(async () => {
      // Setup user with credits
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 3,
        subscriptionCredits: 0,
        reservedCredits: 0
      });

      // Create business profile
      const profileData = TestDataFactory.createBusinessProfileData(testUser._id);
      businessProfile = await BusinessProfile.create(profileData);

      // Create template
      const templateData = TestDataFactory.createTemplateData();
      template = await Template.create(templateData);
    });

    it('should handle complete poster generation flow', async () => {
      // Step 1: Initiate poster generation
      const generationRequest = {
        profileId: businessProfile._id,
        templateId: template._id,
        aiProvider: {
          llm: 'openai',
          diffusion: 'ideogram'
        }
      };

      const generationResponse = await request(app)
        .post('/api/posters/generate')
        .set('Authorization', authToken)
        .send(generationRequest)
        .expect(202);

      expect(generationResponse.body.jobId).toBeDefined();
      expect(generationResponse.body.status).toBe('pending');

      const jobId = generationResponse.body.jobId;

      // Step 2: Check job status
      const statusResponse = await request(app)
        .get(`/api/posters/jobs/${jobId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(statusResponse.body.status).toBe('pending');
      expect(statusResponse.body.creditsReserved).toBe(1);

      // Step 3: Verify credits were reserved
      const creditsAfterReservation = await request(app)
        .get('/api/auth/credits')
        .set('Authorization', authToken)
        .expect(200);

      expect(creditsAfterReservation.body.reservedCredits).toBe(1);
      expect(creditsAfterReservation.body.availableCredits).toBe(2);

      // Step 4: Simulate AI provider webhook completion
      const webhookPayload = {
        job_id: jobId,
        status: 'completed',
        result: {
          image_url: 'https://example.com/generated-poster.jpg',
          metadata: {
            prompt: 'Generated prompt for poster',
            model: 'ideogram-v1'
          }
        }
      };

      const webhookResponse = await request(app)
        .post('/webhooks/ideogram/generation-complete')
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body.success).toBe(true);

      // Step 5: Check final job status
      const finalStatusResponse = await request(app)
        .get(`/api/posters/jobs/${jobId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(finalStatusResponse.body.status).toBe('completed');
      expect(finalStatusResponse.body.result.imageUrl).toBeDefined();

      // Step 6: Verify credits were deducted
      const finalCreditsResponse = await request(app)
        .get('/api/auth/credits')
        .set('Authorization', authToken)
        .expect(200);

      expect(finalCreditsResponse.body.reservedCredits).toBe(0);
      expect(finalCreditsResponse.body.totalCredits).toBe(2); // 3 - 1 deducted
      expect(finalCreditsResponse.body.availableCredits).toBe(2);

      // Step 7: Get poster history
      const historyResponse = await request(app)
        .get('/api/posters/history')
        .set('Authorization', authToken)
        .query({ profileId: businessProfile._id })
        .expect(200);

      expect(historyResponse.body.posters).toHaveLength(1);
      expect(historyResponse.body.posters[0].status).toBe('completed');
    });

    it('should handle generation failure and credit release', async () => {
      // Step 1: Initiate generation
      const generationRequest = {
        profileId: businessProfile._id,
        templateId: template._id,
        aiProvider: { llm: 'openai', diffusion: 'ideogram' }
      };

      const generationResponse = await request(app)
        .post('/api/posters/generate')
        .set('Authorization', authToken)
        .send(generationRequest)
        .expect(202);

      const jobId = generationResponse.body.jobId;

      // Step 2: Simulate AI provider webhook failure
      const failurePayload = {
        job_id: jobId,
        status: 'failed',
        error: {
          code: 'GENERATION_FAILED',
          message: 'AI model temporarily unavailable'
        }
      };

      await request(app)
        .post('/webhooks/ideogram/generation-complete')
        .send(failurePayload)
        .expect(200);

      // Step 3: Verify credits were released
      const creditsResponse = await request(app)
        .get('/api/auth/credits')
        .set('Authorization', authToken)
        .expect(200);

      expect(creditsResponse.body.reservedCredits).toBe(0);
      expect(creditsResponse.body.totalCredits).toBe(3); // Credits restored
      expect(creditsResponse.body.availableCredits).toBe(3);

      // Step 4: Check job status shows failure
      const statusResponse = await request(app)
        .get(`/api/posters/jobs/${jobId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(statusResponse.body.status).toBe('failed');
      expect(statusResponse.body.errorMessage).toContain('AI model temporarily unavailable');
    });
  });

  describe('Subscription and Payment Workflow', () => {
    beforeEach(async () => {
      // Setup user with initial credits
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 3,
        subscriptionCredits: 0,
        reservedCredits: 0
      });
    });

    it('should handle complete subscription flow', async () => {
      // Step 1: Get available plans
      const plansResponse = await request(app)
        .get('/api/subscriptions/plans')
        .set('Authorization', authToken)
        .expect(200);

      expect(plansResponse.body.plans).toBeDefined();
      expect(plansResponse.body.plans.length).toBeGreaterThan(0);

      // Step 2: Create subscription (would redirect to Razorpay)
      const subscriptionRequest = {
        planId: testPlan._id,
        paymentMethod: 'card'
      };

      const subscriptionResponse = await request(app)
        .post('/api/subscriptions/create')
        .set('Authorization', authToken)
        .send(subscriptionRequest)
        .expect(200);

      expect(subscriptionResponse.body.razorpayOrderId).toBeDefined();
      expect(subscriptionResponse.body.amount).toBe(testPlan.price);

      // Step 3: Simulate successful payment webhook
      const paymentWebhook = {
        entity: 'event',
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: 'sub_test123',
              plan_id: testPlan.razorpayPlanId,
              status: 'active',
              current_start: Math.floor(Date.now() / 1000),
              current_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
            }
          },
          payment: {
            entity: {
              id: 'pay_test123',
              amount: testPlan.price,
              status: 'captured'
            }
          }
        }
      };

      await request(app)
        .post('/webhooks/razorpay/subscription-created')
        .send(paymentWebhook)
        .expect(200);

      // Step 4: Verify subscription was created
      const userSubscriptionResponse = await request(app)
        .get('/api/subscriptions/current')
        .set('Authorization', authToken)
        .expect(200);

      expect(userSubscriptionResponse.body.subscription.status).toBe('active');
      expect(userSubscriptionResponse.body.subscription.planId).toEqual(testPlan._id.toString());

      // Step 5: Verify credits were granted
      const creditsResponse = await request(app)
        .get('/api/auth/credits')
        .set('Authorization', authToken)
        .expect(200);

      expect(creditsResponse.body.subscriptionCredits).toBe(50);
      expect(creditsResponse.body.totalCredits).toBe(53); // 3 default + 50 subscription

      // Step 6: Check billing history
      const billingResponse = await request(app)
        .get('/api/subscriptions/billing-history')
        .set('Authorization', authToken)
        .expect(200);

      expect(billingResponse.body.history).toHaveLength(1);
      expect(billingResponse.body.history[0].amount).toBe(testPlan.price);
    });

    it('should handle subscription cancellation', async () => {
      // Step 1: Create active subscription
      const subscription = await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_cancel_test',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
      });

      // Grant subscription credits
      await CreditWallet.updateOne(
        { userId: testUser._id },
        { subscriptionCredits: 50, totalCredits: 53 }
      );

      // Step 2: Cancel subscription
      const cancelResponse = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', authToken)
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.message).toContain('cancelled');

      // Step 3: Simulate cancellation webhook
      const cancellationWebhook = {
        entity: 'event',
        event: 'subscription.cancelled',
        payload: {
          subscription: {
            entity: {
              id: 'sub_cancel_test',
              status: 'cancelled',
              ended_at: Math.floor((Date.now() + 20 * 24 * 60 * 60 * 1000) / 1000)
            }
          }
        }
      };

      await request(app)
        .post('/webhooks/razorpay/subscription-cancelled')
        .send(cancellationWebhook)
        .expect(200);

      // Step 4: Verify subscription status
      const subscriptionResponse = await request(app)
        .get('/api/subscriptions/current')
        .set('Authorization', authToken)
        .expect(200);

      expect(subscriptionResponse.body.subscription.status).toBe('cancelled');
      expect(subscriptionResponse.body.subscription.cancelAtPeriodEnd).toBe(true);

      // Step 5: Verify credits remain until period end
      const creditsResponse = await request(app)
        .get('/api/auth/credits')
        .set('Authorization', authToken)
        .expect(200);

      expect(creditsResponse.body.subscriptionCredits).toBe(50); // Still available
    });
  });

  describe('Business Profile Management Workflow', () => {
    beforeEach(async () => {
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 3,
        subscriptionCredits: 0,
        reservedCredits: 0
      });
    });

    it('should handle complete profile management flow', async () => {
      // Step 1: Create first business profile
      const profileData1 = {
        name: 'Business One',
        tagline: 'First business',
        description: 'Description for first business',
        colorPalette: [{ name: 'Primary', hex: '#007bff' }],
        products: ['Product A'],
        address: { city: 'City A', country: 'Country A' }
      };

      const createResponse1 = await request(app)
        .post('/api/profiles')
        .set('Authorization', authToken)
        .send(profileData1)
        .expect(201);

      const profile1Id = createResponse1.body.profile._id;

      // Step 2: Get all profiles
      const profilesResponse = await request(app)
        .get('/api/profiles')
        .set('Authorization', authToken)
        .expect(200);

      expect(profilesResponse.body.profiles).toHaveLength(1);
      expect(profilesResponse.body.profiles[0].name).toBe('Business One');

      // Step 3: Update profile
      const updateData = {
        tagline: 'Updated tagline',
        products: ['Product A', 'Product B'],
        colorPalette: [
          { name: 'Primary', hex: '#007bff' },
          { name: 'Secondary', hex: '#6c757d' }
        ]
      };

      const updateResponse = await request(app)
        .put(`/api/profiles/${profile1Id}`)
        .set('Authorization', authToken)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.profile.tagline).toBe('Updated tagline');
      expect(updateResponse.body.profile.products).toHaveLength(2);

      // Step 4: Test plan limits (free plan allows only 1 profile)
      const profileData2 = {
        name: 'Business Two',
        tagline: 'Second business',
        description: 'Description for second business',
        colorPalette: [{ name: 'Primary', hex: '#28a745' }],
        products: ['Product C'],
        address: { city: 'City B', country: 'Country B' }
      };

      const createResponse2 = await request(app)
        .post('/api/profiles')
        .set('Authorization', authToken)
        .send(profileData2)
        .expect(403);

      expect(createResponse2.body.error).toContain('plan limit');

      // Step 5: Upgrade to plus plan to allow more profiles
      const subscription = await Subscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        razorpaySubscriptionId: 'sub_upgrade_test',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      // Step 6: Now create second profile should succeed
      const createResponse2Success = await request(app)
        .post('/api/profiles')
        .set('Authorization', authToken)
        .send(profileData2)
        .expect(201);

      expect(createResponse2Success.body.profile.name).toBe('Business Two');

      // Step 7: Get updated profiles list
      const finalProfilesResponse = await request(app)
        .get('/api/profiles')
        .set('Authorization', authToken)
        .expect(200);

      expect(finalProfilesResponse.body.profiles).toHaveLength(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle insufficient credits gracefully', async () => {
      // Setup user with no credits
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 0,
        subscriptionCredits: 0,
        reservedCredits: 0
      });

      const profileData = TestDataFactory.createBusinessProfileData(testUser._id);
      const businessProfile = await BusinessProfile.create(profileData);

      const templateData = TestDataFactory.createTemplateData();
      const template = await Template.create(templateData);

      // Attempt poster generation without credits
      const generationRequest = {
        profileId: businessProfile._id,
        templateId: template._id,
        aiProvider: { llm: 'openai', diffusion: 'ideogram' }
      };

      const response = await request(app)
        .post('/api/posters/generate')
        .set('Authorization', authToken)
        .send(generationRequest)
        .expect(402);

      expect(response.body.error).toContain('Insufficient credits');
    });

    it('should handle concurrent operations correctly', async () => {
      // Setup user with limited credits
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 2,
        subscriptionCredits: 0,
        reservedCredits: 0
      });

      const profileData = TestDataFactory.createBusinessProfileData(testUser._id);
      const businessProfile = await BusinessProfile.create(profileData);

      const templateData = TestDataFactory.createTemplateData();
      const template = await Template.create(templateData);

      // Attempt multiple concurrent generations
      const generationRequest = {
        profileId: businessProfile._id,
        templateId: template._id,
        aiProvider: { llm: 'openai', diffusion: 'ideogram' }
      };

      const requests = Array.from({ length: 3 }, () =>
        request(app)
          .post('/api/posters/generate')
          .set('Authorization', authToken)
          .send(generationRequest)
      );

      const responses = await Promise.allSettled(requests);

      // Only 2 should succeed due to credit limit
      const successes = responses.filter(r => r.status === 'fulfilled' && r.value.status === 202);
      const failures = responses.filter(r => r.status === 'fulfilled' && r.value.status === 402);

      expect(successes.length).toBeLessThanOrEqual(2);
      expect(failures.length).toBeGreaterThan(0);
    });
  });
});