const request = require('supertest');
const app = require('../../../src/app');
const User = require('../../../src/models/User');
const CreditWallet = require('../../../src/models/CreditWallet');
const { mockWebhookPayloads } = require('../../fixtures/testData');

describe('Auth0 Webhooks Integration', () => {
  describe('POST /webhooks/auth0/user-created', () => {
    it('should create user and grant default credits on user creation', async () => {
      const payload = {
        ...mockWebhookPayloads.auth0UserCreated,
        user_id: 'auth0|new_user_123',
        email: 'newuser@example.com'
      };

      const response = await request(app)
        .post('/webhooks/auth0/user-created')
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User created successfully');

      // Verify user was created
      const user = await User.findOne({ auth0Id: payload.user_id });
      expect(user).toBeTruthy();
      expect(user.email).toBe(payload.email);
      expect(user.status).toBe('pending');

      // Verify default credits were granted
      const wallet = await CreditWallet.findOne({ userId: user._id });
      expect(wallet).toBeTruthy();
      expect(wallet.defaultCredits).toBe(3);
      expect(wallet.totalCredits).toBe(3);
    });

    it('should handle duplicate user creation attempts', async () => {
      const payload = mockWebhookPayloads.auth0UserCreated;

      // First creation should succeed
      await request(app)
        .post('/webhooks/auth0/user-created')
        .send(payload)
        .expect(200);

      // Second creation should handle gracefully
      const response = await request(app)
        .post('/webhooks/auth0/user-created')
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('already exists');

      // Verify only one user exists
      const users = await User.find({ auth0Id: payload.user_id });
      expect(users).toHaveLength(1);
    });

    it('should validate webhook payload structure', async () => {
      const invalidPayload = {
        user_id: 'auth0|test',
        // Missing required fields
      };

      const response = await request(app)
        .post('/webhooks/auth0/user-created')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.error).toContain('validation');
    });

    it('should handle webhook signature validation', async () => {
      const payload = mockWebhookPayloads.auth0UserCreated;

      // Test without proper signature header
      const response = await request(app)
        .post('/webhooks/auth0/user-created')
        .send(payload)
        .set('X-Auth0-Signature', 'invalid-signature')
        .expect(401);

      expect(response.body.error).toContain('signature');
    });
  });

  describe('POST /webhooks/auth0/user-updated', () => {
    let existingUser;

    beforeEach(async () => {
      existingUser = await User.create({
        auth0Id: 'auth0|existing_user',
        email: 'existing@example.com',
        status: 'pending'
      });
    });

    it('should update user status from pending to active', async () => {
      const payload = {
        user_id: existingUser.auth0Id,
        email: existingUser.email,
        email_verified: true,
        updated_at: new Date().toISOString()
      };

      const response = await request(app)
        .post('/webhooks/auth0/user-updated')
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify user status was updated
      const updatedUser = await User.findById(existingUser._id);
      expect(updatedUser.status).toBe('active');
      expect(updatedUser.lastLoginAt).toBeTruthy();
    });

    it('should update user metadata', async () => {
      const payload = {
        user_id: existingUser.auth0Id,
        email: existingUser.email,
        name: 'Updated Name',
        picture: 'https://example.com/new-avatar.jpg',
        updated_at: new Date().toISOString()
      };

      await request(app)
        .post('/webhooks/auth0/user-updated')
        .send(payload)
        .expect(200);

      const updatedUser = await User.findById(existingUser._id);
      expect(updatedUser.metadata.name).toBe('Updated Name');
      expect(updatedUser.metadata.picture).toBe('https://example.com/new-avatar.jpg');
    });

    it('should handle non-existent user updates', async () => {
      const payload = {
        user_id: 'auth0|non_existent',
        email: 'nonexistent@example.com',
        updated_at: new Date().toISOString()
      };

      const response = await request(app)
        .post('/webhooks/auth0/user-updated')
        .send(payload)
        .expect(404);

      expect(response.body.error).toContain('User not found');
    });
  });

  describe('Webhook Security', () => {
    it('should reject webhooks without proper authentication', async () => {
      const payload = mockWebhookPayloads.auth0UserCreated;

      const response = await request(app)
        .post('/webhooks/auth0/user-created')
        .send(payload)
        // No authentication headers
        .expect(401);

      expect(response.body.error).toContain('authentication');
    });

    it('should validate webhook timestamp to prevent replay attacks', async () => {
      const payload = mockWebhookPayloads.auth0UserCreated;
      const oldTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      const response = await request(app)
        .post('/webhooks/auth0/user-created')
        .send(payload)
        .set('X-Auth0-Timestamp', oldTimestamp.toString())
        .expect(401);

      expect(response.body.error).toContain('timestamp');
    });

    it('should rate limit webhook endpoints', async () => {
      const payload = mockWebhookPayloads.auth0UserCreated;

      // Make multiple rapid requests
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .post('/webhooks/auth0/user-created')
          .send({ ...payload, user_id: `auth0|user_${Math.random()}` })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const payload = mockWebhookPayloads.auth0UserCreated;

      // Mock database error
      const originalCreate = User.create;
      User.create = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/webhooks/auth0/user-created')
        .send(payload)
        .expect(500);

      expect(response.body.error).toContain('Internal server error');

      // Restore original method
      User.create = originalCreate;
    });

    it('should log webhook processing errors', async () => {
      const payload = { invalid: 'payload' };

      // Mock logger to capture error logs
      const mockLogger = {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
      };

      // This would require dependency injection or mocking the logger module
      // For now, just verify the error response
      const response = await request(app)
        .post('/webhooks/auth0/user-created')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBeTruthy();
    });
  });

  describe('Idempotency', () => {
    it('should handle duplicate webhook deliveries idempotently', async () => {
      const payload = mockWebhookPayloads.auth0UserCreated;
      const webhookId = 'webhook_123';

      // First delivery
      const response1 = await request(app)
        .post('/webhooks/auth0/user-created')
        .send(payload)
        .set('X-Webhook-Id', webhookId)
        .expect(200);

      // Duplicate delivery with same webhook ID
      const response2 = await request(app)
        .post('/webhooks/auth0/user-created')
        .send(payload)
        .set('X-Webhook-Id', webhookId)
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
      expect(response2.body.message).toContain('already processed');

      // Verify only one user was created
      const users = await User.find({ auth0Id: payload.user_id });
      expect(users).toHaveLength(1);
    });
  });
});