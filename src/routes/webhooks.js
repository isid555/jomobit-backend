// const express = require('express'); done
// const webhookController = require('../controllers/webhookController'); done

// const logger = require('../utils/logger'); done
// const expressRaw = express.raw;
// const router = express.Router(); done


const express = require('express');
const router = express.Router();
// const crypto = require('crypto');
const logger = require('../utils/logger');
const webhookController = require('../controllers/webhookController');
const { webhookValidators, auditLog } = require('../middleware/security'); //this should be there. 

// ============================================
// 🔥 CRITICAL: Raw body parser for ALL webhook routes
// ============================================
// This MUST be applied BEFORE any validation or routing
router.use(express.raw({ 
  type: 'application/json',
  limit: '10mb'
}));


/**
 * Middleware to log all webhook requests
 */
// const logWebhookRequest = (req, res, next) => {
//   logger.info('Webhook request received', {
//     path: req.path,
//     method: req.method,
//     headers: {
//       'content-type': req.headers['content-type'],
//       'user-agent': req.headers['user-agent'],
//       'x-auth0-signature': req.headers['x-auth0-signature'] ? '[PRESENT]' : '[MISSING]'
//     },
//     ip: req.ip,
//     timestamp: new Date().toISOString()
//   });
//   next();
// };

// ============================================
// Middleware to log raw body reception
// ============================================
router.use((req, res, next) => {
  logger.info('📦 [WEBHOOK-ROUTE] Raw body received', {
    path: req.path,
    method: req.method,
    bodyType: Buffer.isBuffer(req.body) ? 'Buffer' : typeof req.body,
    bodyLength: Buffer.isBuffer(req.body) ? req.body.length : 
                (typeof req.body === 'string' ? req.body.length : 
                JSON.stringify(req.body).length),
    contentType: req.get('content-type'),
    contentLength: req.get('content-length'),
    hasSignature: {
      razorpay: !!req.get('x-razorpay-signature'),
      auth0: !!req.get('x-auth0-signature'),
      openai: !!req.get('x-openai-signature')
    }
  });
  next();
});

// Apply logging middleware to all webhook routes
// router.use(logWebhookRequest);

/**
 * @swagger
 * /api/webhooks/auth0:
 *   post:
 *     summary: Auth0 webhook endpoint
 *     description: Handles user lifecycle events from Auth0
 *     tags: [Webhooks]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 description: Event type from Auth0
 *               data:
 *                 type: object
 *                 description: Event data from Auth0
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Invalid webhook signature
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// router.post('/auth0', 
//   webhookValidators.auth0,
//   auditLog('auth0_webhook'),
//   async (req, res) => {
//     await webhookController.handleAuth0Webhook(req, res);
//   }
// );

router.post('/auth0',
  webhookValidators.auth0,
  auditLog('auth0_webhook'),
  async (req, res) => {
    logger.info("🎯 [WEBHOOK-ROUTE] Auth0 webhook route hit");
    await webhookController.handleAuth0Webhook(req, res);
  }
);

/**
 * @swagger
 * /api/webhooks/auth0/user-registration:
 *   post:
 *     summary: Auth0 user registration webhook
 *     description: Handles new user registration events from Auth0
 *     tags: [Webhooks]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user:
 *                 type: object
 *                 description: User data from Auth0
 *     responses:
 *       200:
 *         description: User registration processed
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth0/user-registration',
  webhookValidators.auth0,
  auditLog('auth0_user_registration'),
  async (req, res) => {
    await webhookController.handleAuth0UserRegistration(req, res);
  }
);

/**
 * @swagger
 * /api/webhooks/auth0/user-login:
 *   post:
 *     summary: Auth0 user login webhook
 *     description: Handles user login events from Auth0
 *     tags: [Webhooks]
 *     security: []
 *     responses:
 *       200:
 *         description: User login processed
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth0/user-login',
  webhookValidators.auth0,
  auditLog('auth0_user_login'),
  async (req, res) => {
    await webhookController.handleAuth0UserLogin(req, res);
  }
);

/**
 * @swagger
 * /api/webhooks/auth0/user-update:
 *   post:
 *     summary: Auth0 user update webhook
 *     description: Handles user profile update events from Auth0
 *     tags: [Webhooks]
 *     security: []
 *     responses:
 *       200:
 *         description: User update processed
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth0/user-update',
  webhookValidators.auth0,
  auditLog('auth0_user_update'),
  async (req, res) => {
    await webhookController.handleAuth0UserUpdate(req, res);
  }
);

/**
 * @swagger
 * /api/webhooks/auth0/user-deletion:
 *   post:
 *     summary: Auth0 user deletion webhook
 *     description: Handles user account deletion events from Auth0
 *     tags: [Webhooks]
 *     security: []
 *     responses:
 *       200:
 *         description: User deletion processed
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/auth0/user-deletion',
  webhookValidators.auth0,
  auditLog('auth0_user_deletion'),
  async (req, res) => {
    await webhookController.handleAuth0UserDeletion(req, res);
  }
);

/**
 * @swagger
 * /api/webhooks/razorpay:
 *   post:
 *     summary: Razorpay webhook endpoint
 *     description: Handles payment and subscription events from Razorpay
 *     tags: [Webhooks]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 description: Event type from Razorpay
 *               payload:
 *                 type: object
 *                 description: Payment/subscription data
 *     responses:
 *       200:
 *         description: Payment webhook processed successfully
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// router.post('/razorpay',
//   expressRaw({ type: 'application/json' }),
//   webhookValidators.razorpay,
//   auditLog('razorpay_webhook'),
//   async (req, res) => {
//     console.log("Webhooks is being triggered!");
//     logger.info("Webhooks is being triggered!");
//     await webhookController.handleRazorpayWebhook(req, res);
//   }
// );

// ============================================
// 4. UPDATED webhook route (webhooks.js)
// ============================================
// router.post('/razorpay',
//   expressRaw({ type: 'application/json' }), // Captures raw body as Buffer
//   webhookValidators.razorpay, // This validates signature
//   auditLog('razorpay_webhook'),
//   async (req, res) => {
//     logger.info("🎯 [WEBHOOK-ROUTE] Razorpay webhook route hit");
//     await webhookController.handleRazorpayWebhook(req, res);
//   }
// );

// ============================================
// RAZORPAY WEBHOOK
// ============================================
router.post('/razorpay',
  webhookValidators.razorpay,  // Validates signature with raw Buffer
  auditLog('razorpay_webhook'),
  async (req, res) => {
    logger.info("🎯 [WEBHOOK-ROUTE] Razorpay webhook route hit", {
      bodyType: Buffer.isBuffer(req.body) ? 'Buffer' : typeof req.body,
      signatureVerified: req.signatureVerified,
      hasRawBodyBuffer: !!req.rawBodyBuffer
    });
    await webhookController.handleRazorpayWebhook(req, res);
  }
);

/**
 * @swagger
 * /api/webhooks/ai/generation:
 *   post:
 *     summary: AI generation webhook
 *     description: Handles completion events from AI services
 *     tags: [Webhooks]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               jobId:
 *                 type: string
 *                 description: Generation job ID
 *               status:
 *                 type: string
 *                 enum: [completed, failed]
 *               result:
 *                 type: object
 *                 description: Generation result data
 *     responses:
 *       200:
 *         description: Generation webhook processed
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/ai/generation',
  auditLog('ai_generation_webhook'),
  async (req, res) => {
    await webhookController.handleAIGenerationWebhook(req, res);
  }
);

/**
 * @swagger
 * /api/webhooks/ai/openai:
 *   post:
 *     summary: OpenAI webhook endpoint
 *     description: Handles completion events from OpenAI services
 *     tags: [Webhooks]
 *     security: []
 *     responses:
 *       200:
 *         description: OpenAI webhook processed
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/ai/openai',
  webhookValidators.openai,
  auditLog('openai_webhook'),
  async (req, res) => {
    await webhookController.handleOpenAIWebhook(req, res);
  }
);

/**
 * @swagger
 * /api/webhooks/ai/ideogram:
 *   post:
 *     summary: Ideogram webhook endpoint
 *     description: Handles completion events from Ideogram services
 *     tags: [Webhooks]
 *     security: []
 *     responses:
 *       200:
 *         description: Ideogram webhook processed
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/ai/ideogram',
  webhookValidators.ideogram,
  auditLog('ideogram_webhook'),
  async (req, res) => {
    await webhookController.handleIdeogramWebhook(req, res);
  }
);

/**
 * @swaggger/@ -> this needs to be added and then the code below needs to be uncommented
 * /api/webhooks/ai/gemini:
 *   post:
 *     summary: Gemini webhook endpoint
 *     description: Handles completion events from Gemini services
 *     tags: [Webhooks]
 *     security: []
 *     responses:
 *       200:
 *         description: Gemini webhook processed
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// router.post('/ai/gemini',
//   webhookValidators.gemini,
//   auditLog('gemini_webhook'),
//   async (req, res) => {
//     await webhookController.handleGeminiWebhook(req, res);
//   }
// );

/**
 * @swagger
 * /api/webhooks/slack:
 *   post:
 *     summary: Slack webhook endpoint
 *     description: Handles notifications and admin commands from Slack
 *     tags: [Webhooks]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 description: Slack event type
 *               event:
 *                 type: object
 *                 description: Slack event data
 *     responses:
 *       200:
 *         description: Slack webhook processed
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/slack',
  webhookValidators.slack,
  auditLog('slack_webhook'),
  async (req, res) => {
    await webhookController.handleSlackWebhook(req, res);
  }
);

/**
 * @swagger
 * /api/webhooks/health:
 *   get:
 *     summary: Webhook service health check
 *     description: Returns the health status of the webhook service
 *     tags: [Webhooks]
 *     security: []
 *     responses:
 *       200:
 *         description: Webhook service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 service:
 *                   type: string
 *                   example: Webhook Service
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 endpoints:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of available webhook endpoints
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