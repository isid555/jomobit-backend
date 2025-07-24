const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Admin Dashboard Overview
 * GET /api/admin/dashboard
 */
router.get('/dashboard', authenticate, requireAdmin(), async (req, res) => {
  try {
    const UserService = require('../services/userService');
    const TemplateService = require('../services/templateService');
    const SubscriptionService = require('../services/subscriptionService');
    const { GenerationService } = require('../services/generationService');

    const userService = new UserService();
    const templateService = new TemplateService();
    const subscriptionService = new SubscriptionService();
    const generationService = new GenerationService();

    // Get all statistics in parallel
    const [
      userStats,
      templateStats,
      subscriptionAnalytics,
      generationStats
    ] = await Promise.all([
      userService.getUserStats(),
      templateService.getTemplateStats(),
      subscriptionService.getSubscriptionAnalytics(),
      generationService.getGenerationStats()
    ]);

    // Calculate revenue metrics
    const totalRevenue = subscriptionAnalytics.analytics.revenue || 0;
    const monthlyRecurringRevenue = subscriptionAnalytics.analytics.mrr || 0;

    const dashboard = {
      overview: {
        totalUsers: userStats.stats.total,
        activeUsers: userStats.stats.active,
        totalTemplates: templateStats.stats.total,
        activeTemplates: templateStats.stats.active,
        totalSubscriptions: subscriptionAnalytics.analytics.total,
        activeSubscriptions: subscriptionAnalytics.analytics.active,
        totalGenerations: generationStats.stats.total,
        completedGenerations: generationStats.stats.completed,
        totalRevenue,
        monthlyRecurringRevenue
      },
      userMetrics: userStats.stats,
      templateMetrics: templateStats.stats,
      subscriptionMetrics: subscriptionAnalytics.analytics,
      generationMetrics: generationStats.stats,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      dashboard
    });

  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch dashboard data'
    });
  }
});

/**
 * System Health Check
 * GET /api/admin/health
 */
router.get('/health', authenticate, requireAdmin(), async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const redis = require('../config/redis');

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          readyState: mongoose.connection.readyState
        },
        redis: {
          status: redis.status || 'unknown'
        },
        auth0: {
          status: process.env.AUTH0_DOMAIN ? 'configured' : 'not_configured'
        },
        razorpay: {
          status: process.env.RAZORPAY_KEY_ID ? 'configured' : 'not_configured'
        },
        imagekit: {
          status: process.env.IMAGEKIT_PUBLIC_KEY ? 'configured' : 'not_configured'
        }
      },
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    };

    // Check if any critical services are down
    const criticalServices = ['database'];
    const hasIssues = criticalServices.some(service => 
      health.services[service].status !== 'connected' && 
      health.services[service].status !== 'configured'
    );

    if (hasIssues) {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      success: true,
      health
    });

  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to check system health'
    });
  }
});

/**
 * System Configuration
 * GET /api/admin/config
 */
router.get('/config', authenticate, requireAdmin(), async (req, res) => {
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
    console.error('Error fetching system configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch system configuration'
    });
  }
});

/**
 * Recent Activity Feed
 * GET /api/admin/activity
 */
router.get('/activity', authenticate, requireAdmin(), async (req, res) => {
  try {
    const { limit = 50, type, startDate, endDate } = req.query;

    // This would typically come from an activity log collection
    // For now, we'll aggregate from various sources
    const activities = [];

    // Get recent user registrations
    const User = require('../models/User');
    const recentUsers = await User.find({
      ...(startDate && { createdAt: { $gte: new Date(startDate) } }),
      ...(endDate && { createdAt: { $lte: new Date(endDate) } })
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) / 4)
    .select('email createdAt status');

    recentUsers.forEach(user => {
      activities.push({
        type: 'user_registration',
        timestamp: user.createdAt,
        description: `New user registered: ${user.email}`,
        metadata: { userId: user._id, email: user.email, status: user.status }
      });
    });

    // Get recent generations
    const GenerationJob = require('../models/GenerationJob');
    const recentGenerations = await GenerationJob.find({
      status: 'completed',
      ...(startDate && { completedAt: { $gte: new Date(startDate) } }),
      ...(endDate && { completedAt: { $lte: new Date(endDate) } })
    })
    .sort({ completedAt: -1 })
    .limit(parseInt(limit) / 4)
    .populate('userId', 'email')
    .select('userId completedAt aiProvider');

    recentGenerations.forEach(job => {
      activities.push({
        type: 'poster_generated',
        timestamp: job.completedAt,
        description: `Poster generated by ${job.userId?.email || 'Unknown user'}`,
        metadata: { 
          jobId: job._id, 
          userId: job.userId?._id,
          aiProvider: job.aiProvider 
        }
      });
    });

    // Get recent subscriptions
    const Subscription = require('../models/Subscription');
    const recentSubscriptions = await Subscription.find({
      ...(startDate && { createdAt: { $gte: new Date(startDate) } }),
      ...(endDate && { createdAt: { $lte: new Date(endDate) } })
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) / 4)
    .populate('userId', 'email')
    .populate('planId', 'name');

    recentSubscriptions.forEach(sub => {
      activities.push({
        type: 'subscription_created',
        timestamp: sub.createdAt,
        description: `New subscription: ${sub.userId?.email || 'Unknown user'} subscribed to ${sub.planId?.name || 'Unknown plan'}`,
        metadata: { 
          subscriptionId: sub._id, 
          userId: sub.userId?._id,
          planName: sub.planId?.name 
        }
      });
    });

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Filter by type if specified
    const filteredActivities = type 
      ? activities.filter(activity => activity.type === type)
      : activities;

    // Apply limit
    const limitedActivities = filteredActivities.slice(0, parseInt(limit));

    res.json({
      success: true,
      activities: limitedActivities,
      pagination: {
        total: filteredActivities.length,
        limit: parseInt(limit),
        hasMore: filteredActivities.length > parseInt(limit)
      },
      filters: { type, startDate, endDate }
    });

  } catch (error) {
    console.error('Error fetching admin activity:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch activity feed'
    });
  }
});

/**
 * Send Slack Notification
 * POST /api/admin/notify
 */
router.post('/notify', authenticate, requireAdmin(), async (req, res) => {
  try {
    const { message, channel = '#general', urgent = false } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Message is required'
      });
    }

    // This would integrate with Slack API
    // For now, just log the notification
    console.log('Admin notification:', {
      message,
      channel,
      urgent,
      sentBy: req.user.email,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Notification sent successfully',
      notification: {
        message,
        channel,
        urgent,
        sentBy: req.user.email,
        sentAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error sending admin notification:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to send notification'
    });
  }
});

/**
 * Export Data
 * GET /api/admin/export/:type
 */
router.get('/export/:type', authenticate, requireAdmin(), async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'json', startDate, endDate } = req.query;

    let data = [];
    let filename = '';

    switch (type) {
      case 'users':
        const User = require('../models/User');
        const users = await User.find({
          ...(startDate && { createdAt: { $gte: new Date(startDate) } }),
          ...(endDate && { createdAt: { $lte: new Date(endDate) } })
        }).select('-__v');
        data = users;
        filename = `users_export_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'subscriptions':
        const Subscription = require('../models/Subscription');
        const subscriptions = await Subscription.find({
          ...(startDate && { createdAt: { $gte: new Date(startDate) } }),
          ...(endDate && { createdAt: { $lte: new Date(endDate) } })
        })
        .populate('userId', 'email')
        .populate('planId', 'name');
        data = subscriptions;
        filename = `subscriptions_export_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'generations':
        const GenerationJob = require('../models/GenerationJob');
        const generations = await GenerationJob.find({
          ...(startDate && { createdAt: { $gte: new Date(startDate) } }),
          ...(endDate && { createdAt: { $lte: new Date(endDate) } })
        })
        .populate('userId', 'email')
        .select('-__v');
        data = generations;
        filename = `generations_export_${new Date().toISOString().split('T')[0]}`;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid export type',
          message: 'Supported types: users, subscriptions, generations'
        });
    }

    if (format === 'csv') {
      // Convert to CSV format
      const fields = Object.keys(data[0] || {});
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
    console.error('Error exporting data:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to export data'
    });
  }
});

module.exports = router;