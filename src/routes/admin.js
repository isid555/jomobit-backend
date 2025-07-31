const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const AdminController = require('../controllers/adminController');

const router = express.Router();
const adminController = new AdminController();

/**
 * @swagger
 * tags:
 *   - name: Admin Dashboard
 *     description: Administrative dashboard and metrics endpoints
 *   - name: Admin User Management
 *     description: User management and moderation endpoints
 *   - name: Admin Plan Management
 *     description: Subscription plan management endpoints
 *   - name: Admin Template Management
 *     description: Template administration endpoints
 *   - name: Admin Payment Monitoring
 *     description: Payment and transaction monitoring endpoints
 *   - name: Admin System
 *     description: System health and configuration endpoints
 *   - name: Admin Data Export
 *     description: Data export and reporting endpoints
 */

/**
 * Dashboard and Metrics Routes
 */

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard insights
 *     description: Retrieve comprehensive dashboard data including key metrics, recent activity, and system overview for administrative purposes.
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for metrics filtering (YYYY-MM-DD)
 *         example: "2024-01-01"
 *       - name: endDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for metrics filtering (YYYY-MM-DD)
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 dashboard:
 *                   $ref: '#/components/schemas/AdminDashboard'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/dashboard', authenticate, requireAdmin(), adminController.getDashboard.bind(adminController));

/**
 * @swagger
 * /admin/metrics/users:
 *   get:
 *     summary: Get user metrics and analytics
 *     description: Retrieve detailed user metrics including registration trends, activity patterns, and user demographics.
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for metrics filtering
 *         example: "2024-01-01"
 *       - name: endDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for metrics filtering
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: User metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 metrics:
 *                   $ref: '#/components/schemas/UserMetrics'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/metrics/users', authenticate, requireAdmin(), adminController.getUserMetrics.bind(adminController));

/**
 * @swagger
 * /admin/metrics/revenue:
 *   get:
 *     summary: Get revenue metrics and analytics
 *     description: Retrieve comprehensive revenue analytics including subscription trends, payment patterns, and financial performance metrics.
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for revenue metrics
 *         example: "2024-01-01"
 *       - name: endDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for revenue metrics
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Revenue metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 metrics:
 *                   $ref: '#/components/schemas/RevenueMetrics'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/metrics/revenue', authenticate, requireAdmin(), adminController.getRevenueMetrics.bind(adminController));

/**
 * User Management Routes
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get users list with filtering and pagination
 *     description: Retrieve a paginated list of users with advanced filtering options for administrative management.
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of users per page
 *         example: 20
 *       - name: status
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, active, suspended]
 *         description: Filter users by account status
 *         example: "active"
 *       - name: role
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [user, admin]
 *         description: Filter users by role
 *         example: "user"
 *       - name: search
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *         description: Search users by email or name
 *         example: "john@example.com"
 *       - name: sortBy
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [createdAt, email, status, lastLogin]
 *           default: createdAt
 *         description: Field to sort by
 *         example: "createdAt"
 *       - name: sortOrder
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Users list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminUserDetails'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *                 totalCount:
 *                   type: integer
 *                   example: 1250
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/users', authenticate, requireAdmin(), adminController.getUsers.bind(adminController));

/**
 * @swagger
 * /admin/users/{userId}:
 *   get:
 *     summary: Get detailed user information
 *     description: Retrieve comprehensive details about a specific user including profile, subscription, activity history, and administrative notes.
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: Unique user identifier
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/AdminUserDetails'
 *                 subscription:
 *                   $ref: '#/components/schemas/UserSubscriptionDetails'
 *                 activity:
 *                   $ref: '#/components/schemas/UserActivitySummary'
 *                 profiles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BusinessProfile'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/users/:userId', authenticate, requireAdmin(), adminController.getUserDetails.bind(adminController));

/**
 * @swagger
 * /admin/users/{userId}/suspend:
 *   post:
 *     summary: Suspend user account
 *     description: Suspend a user account with a specified reason. This action prevents the user from accessing the platform and triggers system notifications.
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: Unique user identifier
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 description: Detailed reason for suspension
 *                 example: "Violation of terms of service - inappropriate content generation"
 *             required:
 *               - reason
 *     responses:
 *       200:
 *         description: User suspended successfully
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
 *                   example: "User suspended successfully"
 *                 user:
 *                   $ref: '#/components/schemas/AdminUserDetails'
 *       400:
 *         description: Validation error or user already suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/users/:userId/suspend', authenticate, requireAdmin(), adminController.suspendUser.bind(adminController));

/**
 * @swagger
 * /admin/users/{userId}/reactivate:
 *   post:
 *     summary: Reactivate suspended user account
 *     description: Reactivate a previously suspended user account, restoring full platform access and triggering system notifications.
 *     tags: [Admin User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: Unique user identifier
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: User reactivated successfully
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
 *                   example: "User reactivated successfully"
 *                 user:
 *                   $ref: '#/components/schemas/AdminUserDetails'
 *       400:
 *         description: User is not suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/users/:userId/reactivate', authenticate, requireAdmin(), adminController.reactivateUser.bind(adminController));

/**
 * Plan Management Routes
 */

/**
 * @swagger
 * /admin/plans:
 *   get:
 *     summary: Get all subscription plans with statistics
 *     description: Retrieve all subscription plans with detailed usage statistics, subscriber counts, and revenue metrics.
 *     tags: [Admin Plan Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Plans retrieved successfully
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
 *                     $ref: '#/components/schemas/AdminPlanDetails'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *   post:
 *     summary: Create new subscription plan
 *     description: Create a new subscription plan with pricing, features, and limits configuration.
 *     tags: [Admin Plan Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePlanRequest'
 *     responses:
 *       201:
 *         description: Plan created successfully
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
 *                   example: "Plan created successfully"
 *                 plan:
 *                   $ref: '#/components/schemas/AdminPlanDetails'
 *       400:
 *         description: Validation error or plan ID already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/plans', authenticate, requireAdmin(), adminController.getPlans.bind(adminController));
router.post('/plans', authenticate, requireAdmin(), adminController.createPlan.bind(adminController));

/**
 * @swagger
 * /admin/plans/{planId}:
 *   put:
 *     summary: Update existing subscription plan
 *     description: Update an existing subscription plan's configuration, pricing, or features. Active subscriptions will be affected based on the changes.
 *     tags: [Admin Plan Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: planId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan identifier (e.g., 'free', 'plus', 'pro')
 *         example: "plus"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePlanRequest'
 *     responses:
 *       200:
 *         description: Plan updated successfully
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
 *                   example: "Plan updated successfully"
 *                 plan:
 *                   $ref: '#/components/schemas/AdminPlanDetails'
 *       400:
 *         description: Validation error or invalid plan modification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *   delete:
 *     summary: Delete subscription plan
 *     description: Delete a subscription plan. Plans with active subscriptions cannot be deleted and must be migrated first.
 *     tags: [Admin Plan Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: planId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan identifier to delete
 *         example: "deprecated-plan"
 *     responses:
 *       200:
 *         description: Plan deleted successfully
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
 *                   example: "Plan deleted successfully"
 *                 plan:
 *                   $ref: '#/components/schemas/AdminPlanDetails'
 *       400:
 *         description: Cannot delete plan with active subscriptions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/plans/:planId', authenticate, requireAdmin(), adminController.updatePlan.bind(adminController));
router.delete('/plans/:planId', authenticate, requireAdmin(), adminController.deletePlan.bind(adminController));

/**
 * Template Management Routes
 */

/**
 * @swagger
 * /admin/templates:
 *   get:
 *     summary: Get templates with administrative statistics
 *     description: Retrieve all templates with detailed usage statistics, performance metrics, and administrative controls.
 *     tags: [Admin Template Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of templates per page
 *         example: 20
 *       - name: status
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [draft, active, inactive, archived]
 *         description: Filter templates by status
 *         example: "active"
 *       - name: category
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter templates by category
 *         example: "business"
 *       - name: search
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *         description: Search templates by name or description
 *         example: "business card"
 *       - name: sortBy
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [createdAt, name, usageCount, rating]
 *           default: createdAt
 *         description: Field to sort by
 *         example: "usageCount"
 *       - name: sortOrder
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 templates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminTemplateDetails'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *                 totalCount:
 *                   type: integer
 *                   example: 450
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/templates', authenticate, requireAdmin(), adminController.getTemplates.bind(adminController));

/**
 * @swagger
 * /admin/templates/batch:
 *   post:
 *     summary: Batch upload templates
 *     description: Upload multiple templates in a single operation with validation and error reporting for each template.
 *     tags: [Admin Template Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templates:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 50
 *                 items:
 *                   $ref: '#/components/schemas/BatchTemplateUpload'
 *                 description: Array of templates to upload
 *             required:
 *               - templates
 *     responses:
 *       201:
 *         description: Batch upload completed
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
 *                   example: "Batch upload completed"
 *                 results:
 *                   $ref: '#/components/schemas/BatchUploadResults'
 *       400:
 *         description: Validation error or empty templates array
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/templates/batch', authenticate, requireAdmin(), adminController.batchUploadTemplates.bind(adminController));

/**
 * @swagger
 * /admin/templates/{templateId}/status:
 *   put:
 *     summary: Update template status
 *     description: Update the active status of a template, controlling its availability to users.
 *     tags: [Admin Template Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: Unique template identifier
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: Whether the template should be active and available to users
 *                 example: true
 *             required:
 *               - isActive
 *     responses:
 *       200:
 *         description: Template status updated successfully
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
 *                   example: "Template status updated successfully"
 *                 template:
 *                   $ref: '#/components/schemas/AdminTemplateDetails'
 *       400:
 *         description: Validation error - isActive must be boolean
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/templates/:templateId/status', authenticate, requireAdmin(), adminController.updateTemplateStatus.bind(adminController));

/**
 * Payment Monitoring Routes
 */

/**
 * @swagger
 * /admin/payments/transactions:
 *   get:
 *     summary: Get payment transactions with filtering
 *     description: Retrieve detailed payment transaction history with advanced filtering and pagination for administrative monitoring.
 *     tags: [Admin Payment Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of transactions per page
 *         example: 20
 *       - name: status
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *         description: Filter transactions by payment status
 *         example: "completed"
 *       - name: startDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for transaction filtering
 *         example: "2024-01-01"
 *       - name: endDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for transaction filtering
 *         example: "2024-01-31"
 *       - name: userId
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: Filter transactions by specific user
 *         example: "507f1f77bcf86cd799439011"
 *       - name: sortBy
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [paidAt, amount, status]
 *           default: paidAt
 *         description: Field to sort by
 *         example: "paidAt"
 *       - name: sortOrder
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Payment transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminPaymentTransaction'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *                 totalCount:
 *                   type: integer
 *                   example: 2450
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/payments/transactions', authenticate, requireAdmin(), adminController.getPaymentTransactions.bind(adminController));

/**
 * @swagger
 * /admin/payments/analytics:
 *   get:
 *     summary: Get payment analytics and insights
 *     description: Retrieve comprehensive payment analytics including revenue trends, conversion rates, and payment method performance.
 *     tags: [Admin Payment Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics period
 *         example: "2024-01-01"
 *       - name: endDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics period
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Payment analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 analytics:
 *                   $ref: '#/components/schemas/PaymentAnalytics'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/payments/analytics', authenticate, requireAdmin(), adminController.getPaymentAnalytics.bind(adminController));

/**
 * @swagger
 * /admin/payments/failed:
 *   get:
 *     summary: Get failed payment transactions
 *     description: Retrieve recent failed payment transactions for investigation and customer support purposes.
 *     tags: [Admin Payment Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *         description: Maximum number of failed payments to retrieve
 *         example: 50
 *       - name: startDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for failed payment filtering
 *         example: "2024-01-01"
 *       - name: endDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for failed payment filtering
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Failed payments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 failedPayments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FailedPaymentDetails'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/payments/failed', authenticate, requireAdmin(), adminController.getFailedPayments.bind(adminController));

/**
 * Slack Integration Routes
 */

/**
 * @swagger
 * /admin/slack/notify:
 *   post:
 *     summary: Send Slack notification
 *     description: Send a custom notification message to a specified Slack channel for administrative communication.
 *     tags: [Admin System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Message content to send
 *                 example: "System maintenance scheduled for tonight at 2 AM UTC"
 *               channel:
 *                 type: string
 *                 default: "#general"
 *                 description: Slack channel to send message to
 *                 example: "#admin-alerts"
 *               urgent:
 *                 type: boolean
 *                 default: false
 *                 description: Whether this is an urgent notification
 *                 example: false
 *               type:
 *                 type: string
 *                 enum: [info, warning, error, success]
 *                 default: info
 *                 description: Notification type for formatting
 *                 example: "info"
 *             required:
 *               - message
 *     responses:
 *       200:
 *         description: Notification sent successfully
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
 *                   example: "Notification sent successfully"
 *                 result:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                       example: "1234567890.123456"
 *                     channel:
 *                       type: string
 *                       example: "#admin-alerts"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Validation error - message is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/slack/notify', authenticate, requireAdmin(), adminController.sendSlackNotification.bind(adminController));

/**
 * @swagger
 * /admin/slack/daily-summary:
 *   post:
 *     summary: Send daily summary report
 *     description: Generate and send a comprehensive daily summary report to the configured Slack channel with key metrics and system status.
 *     tags: [Admin System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daily summary sent successfully
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
 *                   example: "Daily summary sent successfully"
 *                 result:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                       example: "1234567890.123456"
 *                     summaryDate:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-15"
 *                     metricsIncluded:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["users", "revenue", "generations", "system_health"]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/slack/daily-summary', authenticate, requireAdmin(), adminController.sendDailySummary.bind(adminController));

/**
 * System Monitoring Routes
 */

/**
 * @swagger
 * /admin/system/health:
 *   get:
 *     summary: Perform comprehensive system health check
 *     description: Execute a detailed health check of all system components including database, Redis, external APIs, and service dependencies.
 *     tags: [Admin System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 health:
 *                   $ref: '#/components/schemas/SystemHealthCheck'
 *       503:
 *         description: System has health issues
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 health:
 *                   $ref: '#/components/schemas/SystemHealthCheck'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/system/health', authenticate, requireAdmin(), adminController.performHealthCheck.bind(adminController));

/**
 * @swagger
 * /admin/system/config:
 *   get:
 *     summary: Get system configuration overview
 *     description: Retrieve current system configuration including environment settings, feature flags, limits, and integration status.
 *     tags: [Admin System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 config:
 *                   $ref: '#/components/schemas/SystemConfiguration'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/system/config', authenticate, requireAdmin(), adminController.getSystemConfig.bind(adminController));

/**
 * Data Export Routes
 */

/**
 * @swagger
 * /admin/export/{type}:
 *   get:
 *     summary: Export system data
 *     description: Export various types of system data in JSON or CSV format for analysis, backup, or compliance purposes.
 *     tags: [Admin Data Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [users, payments, templates]
 *         description: Type of data to export
 *         example: "users"
 *       - name: format
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format
 *         example: "json"
 *       - name: startDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for data filtering
 *         example: "2024-01-01"
 *       - name: endDate
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for data filtering
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 exportType:
 *                   type: string
 *                   example: "users"
 *                 exportDate:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *                 recordCount:
 *                   type: integer
 *                   example: 1250
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                   description: Exported data records
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted data
 *               example: "id,email,status,createdAt\n507f1f77bcf86cd799439011,user@example.com,active,2024-01-15T10:30:00Z"
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: 'attachment; filename="users_export_2024-01-15.json"'
 *       400:
 *         description: Invalid export type or no data found
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ValidationError'
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: false
 *                     error:
 *                       type: string
 *                       example: "No data found"
 *                     message:
 *                       type: string
 *                       example: "No data available for export"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/export/:type', authenticate, requireAdmin(), adminController.exportData.bind(adminController));

module.exports = router;