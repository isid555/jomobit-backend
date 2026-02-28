const express = require('express');
const trialController = require('../controllers/trialController');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiter for trial generation (3 requests per IP per hour)
const trialGenerationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour
    message: {
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many generation requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * @swagger
 * /trial/templates:
 *   get:
 *     summary: Get featured templates for trial users (No authentication required)
 *     description: |
 *       Retrieve a curated list of featured templates for guest/trial users.
 *       Returns recently added featured templates without requiring authentication.
 *       This endpoint is specifically designed for the trial/guest mode experience.
 *     tags: [Trial]
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of templates to return (default 15, max 50)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 15
 *           example: 15
 *     responses:
 *       200:
 *         description: Trial templates retrieved successfully
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
 *                     $ref: '#/components/schemas/Template'
 *                 count:
 *                   type: integer
 *                   example: 15
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/templates', trialController.getTrialTemplates);

/**
 * @swagger
 * /trial/generate:
 *   post:
 *     summary: Generate posters for guest users (No authentication required)
 *     description: |
 *       Create a guest user and generate posters based on selected template and profile.
 *       Rate limited to 3 requests per IP per hour.
 *       Returns userId and jobId for tracking generation status.
 *       Supports retry by providing existing guestUserId - will reuse guest user if valid.
 *     tags: [Trial]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *               - profileId
 *             properties:
 *               templateId:
 *                 type: string
 *                 description: ID of the selected template
 *                 example: "507f1f77bcf86cd799439011"
 *               profileId:
 *                 type: string
 *                 description: Predefined guest profile ID
 *                 enum:
 *                   - "69554734e71d37bfec0aef42"
 *                   - "69554791e71d37bfec0aef44"
 *                   - "695547dfe71d37bfec0aef46"
 *                   - "695549fde71d37bfec0aef49"
 *                   - "69554cb5e71d37bfec0aef4b"
 *                   - "69554d05e71d37bfec0aef4d"
 *                 example: "69554734e71d37bfec0aef42"
 *               guestUserId:
 *                 type: string
 *                 description: Optional - Existing guest user ID for retry (reuses guest user if valid and not suspended)
 *                 example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Generation started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 userId:
 *                   type: string
 *                   example: "507f1f77bcf86cd799439012"
 *                 jobId:
 *                   type: string
 *                   example: "507f1f77bcf86cd799439013"
 *                 message:
 *                   type: string
 *                   example: "Generation started successfully"
 *       400:
 *         description: Validation error
 *       404:
 *         description: Template or profile not found
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/generate', trialGenerationLimiter, trialController.generatePosters);

/**
 * @swagger
 * /trial/jobs/{jobId}:
 *   get:
 *     summary: Get job status for trial users (No authentication required)
 *     description: |
 *       Retrieve the current status of a generation job for guest/trial users.
 *       Returns limited job information for security.
 *       No authentication required - allows guest users to track their generation.
 *     tags: [Trial]
 *     parameters:
 *       - name: jobId
 *         in: path
 *         required: true
 *         description: ID of the generation job
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 job:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     status:
 *                       type: string
 *                       enum: [queued, processing, pending, completed, failed]
 *                       example: "processing"
 *                     progress:
 *                       type: number
 *                       example: 45
 *                     templateId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     profileId:
 *                       type: string
 *                       example: "69554734e71d37bfec0aef42"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     result:
 *                       type: object
 *                       description: Only present for pending/completed status
 *                       properties:
 *                         metadata:
 *                           type: object
 *                           description: Present for pending status
 *                           properties:
 *                             baseImages:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         imageUrl:
 *                           type: string
 *                           description: Present for completed status
 *                     error:
 *                       type: string
 *                       description: User-friendly error message (only for failed status)
 *                       example: "Generation failed. Please try again."
 *       400:
 *         description: Invalid job ID format
 *       404:
 *         description: Job not found
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/jobs/:jobId', trialController.getJobStatus);

module.exports = router;
