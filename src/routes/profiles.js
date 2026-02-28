const express = require('express');
const { authenticate } = require('../middleware/auth');
const profileController = require('../controllers/profileController');

const router = express.Router();

/**
 * @swagger
 * /api/profiles:
 *   post:
 *     summary: Create a new business profile
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - tagline
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Business name
 *               tagline:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Business tagline
 *               description:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Business description
 *               logo:
 *                 type: string
 *                 format: uri
 *                 description: Business logo URL
 *               colorPalette:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     hex:
 *                       type: string
 *                       pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'
 *               products:
 *                 type: array
 *                 maxItems: 20
 *                 items:
 *                   type: string
 *                   maxLength: 100
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                     maxLength: 200
 *                   city:
 *                     type: string
 *                     maxLength: 100
 *                   state:
 *                     type: string
 *                     maxLength: 100
 *                   country:
 *                     type: string
 *                     maxLength: 100
 *                   zipCode:
 *                     type: string
 *                     maxLength: 20
 *     responses:
 *       201:
 *         description: Profile created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessProfile'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       402:
 *         description: Plan limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/', authenticate, profileController.createProfile);

/**
 * @swagger
 * /api/profiles:
 *   get:
 *     summary: Get user's business profiles
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: active
 *         in: query
 *         description: Filter by active status
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of user's business profiles
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
 *                         $ref: '#/components/schemas/BusinessProfile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/', authenticate, profileController.getUserProfiles);

/**
 * @swagger
 * /api/profiles/search:
 *   get:
 *     summary: Search business profiles
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: q
 *         in: query
 *         description: Search query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Search results
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
 *                         $ref: '#/components/schemas/BusinessProfile'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/search', authenticate, profileController.searchProfiles);

/**
 * @swagger
 * /api/profiles/{profileId}:
 *   get:
 *     summary: Get business profile by ID
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ObjectIdParam'
 *     responses:
 *       200:
 *         description: Business profile details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessProfile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:profileId', authenticate, profileController.getProfileById);

/**
 * @swagger
 * /api/profiles/{profileId}:
 *   put:
 *     summary: Update business profile
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ObjectIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tagline:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               products:
 *                 type: array
 *                 maxItems: 20
 *                 items:
 *                   type: string
 *                   maxLength: 100
 *               colorPalette:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     hex:
 *                       type: string
 *                       pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'
 *               typography:
 *                 type: object
 *                 properties:
 *                   primary:
 *                     type: string
 *                   secondary:
 *                     type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessProfile'
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
router.put('/:profileId', authenticate, profileController.updateProfile);

/**
 * @swagger
 * /api/profiles/{profileId}/deactivate:
 *   post:
 *     summary: Deactivate business profile
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ObjectIdParam'
 *     responses:
 *       200:
 *         description: Profile deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 profile:
 *                   $ref: '#/components/schemas/BusinessProfile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:profileId/deactivate', authenticate, profileController.deactivateProfile);

/**
 * @swagger
 * /api/profiles/{profileId}/activate:
 *   post:
 *     summary: Activate business profile
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ObjectIdParam'
 *     responses:
 *       200:
 *         description: Profile activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 profile:
 *                   $ref: '#/components/schemas/BusinessProfile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:profileId/activate', authenticate, profileController.activateProfile);

/**
 * @swagger
 * /api/profiles/{profileId}/generation-summary:
 *   get:
 *     summary: Get profile generation summary
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ObjectIdParam'
 *     responses:
 *       200:
 *         description: Profile generation statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profileId:
 *                   type: string
 *                 totalGenerations:
 *                   type: number
 *                 successfulGenerations:
 *                   type: number
 *                 failedGenerations:
 *                   type: number
 *                 creditsUsed:
 *                   type: number
 *                 lastGeneration:
 *                   type: string
 *                   format: date-time
 *                 averageGenerationTime:
 *                   type: number
 *                   description: Average generation time in seconds
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:profileId/generation-summary', authenticate, profileController.getProfileGenerationSummary);

/**
 * @swagger
 * /api/profiles/imagekit/auth:
 *   get:
 *     summary: Get ImageKit authentication parameters
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ImageKit authentication parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicKey:
 *                   type: string
 *                 endpoint:
 *                   type: string
 *                 authToken:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/imagekit/auth', authenticate, profileController.getImageKitAuthParams);

module.exports = router;