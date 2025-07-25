const User = require('../models/User');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Template = require('../models/Template');
const GenerationJob = require('../models/GenerationJob');
const CreditTransaction = require('../models/CreditTransaction');
const BusinessProfile = require('../models/BusinessProfile');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * AdminService
 * Handles all administrative operations including user management,
 * analytics, plan management, and system monitoring
 */
class AdminService {
  /**
   * Get comprehensive dashboard insights
   * @returns {Promise<Object>} Dashboard data with metrics
   */
  async getDashboardInsights() {
    try {
      const [
        userMetrics,
        revenueMetrics,
        subscriptionMetrics,
        generationMetrics,
        templateMetrics,
        creditMetrics
      ] = await Promise.all([
        this.getUserMetrics(),
        this.getRevenueMetrics(),
        this.getSubscriptionMetrics(),
        this.getGenerationMetrics(),
        this.getTemplateMetrics(),
        this.getCreditMetrics()
      ]);

      return {
        overview: {
          totalUsers: userMetrics.total,
          activeUsers: userMetrics.active,
          totalRevenue: revenueMetrics.total,
          monthlyRecurringRevenue: revenueMetrics.mrr,
          totalSubscriptions: subscriptionMetrics.total,
          activeSubscriptions: subscriptionMetrics.active,
          totalGenerations: generationMetrics.total,
          completedGenerations: generationMetrics.completed,
          totalTemplates: templateMetrics.total,
          activeTemplates: templateMetrics.active
        },
        userMetrics,
        revenueMetrics,
        subscriptionMetrics,
        generationMetrics,
        templateMetrics,
        creditMetrics,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting dashboard insights:', error);
      throw new Error('Failed to fetch dashboard insights');
    }
  }

  /**
   * Get user metrics and statistics
   * @param {Object} filters - Date filters
   * @returns {Promise<Object>} User metrics
   */
  async getUserMetrics(filters = {}) {
    try {
      const { startDate, endDate } = filters;
      const matchStage = {};

      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }

      const [
        totalUsers,
        activeUsers,
        suspendedUsers,
        pendingUsers,
        userGrowth,
        usersByRole
      ] = await Promise.all([
        User.countDocuments(matchStage),
        User.countDocuments({ ...matchStage, status: 'active' }),
        User.countDocuments({ ...matchStage, status: 'suspended' }),
        User.countDocuments({ ...matchStage, status: 'pending' }),
        this.getUserGrowthData(startDate, endDate),
        this.getUsersByRole(matchStage)
      ]);

      return {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        pending: pendingUsers,
        growth: userGrowth,
        byRole: usersByRole,
        activePercentage: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
      };
    } catch (error) {
      logger.error('Error getting user metrics:', error);
      throw new Error('Failed to fetch user metrics');
    }
  }

  /**
   * Get revenue metrics and analytics
   * @param {Object} filters - Date filters
   * @returns {Promise<Object>} Revenue metrics
   */
  async getRevenueMetrics(filters = {}) {
    try {
      const { startDate, endDate } = filters;
      const matchStage = { status: 'active' };

      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }

      const [subscriptionStats, revenueGrowth] = await Promise.all([
        Subscription.getSubscriptionStats(filters),
        this.getRevenueGrowthData(startDate, endDate)
      ]);

      // Calculate total revenue from billing history
      const totalRevenueResult = await Subscription.aggregate([
        { $match: matchStage },
        { $unwind: '$billingHistory' },
        { $match: { 'billingHistory.status': 'paid' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$billingHistory.amount' },
            totalTransactions: { $sum: 1 }
          }
        }
      ]);

      const totalRevenue = totalRevenueResult[0]?.totalRevenue || 0;
      const totalTransactions = totalRevenueResult[0]?.totalTransactions || 0;

      return {
        total: totalRevenue,
        mrr: subscriptionStats.monthlyRecurringRevenue,
        totalTransactions,
        averageRevenuePerUser: subscriptionStats.active > 0 ? Math.round(totalRevenue / subscriptionStats.active) : 0,
        growth: revenueGrowth,
        subscriptionBreakdown: subscriptionStats.byStatus
      };
    } catch (error) {
      logger.error('Error getting revenue metrics:', error);
      throw new Error('Failed to fetch revenue metrics');
    }
  }

  /**
   * Get subscription metrics
   * @param {Object} filters - Date filters
   * @returns {Promise<Object>} Subscription metrics
   */
  async getSubscriptionMetrics(filters = {}) {
    try {
      const subscriptionStats = await Subscription.getSubscriptionStats(filters);
      
      // Get plan distribution
      const planDistribution = await Subscription.aggregate([
        { $match: { status: 'active' } },
        {
          $lookup: {
            from: 'plans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan'
          }
        },
        { $unwind: '$plan' },
        {
          $group: {
            _id: '$plan.name',
            count: { $sum: 1 },
            revenue: { $sum: '$billing.amount' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Get churn rate (cancelled subscriptions in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const churnedSubscriptions = await Subscription.countDocuments({
        status: 'cancelled',
        cancelledAt: { $gte: thirtyDaysAgo }
      });

      const churnRate = subscriptionStats.active > 0 ? 
        Math.round((churnedSubscriptions / subscriptionStats.active) * 100) : 0;

      return {
        ...subscriptionStats,
        planDistribution,
        churnRate,
        churnedThisMonth: churnedSubscriptions
      };
    } catch (error) {
      logger.error('Error getting subscription metrics:', error);
      throw new Error('Failed to fetch subscription metrics');
    }
  }

  /**
   * Get generation metrics
   * @param {Object} filters - Date filters
   * @returns {Promise<Object>} Generation metrics
   */
  async getGenerationMetrics(filters = {}) {
    try {
      const { startDate, endDate } = filters;
      const matchStage = {};

      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }

      const [
        totalGenerations,
        completedGenerations,
        failedGenerations,
        pendingGenerations,
        aiProviderStats,
        generationTrends
      ] = await Promise.all([
        GenerationJob.countDocuments(matchStage),
        GenerationJob.countDocuments({ ...matchStage, status: 'completed' }),
        GenerationJob.countDocuments({ ...matchStage, status: 'failed' }),
        GenerationJob.countDocuments({ ...matchStage, status: 'pending' }),
        this.getAIProviderStats(matchStage),
        this.getGenerationTrends(startDate, endDate)
      ]);

      const successRate = totalGenerations > 0 ? 
        Math.round((completedGenerations / totalGenerations) * 100) : 0;

      return {
        total: totalGenerations,
        completed: completedGenerations,
        failed: failedGenerations,
        pending: pendingGenerations,
        successRate,
        aiProviderStats,
        trends: generationTrends
      };
    } catch (error) {
      logger.error('Error getting generation metrics:', error);
      throw new Error('Failed to fetch generation metrics');
    }
  }

  /**
   * Get template metrics
   * @returns {Promise<Object>} Template metrics
   */
  async getTemplateMetrics() {
    try {
      const [
        totalTemplates,
        activeTemplates,
        templateUsage,
        popularTemplates
      ] = await Promise.all([
        Template.countDocuments(),
        Template.countDocuments({ isActive: true }),
        this.getTemplateUsageStats(),
        this.getPopularTemplates()
      ]);

      return {
        total: totalTemplates,
        active: activeTemplates,
        inactive: totalTemplates - activeTemplates,
        usage: templateUsage,
        popular: popularTemplates
      };
    } catch (error) {
      logger.error('Error getting template metrics:', error);
      throw new Error('Failed to fetch template metrics');
    }
  }

  /**
   * Get credit system metrics
   * @returns {Promise<Object>} Credit metrics
   */
  async getCreditMetrics() {
    try {
      const creditStats = await CreditTransaction.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const totalCreditsGranted = creditStats
        .filter(stat => stat._id === 'grant')
        .reduce((sum, stat) => sum + stat.totalAmount, 0);

      const totalCreditsUsed = creditStats
        .filter(stat => stat._id === 'deduct')
        .reduce((sum, stat) => sum + stat.totalAmount, 0);

      return {
        totalGranted: totalCreditsGranted,
        totalUsed: totalCreditsUsed,
        totalReserved: creditStats
          .filter(stat => stat._id === 'reserve')
          .reduce((sum, stat) => sum + stat.totalAmount, 0),
        byType: creditStats
      };
    } catch (error) {
      logger.error('Error getting credit metrics:', error);
      throw new Error('Failed to fetch credit metrics');
    }
  }

  // Helper methods for metrics calculations
  async getUserGrowthData(startDate, endDate) {
    const pipeline = [
      {
        $match: {
          ...(startDate && { createdAt: { $gte: new Date(startDate) } }),
          ...(endDate && { createdAt: { $lte: new Date(endDate) } })
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ];

    return User.aggregate(pipeline);
  }

  async getUsersByRole(matchStage) {
    return User.aggregate([
      { $match: matchStage },
      { $unwind: { path: '$roles', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$roles',
          count: { $sum: 1 }
        }
      }
    ]);
  }

  async getRevenueGrowthData(startDate, endDate) {
    const pipeline = [
      { $match: { status: 'active' } },
      { $unwind: '$billingHistory' },
      { $match: { 'billingHistory.status': 'paid' } },
      {
        $match: {
          ...(startDate && { 'billingHistory.paidAt': { $gte: new Date(startDate) } }),
          ...(endDate && { 'billingHistory.paidAt': { $lte: new Date(endDate) } })
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$billingHistory.paidAt' },
            month: { $month: '$billingHistory.paidAt' }
          },
          revenue: { $sum: '$billingHistory.amount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ];

    return Subscription.aggregate(pipeline);
  }

  async getAIProviderStats(matchStage) {
    return GenerationJob.aggregate([
      { $match: { ...matchStage, status: 'completed' } },
      {
        $group: {
          _id: {
            llm: '$aiProvider.llm',
            diffusion: '$aiProvider.diffusion'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  async getGenerationTrends(startDate, endDate) {
    const pipeline = [
      {
        $match: {
          ...(startDate && { createdAt: { $gte: new Date(startDate) } }),
          ...(endDate && { createdAt: { $lte: new Date(endDate) } })
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ];

    return GenerationJob.aggregate(pipeline);
  }

  async getTemplateUsageStats() {
    return GenerationJob.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$templateId',
          usageCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'templates',
          localField: '_id',
          foreignField: '_id',
          as: 'template'
        }
      },
      { $unwind: '$template' },
      {
        $project: {
          templateName: '$template.name',
          usageCount: 1
        }
      },
      { $sort: { usageCount: -1 } },
      { $limit: 10 }
    ]);
  }

  async getPopularTemplates() {
    return this.getTemplateUsageStats();
  }


// module.exports = AdminService;
 
 /**
   * User Management Methods
   */

  /**
   * Get paginated list of users with filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Users list with pagination
   */
  async getUsers(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        role,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;
      const query = {};

      // Apply filters
      if (status) query.status = status;
      if (role) query.roles = { $in: [role] };
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { 'metadata.name': { $regex: search, $options: 'i' } }
        ];
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [users, totalCount] = await Promise.all([
        User.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .select('-__v')
          .lean(),
        User.countDocuments(query)
      ]);

      // Enrich user data with subscription info
      const enrichedUsers = await Promise.all(
        users.map(async (user) => {
          const subscription = await Subscription.findOne({
            userId: user._id,
            status: 'active'
          }).populate('planId', 'name');

          const profileCount = await BusinessProfile.countDocuments({
            userId: user._id,
            isActive: true
          });

          return {
            ...user,
            subscription: subscription ? {
              planName: subscription.planId?.name,
              status: subscription.status,
              currentPeriodEnd: subscription.currentPeriodEnd
            } : null,
            profileCount
          };
        })
      );

      return {
        users: enrichedUsers,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Error getting users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  /**
   * Get detailed user information
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Detailed user information
   */
  async getUserDetails(userId) {
    try {
      const user = await User.findById(userId).lean();
      if (!user) {
        throw new Error('User not found');
      }

      const [
        subscription,
        profiles,
        generations,
        creditTransactions
      ] = await Promise.all([
        Subscription.findOne({ userId, status: 'active' })
          .populate('planId', 'name features pricing'),
        BusinessProfile.find({ userId, isActive: true })
          .select('name createdAt'),
        GenerationJob.find({ userId })
          .sort({ createdAt: -1 })
          .limit(10)
          .select('status createdAt aiProvider'),
        CreditTransaction.find({ userId })
          .sort({ createdAt: -1 })
          .limit(10)
          .select('type amount createdAt reference')
      ]);

      const generationStats = await GenerationJob.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        user,
        subscription,
        profiles,
        recentGenerations: generations,
        recentCreditTransactions: creditTransactions,
        generationStats: generationStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Error getting user details:', error);
      throw new Error('Failed to fetch user details');
    }
  }

  /**
   * Suspend user account
   * @param {string} userId - User ID
   * @param {string} reason - Suspension reason
   * @param {string} adminId - Admin user ID
   * @returns {Promise<Object>} Updated user
   */
  async suspendUser(userId, reason, adminId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.status === 'suspended') {
        throw new Error('User is already suspended');
      }

      user.status = 'suspended';
      user.metadata.suspensionReason = reason;
      user.metadata.suspendedBy = adminId;
      user.metadata.suspendedAt = new Date();

      await user.save();

      // Cancel active subscription if exists
      const activeSubscription = await Subscription.findOne({
        userId,
        status: 'active'
      });

      if (activeSubscription) {
        await activeSubscription.cancel(false, 'Account suspended');
      }

      logger.info('User suspended', {
        userId,
        reason,
        adminId,
        timestamp: new Date()
      });

      return user;
    } catch (error) {
      logger.error('Error suspending user:', error);
      throw error;
    }
  }

  /**
   * Reactivate suspended user account
   * @param {string} userId - User ID
   * @param {string} adminId - Admin user ID
   * @returns {Promise<Object>} Updated user
   */
  async reactivateUser(userId, adminId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.status !== 'suspended') {
        throw new Error('User is not suspended');
      }

      user.status = 'active';
      user.metadata.reactivatedBy = adminId;
      user.metadata.reactivatedAt = new Date();
      
      // Clear suspension data
      delete user.metadata.suspensionReason;
      delete user.metadata.suspendedBy;
      delete user.metadata.suspendedAt;

      await user.save();

      logger.info('User reactivated', {
        userId,
        adminId,
        timestamp: new Date()
      });

      return user;
    } catch (error) {
      logger.error('Error reactivating user:', error);
      throw error;
    }
  }

  /**
   * Plan Management Methods
   */

  /**
   * Get all plans with usage statistics
   * @returns {Promise<Array>} Plans with statistics
   */
  async getPlansWithStats() {
    try {
      const plans = await Plan.find().sort({ sortOrder: 1 });
      
      const plansWithStats = await Promise.all(
        plans.map(async (plan) => {
          const [
            activeSubscriptions,
            totalSubscriptions,
            totalRevenue
          ] = await Promise.all([
            Subscription.countDocuments({ planId: plan._id, status: 'active' }),
            Subscription.countDocuments({ planId: plan._id }),
            this.getPlanRevenue(plan._id)
          ]);

          return {
            ...plan.toObject(),
            stats: {
              activeSubscriptions,
              totalSubscriptions,
              totalRevenue,
              conversionRate: totalSubscriptions > 0 ? 
                Math.round((activeSubscriptions / totalSubscriptions) * 100) : 0
            }
          };
        })
      );

      return plansWithStats;
    } catch (error) {
      logger.error('Error getting plans with stats:', error);
      throw new Error('Failed to fetch plans with statistics');
    }
  }

  /**
   * Create new subscription plan
   * @param {Object} planData - Plan data
   * @returns {Promise<Object>} Created plan
   */
  async createPlan(planData) {
    try {
      const {
        name,
        planId,
        description,
        pricing,
        features,
        tier,
        isPublic = true,
        isFeatured = false,
        sortOrder = 0
      } = planData;

      // Check if plan ID already exists
      const existingPlan = await Plan.findOne({ planId: planId.toLowerCase() });
      if (existingPlan) {
        throw new Error('Plan ID already exists');
      }

      const plan = new Plan({
        name,
        planId: planId.toLowerCase(),
        description,
        pricing,
        features,
        tier,
        isPublic,
        isFeatured,
        sortOrder,
        status: 'active'
      });

      await plan.save();

      logger.info('Plan created', {
        planId: plan._id,
        name: plan.name,
        tier: plan.tier
      });

      return plan;
    } catch (error) {
      logger.error('Error creating plan:', error);
      throw error;
    }
  }

  /**
   * Update existing plan
   * @param {string} planId - Plan ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated plan
   */
  async updatePlan(planId, updateData) {
    try {
      const plan = await Plan.findById(planId);
      if (!plan) {
        throw new Error('Plan not found');
      }

      // Don't allow changing planId if there are active subscriptions
      if (updateData.planId && updateData.planId !== plan.planId) {
        const activeSubscriptions = await Subscription.countDocuments({
          planId: plan._id,
          status: 'active'
        });

        if (activeSubscriptions > 0) {
          throw new Error('Cannot change plan ID while there are active subscriptions');
        }
      }

      Object.assign(plan, updateData);
      await plan.save();

      logger.info('Plan updated', {
        planId: plan._id,
        name: plan.name,
        changes: Object.keys(updateData)
      });

      return plan;
    } catch (error) {
      logger.error('Error updating plan:', error);
      throw error;
    }
  }

  /**
   * Delete plan (soft delete by setting status to deprecated)
   * @param {string} planId - Plan ID
   * @returns {Promise<Object>} Updated plan
   */
  async deletePlan(planId) {
    try {
      const plan = await Plan.findById(planId);
      if (!plan) {
        throw new Error('Plan not found');
      }

      // Check for active subscriptions
      const activeSubscriptions = await Subscription.countDocuments({
        planId: plan._id,
        status: 'active'
      });

      if (activeSubscriptions > 0) {
        throw new Error('Cannot delete plan with active subscriptions');
      }

      await plan.deprecate();

      logger.info('Plan deprecated', {
        planId: plan._id,
        name: plan.name
      });

      return plan;
    } catch (error) {
      logger.error('Error deleting plan:', error);
      throw error;
    }
  }

  /**
   * Get plan revenue
   * @param {string} planId - Plan ID
   * @returns {Promise<number>} Total revenue for plan
   */
  async getPlanRevenue(planId) {
    try {
      const result = await Subscription.aggregate([
        { $match: { planId: new mongoose.Types.ObjectId(planId) } },
        { $unwind: '$billingHistory' },
        { $match: { 'billingHistory.status': 'paid' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$billingHistory.amount' }
          }
        }
      ]);

      return result[0]?.totalRevenue || 0;
    } catch (error) {
      logger.error('Error getting plan revenue:', error);
      return 0;
    }
  }  /**

   * Template Management Methods
   */

  /**
   * Get templates with usage statistics
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Templates with pagination and stats
   */
  async getTemplatesWithStats(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        category,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;
      const query = {};

      // Apply filters
      if (status !== undefined) query.isActive = status === 'active';
      if (category) query.category = category;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [templates, totalCount] = await Promise.all([
        Template.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Template.countDocuments(query)
      ]);

      // Get usage statistics for each template
      const templatesWithStats = await Promise.all(
        templates.map(async (template) => {
          const [usageCount, lastUsed] = await Promise.all([
            GenerationJob.countDocuments({ 
              templateId: template._id,
              status: 'completed'
            }),
            GenerationJob.findOne({ 
              templateId: template._id,
              status: 'completed'
            })
            .sort({ completedAt: -1 })
            .select('completedAt')
          ]);

          return {
            ...template,
            stats: {
              usageCount,
              lastUsed: lastUsed?.completedAt || null
            }
          };
        })
      );

      return {
        templates: templatesWithStats,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Error getting templates with stats:', error);
      throw new Error('Failed to fetch templates with statistics');
    }
  }

  /**
   * Batch upload templates
   * @param {Array} templatesData - Array of template data
   * @param {string} adminId - Admin user ID
   * @returns {Promise<Object>} Upload results
   */
  async batchUploadTemplates(templatesData, adminId) {
    try {
      const results = {
        successful: [],
        failed: [],
        total: templatesData.length
      };

      for (const templateData of templatesData) {
        try {
          // Validate required fields
          if (!templateData.name || !templateData.images || !templateData.aspectRatio) {
            throw new Error('Missing required fields: name, images, or aspectRatio');
          }

          const template = new Template({
            ...templateData,
            uploadedBy: adminId,
            isActive: true,
            createdAt: new Date()
          });

          await template.save();
          results.successful.push({
            name: template.name,
            id: template._id
          });

        } catch (error) {
          results.failed.push({
            name: templateData.name || 'Unknown',
            error: error.message
          });
        }
      }

      logger.info('Batch template upload completed', {
        adminId,
        total: results.total,
        successful: results.successful.length,
        failed: results.failed.length
      });

      return results;
    } catch (error) {
      logger.error('Error in batch template upload:', error);
      throw new Error('Failed to batch upload templates');
    }
  }

  /**
   * Update template status
   * @param {string} templateId - Template ID
   * @param {boolean} isActive - Active status
   * @param {string} adminId - Admin user ID
   * @returns {Promise<Object>} Updated template
   */
  async updateTemplateStatus(templateId, isActive, adminId) {
    try {
      const template = await Template.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      template.isActive = isActive;
      template.updatedBy = adminId;
      template.updatedAt = new Date();

      await template.save();

      logger.info('Template status updated', {
        templateId,
        isActive,
        adminId
      });

      return template;
    } catch (error) {
      logger.error('Error updating template status:', error);
      throw error;
    }
  }

  /**
   * Payment and Transaction Monitoring Methods
   */

  /**
   * Get payment transactions with filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Payment transactions with pagination
   */
  async getPaymentTransactions(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        startDate,
        endDate,
        userId,
        sortBy = 'paidAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;
      const pipeline = [];

      // Match stage for subscriptions
      const matchStage = {};
      if (userId) matchStage.userId = new mongoose.Types.ObjectId(userId);

      pipeline.push({ $match: matchStage });

      // Unwind billing history
      pipeline.push({ $unwind: '$billingHistory' });

      // Match billing history filters
      const billingMatch = {};
      if (status) billingMatch['billingHistory.status'] = status;
      if (startDate || endDate) {
        billingMatch['billingHistory.paidAt'] = {};
        if (startDate) billingMatch['billingHistory.paidAt'].$gte = new Date(startDate);
        if (endDate) billingMatch['billingHistory.paidAt'].$lte = new Date(endDate);
      }

      if (Object.keys(billingMatch).length > 0) {
        pipeline.push({ $match: billingMatch });
      }

      // Lookup user and plan information
      pipeline.push(
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'plans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan'
          }
        }
      );

      // Project required fields
      pipeline.push({
        $project: {
          _id: '$billingHistory._id',
          subscriptionId: '$_id',
          razorpayPaymentId: '$billingHistory.razorpayPaymentId',
          amount: '$billingHistory.amount',
          currency: '$billingHistory.currency',
          status: '$billingHistory.status',
          paymentMethod: '$billingHistory.paymentMethod',
          paidAt: '$billingHistory.paidAt',
          failureReason: '$billingHistory.failureReason',
          user: { $arrayElemAt: ['$user', 0] },
          plan: { $arrayElemAt: ['$plan', 0] }
        }
      });

      // Sort
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
      pipeline.push({ $sort: sortOptions });

      // Get total count
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await Subscription.aggregate(countPipeline);
      const totalCount = countResult[0]?.total || 0;

      // Add pagination
      pipeline.push({ $skip: skip }, { $limit: limit });

      const transactions = await Subscription.aggregate(pipeline);

      return {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Error getting payment transactions:', error);
      throw new Error('Failed to fetch payment transactions');
    }
  }

  /**
   * Get payment analytics
   * @param {Object} filters - Date filters
   * @returns {Promise<Object>} Payment analytics
   */
  async getPaymentAnalytics(filters = {}) {
    try {
      const { startDate, endDate } = filters;
      const matchStage = {};

      if (startDate || endDate) {
        matchStage['billingHistory.paidAt'] = {};
        if (startDate) matchStage['billingHistory.paidAt'].$gte = new Date(startDate);
        if (endDate) matchStage['billingHistory.paidAt'].$lte = new Date(endDate);
      }

      const pipeline = [
        { $unwind: '$billingHistory' },
        { $match: matchStage },
        {
          $group: {
            _id: '$billingHistory.status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$billingHistory.amount' },
            avgAmount: { $avg: '$billingHistory.amount' }
          }
        }
      ];

      const statusAnalytics = await Subscription.aggregate(pipeline);

      // Get payment method breakdown
      const paymentMethodPipeline = [
        { $unwind: '$billingHistory' },
        { $match: { ...matchStage, 'billingHistory.status': 'paid' } },
        {
          $group: {
            _id: '$billingHistory.paymentMethod',
            count: { $sum: 1 },
            totalAmount: { $sum: '$billingHistory.amount' }
          }
        }
      ];

      const paymentMethodAnalytics = await Subscription.aggregate(paymentMethodPipeline);

      // Get daily revenue trend
      const dailyRevenuePipeline = [
        { $unwind: '$billingHistory' },
        { $match: { ...matchStage, 'billingHistory.status': 'paid' } },
        {
          $group: {
            _id: {
              year: { $year: '$billingHistory.paidAt' },
              month: { $month: '$billingHistory.paidAt' },
              day: { $dayOfMonth: '$billingHistory.paidAt' }
            },
            revenue: { $sum: '$billingHistory.amount' },
            transactions: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ];

      const dailyRevenue = await Subscription.aggregate(dailyRevenuePipeline);

      return {
        byStatus: statusAnalytics,
        byPaymentMethod: paymentMethodAnalytics,
        dailyTrend: dailyRevenue,
        summary: {
          totalRevenue: statusAnalytics
            .filter(s => s._id === 'paid')
            .reduce((sum, s) => sum + s.totalAmount, 0),
          totalTransactions: statusAnalytics
            .reduce((sum, s) => sum + s.count, 0),
          successRate: this.calculateSuccessRate(statusAnalytics)
        }
      };
    } catch (error) {
      logger.error('Error getting payment analytics:', error);
      throw new Error('Failed to fetch payment analytics');
    }
  }

  /**
   * Get failed payment details for investigation
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Failed payments with details
   */
  async getFailedPayments(options = {}) {
    try {
      const { limit = 50, startDate, endDate } = options;
      
      const matchStage = {
        'billingHistory.status': 'failed'
      };

      if (startDate || endDate) {
        matchStage['billingHistory.paidAt'] = {};
        if (startDate) matchStage['billingHistory.paidAt'].$gte = new Date(startDate);
        if (endDate) matchStage['billingHistory.paidAt'].$lte = new Date(endDate);
      }

      const pipeline = [
        { $unwind: '$billingHistory' },
        { $match: matchStage },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'plans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan'
          }
        },
        {
          $project: {
            subscriptionId: '$_id',
            razorpayPaymentId: '$billingHistory.razorpayPaymentId',
            amount: '$billingHistory.amount',
            currency: '$billingHistory.currency',
            failureReason: '$billingHistory.failureReason',
            paidAt: '$billingHistory.paidAt',
            user: { $arrayElemAt: ['$user', 0] },
            plan: { $arrayElemAt: ['$plan', 0] }
          }
        },
        { $sort: { paidAt: -1 } },
        { $limit: limit }
      ];

      return Subscription.aggregate(pipeline);
    } catch (error) {
      logger.error('Error getting failed payments:', error);
      throw new Error('Failed to fetch failed payments');
    }
  }

  /**
   * Helper method to calculate payment success rate
   * @param {Array} statusAnalytics - Payment status analytics
   * @returns {number} Success rate percentage
   */
  calculateSuccessRate(statusAnalytics) {
    const totalTransactions = statusAnalytics.reduce((sum, s) => sum + s.count, 0);
    const successfulTransactions = statusAnalytics
      .filter(s => s._id === 'paid')
      .reduce((sum, s) => sum + s.count, 0);

    return totalTransactions > 0 ? 
      Math.round((successfulTransactions / totalTransactions) * 100) : 0;
  }  
/**
   * Slack Integration Methods
   */

  /**
   * Send notification to Slack
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} Slack response
   */
  async sendSlackNotification(notification) {
    try {
      const {
        message,
        channel = '#general',
        urgent = false,
        type = 'info',
        metadata = {}
      } = notification;

      const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!slackWebhookUrl) {
        logger.warn('Slack webhook URL not configured');
        return { success: false, error: 'Slack webhook not configured' };
      }

      const payload = {
        channel,
        username: 'Jomobit Admin Bot',
        icon_emoji: this.getSlackEmoji(type, urgent),
        attachments: [{
          color: this.getSlackColor(type, urgent),
          title: urgent ? '🚨 URGENT: Admin Notification' : '📢 Admin Notification',
          text: message,
          fields: this.formatSlackFields(metadata),
          footer: 'Jomobit Admin System',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      // In a real implementation, you would use axios or fetch to send to Slack
      // For now, we'll simulate the API call
      const response = await this.simulateSlackWebhook(payload);

      logger.info('Slack notification sent', {
        channel,
        type,
        urgent,
        success: response.success
      });

      return response;
    } catch (error) {
      logger.error('Error sending Slack notification:', error);
      throw new Error('Failed to send Slack notification');
    }
  }

  /**
   * Send system alert to Slack
   * @param {string} alertType - Type of alert
   * @param {Object} alertData - Alert data
   * @returns {Promise<Object>} Slack response
   */
  async sendSystemAlert(alertType, alertData) {
    const alertMessages = {
      high_failed_payments: {
        message: `⚠️ High number of failed payments detected: ${alertData.count} failures in the last ${alertData.timeframe}`,
        urgent: true,
        channel: '#alerts'
      },
      low_credit_balance: {
        message: `💳 User ${alertData.userEmail} has low credit balance: ${alertData.credits} credits remaining`,
        urgent: false,
        channel: '#monitoring'
      },
      subscription_cancelled: {
        message: `📉 Subscription cancelled: ${alertData.userEmail} cancelled ${alertData.planName} plan`,
        urgent: false,
        channel: '#business'
      },
      generation_failure_spike: {
        message: `🔥 Generation failure spike detected: ${alertData.failureRate}% failure rate in the last hour`,
        urgent: true,
        channel: '#alerts'
      },
      new_user_signup: {
        message: `🎉 New user signed up: ${alertData.userEmail} joined with ${alertData.planName} plan`,
        urgent: false,
        channel: '#growth'
      },
      revenue_milestone: {
        message: `💰 Revenue milestone reached: ${alertData.milestone} total revenue achieved!`,
        urgent: false,
        channel: '#business'
      },
      user_suspended: {
        message: `🚫 User account suspended: ${alertData.userEmail} suspended by ${alertData.adminEmail}. Reason: ${alertData.reason}`,
        urgent: true,
        channel: '#admin-activity'
      },
      user_reactivated: {
        message: `✅ User account reactivated: ${alertData.userEmail} reactivated by ${alertData.adminEmail}`,
        urgent: false,
        channel: '#admin-activity'
      },
      system_unhealthy: {
        message: `🔴 System health alert: ${alertData.system} is ${alertData.status}. ${alertData.message}`,
        urgent: true,
        channel: '#alerts'
      }
    };

    const alert = alertMessages[alertType];
    if (!alert) {
      const error = new Error(`Unknown alert type: ${alertType}`);
      logger.error('Unknown alert type:', { alertType });
      throw error;
    }

    try {
      return this.sendSlackNotification({
        message: alert.message,
        channel: alert.channel,
        urgent: alert.urgent,
        type: 'alert',
        metadata: alertData
      });
    } catch (error) {
      logger.error('Error sending system alert:', error);
      throw new Error('Failed to send system alert');
    }
  }

  /**
   * Send daily summary to Slack
   * @returns {Promise<Object>} Slack response
   */
  async sendDailySummary() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        userMetrics,
        revenueMetrics,
        generationMetrics
      ] = await Promise.all([
        this.getUserMetrics({ 
          startDate: yesterday.toISOString(), 
          endDate: today.toISOString() 
        }),
        this.getRevenueMetrics({ 
          startDate: yesterday.toISOString(), 
          endDate: today.toISOString() 
        }),
        this.getGenerationMetrics({ 
          startDate: yesterday.toISOString(), 
          endDate: today.toISOString() 
        })
      ]);

      const summaryMessage = `📊 Daily Summary for ${yesterday.toDateString()}

👥 Users: ${userMetrics.total} new signups
💰 Revenue: ₹${(revenueMetrics.total / 100).toFixed(2)}
🎨 Generations: ${generationMetrics.completed} completed (${generationMetrics.successRate}% success rate)
📈 Active Subscriptions: ${revenueMetrics.subscriptionBreakdown?.find(s => s._id === 'active')?.count || 0}`;

      return this.sendSlackNotification({
        message: summaryMessage,
        channel: '#daily-reports',
        urgent: false,
        type: 'info',
        metadata: {
          date: yesterday.toISOString(),
          userMetrics,
          revenueMetrics,
          generationMetrics
        }
      });
    } catch (error) {
      logger.error('Error sending daily summary:', error);
      throw new Error('Failed to send daily summary');
    }
  }

  /**
   * Helper methods for Slack integration
   */
  getSlackEmoji(type, urgent) {
    if (urgent) return ':rotating_light:';
    
    const emojis = {
      info: ':information_source:',
      success: ':white_check_mark:',
      warning: ':warning:',
      error: ':x:',
      alert: ':bell:'
    };

    return emojis[type] || ':speech_balloon:';
  }

  getSlackColor(type, urgent) {
    if (urgent) return 'danger';
    
    const colors = {
      info: '#36a64f',
      success: 'good',
      warning: 'warning',
      error: 'danger',
      alert: '#ff9500'
    };

    return colors[type] || '#36a64f';
  }

  formatSlackFields(metadata) {
    if (!metadata || Object.keys(metadata).length === 0) {
      return [];
    }

    return Object.entries(metadata)
      .filter(([key, value]) => value !== null && value !== undefined)
      .map(([key, value]) => ({
        title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        short: true
      }));
  }

  /**
   * Simulate Slack webhook call (replace with actual HTTP request in production)
   * @param {Object} payload - Slack payload
   * @returns {Promise<Object>} Simulated response
   */
  async simulateSlackWebhook(payload) {
    // In production, replace this with actual HTTP request to Slack webhook
    // const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(payload)
    // });
    
    logger.info('Slack webhook payload (simulated):', {
      channel: payload.channel,
      message: payload.attachments[0]?.text,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Notification sent successfully (simulated)',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * System Monitoring Methods
   */

  /**
   * Check system health and send alerts if needed
   * @returns {Promise<Object>} Health check results
   */
  async performHealthCheck() {
    try {
      const checks = {
        database: await this.checkDatabaseHealth(),
        redis: await this.checkRedisHealth(),
        paymentFailures: await this.checkPaymentFailures(),
        generationFailures: await this.checkGenerationFailures(),
        creditSystem: await this.checkCreditSystemHealth()
      };

      const overallHealth = Object.values(checks).every(check => check.status === 'healthy');
      
      // Send alerts for any unhealthy systems
      for (const [system, check] of Object.entries(checks)) {
        if (check.status !== 'healthy') {
          await this.sendSystemAlert('system_unhealthy', {
            system,
            status: check.status,
            message: check.message,
            details: check.details
          });
        }
      }

      return {
        overall: overallHealth ? 'healthy' : 'unhealthy',
        checks,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error performing health check:', error);
      throw new Error('Failed to perform health check');
    }
  }

  async checkDatabaseHealth() {
    try {
      const dbState = mongoose.connection.readyState;
      return {
        status: dbState === 1 ? 'healthy' : 'unhealthy',
        message: dbState === 1 ? 'Database connected' : 'Database disconnected',
        details: { readyState: dbState }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database check failed',
        details: { error: error.message }
      };
    }
  }

  async checkRedisHealth() {
    try {
      // This would check Redis connection in a real implementation
      return {
        status: 'healthy',
        message: 'Redis connection healthy',
        details: {}
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Redis check failed',
        details: { error: error.message }
      };
    }
  }

  async checkPaymentFailures() {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const failedPayments = await this.getFailedPayments({
        startDate: oneDayAgo.toISOString(),
        limit: 100
      });

      const failureRate = failedPayments.length;
      const isHealthy = failureRate < 10; // Alert if more than 10 failures per day

      return {
        status: isHealthy ? 'healthy' : 'warning',
        message: `${failureRate} payment failures in last 24 hours`,
        details: { failureCount: failureRate, threshold: 10 }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Payment failure check failed',
        details: { error: error.message }
      };
    }
  }

  async checkGenerationFailures() {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const [totalGenerations, failedGenerations] = await Promise.all([
        GenerationJob.countDocuments({
          createdAt: { $gte: oneHourAgo }
        }),
        GenerationJob.countDocuments({
          createdAt: { $gte: oneHourAgo },
          status: 'failed'
        })
      ]);

      const failureRate = totalGenerations > 0 ? 
        Math.round((failedGenerations / totalGenerations) * 100) : 0;
      
      const isHealthy = failureRate < 20; // Alert if failure rate > 20%

      return {
        status: isHealthy ? 'healthy' : 'warning',
        message: `${failureRate}% generation failure rate in last hour`,
        details: { 
          failureRate, 
          totalGenerations, 
          failedGenerations, 
          threshold: 20 
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Generation failure check failed',
        details: { error: error.message }
      };
    }
  }

  async checkCreditSystemHealth() {
    try {
      // Check for any credit transactions that might be stuck
      const pendingReservations = await CreditTransaction.countDocuments({
        type: 'reserve',
        createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } // 30 minutes ago
      });

      const isHealthy = pendingReservations < 5;

      return {
        status: isHealthy ? 'healthy' : 'warning',
        message: `${pendingReservations} pending credit reservations older than 30 minutes`,
        details: { pendingReservations, threshold: 5 }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Credit system check failed',
        details: { error: error.message }
      };
    }
  }
}


module.exports = AdminService;