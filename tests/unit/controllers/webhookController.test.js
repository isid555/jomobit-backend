const crypto = require('crypto');
const webhookController = require('../../../src/controllers/webhookController');
const User = require('../../../src/models/User');

// Mock dependencies
jest.mock('../../../src/models/User');
jest.mock('../../../src/utils/logger');

describe('WebhookController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      headers: {},
      body: {},
      ip: '127.0.0.1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyAuth0Signature', () => {
    const secret = 'test-webhook-secret';
    const payload = { test: 'data' };

    it('should return true for valid signature', () => {
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      req.headers['x-auth0-signature'] = `sha256=${signature}`;
      req.body = payload;

      const result = webhookController.verifyAuth0Signature(req, secret);
      expect(result).toBe(true);
    });

    it('should return false for invalid signature', () => {
      req.headers['x-auth0-signature'] = 'sha256=invalid-signature';
      req.body = payload;

      const result = webhookController.verifyAuth0Signature(req, secret);
      expect(result).toBe(false);
    });

    it('should return false when signature header is missing', () => {
      req.body = payload;

      const result = webhookController.verifyAuth0Signature(req, secret);
      expect(result).toBe(false);
    });

    it('should return false when secret is not provided', () => {
      const result = webhookController.verifyAuth0Signature(req, null);
      expect(result).toBe(false);
    });

    it('should handle signature verification errors gracefully', () => {
      req.headers['x-auth0-signature'] = 'invalid-format';
      req.body = payload;

      const result = webhookController.verifyAuth0Signature(req, secret);
      expect(result).toBe(false);
    });
  });

  describe('handleAuth0UserRegistration', () => {
    const mockUser = {
      _id: 'user-id',
      auth0Id: 'auth0|123456',
      email: 'test@example.com',
      status: 'active',
      isNew: true
    };

    beforeEach(() => {
      User.createOrUpdateFromAuth0 = jest.fn().mockResolvedValue(mockUser);
    });

    it('should process valid user registration webhook', async () => {
      req.body = {
        user: {
          user_id: 'auth0|123456',
          email: 'test@example.com',
          email_verified: true,
          name: 'Test User'
        }
      };

      await webhookController.handleAuth0UserRegistration(req, res);

      expect(User.createOrUpdateFromAuth0).toHaveBeenCalledWith(req.body.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User registration processed successfully',
        userId: mockUser._id
      });
    });

    it('should handle invalid payload', async () => {
      req.body = { user: null };

      await webhookController.handleAuth0UserRegistration(req, res);

      expect(User.createOrUpdateFromAuth0).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid payload' });
    });

    it('should handle missing user_id', async () => {
      req.body = {
        user: {
          email: 'test@example.com'
        }
      };

      await webhookController.handleAuth0UserRegistration(req, res);

      expect(User.createOrUpdateFromAuth0).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle database errors', async () => {
      req.body = {
        user: {
          user_id: 'auth0|123456',
          email: 'test@example.com'
        }
      };

      User.createOrUpdateFromAuth0.mockRejectedValue(new Error('Database error'));

      await webhookController.handleAuth0UserRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('handleAuth0UserLogin', () => {
    const mockUser = {
      _id: 'user-id',
      auth0Id: 'auth0|123456',
      email: 'test@example.com',
      lastLoginAt: new Date()
    };

    beforeEach(() => {
      User.createOrUpdateFromAuth0 = jest.fn().mockResolvedValue(mockUser);
    });

    it('should process valid user login webhook', async () => {
      req.body = {
        user: {
          user_id: 'auth0|123456',
          email: 'test@example.com',
          name: 'Test User'
        }
      };

      await webhookController.handleAuth0UserLogin(req, res);

      expect(User.createOrUpdateFromAuth0).toHaveBeenCalledWith({
        ...req.body.user,
        last_login: expect.any(String)
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User login processed successfully',
        userId: mockUser._id
      });
    });

    it('should handle invalid payload', async () => {
      req.body = { user: {} };

      await webhookController.handleAuth0UserLogin(req, res);

      expect(User.createOrUpdateFromAuth0).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle database errors', async () => {
      req.body = {
        user: {
          user_id: 'auth0|123456',
          email: 'test@example.com'
        }
      };

      User.createOrUpdateFromAuth0.mockRejectedValue(new Error('Database error'));

      await webhookController.handleAuth0UserLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('handleAuth0UserUpdate', () => {
    const mockUser = {
      _id: 'user-id',
      auth0Id: 'auth0|123456',
      email: 'test@example.com',
      status: 'active',
      emailVerified: true
    };

    beforeEach(() => {
      User.createOrUpdateFromAuth0 = jest.fn().mockResolvedValue(mockUser);
    });

    it('should process valid user update webhook', async () => {
      req.body = {
        user: {
          user_id: 'auth0|123456',
          email: 'test@example.com',
          email_verified: true,
          name: 'Updated User'
        }
      };

      await webhookController.handleAuth0UserUpdate(req, res);

      expect(User.createOrUpdateFromAuth0).toHaveBeenCalledWith(req.body.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User update processed successfully',
        userId: mockUser._id
      });
    });

    it('should handle invalid payload', async () => {
      req.body = { user: null };

      await webhookController.handleAuth0UserUpdate(req, res);

      expect(User.createOrUpdateFromAuth0).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('handleAuth0UserDeletion', () => {
    const mockUser = {
      _id: 'user-id',
      auth0Id: 'auth0|123456',
      email: 'test@example.com',
      suspend: jest.fn().mockResolvedValue()
    };

    beforeEach(() => {
      User.findByAuth0Id = jest.fn().mockResolvedValue(mockUser);
    });

    it('should process valid user deletion webhook', async () => {
      req.body = {
        user: {
          user_id: 'auth0|123456'
        }
      };

      await webhookController.handleAuth0UserDeletion(req, res);

      expect(User.findByAuth0Id).toHaveBeenCalledWith('auth0|123456');
      expect(mockUser.suspend).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User deletion processed successfully'
      });
    });

    it('should handle user not found', async () => {
      req.body = {
        user: {
          user_id: 'auth0|nonexistent'
        }
      };

      User.findByAuth0Id.mockResolvedValue(null);

      await webhookController.handleAuth0UserDeletion(req, res);

      expect(User.findByAuth0Id).toHaveBeenCalledWith('auth0|nonexistent');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle invalid payload', async () => {
      req.body = { user: {} };

      await webhookController.handleAuth0UserDeletion(req, res);

      expect(User.findByAuth0Id).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('handleAuth0Webhook', () => {
    beforeEach(() => {
      // Mock environment variable
      process.env.AUTH0_WEBHOOK_SECRET = 'test-secret';
      
      // Mock signature verification
      jest.spyOn(webhookController, 'verifyAuth0Signature').mockReturnValue(true);
      
      // Mock individual handlers
      jest.spyOn(webhookController, 'handleAuth0UserRegistration').mockResolvedValue();
      jest.spyOn(webhookController, 'handleAuth0UserLogin').mockResolvedValue();
      jest.spyOn(webhookController, 'handleAuth0UserUpdate').mockResolvedValue();
      jest.spyOn(webhookController, 'handleAuth0UserDeletion').mockResolvedValue();
    });

    afterEach(() => {
      delete process.env.AUTH0_WEBHOOK_SECRET;
      jest.restoreAllMocks();
    });

    it('should route user_registration event correctly', async () => {
      req.body = {
        event: 'user_registration',
        user: { user_id: 'auth0|123456' }
      };

      await webhookController.handleAuth0Webhook(req, res);

      expect(webhookController.handleAuth0UserRegistration).toHaveBeenCalledWith(req, res);
    });

    it('should route post_user_registration event correctly', async () => {
      req.body = {
        event: 'post_user_registration',
        user: { user_id: 'auth0|123456' }
      };

      await webhookController.handleAuth0Webhook(req, res);

      expect(webhookController.handleAuth0UserRegistration).toHaveBeenCalledWith(req, res);
    });

    it('should route user_login event correctly', async () => {
      req.body = {
        event: 'user_login',
        user: { user_id: 'auth0|123456' }
      };

      await webhookController.handleAuth0Webhook(req, res);

      expect(webhookController.handleAuth0UserLogin).toHaveBeenCalledWith(req, res);
    });

    it('should route user_update event correctly', async () => {
      req.body = {
        event: 'user_update',
        user: { user_id: 'auth0|123456' }
      };

      await webhookController.handleAuth0Webhook(req, res);

      expect(webhookController.handleAuth0UserUpdate).toHaveBeenCalledWith(req, res);
    });

    it('should route user_deletion event correctly', async () => {
      req.body = {
        event: 'user_deletion',
        user: { user_id: 'auth0|123456' }
      };

      await webhookController.handleAuth0Webhook(req, res);

      expect(webhookController.handleAuth0UserDeletion).toHaveBeenCalledWith(req, res);
    });

    it('should handle unrecognized events', async () => {
      req.body = {
        event: 'unknown_event',
        user: { user_id: 'auth0|123456' }
      };

      await webhookController.handleAuth0Webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Event received but not processed',
        event: 'unknown_event'
      });
    });

    it('should reject invalid signatures', async () => {
      webhookController.verifyAuth0Signature.mockReturnValue(false);
      
      req.body = {
        event: 'user_registration',
        user: { user_id: 'auth0|123456' }
      };

      await webhookController.handleAuth0Webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });

    it('should skip signature verification when secret is not configured', async () => {
      delete process.env.AUTH0_WEBHOOK_SECRET;
      
      req.body = {
        event: 'user_registration',
        user: { user_id: 'auth0|123456' }
      };

      await webhookController.handleAuth0Webhook(req, res);

      expect(webhookController.verifyAuth0Signature).not.toHaveBeenCalled();
      expect(webhookController.handleAuth0UserRegistration).toHaveBeenCalledWith(req, res);
    });

    it('should handle processing errors', async () => {
      webhookController.handleAuth0UserRegistration.mockRejectedValue(new Error('Processing error'));
      
      req.body = {
        event: 'user_registration',
        user: { user_id: 'auth0|123456' }
      };

      await webhookController.handleAuth0Webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});