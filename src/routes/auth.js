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

/**
 * @swagger
 * /api/auth/sync-guest-job:
 *   post:
 *     summary: Sync guest user job to authenticated user
 *     description: Transfers job ownership from guest user to authenticated user after signup. Soft deletes guest user.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guestUserId
 *             properties:
 *               guestUserId:
 *                 type: string
 *                 description: Guest user ID from localStorage
 *                 example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Guest job synced successfully
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
 *                   example: "Guest job synced successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobsTransferred:
 *                       type: number
 *                       example: 1
 *                     jobs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           jobId:
 *                             type: string
 *                           status:
 *                             type: string
 *                           templateId:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     guestUserId:
 *                       type: string
 *                     actualUserId:
 *                       type: string
 *       400:
 *         description: Bad request - Invalid guest user ID or already synced
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
 *                   example: "Bad Request"
 *                 message:
 *                   type: string
 *                   example: "Guest user ID is required"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Guest user not found
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
 *                   example: "Not Found"
 *                 message:
 *                   type: string
 *                   example: "Guest user not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/sync-guest-job', authenticate, authController.syncGuestJob);

/**
 * @swagger
 * /api/auth/sync-profile-to-job:
 *   post:
 *     summary: Sync profile to job (for trial users)
 *     description: Updates a job's profileId after user creates their first profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *               - profileId
 *             properties:
 *               jobId:
 *                 type: string
 *                 description: ID of the job to update
 *               profileId:
 *                 type: string
 *                 description: ID of the profile to link
 *     responses:
 *       200:
 *         description: Profile synced successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Job or profile not found
 *       500:
 *         description: Internal server error
 */
router.post('/sync-profile-to-job', authenticate, authController.syncProfileToJob);

module.exports = router;