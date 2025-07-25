const AdminService = require('../services/adminService');
const logger = require('../utils/logger');

/**
 * AdminController
 * Handles all administrative API endpoints
 */
class AdminController {
  constructor() {
    this.adminService = new AdminService();
  }

  /**
   * Get admin dashboard insights
   * GET /api/admin/dashboard
   */
  async getDashboard(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const dashboard = await this.adminService.getDashboardInsights({
        startDate,
        endDate
      });

      res.json({
        success: true,
        dashboard
      });
    } catch (error) {
      logger.error('Error getting admin dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch dashboard data'
      });
    }
  }

  /**
   * Get user metrics
   * GET /api/admin/metrics/users
   */
  async getUserMetrics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const metrics = await this.adminService.getUserMetrics({
        startDate,
        endDate
      });

      res.json({
        success: true,
        metrics
      });
    } catch (error) {
      logger.error('Error getting user metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch user metrics'
      });
    }
  }

  /**
   * Get revenue metrics
   * GET /api/admin/metrics/revenue
   */
  async getRevenueMetrics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const metrics = await this.adminService.getRevenueMetrics({
        startDate,
        endDate
      });

      res.json({
        success: true,
        metrics
      });
    } catch (error) {
      logger.error('Error getting revenue metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch revenue metrics'
      });
    }
  }

  /**
   * User Management Endpoints
   */

  /**
   * Get users list with filters
   * GET /api/admin/users
   */
  async getUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        role,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const result = await this.adminService.getUsers({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        role,
        search,
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error getting users:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch users'
      });
    }
  }

  /**
   * Get user details
   * GET /api/admin/users/:userId
   */
  async getUserDetails(req, res) {
    try {
      const { userId } = req.params;
      
      const userDetails = await this.adminService.getUserDetails(userId);

      res.json({
        success: true,
        ...userDetails
      });
    } catch (error) {
      logger.error('Error getting user details:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'User not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch user details'
      });
    }
  }

  /**
   * Suspend user account
   * POST /api/admin/users/:userId/suspend
   */
  async suspendUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Suspension reason is required'
        });
      }

      const user = await this.adminService.suspendUser(userId, reason, adminId);

      // Send Slack notification
      await this.adminService.sendSystemAlert('user_suspended', {
        userEmail: user.email,
        reason,
        adminEmail: req.user.email
      });

      res.json({
        success: true,
        message: 'User suspended successfully',
        user
      });
    } catch (error) {
      logger.error('Error suspending user:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'User not found'
        });
      }

      if (error.message === 'User is already suspended') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'User is already suspended'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to suspend user'
      });
    }
  }

  /**
   * Reactivate user account
   * POST /api/admin/users/:userId/reactivate
   */
  async reactivateUser(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.user.id;

      const user = await this.adminService.reactivateUser(userId, adminId);

      // Send Slack notification
      await this.adminService.sendSystemAlert('user_reactivated', {
        userEmail: user.email,
        adminEmail: req.user.email
      });

      res.json({
        success: true,
        message: 'User reactivated successfully',
        user
      });
    } catch (error) {
      logger.error('Error reactivating user:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'User not found'
        });
      }

      if (error.message === 'User is not suspended') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'User is not suspended'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to reactivate user'
      });
    }
  }

  /**
   * Plan Management Endpoints
   */

  /**
   * Get plans with statistics
   * GET /api/admin/plans
   */
  async getPlans(req, res) {
    try {
      const plans = await this.adminService.getPlansWithStats();

      res.json({
        success: true,
        plans
      });
    } catch (error) {
      logger.error('Error getting plans:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch plans'
      });
    }
  }

  /**
   * Create new plan
   * POST /api/admin/plans
   */
  async createPlan(req, res) {
    try {
      const planData = req.body;
      
      // Validate required fields
      const requiredFields = ['name', 'planId', 'pricing', 'features', 'tier'];
      const missingFields = requiredFields.filter(field => !planData[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: `Missing required fields: ${missingFields.join(', ')}`
        });
      }

      const plan = await this.adminService.createPlan(planData);

      res.status(201).json({
        success: true,
        message: 'Plan created successfully',
        plan
      });
    } catch (error) {
      logger.error('Error creating plan:', error);
      
      if (error.message === 'Plan ID already exists') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Plan ID already exists'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create plan'
      });
    }
  }

  /**
   * Update plan
   * PUT /api/admin/plans/:planId
   */
  async updatePlan(req, res) {
    try {
      const { planId } = req.params;
      const updateData = req.body;

      const plan = await this.adminService.updatePlan(planId, updateData);

      res.json({
        success: true,
        message: 'Plan updated successfully',
        plan
      });
    } catch (error) {
      logger.error('Error updating plan:', error);
      
      if (error.message === 'Plan not found') {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Plan not found'
        });
      }

      if (error.message.includes('Cannot change plan ID')) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to update plan'
      });
    }
  }

  /**
   * Delete plan
   * DELETE /api/admin/plans/:planId
   */
  async deletePlan(req, res) {
    try {
      const { planId } = req.params;

      const plan = await this.adminService.deletePlan(planId);

      res.json({
        success: true,
        message: 'Plan deleted successfully',
        plan
      });
    } catch (error) {
      logger.error('Error deleting plan:', error);
      
      if (error.message === 'Plan not found') {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Plan not found'
        });
      }

      if (error.message.includes('Cannot delete plan with active subscriptions')) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to delete plan'
      });
    }
  }

 /**
   * Template Management Endpoints
   */

  /**
   * Get templates with statistics
   * GET /api/admin/templates
   */
  async getTemplates(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        category,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const result = await this.adminService.getTemplatesWithStats({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        category,
        search,
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error getting templates:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch templates'
      });
    }
  }

  /**
   * Batch upload templates
   * POST /api/admin/templates/batch
   */
  async batchUploadTemplates(req, res) {
    try {
      const { templates } = req.body;
      const adminId = req.user.id;

      if (!templates || !Array.isArray(templates) || templates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Templates array is required and must not be empty'
        });
      }

      const results = await this.adminService.batchUploadTemplates(templates, adminId);

      // Send Slack notification about batch upload
      await this.adminService.sendSlackNotification({
        message: `📁 Batch template upload completed by ${req.user.email}`,
        channel: '#admin-activity',
        metadata: {
          total: results.total,
          successful: results.successful.length,
          failed: results.failed.length,
          adminEmail: req.user.email
        }
      });

      res.status(201).json({
        success: true,
        message: 'Batch upload completed',
        results
      });
    } catch (error) {
      logger.error('Error in batch template upload:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to batch upload templates'
      });
    }
  }

  /**
   * Update template status
   * PUT /api/admin/templates/:templateId/status
   */
  async updateTemplateStatus(req, res) {
    try {
      const { templateId } = req.params;
      const { isActive } = req.body;
      const adminId = req.user.id;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'isActive must be a boolean value'
        });
      }

      const template = await this.adminService.updateTemplateStatus(templateId, isActive, adminId);

      res.json({
        success: true,
        message: 'Template status updated successfully',
        template
      });
    } catch (error) {
      logger.error('Error updating template status:', error);
      
      if (error.message === 'Template not found') {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Template not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to update template status'
      });
    }
  }

  /**
   * Payment and Transaction Monitoring Endpoints
   */

  /**
   * Get payment transactions
   * GET /api/admin/payments/transactions
   */
  async getPaymentTransactions(req, res) {
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
      } = req.query;

      const result = await this.adminService.getPaymentTransactions({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        startDate,
        endDate,
        userId,
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error getting payment transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch payment transactions'
      });
    }
  }

  /**
   * Get payment analytics
   * GET /api/admin/payments/analytics
   */
  async getPaymentAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const analytics = await this.adminService.getPaymentAnalytics({
        startDate,
        endDate
      });

      res.json({
        success: true,
        analytics
      });
    } catch (error) {
      logger.error('Error getting payment analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch payment analytics'
      });
    }
  }

  /**
   * Get failed payments
   * GET /api/admin/payments/failed
   */
  async getFailedPayments(req, res) {
    try {
      const { limit = 50, startDate, endDate } = req.query;
      
      const failedPayments = await this.adminService.getFailedPayments({
        limit: parseInt(limit),
        startDate,
        endDate
      });

      res.json({
        success: true,
        failedPayments
      });
    } catch (error) {
      logger.error('Error getting failed payments:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch failed payments'
      });
    }
  }

  /**
   * Slack Integration Endpoints
   */

  /**
   * Send Slack notification
   * POST /api/admin/slack/notify
   */
  async sendSlackNotification(req, res) {
    try {
      const {
        message,
        channel = '#general',
        urgent = false,
        type = 'info'
      } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Message is required'
        });
      }

      const result = await this.adminService.sendSlackNotification({
        message,
        channel,
        urgent,
        type,
        metadata: {
          sentBy: req.user.email,
          timestamp: new Date().toISOString()
        }
      });

      res.json({
        success: true,
        message: 'Notification sent successfully',
        result
      });
    } catch (error) {
      logger.error('Error sending Slack notification:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to send notification'
      });
    }
  }

  /**
   * Send daily summary
   * POST /api/admin/slack/daily-summary
   */
  async sendDailySummary(req, res) {
    try {
      const result = await this.adminService.sendDailySummary();

      res.json({
        success: true,
        message: 'Daily summary sent successfully',
        result
      });
    } catch (error) {
      logger.error('Error sending daily summary:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to send daily summary'
      });
    }
  }

  /**
   * System Monitoring Endpoints
   */

  /**
   * Perform system health check
   * GET /api/admin/system/health
   */
  async performHealthCheck(req, res) {
    try {
      const healthCheck = await this.adminService.performHealthCheck();

      const statusCode = healthCheck.overall === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json({
        success: true,
        health: healthCheck
      });
    } catch (error) {
      logger.error('Error performing health check:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to perform health check'
      });
    }
  }

  /**
   * Get system configuration
   * GET /api/admin/system/config
   */
  async getSystemConfig(req, res) {
    try {
      const config = {
        environment: process.env.NODE_ENV || 'development',
        features: {
          auth0: !!process.env.AUTH0_DOMAIN,
          razorpay: !!process.env.RAZORPAY_KEY_ID,
          imagekit: !!process.env.IMAGEKIT_PUBLIC_KEY,
          redis: !!process.env.REDIS_URL,
          slack: !!process.env.SLACK_WEBHOOK_URL
        },
        limits: {
          defaultCredits: 3,
          maxFileSize: '10MB',
          maxRequestSize: '50MB',
          rateLimits: {
            general: '100/hour',
            generation: '10/hour',
            upload: '5/hour'
          }
        },
        aiProviders: {
          llm: ['openai', 'gemini'],
          diffusion: ['openai', 'ideogram']
        },
        plans: {
          free: { credits: 3, profiles: 1 },
          plus: { credits: 50, profiles: 3, price: 25 },
          pro: { credits: 120, profiles: 8, price: 59 }
        }
      };

      res.json({
        success: true,
        config
      });
    } catch (error) {
      logger.error('Error getting system configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch system configuration'
      });
    }
  }

  /**
   * Export data
   * GET /api/admin/export/:type
   */
  async exportData(req, res) {
    try {
      const { type } = req.params;
      const { format = 'json', startDate, endDate } = req.query;

      let data = [];
      let filename = '';

      switch (type) {
        case 'users':
          const usersResult = await this.adminService.getUsers({
            page: 1,
            limit: 10000, // Large limit for export
            ...(startDate && { startDate }),
            ...(endDate && { endDate })
          });
          data = usersResult.users;
          filename = `users_export_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'payments':
          const paymentsResult = await this.adminService.getPaymentTransactions({
            page: 1,
            limit: 10000,
            startDate,
            endDate
          });
          data = paymentsResult.transactions;
          filename = `payments_export_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'templates':
          const templatesResult = await this.adminService.getTemplatesWithStats({
            page: 1,
            limit: 10000
          });
          data = templatesResult.templates;
          filename = `templates_export_${new Date().toISOString().split('T')[0]}`;
          break;

        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid export type',
            message: 'Supported types: users, payments, templates'
          });
      }

      if (format === 'csv') {
        // Convert to CSV format
        if (data.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'No data found',
            message: 'No data available for export'
          });
        }

        const fields = Object.keys(data[0]);
        const csv = [
          fields.join(','),
          ...data.map(item => fields.map(field => 
            JSON.stringify(item[field] || '')
          ).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.json({
          success: true,
          exportType: type,
          exportDate: new Date().toISOString(),
          recordCount: data.length,
          data
        });
      }
    } catch (error) {
      logger.error('Error exporting data:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to export data'
      });
    }
  }
}

module.exports = AdminController;