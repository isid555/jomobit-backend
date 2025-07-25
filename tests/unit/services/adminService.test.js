const AdminService = require('../../../src/services/adminService');
const User = require('../../../src/models/User');
const Plan = require('../../../src/models/Plan');
const Subscription = require('../../../src/models/Subscription');
const Template = require('../../../src/models/Template');
const GenerationJob = require('../../../src/models/GenerationJob');
const CreditTransaction = require('../../../src/models/CreditTransaction');
const BusinessProfile = require('../../../src/models/BusinessProfile');
const mongoose = require('mongoose');

// Mock all models
jest.mock('../../../src/models/User');
jest.mock('../../../src/models/Plan');
jest.mock('../../../src/models/Subscription');
jest.mock('../../../src/models/Template');
jest.mock('../../../src/models/GenerationJob');
jest.mock('../../../src/models/CreditTransaction');
jest.mock('../../../src/models/BusinessProfile');
jest.mock('../../../src/utils/logger');

describe('AdminService', () => {
  let adminService;

  beforeEach(() => {
    adminService = new AdminService();
    jest.clearAllMocks();
  });

  describe('getDashboardInsights', () => {
    it('should return comprehensive dashboard data', async () => {
      // Mock all the required data
      User.countDocuments = jest.fn()
        .mockResolvedValueOnce(100) // total users
        .mockResolvedValueOnce(85)  // active users
        .mockResolvedValueOnce(5)   // suspended users
        .mockResolvedValueOnce(10); // pending users

      User.aggregate = jest.fn().mockResolvedValue([
        { _id: { year: 2024, month: 1, day: 1 }, count: 5 }
      ]);

      Subscription.getSubscriptionStats = jest.fn().mockResolvedValue({
        total: 50,
        active: 45,
        monthlyRecurringRevenue: 125000,
        byStatus: [{ _id: 'active', count: 45 }]
      });

      Subscription.aggregate = jest.fn().mockResolvedValue([
        { _id: null, totalRevenue: 500000 }
      ]);

      GenerationJob.countDocuments = jest.fn()
        .mockResolvedValueOnce(200) // total generations
        .mockResolvedValueOnce(180) // completed generations
        .mockResolvedValueOnce(15)  // failed generations
        .mockResolvedValueOnce(5);  // pending generations

      GenerationJob.aggregate = jest.fn().mockResolvedValue([
        { _id: { llm: 'openai', diffusion: 'openai' }, count: 100 }
      ]);

      Template.countDocuments = jest.fn()
        .mockResolvedValueOnce(50)  // total templates
        .mockResolvedValueOnce(45); // active templates

      CreditTransaction.aggregate = jest.fn().mockResolvedValue([
        { _id: 'grant', count: 100, totalAmount: 1000 },
        { _id: 'deduct', count: 80, totalAmount: 800 }
      ]);

      const result = await adminService.getDashboardInsights();

      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('userMetrics');
      expect(result).toHaveProperty('revenueMetrics');
      expect(result).toHaveProperty('subscriptionMetrics');
      expect(result).toHaveProperty('generationMetrics');
      expect(result).toHaveProperty('templateMetrics');
      expect(result).toHaveProperty('creditMetrics');
      expect(result).toHaveProperty('lastUpdated');

      expect(result.overview.totalUsers).toBe(100);
      expect(result.overview.activeUsers).toBe(85);
    });

    it('should handle errors gracefully', async () => {
      User.countDocuments = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(adminService.getDashboardInsights()).rejects.toThrow('Failed to fetch dashboard insights');
    });
  });

  describe('getUserMetrics', () => {
    it('should return user metrics with filters', async () => {
      User.countDocuments = jest.fn()
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85)  // active
        .mockResolvedValueOnce(5)   // suspended
        .mockResolvedValueOnce(10); // pending

      User.aggregate = jest.fn().mockResolvedValue([
        { _id: { year: 2024, month: 1, day: 1 }, count: 5 }
      ]);

      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      const result = await adminService.getUserMetrics(filters);

      expect(result).toHaveProperty('total', 100);
      expect(result).toHaveProperty('active', 85);
      expect(result).toHaveProperty('suspended', 5);
      expect(result).toHaveProperty('pending', 10);
      expect(result).toHaveProperty('activePercentage', 85);
      expect(result).toHaveProperty('growth');
      expect(result).toHaveProperty('byRole');
    });
  });

  describe('getUsers', () => {
    it('should return paginated users with enriched data', async () => {
      const mockUsers = [
        {
          _id: new mongoose.Types.ObjectId(),
          email: 'user1@example.com',
          status: 'active',
          createdAt: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          email: 'user2@example.com',
          status: 'active',
          createdAt: new Date()
        }
      ];

      User.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockUsers)
              })
            })
          })
        })
      });

      User.countDocuments = jest.fn().mockResolvedValue(2);

      Subscription.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          planId: { name: 'Plus' },
          status: 'active',
          currentPeriodEnd: new Date()
        })
      });

      BusinessProfile.countDocuments = jest.fn().mockResolvedValue(1);

      const options = {
        page: 1,
        limit: 20,
        status: 'active'
      };

      const result = await adminService.getUsers(options);

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('pagination');
      expect(result.users).toHaveLength(2);
      expect(result.users[0]).toHaveProperty('subscription');
      expect(result.users[0]).toHaveProperty('profileCount');
      expect(result.pagination.totalCount).toBe(2);
    });

    it('should handle search filters', async () => {
      User.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
              })
            })
          })
        })
      });

      User.countDocuments = jest.fn().mockResolvedValue(0);

      const options = {
        search: 'john@example.com'
      };

      await adminService.getUsers(options);

      expect(User.find).toHaveBeenCalledWith({
        $or: [
          { email: { $regex: 'john@example.com', $options: 'i' } },
          { 'metadata.name': { $regex: 'john@example.com', $options: 'i' } }
        ]
      });
    });
  });

  describe('suspendUser', () => {
    it('should suspend user and cancel subscription', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'user@example.com',
        status: 'active',
        metadata: {},
        save: jest.fn().mockResolvedValue(true)
      };

      const mockSubscription = {
        cancel: jest.fn().mockResolvedValue(true)
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);
      Subscription.findOne = jest.fn().mockResolvedValue(mockSubscription);

      const result = await adminService.suspendUser(
        mockUser._id.toString(),
        'Violation of terms',
        'admin123'
      );

      expect(mockUser.status).toBe('suspended');
      expect(mockUser.metadata.suspensionReason).toBe('Violation of terms');
      expect(mockUser.metadata.suspendedBy).toBe('admin123');
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockSubscription.cancel).toHaveBeenCalledWith(false, 'Account suspended');
    });

    it('should throw error if user not found', async () => {
      User.findById = jest.fn().mockResolvedValue(null);

      await expect(adminService.suspendUser('invalid-id', 'reason', 'admin'))
        .rejects.toThrow('User not found');
    });

    it('should throw error if user already suspended', async () => {
      const mockUser = {
        status: 'suspended'
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);

      await expect(adminService.suspendUser('user-id', 'reason', 'admin'))
        .rejects.toThrow('User is already suspended');
    });
  });

  describe('reactivateUser', () => {
    it('should reactivate suspended user', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        status: 'suspended',
        metadata: {
          suspensionReason: 'Previous violation',
          suspendedBy: 'admin123',
          suspendedAt: new Date()
        },
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);

      const result = await adminService.reactivateUser(
        mockUser._id.toString(),
        'admin456'
      );

      expect(mockUser.status).toBe('active');
      expect(mockUser.metadata.reactivatedBy).toBe('admin456');
      expect(mockUser.metadata.suspensionReason).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error if user is not suspended', async () => {
      const mockUser = {
        status: 'active'
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);

      await expect(adminService.reactivateUser('user-id', 'admin'))
        .rejects.toThrow('User is not suspended');
    });
  });

  describe('createPlan', () => {
    it('should create new plan successfully', async () => {
      const planData = {
        name: 'Enterprise',
        planId: 'enterprise',
        description: 'Enterprise plan',
        pricing: { amount: 9900, currency: 'INR', interval: 'monthly' },
        features: { credits: { monthly: 500 } },
        tier: 'enterprise'
      };

      Plan.findOne = jest.fn().mockResolvedValue(null); // No existing plan

      const mockPlan = {
        ...planData,
        _id: new mongoose.Types.ObjectId(),
        save: jest.fn().mockResolvedValue(true)
      };

      Plan.mockImplementation(() => mockPlan);

      const result = await adminService.createPlan(planData);

      expect(Plan.findOne).toHaveBeenCalledWith({ planId: 'enterprise' });
      expect(mockPlan.save).toHaveBeenCalled();
      expect(result).toBe(mockPlan);
    });

    it('should throw error if plan ID already exists', async () => {
      const existingPlan = { planId: 'enterprise' };
      Plan.findOne = jest.fn().mockResolvedValue(existingPlan);

      const planData = {
        name: 'Enterprise',
        planId: 'enterprise'
      };

      await expect(adminService.createPlan(planData))
        .rejects.toThrow('Plan ID already exists');
    });
  });

  describe('batchUploadTemplates', () => {
    it('should upload templates successfully', async () => {
      const templatesData = [
        {
          name: 'Template 1',
          images: ['image1.jpg'],
          aspectRatio: '16:9'
        },
        {
          name: 'Template 2',
          images: ['image2.jpg'],
          aspectRatio: '1:1'
        }
      ];

      const mockTemplate = {
        save: jest.fn().mockResolvedValue(true),
        _id: new mongoose.Types.ObjectId(),
        name: 'Template 1'
      };

      Template.mockImplementation(() => mockTemplate);

      const result = await adminService.batchUploadTemplates(templatesData, 'admin123');

      expect(result.total).toBe(2);
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle failed uploads', async () => {
      const templatesData = [
        {
          name: 'Valid Template',
          images: ['image1.jpg'],
          aspectRatio: '16:9'
        },
        {
          name: 'Invalid Template'
          // Missing required fields
        }
      ];

      const mockTemplate = {
        save: jest.fn().mockResolvedValue(true),
        _id: new mongoose.Types.ObjectId(),
        name: 'Valid Template'
      };

      Template.mockImplementation((data) => {
        if (!data.images) {
          throw new Error('Missing required fields: name, images, or aspectRatio');
        }
        return mockTemplate;
      });

      const result = await adminService.batchUploadTemplates(templatesData, 'admin123');

      expect(result.total).toBe(2);
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('Missing required fields');
    });
  });

  describe('getPaymentTransactions', () => {
    it('should return paginated payment transactions', async () => {
      const mockTransactions = [
        {
          _id: new mongoose.Types.ObjectId(),
          razorpayPaymentId: 'pay_123',
          amount: 2500,
          status: 'paid',
          user: { email: 'user@example.com' },
          plan: { name: 'Plus' }
        }
      ];

      Subscription.aggregate = jest.fn()
        .mockResolvedValueOnce([{ total: 1 }]) // Count pipeline
        .mockResolvedValueOnce(mockTransactions); // Data pipeline

      const options = {
        page: 1,
        limit: 20,
        status: 'paid'
      };

      const result = await adminService.getPaymentTransactions(options);

      expect(result).toHaveProperty('transactions');
      expect(result).toHaveProperty('pagination');
      expect(result.transactions).toHaveLength(1);
      expect(result.pagination.totalCount).toBe(1);
    });
  });

  describe('sendSlackNotification', () => {
    it('should send Slack notification successfully', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

      const notification = {
        message: 'Test notification',
        channel: '#test',
        urgent: false,
        type: 'info'
      };

      const result = await adminService.sendSlackNotification(notification);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Notification sent successfully (simulated)');
    });

    it('should handle missing webhook URL', async () => {
      delete process.env.SLACK_WEBHOOK_URL;

      const notification = {
        message: 'Test notification'
      };

      const result = await adminService.sendSlackNotification(notification);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Slack webhook not configured');
    });
  });

  describe('sendSystemAlert', () => {
    it('should send system alert for high failed payments', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

      const alertData = {
        count: 15,
        timeframe: '24 hours'
      };

      const result = await adminService.sendSystemAlert('high_failed_payments', alertData);

      expect(result.success).toBe(true);
    });

    it('should throw error for unknown alert type', async () => {
      await expect(adminService.sendSystemAlert('unknown_alert', {}))
        .rejects.toThrow('Unknown alert type: unknown_alert');
    });

    it('should send user suspended alert', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

      const alertData = {
        userEmail: 'user@example.com',
        adminEmail: 'admin@example.com',
        reason: 'Terms violation'
      };

      const result = await adminService.sendSystemAlert('user_suspended', alertData);

      expect(result.success).toBe(true);
    });

    it('should send user reactivated alert', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

      const alertData = {
        userEmail: 'user@example.com',
        adminEmail: 'admin@example.com'
      };

      const result = await adminService.sendSystemAlert('user_reactivated', alertData);

      expect(result.success).toBe(true);
    });

    it('should send system unhealthy alert', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

      const alertData = {
        system: 'database',
        status: 'unhealthy',
        message: 'Connection timeout'
      };

      const result = await adminService.sendSystemAlert('system_unhealthy', alertData);

      expect(result.success).toBe(true);
    });
  });

  describe('performHealthCheck', () => {
    it('should return healthy status when all systems are healthy', async () => {
      // Mock mongoose connection
      mongoose.connection = { readyState: 1 };

      // Mock the individual health check methods
      adminService.checkDatabaseHealth = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: 'Database connected',
        details: { readyState: 1 }
      });

      adminService.checkRedisHealth = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: 'Redis connection healthy',
        details: {}
      });

      adminService.checkPaymentFailures = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: '5 payment failures in last 24 hours',
        details: { failureCount: 5, threshold: 10 }
      });

      adminService.checkGenerationFailures = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: '5% generation failure rate in last hour',
        details: { failureRate: 5, threshold: 20 }
      });

      adminService.checkCreditSystemHealth = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: '2 pending credit reservations older than 30 minutes',
        details: { pendingReservations: 2, threshold: 5 }
      });

      adminService.sendSystemAlert = jest.fn().mockResolvedValue({});

      const result = await adminService.performHealthCheck();

      expect(result.overall).toBe('healthy');
      expect(result.checks.database.status).toBe('healthy');
      expect(result.checks.generationFailures.status).toBe('healthy');
    });

    it('should return unhealthy status when database is down', async () => {
      mongoose.connection = { readyState: 0 };

      // Mock the individual health check methods
      adminService.checkDatabaseHealth = jest.fn().mockResolvedValue({
        status: 'unhealthy',
        message: 'Database disconnected',
        details: { readyState: 0 }
      });

      adminService.checkRedisHealth = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: 'Redis connection healthy',
        details: {}
      });

      adminService.checkPaymentFailures = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: '5 payment failures in last 24 hours',
        details: { failureCount: 5, threshold: 10 }
      });

      adminService.checkGenerationFailures = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: '5% generation failure rate in last hour',
        details: { failureRate: 5, threshold: 20 }
      });

      adminService.checkCreditSystemHealth = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: '2 pending credit reservations older than 30 minutes',
        details: { pendingReservations: 2, threshold: 5 }
      });

      adminService.sendSystemAlert = jest.fn().mockResolvedValue({});

      const result = await adminService.performHealthCheck();

      expect(result.overall).toBe('unhealthy');
      expect(result.checks.database.status).toBe('unhealthy');
    });
  });

  describe('Helper methods', () => {
    describe('getSlackEmoji', () => {
      it('should return correct emoji for different types', () => {
        expect(adminService.getSlackEmoji('info', false)).toBe(':information_source:');
        expect(adminService.getSlackEmoji('error', false)).toBe(':x:');
        expect(adminService.getSlackEmoji('info', true)).toBe(':rotating_light:');
      });
    });

    describe('getSlackColor', () => {
      it('should return correct color for different types', () => {
        expect(adminService.getSlackColor('success', false)).toBe('good');
        expect(adminService.getSlackColor('error', false)).toBe('danger');
        expect(adminService.getSlackColor('info', true)).toBe('danger');
      });
    });

    describe('calculateSuccessRate', () => {
      it('should calculate success rate correctly', () => {
        const statusAnalytics = [
          { _id: 'paid', count: 80 },
          { _id: 'failed', count: 20 }
        ];

        const successRate = adminService.calculateSuccessRate(statusAnalytics);
        expect(successRate).toBe(80);
      });

      it('should return 0 for no transactions', () => {
        const successRate = adminService.calculateSuccessRate([]);
        expect(successRate).toBe(0);
      });
    });
  });
});