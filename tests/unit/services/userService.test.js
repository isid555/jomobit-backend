const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const UserService = require('../../../src/services/userService');
const { CreditService } = require('../../../src/services/creditService');
const User = require('../../../src/models/User');
const CreditWallet = require('../../../src/models/CreditWallet');

describe('UserService', () => {
  let mongoServer;
  let userService;
  let mockCreditService;

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
    await CreditWallet.deleteMany({});

    // Create mock credit service
    mockCreditService = {
      DEFAULT_CREDITS: 3,
      grantDefaultCredits: jest.fn(),
      getCreditBalance: jest.fn()
    };

    userService = new UserService({ creditService: mockCreditService });
  });

  describe('createOrUpdateFromAuth0', () => {
    const mockAuth0User = {
      user_id: 'auth0|123456789',
      email: 'test@example.com',
      email_verified: true,
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      nickname: 'testuser',
      picture: 'https://example.com/avatar.jpg',
      locale: 'en',
      updated_at: '2024-01-01T00:00:00.000Z',
      'https://jomobit.com/roles': ['user'],
      permissions: ['read:profile']
    };

    it('should create a new user and grant default credits', async () => {
      mockCreditService.grantDefaultCredits.mockResolvedValue({
        success: true,
        wallet: { totalCredits: 3 },
        transaction: { id: 'tx123' }
      });

      const result = await userService.createOrUpdateFromAuth0(mockAuth0User);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(true);
      expect(result.user.auth0Id).toBe(mockAuth0User.user_id);
      expect(result.user.email).toBe(mockAuth0User.email);
      expect(result.user.status).toBe('active');
      expect(result.creditResult).toBeDefined();
      expect(mockCreditService.grantDefaultCredits).toHaveBeenCalledWith(
        result.user._id,
        3,
        expect.objectContaining({
          source: 'user_registration',
          auth0Id: mockAuth0User.user_id,
          email: mockAuth0User.email
        })
      );
    });

    it('should update existing user without granting credits', async () => {
      // Create existing user
      const existingUser = await User.create({
        auth0Id: mockAuth0User.user_id,
        email: mockAuth0User.email,
        status: 'pending'
      });

      const result = await userService.createOrUpdateFromAuth0(mockAuth0User);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(false);
      expect(result.user._id.toString()).toBe(existingUser._id.toString());
      expect(result.user.status).toBe('active');
      expect(result.creditResult).toBeNull();
      expect(mockCreditService.grantDefaultCredits).not.toHaveBeenCalled();
    });

    it('should handle credit service errors gracefully', async () => {
      mockCreditService.grantDefaultCredits.mockRejectedValue(new Error('Credit service error'));

      const result = await userService.createOrUpdateFromAuth0(mockAuth0User);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(true);
      expect(result.user.auth0Id).toBe(mockAuth0User.user_id);
      expect(result.creditResult).toBeNull();
    });

    it('should not grant credits when disabled', async () => {
      const result = await userService.createOrUpdateFromAuth0(mockAuth0User, {
        grantDefaultCredits: false
      });

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(true);
      expect(result.creditResult).toBeNull();
      expect(mockCreditService.grantDefaultCredits).not.toHaveBeenCalled();
    });

    it('should throw UserOperationError on database error', async () => {
      // Mock User.createOrUpdateFromAuth0 to throw error
      jest.spyOn(User, 'createOrUpdateFromAuth0').mockRejectedValue(new Error('Database error'));

      await expect(userService.createOrUpdateFromAuth0(mockAuth0User))
        .rejects.toThrow(UserService.UserOperationError);

      User.createOrUpdateFromAuth0.mockRestore();
    });
  });

  describe('updateUserStatus', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        auth0Id: 'auth0|123456789',
        email: 'test@example.com',
        status: 'pending'
      });
    });

    it('should update user status successfully', async () => {
      const result = await userService.updateUserStatus(testUser.auth0Id, 'active', {
        emailVerified: true,
        lastLogin: '2024-01-01T12:00:00.000Z'
      });

      expect(result.success).toBe(true);
      expect(result.statusChanged).toBe(true);
      expect(result.oldStatus).toBe('pending');
      expect(result.newStatus).toBe('active');
      expect(result.user.status).toBe('active');
      expect(result.user.emailVerified).toBe(true);
    });

    it('should handle same status update', async () => {
      const result = await userService.updateUserStatus(testUser.auth0Id, 'pending');

      expect(result.success).toBe(true);
      expect(result.statusChanged).toBe(false);
      expect(result.oldStatus).toBe('pending');
      expect(result.newStatus).toBe('pending');
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      await expect(userService.updateUserStatus('auth0|nonexistent', 'active'))
        .rejects.toThrow(UserService.UserNotFoundError);
    });
  });

  describe('getUserByAuth0Id', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        auth0Id: 'auth0|123456789',
        email: 'test@example.com',
        status: 'active'
      });
    });

    it('should get user by Auth0 ID successfully', async () => {
      const result = await userService.getUserByAuth0Id(testUser.auth0Id);

      expect(result.success).toBe(true);
      expect(result.user._id.toString()).toBe(testUser._id.toString());
      expect(result.user.auth0Id).toBe(testUser.auth0Id);
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      await expect(userService.getUserByAuth0Id('auth0|nonexistent'))
        .rejects.toThrow(UserService.UserNotFoundError);
    });
  });

  describe('getUserByEmail', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        auth0Id: 'auth0|123456789',
        email: 'test@example.com',
        status: 'active'
      });
    });

    it('should get user by email successfully', async () => {
      const result = await userService.getUserByEmail(testUser.email);

      expect(result.success).toBe(true);
      expect(result.user._id.toString()).toBe(testUser._id.toString());
      expect(result.user.email).toBe(testUser.email);
    });

    it('should throw UserNotFoundError for non-existent email', async () => {
      await expect(userService.getUserByEmail('nonexistent@example.com'))
        .rejects.toThrow(UserService.UserNotFoundError);
    });
  });

  describe('getUserById', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        auth0Id: 'auth0|123456789',
        email: 'test@example.com',
        status: 'active'
      });
    });

    it('should get user by ID successfully', async () => {
      const result = await userService.getUserById(testUser._id);

      expect(result.success).toBe(true);
      expect(result.user._id.toString()).toBe(testUser._id.toString());
    });

    it('should throw UserNotFoundError for non-existent ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(userService.getUserById(nonExistentId))
        .rejects.toThrow(UserService.UserNotFoundError);
    });
  });

  describe('updateLastLogin', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        auth0Id: 'auth0|123456789',
        email: 'test@example.com',
        status: 'active'
      });
    });

    it('should update last login timestamp', async () => {
      const beforeUpdate = new Date();
      const result = await userService.updateLastLogin(testUser.auth0Id);

      expect(result.success).toBe(true);
      expect(result.user.lastLoginAt).toBeDefined();
      expect(new Date(result.user.lastLoginAt)).toBeInstanceOf(Date);
      expect(new Date(result.user.lastLoginAt).getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      await expect(userService.updateLastLogin('auth0|nonexistent'))
        .rejects.toThrow(UserService.UserNotFoundError);
    });
  });

  describe('suspendUser', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        auth0Id: 'auth0|123456789',
        email: 'test@example.com',
        status: 'active'
      });
    });

    it('should suspend user successfully', async () => {
      const result = await userService.suspendUser(testUser._id, 'Policy violation');

      expect(result.success).toBe(true);
      expect(result.user.status).toBe('suspended');
      expect(result.oldStatus).toBe('active');
      expect(result.reason).toBe('Policy violation');
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(userService.suspendUser(nonExistentId))
        .rejects.toThrow(UserService.UserNotFoundError);
    });
  });

  describe('activateUser', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        auth0Id: 'auth0|123456789',
        email: 'test@example.com',
        status: 'suspended'
      });
    });

    it('should activate user successfully', async () => {
      const result = await userService.activateUser(testUser._id);

      expect(result.success).toBe(true);
      expect(result.user.status).toBe('active');
      expect(result.oldStatus).toBe('suspended');
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(userService.activateUser(nonExistentId))
        .rejects.toThrow(UserService.UserNotFoundError);
    });
  });

  describe('getUsersByStatus', () => {
    beforeEach(async () => {
      await User.create([
        { auth0Id: 'auth0|1', email: 'user1@example.com', status: 'active' },
        { auth0Id: 'auth0|2', email: 'user2@example.com', status: 'active' },
        { auth0Id: 'auth0|3', email: 'user3@example.com', status: 'pending' },
        { auth0Id: 'auth0|4', email: 'user4@example.com', status: 'suspended' }
      ]);
    });

    it('should get users by status with pagination', async () => {
      const result = await userService.getUsersByStatus('active', {
        limit: 1,
        skip: 0
      });

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(1);
      expect(result.users[0].status).toBe('active');
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should handle empty results', async () => {
      const result = await userService.getUsersByStatus('nonexistent');

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('getUserStats', () => {
    beforeEach(async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      await User.create([
        { 
          auth0Id: 'auth0|1', 
          email: 'user1@example.com', 
          status: 'active',
          createdAt: thirtyDaysAgo,
          lastLoginAt: sevenDaysAgo
        },
        { 
          auth0Id: 'auth0|2', 
          email: 'user2@example.com', 
          status: 'active',
          createdAt: now,
          lastLoginAt: now
        },
        { 
          auth0Id: 'auth0|3', 
          email: 'user3@example.com', 
          status: 'pending',
          createdAt: now
        },
        { 
          auth0Id: 'auth0|4', 
          email: 'user4@example.com', 
          status: 'suspended',
          createdAt: thirtyDaysAgo
        }
      ]);
    });

    it('should return comprehensive user statistics', async () => {
      const result = await userService.getUserStats();

      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(4);
      expect(result.stats.active).toBe(2);
      expect(result.stats.pending).toBe(1);
      expect(result.stats.suspended).toBe(1);
      expect(result.stats.recentRegistrations).toBe(2);
      expect(result.stats.recentlyActive).toBe(1);
      expect(result.stats.statusBreakdown).toEqual({
        active: 2,
        pending: 1,
        suspended: 1
      });
    });
  });

  describe('searchUsers', () => {
    beforeEach(async () => {
      await User.create([
        {
          auth0Id: 'auth0|1',
          email: 'john.doe@example.com',
          status: 'active',
          metadata: { name: 'John Doe', given_name: 'John', family_name: 'Doe' }
        },
        {
          auth0Id: 'auth0|2',
          email: 'jane.smith@example.com',
          status: 'active',
          metadata: { name: 'Jane Smith', given_name: 'Jane', family_name: 'Smith' }
        },
        {
          auth0Id: 'auth0|3',
          email: 'bob.johnson@example.com',
          status: 'pending',
          metadata: { name: 'Bob Johnson', given_name: 'Bob', family_name: 'Johnson' }
        }
      ]);
    });

    it('should search users by email', async () => {
      const result = await userService.searchUsers('john.doe');

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('john.doe@example.com');
      expect(result.searchTerm).toBe('john.doe');
    });

    it('should search users by name', async () => {
      const result = await userService.searchUsers('Jane');

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(1);
      expect(result.users[0].metadata.name).toBe('Jane Smith');
    });

    it('should filter by status', async () => {
      const result = await userService.searchUsers('o', { status: 'active' });

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(2);
      expect(result.users.every(user => user.status === 'active')).toBe(true);
    });

    it('should handle no results', async () => {
      const result = await userService.searchUsers('nonexistent');

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getUserWithCredits', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        auth0Id: 'auth0|123456789',
        email: 'test@example.com',
        status: 'active'
      });

      mockCreditService.getCreditBalance.mockResolvedValue({
        userId: testUser._id,
        totalCredits: 10,
        availableCredits: 8,
        reservedCredits: 2
      });
    });

    it('should get user with credit information', async () => {
      const result = await userService.getUserWithCredits(testUser._id);

      expect(result.success).toBe(true);
      expect(result.user._id.toString()).toBe(testUser._id.toString());
      expect(result.credits.totalCredits).toBe(10);
      expect(result.credits.availableCredits).toBe(8);
      expect(mockCreditService.getCreditBalance).toHaveBeenCalledWith(testUser._id);
    });

    it('should throw UserNotFoundError for non-existent user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(userService.getUserWithCredits(nonExistentId))
        .rejects.toThrow(UserService.UserNotFoundError);
    });
  });

  describe('Error Handling', () => {
    it('should export error classes', () => {
      expect(UserService.UserNotFoundError).toBeDefined();
      expect(UserService.UserAlreadyExistsError).toBeDefined();
      expect(UserService.UserOperationError).toBeDefined();
    });

    it('should create proper error instances', () => {
      const notFoundError = new UserService.UserNotFoundError('test-id');
      expect(notFoundError.name).toBe('UserNotFoundError');
      expect(notFoundError.code).toBe('USER_NOT_FOUND');
      expect(notFoundError.identifier).toBe('test-id');

      const operationError = new UserService.UserOperationError('test message', 'testOp', 'userId');
      expect(operationError.name).toBe('UserOperationError');
      expect(operationError.code).toBe('USER_OPERATION_ERROR');
      expect(operationError.operation).toBe('testOp');
      expect(operationError.userId).toBe('userId');
    });
  });
});