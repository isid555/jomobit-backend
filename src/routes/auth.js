const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();


/**
 * @swagger
 * /api/auth/sync/register:
 *   post:
 *     summary: Sync user registration from Auth0 (Actions only)
 *     tags: [Auth0 Sync]
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auth0User:
 *                 type: object
 *                 description: Auth0 user object
 *     responses:
 *       201:
 *         description: User created successfully
 *       200:
 *         description: Identity linked to existing user
 *       401:
 *         description: Unauthorized - Invalid API secret
 *       500:
 *         description: Internal server error
 */
router.post('/sync/register', authController.syncUserRegistration);

/**
 * @swagger
 * /api/auth/sync/login:
 *   post:
 *     summary: Sync user login from Auth0 (Actions only)
 *     tags: [Auth0 Sync]
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auth0User:
 *                 type: object
 *                 description: Auth0 user object
 *     responses:
 *       200:
 *         description: User updated successfully
 *       401:
 *         description: Unauthorized - Invalid API secret
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/sync/login', authController.syncUserLogin);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Update user last login timestamp
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Login timestamp updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 lastLoginAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/login', authenticate, authController.updateLastLogin);

/**
 * @swagger
 * /api/auth/permissions:
 *   get:
 *     summary: Get user permissions
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: string
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/permissions', authenticate, authController.getUserPermissions);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get user profile with credit information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile with credit wallet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 creditWallet:
 *                   $ref: '#/components/schemas/CreditWallet'
 *                 subscription:
 *                   $ref: '#/components/schemas/Subscription'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/profile', authenticate, authController.getUserProfile);

/**
 * @swagger
 * /api/auth/admin/users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         description: Filter by user status
 *         schema:
 *           type: string
 *           enum: [pending, active, suspended]
 *       - name: search
 *         in: query
 *         description: Search by email or name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/admin/users', authenticate, requireAdmin(), authController.getUsers);

/**
 * @swagger
 * /api/auth/admin/users/{userId}/suspend:
 *   post:
 *     summary: Suspend a user account (admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: User ID to suspend
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for suspension
 *     responses:
 *       200:
 *         description: User suspended successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/admin/users/:userId/suspend', authenticate, requireAdmin(), authController.suspendUser);

/**
 * @swagger
 * /api/auth/admin/users/{userId}/activate:
 *   post:
 *     summary: Activate a suspended user account (admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: User ID to activate
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *     responses:
 *       200:
 *         description: User activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/admin/users/:userId/activate', authenticate, requireAdmin(), authController.activateUser);

/**
 * @swagger
 * /api/auth/admin/stats:
 *   get:
 *     summary: Get user statistics (admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: number
 *                 activeUsers:
 *                   type: number
 *                 pendingUsers:
 *                   type: number
 *                 suspendedUsers:
 *                   type: number
 *                 newUsersThisMonth:
 *                   type: number
 *                 userGrowthRate:
 *                   type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/admin/stats', authenticate, requireAdmin(), authController.getUserStats);

module.exports = router;