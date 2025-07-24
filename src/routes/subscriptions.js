const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');

const router = express.Router();

// Subscription management endpoints
router.get('/current', authenticate, subscriptionController.getCurrentSubscription);
router.get('/history', authenticate, subscriptionController.getSubscriptionHistory);
router.post('/upgrade', authenticate, subscriptionController.upgradeSubscription);
router.post('/cancel', authenticate, subscriptionController.cancelSubscription);
router.get('/billing', authenticate, subscriptionController.getBillingHistory);

// Plan endpoints
router.get('/plans', subscriptionController.getAvailablePlans);
router.get('/plans/:planId', subscriptionController.getPlanById);

// Webhook endpoints
router.post('/webhooks/razorpay', subscriptionController.processRazorpayWebhook);

// Admin subscription endpoints
router.get('/admin/analytics', authenticate, requireAdmin(), subscriptionController.getSubscriptionAnalytics);
router.get('/admin', authenticate, requireAdmin(), subscriptionController.getAdminSubscriptions);
router.post('/admin/process-cancellations', authenticate, requireAdmin(), subscriptionController.processScheduledCancellations);

module.exports = router;