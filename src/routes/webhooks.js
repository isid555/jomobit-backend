const express = require('express');
const webhookController = require('../controllers/webhookController');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Middleware to log all webhook requests
 */
const logWebhookRequest = (req, res, next) => {
  logger.info('Webhook request received', {
    path: req.path,
    method: req.method,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'x-auth0-signature': req.headers['x-auth0-signature'] ? '[PRESENT]' : '[MISSING]'
    },
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  next();
};

// Apply logging middleware to all webhook routes
router.use(logWebhookRequest);

/**
 * Auth0 webhook endpoint
 * Handles user lifecycle events from Auth0
 * POST /api/webhooks/auth0
 */
router.post('/auth0', async (req, res) => {
  await webhookController.handleAuth0Webhook(req, res);
});

/**
 * Auth0 user registration webhook (specific endpoint)
 * POST /api/webhooks/auth0/user-registration
 */
router.post('/auth0/user-registration', async (req, res) => {
  await webhookController.handleAuth0UserRegistration(req, res);
});

/**
 * Auth0 user login webhook (specific endpoint)
 * POST /api/webhooks/auth0/user-login
 */
router.post('/auth0/user-login', async (req, res) => {
  await webhookController.handleAuth0UserLogin(req, res);
});

/**
 * Auth0 user update webhook (specific endpoint)
 * POST /api/webhooks/auth0/user-update
 */
router.post('/auth0/user-update', async (req, res) => {
  await webhookController.handleAuth0UserUpdate(req, res);
});

/**
 * Auth0 user deletion webhook (specific endpoint)
 * POST /api/webhooks/auth0/user-deletion
 */
router.post('/auth0/user-deletion', async (req, res) => {
  await webhookController.handleAuth0UserDeletion(req, res);
});

/**
 * Razorpay webhook endpoint
 * Handles payment and subscription events from Razorpay
 * POST /api/webhooks/razorpay
 */
router.post('/razorpay', async (req, res) => {
  await webhookController.handleRazorpayWebhook(req, res);
});

/**
 * AI generation webhook endpoints
 * Handle completion events from AI services
 */
router.post('/ai/generation', async (req, res) => {
  await webhookController.handleAIGenerationWebhook(req, res);
});

router.post('/ai/openai', async (req, res) => {
  await webhookController.handleOpenAIWebhook(req, res);
});

router.post('/ai/ideogram', async (req, res) => {
  await webhookController.handleIdeogramWebhook(req, res);
});

router.post('/ai/gemini', async (req, res) => {
  await webhookController.handleGeminiWebhook(req, res);
});

/**
 * Slack webhook endpoint
 * Handles notifications and admin commands from Slack
 * POST /api/webhooks/slack
 */
router.post('/slack', async (req, res) => {
  await webhookController.handleSlackWebhook(req, res);
});

/**
 * Health check endpoint for webhooks
 * GET /api/webhooks/health
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Webhook Service',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/webhooks/auth0',
      'POST /api/webhooks/auth0/user-registration',
      'POST /api/webhooks/auth0/user-login',
      'POST /api/webhooks/auth0/user-update',
      'POST /api/webhooks/auth0/user-deletion',
      'POST /api/webhooks/razorpay',
      'POST /api/webhooks/ai/generation',
      'POST /api/webhooks/ai/openai',
      'POST /api/webhooks/ai/ideogram',
      'POST /api/webhooks/ai/gemini',
      'POST /api/webhooks/slack'
    ]
  });
});

module.exports = router;