const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const AdminController = require('../controllers/adminController');

const router = express.Router();
const adminController = new AdminController();

/**
 * Dashboard and Metrics Routes
 */
router.get('/dashboard', authenticate, requireAdmin(), adminController.getDashboard.bind(adminController));
router.get('/metrics/users', authenticate, requireAdmin(), adminController.getUserMetrics.bind(adminController));
router.get('/metrics/revenue', authenticate, requireAdmin(), adminController.getRevenueMetrics.bind(adminController));

/**
 * User Management Routes
 */
router.get('/users', authenticate, requireAdmin(), adminController.getUsers.bind(adminController));
router.get('/users/:userId', authenticate, requireAdmin(), adminController.getUserDetails.bind(adminController));
router.post('/users/:userId/suspend', authenticate, requireAdmin(), adminController.suspendUser.bind(adminController));
router.post('/users/:userId/reactivate', authenticate, requireAdmin(), adminController.reactivateUser.bind(adminController));

/**
 * Plan Management Routes
 */
router.get('/plans', authenticate, requireAdmin(), adminController.getPlans.bind(adminController));
router.post('/plans', authenticate, requireAdmin(), adminController.createPlan.bind(adminController));
router.put('/plans/:planId', authenticate, requireAdmin(), adminController.updatePlan.bind(adminController));
router.delete('/plans/:planId', authenticate, requireAdmin(), adminController.deletePlan.bind(adminController));

/**
 * Template Management Routes
 */
router.get('/templates', authenticate, requireAdmin(), adminController.getTemplates.bind(adminController));
router.post('/templates/batch', authenticate, requireAdmin(), adminController.batchUploadTemplates.bind(adminController));
router.put('/templates/:templateId/status', authenticate, requireAdmin(), adminController.updateTemplateStatus.bind(adminController));

/**
 * Payment Monitoring Routes
 */
router.get('/payments/transactions', authenticate, requireAdmin(), adminController.getPaymentTransactions.bind(adminController));
router.get('/payments/analytics', authenticate, requireAdmin(), adminController.getPaymentAnalytics.bind(adminController));
router.get('/payments/failed', authenticate, requireAdmin(), adminController.getFailedPayments.bind(adminController));

/**
 * Slack Integration Routes
 */
router.post('/slack/notify', authenticate, requireAdmin(), adminController.sendSlackNotification.bind(adminController));
router.post('/slack/daily-summary', authenticate, requireAdmin(), adminController.sendDailySummary.bind(adminController));

/**
 * System Monitoring Routes
 */
router.get('/system/health', authenticate, requireAdmin(), adminController.performHealthCheck.bind(adminController));
router.get('/system/config', authenticate, requireAdmin(), adminController.getSystemConfig.bind(adminController));

/**
 * Data Export Routes
 */
router.get('/export/:type', authenticate, requireAdmin(), adminController.exportData.bind(adminController));

module.exports = router;