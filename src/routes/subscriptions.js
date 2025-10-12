const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');

const router = express.Router();

// Subscription management endpoints

/**
 * @swagger
 * /api/subscriptions/create:
 *   post:
 *     summary: Create new subscription
 *     description: Create a new subscription for the authenticated user with a specific plan
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *                 description: Plan identifier (e.g., 'free', 'plus', 'pro')
 *                 example: 'pro'
 *               totalCount:
 *                 type: integer
 *                 description: Total number of billing cycles (default 1 for unlimited)
 *                 minimum: 1
 *                 default: 1
 *                 example: 1
 *               customerNotify:
 *                 type: boolean
 *                 description: Whether to notify customer via email/SMS
 *                 default: true
 *                 example: true
 *               notes:
 *                 type: object
 *                 description: Additional notes to attach to subscription
 *                 example:
 *                   source: 'web_app'
 *                   campaign: 'summer_sale'
 *           examples:
 *             create_pro_subscription:
 *               summary: Create Pro plan subscription
 *               value:
 *                 planId: 'pro'
 *                 totalCount: 1
 *                 customerNotify: true
 *             create_plus_subscription:
 *               summary: Create Plus plan subscription
 *               value:
 *                 planId: 'plus'
 *                 totalCount: 12
 *                 customerNotify: false
 *     responses:
 *       201:
 *         description: Subscription created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Subscription created successfully. Please complete payment using the provided URL.'
 *                 subscription:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: '507f1f77bcf86cd799439011'
 *                     razorpaySubscriptionId:
 *                       type: string
 *                       example: 'sub_1234567890abcdef'
 *                     short_url:
 *                       type: string
 *                       example: 'https://rzp.io/i/abc123'
 *                     status:
 *                       type: string
 *                       example: 'created'
 *                     billing:
 *                       type: object
 *                       properties:
 *                         amount:
 *                           type: number
 *                           example: 5900
 *                         currency:
 *                           type: string
 *                           example: 'INR'
 *                         interval:
 *                           type: string
 *                           example: 'monthly'
 *                         intervalCount:
 *                           type: number
 *                           example: 1
 *                     totalCount:
 *                       type: number
 *                       example: 1
 *                     paidCount:
 *                       type: number
 *                       example: 0
 *                     remainingCount:
 *                       type: number
 *                       example: 1
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 plan:
 *                   $ref: '#/components/schemas/Plan'
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_plan_id:
 *                 summary: Missing plan ID
 *                 value:
 *                   success: false
 *                   error: 'Validation error'
 *                   message: 'Plan ID is required'
 *               invalid_plan:
 *                 summary: Invalid plan ID
 *                 value:
 *                   success: false
 *                   error: 'Plan not found'
 *                   message: 'Invalid plan ID provided'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: 'User not found'
 *               message: 'User profile not found in database'
 *       409:
 *         description: Active subscription already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: 'Active subscription exists'
 *                 message:
 *                   type: string
 *                   example: 'User already has an active subscription'
 *                 subscription:
 *                   $ref: '#/components/schemas/Subscription'
 *       500:
 *         description: Internal server error or Razorpay error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               razorpay_error:
 *                 summary: Razorpay API error
 *                 value:
 *                   success: false
 *                   error: 'Razorpay error'
 *                   message: 'Failed to create subscription in Razorpay'
 *                   details: 'API key is invalid'
 *               internal_error:
 *                 summary: Internal server error
 *                 value:
 *                   success: false
 *                   error: 'Internal server error'
 *                   message: 'Failed to create subscription'
 */
router.post('/create', authenticate, subscriptionController.createSubscription);

/**
 * @swagger
 * /api/subscriptions/current:
 *   get:
 *     summary: Get current subscription
 *     description: Retrieve the user's current active subscription with plan details
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current subscription retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 subscription:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/Subscription'
 *                     - type: 'null'
 *                 message:
 *                   type: string
 *                   example: 'No active subscription found'
 *             examples:
 *               with_subscription:
 *                 summary: User has active subscription
 *                 value:
 *                   success: true
 *                   subscription:
 *                     id: '507f1f77bcf86cd799439011'
 *                     userId: '507f1f77bcf86cd799439012'
 *                     planId:
 *                       id: '507f1f77bcf86cd799439013'
 *                       name: 'Pro Plan'
 *                       planId: 'pro'
 *                       pricing:
 *                         amount: 5900
 *                         currency: 'INR'
 *                         interval: 'monthly'
 *                     status: 'active'
 *                     currentPeriodStart: '2024-01-15T10:30:00Z'
 *                     currentPeriodEnd: '2024-02-15T10:30:00Z'
 *                     cancelAtPeriodEnd: false
 *                     billing:
 *                       currency: 'INR'
 *                       amount: 5900
 *                       interval: 'monthly'
 *               no_subscription:
 *                 summary: User has no active subscription
 *                 value:
 *                   success: true
 *                   subscription: null
 *                   message: 'No active subscription found'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: 'User not found'
 *               message: 'User profile not found in database'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/current', authenticate, subscriptionController.getCurrentSubscription);
/**
 * @swagger
 * /api/subscriptions/history:
 *   get:
 *     summary: Get subscription history
 *     description: Retrieve the user's subscription history with pagination
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Number of subscriptions to return
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - name: skip
 *         in: query
 *         description: Number of subscriptions to skip
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: Subscription history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 subscriptions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Subscription'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       description: Total number of subscriptions
 *                       example: 25
 *                     limit:
 *                       type: number
 *                       description: Number of items per page
 *                       example: 10
 *                     skip:
 *                       type: number
 *                       description: Number of items skipped
 *                       example: 0
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether there are more items
 *                       example: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/history', authenticate, subscriptionController.getSubscriptionHistory);
/**
 * @swagger
 * /api/subscriptions/upgrade:
 *   post:
 *     summary: Upgrade subscription
 *     description: Upgrade user's subscription to a different plan with prorated billing
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscriptionUpgradeRequest'
 *           examples:
 *             upgrade_to_pro:
 *               summary: Upgrade to Pro plan
 *               value:
 *                 newPlanId: '507f1f77bcf86cd799439013'
 *                 immediate: true
 *                 reason: 'user_upgrade'
 *             scheduled_upgrade:
 *               summary: Schedule upgrade for next billing cycle
 *               value:
 *                 newPlanId: '507f1f77bcf86cd799439013'
 *                 immediate: false
 *                 reason: 'user_upgrade'
 *     responses:
 *       200:
 *         description: Subscription upgraded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Subscription upgraded successfully'
 *                 subscription:
 *                   $ref: '#/components/schemas/Subscription'
 *                 oldPlan:
 *                   $ref: '#/components/schemas/Plan'
 *                 newPlan:
 *                   $ref: '#/components/schemas/Plan'
 *                 changeType:
 *                   type: string
 *                   enum: ['upgrade', 'downgrade', 'change']
 *                   example: 'upgrade'
 *                 proratedAmount:
 *                   type: number
 *                   description: 'Prorated amount charged/refunded in smallest currency unit'
 *                   example: 2950
 *       400:
 *         description: Invalid request or subscription error
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ValidationError'
 *                 - $ref: '#/components/responses/SubscriptionError/content/application~1json/schema'
 *             examples:
 *               validation_error:
 *                 summary: Missing required fields
 *                 value:
 *                   success: false
 *                   error: 'Validation error'
 *                   message: 'New plan ID is required'
 *               same_plan_error:
 *                 summary: Cannot upgrade to same plan
 *                 value:
 *                   success: false
 *                   error: 'CANNOT_UPGRADE_TO_SAME_PLAN'
 *                   message: 'Cannot upgrade to the same plan'
 *                   details:
 *                     currentPlan: 'pro'
 *                     requestedPlan: 'pro'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: User or plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               user_not_found:
 *                 summary: User not found
 *                 value:
 *                   success: false
 *                   error: 'User not found'
 *                   message: 'User profile not found in database'
 *               no_subscription:
 *                 summary: No active subscription
 *                 value:
 *                   success: false
 *                   error: 'NO_ACTIVE_SUBSCRIPTION'
 *                   message: 'User does not have an active subscription'
 *               plan_not_found:
 *                 summary: Plan not found
 *                 value:
 *                   success: false
 *                   error: 'PLAN_NOT_FOUND'
 *                   message: 'Subscription plan not found'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/upgrade', authenticate, subscriptionController.upgradeSubscription);
/**
 * @swagger
 * /api/subscriptions/cancel:
 *   post:
 *     summary: Cancel subscription
 *     description: Cancel user's subscription either immediately or at the end of current billing period
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscriptionCancelRequest'
 *           examples:
 *             cancel_at_period_end:
 *               summary: Cancel at end of billing period
 *               value:
 *                 immediately: false
 *                 reason: 'user_cancellation'
 *             cancel_immediately:
 *               summary: Cancel immediately
 *               value:
 *                 immediately: true
 *                 reason: 'user_cancellation'
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Subscription will be cancelled at the end of current billing period'
 *                 subscription:
 *                   $ref: '#/components/schemas/Subscription'
 *                 cancelledImmediately:
 *                   type: boolean
 *                   description: 'Whether subscription was cancelled immediately'
 *                   example: false
 *             examples:
 *               cancelled_at_period_end:
 *                 summary: Cancelled at period end
 *                 value:
 *                   success: true
 *                   message: 'Subscription will be cancelled at the end of current billing period'
 *                   subscription:
 *                     id: '507f1f77bcf86cd799439011'
 *                     status: 'active'
 *                     cancelAtPeriodEnd: true
 *                     currentPeriodEnd: '2024-02-15T10:30:00Z'
 *                   cancelledImmediately: false
 *               cancelled_immediately:
 *                 summary: Cancelled immediately
 *                 value:
 *                   success: true
 *                   message: 'Subscription cancelled immediately'
 *                   subscription:
 *                     id: '507f1f77bcf86cd799439011'
 *                     status: 'cancelled'
 *                     cancelledAt: '2024-01-20T15:45:00Z'
 *                   cancelledImmediately: true
 *       400:
 *         $ref: '#/components/responses/SubscriptionError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: User or subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               user_not_found:
 *                 summary: User not found
 *                 value:
 *                   success: false
 *                   error: 'User not found'
 *                   message: 'User profile not found in database'
 *               no_subscription:
 *                 summary: No active subscription
 *                 value:
 *                   success: false
 *                   error: 'NO_ACTIVE_SUBSCRIPTION'
 *                   message: 'User does not have an active subscription'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/cancel', authenticate, subscriptionController.cancelSubscription);
/**
 * @swagger
 * /api/subscriptions/billing:
 *   get:
 *     summary: Get billing history
 *     description: Retrieve user's billing history with payment details and summary
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Number of billing records to return
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - name: skip
 *         in: query
 *         description: Number of billing records to skip
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - name: startDate
 *         in: query
 *         description: Filter billing records from this date (ISO 8601)
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *           example: '2024-01-01T00:00:00Z'
 *       - name: endDate
 *         in: query
 *         description: Filter billing records until this date (ISO 8601)
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *           example: '2024-01-31T23:59:59Z'
 *     responses:
 *       200:
 *         description: Billing history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 billingHistory:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BillingHistoryItem'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       description: Total number of billing records
 *                       example: 12
 *                     limit:
 *                       type: number
 *                       example: 10
 *                     skip:
 *                       type: number
 *                       example: 0
 *                     hasMore:
 *                       type: boolean
 *                       example: true
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalAmountPaid:
 *                       type: number
 *                       description: Total amount paid in smallest currency unit
 *                       example: 70800
 *                     totalPayments:
 *                       type: number
 *                       description: Total number of successful payments
 *                       example: 12
 *                     averagePayment:
 *                       type: number
 *                       description: Average payment amount
 *                       example: 5900
 *                     lastPaymentDate:
 *                       type: string
 *                       format: date-time
 *                       description: Date of last successful payment
 *                       example: '2024-01-15T10:30:00Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/billing', authenticate, subscriptionController.getBillingHistory);

// Plan endpoints

/**
 * @swagger
 * /api/subscriptions/plans:
 *   get:
 *     summary: Get available plans
 *     description: Retrieve all publicly available subscription plans with features and pricing
 *     tags: [Plans]
 *     responses:
 *       200:
 *         description: Available plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 plans:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Plan'
 *             example:
 *               success: true
 *               plans:
 *                 - id: '507f1f77bcf86cd799439011'
 *                   name: 'Free'
 *                   planId: 'free'
 *                   description: 'Perfect for trying out Jomobit'
 *                   pricing:
 *                     amount: 0
 *                     currency: 'INR'
 *                     interval: 'monthly'
 *                   features:
 *                     credits:
 *                       monthly: 3
 *                       rollover: false
 *                     businessProfiles:
 *                       limit: 1
 *                   tier: 'free'
 *                   status: 'active'
 *                   isFeatured: false
 *                 - id: '507f1f77bcf86cd799439012'
 *                   name: 'Plus'
 *                   planId: 'plus'
 *                   description: 'Great for small businesses and entrepreneurs'
 *                   pricing:
 *                     amount: 2500
 *                     currency: 'INR'
 *                     interval: 'monthly'
 *                   features:
 *                     credits:
 *                       monthly: 50
 *                       rollover: false
 *                     businessProfiles:
 *                       limit: 3
 *                   tier: 'basic'
 *                   status: 'active'
 *                   isFeatured: true
 *                 - id: '507f1f77bcf86cd799439013'
 *                   name: 'Pro'
 *                   planId: 'pro'
 *                   description: 'Perfect for growing businesses and agencies'
 *                   pricing:
 *                     amount: 5900
 *                     currency: 'INR'
 *                     interval: 'monthly'
 *                   features:
 *                     credits:
 *                       monthly: 120
 *                       rollover: true
 *                     businessProfiles:
 *                       limit: 8
 *                   tier: 'premium'
 *                   status: 'active'
 *                   isFeatured: true
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/plans', subscriptionController.getAvailablePlans);
/**
 * @swagger
 * /api/subscriptions/plans/{planId}:
 *   get:
 *     summary: Get plan by ID
 *     description: Retrieve detailed information about a specific subscription plan
 *     tags: [Plans]
 *     parameters:
 *       - name: planId
 *         in: path
 *         required: true
 *         description: Plan identifier (e.g., 'free', 'plus', 'pro')
 *         schema:
 *           type: string
 *           example: 'pro'
 *     responses:
 *       200:
 *         description: Plan details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 plan:
 *                   $ref: '#/components/schemas/Plan'
 *             example:
 *               success: true
 *               plan:
 *                 id: '507f1f77bcf86cd799439013'
 *                 name: 'Pro Plan'
 *                 planId: 'pro'
 *                 description: 'Perfect for growing businesses and agencies'
 *                 pricing:
 *                   amount: 5900
 *                   currency: 'INR'
 *                   interval: 'monthly'
 *                   intervalCount: 1
 *                 features:
 *                   credits:
 *                     monthly: 120
 *                     rollover: true
 *                   businessProfiles:
 *                     limit: 8
 *                   templates:
 *                     access: 'all'
 *                     customTemplates: true
 *                   aiProviders:
 *                     llm: ['openai', 'gemini']
 *                     diffusion: ['openai', 'ideogram']
 *                   additional:
 *                     prioritySupport: true
 *                     analytics: true
 *                     apiAccess: true
 *                     whiteLabel: true
 *                     bulkGeneration: true
 *                 tier: 'premium'
 *                 status: 'active'
 *                 isFeatured: true
 *                 trial:
 *                   enabled: false
 *                   duration: 0
 *       404:
 *         $ref: '#/components/responses/PlanNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/plans/:planId', subscriptionController.getPlanById);

router.post('/plans', subscriptionController.createRazorpayPlan);

router.post('/plans/razorpay', subscriptionController.createRazorpayPlan);

// Webhook endpoints

/**
 * @swagger
 * /api/subscriptions/webhooks/razorpay:
 *   post:
 *     summary: Process Razorpay webhook
 *     description: Handle Razorpay subscription and payment webhooks for automated billing processing
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 enum: ['subscription.activated', 'subscription.charged', 'subscription.completed', 'payment.captured', 'payment.failed', 'subscription.cancelled', 'subscription.halted']
 *                 description: Webhook event type
 *                 example: 'subscription.charged'
 *               payload:
 *                 type: object
 *                 description: Event payload from Razorpay
 *                 properties:
 *                   subscription:
 *                     type: object
 *                     properties:
 *                       entity:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Razorpay subscription ID
 *                             example: 'sub_1234567890abcdef'
 *                           status:
 *                             type: string
 *                             example: 'active'
 *                           current_start:
 *                             type: number
 *                             description: Current period start timestamp
 *                             example: 1705312200
 *                           current_end:
 *                             type: number
 *                             description: Current period end timestamp
 *                             example: 1707990600
 *                   payment:
 *                     type: object
 *                     properties:
 *                       entity:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Razorpay payment ID
 *                             example: 'pay_1234567890abcdef'
 *                           amount:
 *                             type: number
 *                             description: Payment amount in paise
 *                             example: 5900
 *                           currency:
 *                             type: string
 *                             example: 'INR'
 *                           status:
 *                             type: string
 *                             example: 'captured'
 *             required: ['event', 'payload']
 *           examples:
 *             subscription_charged:
 *               summary: Subscription charged successfully
 *               value:
 *                 event: 'subscription.charged'
 *                 payload:
 *                   subscription:
 *                     entity:
 *                       id: 'sub_1234567890abcdef'
 *                       status: 'active'
 *                       current_start: 1705312200
 *                       current_end: 1707990600
 *                   payment:
 *                     entity:
 *                       id: 'pay_1234567890abcdef'
 *                       amount: 5900
 *                       currency: 'INR'
 *                       status: 'captured'
 *             payment_failed:
 *               summary: Payment failed
 *               value:
 *                 event: 'payment.failed'
 *                 payload:
 *                   payment:
 *                     entity:
 *                       id: 'pay_1234567890abcdef'
 *                       amount: 5900
 *                       currency: 'INR'
 *                       status: 'failed'
 *                       error_code: 'BAD_REQUEST_ERROR'
 *                       error_description: 'Payment failed due to insufficient funds'
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
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Subscription renewal processed successfully'
 *             examples:
 *               subscription_processed:
 *                 summary: Subscription webhook processed
 *                 value:
 *                   success: true
 *                   message: 'Subscription renewal processed successfully'
 *               payment_processed:
 *                 summary: Payment webhook processed
 *                 value:
 *                   success: true
 *                   message: 'Payment processed successfully'
 *               unhandled_event:
 *                 summary: Unhandled event type
 *                 value:
 *                   success: true
 *                   message: 'Event received but not processed'
 *       400:
 *         description: Webhook processing error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               subscription_error:
 *                 summary: Subscription processing error
 *                 value:
 *                   success: false
 *                   error: 'SUBSCRIPTION_NOT_FOUND'
 *                   message: 'Subscription not found in database'
 *               payment_error:
 *                 summary: Payment processing error
 *                 value:
 *                   success: false
 *                   error: 'PAYMENT_PROCESSING_ERROR'
 *                   message: 'Failed to process payment webhook'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/webhooks/razorpay', subscriptionController.processRazorpayWebhook);

// Admin subscription endpoints

/**
 * @swagger
 * /api/subscriptions/admin/analytics:
 *   get:
 *     summary: Get subscription analytics (Admin)
 *     description: Retrieve comprehensive subscription analytics including revenue, churn, and trends
 *     tags: [Admin - Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         description: Analytics start date (ISO 8601)
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *           example: '2024-01-01T00:00:00Z'
 *       - name: endDate
 *         in: query
 *         description: Analytics end date (ISO 8601)
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *           example: '2024-01-31T23:59:59Z'
 *       - name: planId
 *         in: query
 *         description: Filter analytics by specific plan
 *         required: false
 *         schema:
 *           type: string
 *           example: 'pro'
 *     responses:
 *       200:
 *         description: Subscription analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 analytics:
 *                   $ref: '#/components/schemas/SubscriptionAnalytics'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/admin/analytics', authenticate, requireAdmin(), subscriptionController.getSubscriptionAnalytics);
/**
 * @swagger
 * /api/subscriptions/admin:
 *   get:
 *     summary: Get all subscriptions (Admin)
 *     description: Retrieve all subscriptions with advanced filtering and pagination for admin management
 *     tags: [Admin - Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: query
 *         description: Filter by user ID
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *           example: '507f1f77bcf86cd799439012'
 *       - name: planId
 *         in: query
 *         description: Filter by plan ID
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *           example: '507f1f77bcf86cd799439013'
 *       - name: status
 *         in: query
 *         description: Filter by subscription status
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['active', 'cancelled', 'expired', 'paused', 'pending']
 *           example: 'active'
 *       - name: startDate
 *         in: query
 *         description: Filter subscriptions created after this date
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *           example: '2024-01-01T00:00:00Z'
 *       - name: endDate
 *         in: query
 *         description: Filter subscriptions created before this date
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *           example: '2024-01-31T23:59:59Z'
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Number of subscriptions per page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - name: sortBy
 *         in: query
 *         description: Field to sort by
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['createdAt', 'updatedAt', 'currentPeriodEnd', 'status']
 *           default: 'createdAt'
 *       - name: sortOrder
 *         in: query
 *         description: Sort order
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['asc', 'desc']
 *           default: 'desc'
 *     responses:
 *       200:
 *         description: Subscriptions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 subscriptions:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Subscription'
 *                       - type: object
 *                         properties:
 *                           userId:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: '507f1f77bcf86cd799439012'
 *                               email:
 *                                 type: string
 *                                 example: 'user@example.com'
 *                               metadata:
 *                                 type: object
 *                                 properties:
 *                                   name:
 *                                     type: string
 *                                     example: 'John Doe'
 *                           planId:
 *                             $ref: '#/components/schemas/Plan'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                       example: 1
 *                     limit:
 *                       type: number
 *                       example: 50
 *                     total:
 *                       type: number
 *                       example: 1250
 *                     pages:
 *                       type: number
 *                       example: 25
 *                 filters:
 *                   type: object
 *                   description: Applied filters
 *                   properties:
 *                     userId:
 *                       type: string
 *                       example: null
 *                     planId:
 *                       type: string
 *                       example: null
 *                     status:
 *                       type: string
 *                       example: 'active'
 *                     startDate:
 *                       type: string
 *                       example: null
 *                     endDate:
 *                       type: string
 *                       example: null
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/admin', authenticate, requireAdmin(), subscriptionController.getAdminSubscriptions);
/**
 * @swagger
 * /api/subscriptions/admin/process-cancellations:
 *   post:
 *     summary: Process scheduled cancellations (Admin)
 *     description: Process all subscriptions scheduled for cancellation at period end
 *     tags: [Admin - Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduled cancellations processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Scheduled cancellations processed successfully'
 *                 results:
 *                   type: object
 *                   properties:
 *                     processedSubscriptions:
 *                       type: number
 *                       description: Total number of subscriptions processed
 *                       example: 15
 *                     successfulCancellations:
 *                       type: number
 *                       description: Number of successful cancellations
 *                       example: 12
 *                     failedCancellations:
 *                       type: number
 *                       description: Number of failed cancellations
 *                       example: 3
 *             example:
 *               success: true
 *               message: 'Scheduled cancellations processed successfully'
 *               results:
 *                 processedSubscriptions: 15
 *                 successfulCancellations: 12
 *                 failedCancellations: 3
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/admin/process-cancellations', authenticate, requireAdmin(), subscriptionController.processScheduledCancellations);

module.exports = router;