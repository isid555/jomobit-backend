const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const posterController = require('../controllers/posterController');

const router = express.Router();

/**
 * @swagger
 * /api/posters/generate:
 *   post:
 *     summary: Create a new poster generation job
 *     description: |
 *       Creates a new AI-powered poster generation job using a business profile and template.
 *       The system will reserve credits, generate a prompt, and queue the job for processing.
 *       
 *       **Process Flow:**
 *       1. Validates business profile and template access
 *       2. Reserves required credits from user's wallet
 *       3. Generates AI prompt based on profile and template
 *       4. Queues job with selected AI providers
 *       5. Returns job details for tracking progress
 *       
 *       **Credit System:**
 *       - Credits are reserved when job is created
 *       - Credits are consumed only when generation completes
 *       - Failed jobs release reserved credits back to wallet
 *     tags: [Poster Generation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PosterGenerationRequest'
 *           examples:
 *             basic:
 *               summary: Basic generation request
 *               value:
 *                 profileId: "507f1f77bcf86cd799439013"
 *                 templateId: "507f1f77bcf86cd799439014"
 *             advanced:
 *               summary: Advanced generation with custom providers
 *               value:
 *                 profileId: "507f1f77bcf86cd799439013"
 *                 templateId: "507f1f77bcf86cd799439014"
 *                 aiProvider:
 *                   llm: "gemini"
 *                   diffusion: "ideogram"
 *                 priority: "high"
 *                 creditsRequired: 2
 *     responses:
 *       201:
 *         description: Generation job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PosterGenerationResponse'
 *             examples:
 *               success:
 *                 summary: Successful job creation
 *                 value:
 *                   success: true
 *                   message: "Poster generation job created successfully"
 *                   job:
 *                     id: "507f1f77bcf86cd799439011"
 *                     status: "pending"
 *                     profileId: "507f1f77bcf86cd799439013"
 *                     templateId: "507f1f77bcf86cd799439014"
 *                     creditsReserved: 1
 *                     aiProvider:
 *                       llm: "openai"
 *                       diffusion: "ideogram"
 *                     priority: "normal"
 *                     createdAt: "2024-01-15T10:30:00Z"
 *                   creditReservation:
 *                     creditsReserved: 1
 *                     remainingCredits: 49
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       402:
 *         $ref: '#/components/responses/PaymentRequired'
 *       404:
 *         description: Business profile or template not found
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
// Poster generation endpoints
router.post('/generate', authenticate, posterController.generatePoster.bind(posterController));

router.post('/enhance', authenticate, posterController.enhancePoster.bind(posterController));

/**
 * @swagger
 * /api/posters/history:
 *   get:
 *     summary: Get user's poster generation history
 *     description: |
 *       Retrieves paginated list of user's poster generation jobs with filtering and sorting options.
 *       
 *       **Features:**
 *       - Pagination support with configurable page size
 *       - Filter by business profile, status, or date range
 *       - Sort by creation date, completion time, or status
 *       - Includes job details, status, and result URLs
 *       
 *       **Status Values:**
 *       - `pending`: Job queued, waiting to start
 *       - `processing`: Currently being generated
 *       - `completed`: Successfully generated
 *       - `failed`: Generation failed (with error details)
 *     tags: [Poster Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: profileId
 *         in: query
 *         description: Filter by specific business profile ID
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439013"
 *       - name: status
 *         in: query
 *         description: Filter by generation status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         example: "completed"
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         example: 1
 *       - name: limit
 *         in: query
 *         description: Number of items per page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         example: 20
 *       - name: sortBy
 *         in: query
 *         description: Field to sort by
 *         required: false
 *         schema:
 *           type: string
 *           enum: [createdAt, completedAt, status, creditsUsed]
 *           default: createdAt
 *         example: "createdAt"
 *       - name: sortOrder
 *         in: query
 *         description: Sort order
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Generation history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PosterHistoryResponse'
 *             examples:
 *               success:
 *                 summary: Successful history retrieval
 *                 value:
 *                   success: true
 *                   history:
 *                     - id: "507f1f77bcf86cd799439011"
 *                       status: "completed"
 *                       profileId: "507f1f77bcf86cd799439013"
 *                       templateId: "507f1f77bcf86cd799439014"
 *                       creditsUsed: 1
 *                       result:
 *                         imageUrl: "https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png"
 *                         thumbnailUrl: "https://cdn.jomobit.com/thumbnails/507f1f77bcf86cd799439011.jpg"
 *                       createdAt: "2024-01-15T10:30:00Z"
 *                       completedAt: "2024-01-15T10:30:57Z"
 *                   pagination:
 *                     currentPage: 1
 *                     totalPages: 5
 *                     totalItems: 87
 *                     itemsPerPage: 20
 *                   filters:
 *                     profileId: null
 *                     status: null
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
router.get('/history', authenticate, posterController.getGenerationHistory.bind(posterController));
/**
 * @swagger
 * /api/posters/stats:
 *   get:
 *     summary: Get user's poster generation statistics
 *     description: |
 *       Retrieves comprehensive statistics about user's poster generation activity.
 *       
 *       **Statistics Include:**
 *       - Total generations by status (completed, failed, pending)
 *       - Credits usage and consumption patterns
 *       - Most used templates and business profiles
 *       - Average processing times and success rates
 *       - Breakdown by AI providers used
 *       - Time-based analytics with filtering options
 *       
 *       **Use Cases:**
 *       - Dashboard analytics and reporting
 *       - Usage pattern analysis
 *       - Performance monitoring
 *       - Credit consumption tracking
 *     tags: [Poster Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         description: Filter statistics from this date (ISO 8601 format)
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2024-01-01T00:00:00Z"
 *       - name: endDate
 *         in: query
 *         description: Filter statistics until this date (ISO 8601 format)
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2024-01-31T23:59:59Z"
 *       - name: profileId
 *         in: query
 *         description: Filter statistics for specific business profile
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PosterStats'
 *             examples:
 *               success:
 *                 summary: Comprehensive user statistics
 *                 value:
 *                   success: true
 *                   stats:
 *                     totalGenerations: 87
 *                     completedGenerations: 82
 *                     failedGenerations: 3
 *                     pendingGenerations: 2
 *                     totalCreditsUsed: 82
 *                     averageProcessingTime: 45.2
 *                     mostUsedTemplate:
 *                       id: "507f1f77bcf86cd799439014"
 *                       name: "Modern Business Card"
 *                       usageCount: 15
 *                     mostUsedProfile:
 *                       id: "507f1f77bcf86cd799439013"
 *                       name: "Acme Corporation"
 *                       usageCount: 25
 *                     generationsByStatus:
 *                       completed: 82
 *                       failed: 3
 *                       pending: 2
 *                       processing: 0
 *                     generationsByProvider:
 *                       openai: 45
 *                       ideogram: 37
 *                       gemini: 5
 *                   filters:
 *                     startDate: null
 *                     endDate: null
 *                     profileId: null
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
router.get('/stats', authenticate, posterController.getUserGenerationStats.bind(posterController));
/**
 * @swagger
 * /api/posters/{jobId}:
 *   get:
 *     summary: Get poster generation job details
 *     description: |
 *       Retrieves detailed information about a specific poster generation job.
 *       
 *       **Job Information Includes:**
 *       - Current status and progress
 *       - Business profile and template used
 *       - AI provider configuration
 *       - Processing timestamps and duration
 *       - Result URLs (if completed)
 *       - Error details (if failed)
 *       - Optional detailed metadata
 *       
 *       **Status Tracking:**
 *       - `pending`: Job queued, waiting to start
 *       - `processing`: Currently being generated
 *       - `completed`: Successfully generated with result URLs
 *       - `failed`: Generation failed with error details
 *       
 *       **Security:** Users can only access their own generation jobs
 *     tags: [Poster Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: jobId
 *         in: path
 *         description: Unique generation job identifier
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439011"
 *       - name: includeMetadata
 *         in: query
 *         description: Include detailed metadata in response
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         example: "true"
 *     responses:
 *       200:
 *         description: Job details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 job:
 *                   $ref: '#/components/schemas/GenerationJob'
 *                 metadata:
 *                   $ref: '#/components/schemas/PosterMetadata'
 *                   description: Detailed metadata (only when includeMetadata=true)
 *             examples:
 *               basic:
 *                 summary: Basic job details
 *                 value:
 *                   success: true
 *                   job:
 *                     id: "507f1f77bcf86cd799439011"
 *                     status: "completed"
 *                     profileId: "507f1f77bcf86cd799439013"
 *                     templateId: "507f1f77bcf86cd799439014"
 *                     creditsReserved: 1
 *                     creditsUsed: 1
 *                     aiProvider:
 *                       llm: "openai"
 *                       diffusion: "ideogram"
 *                     result:
 *                       imageUrl: "https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png"
 *                       thumbnailUrl: "https://cdn.jomobit.com/thumbnails/507f1f77bcf86cd799439011.jpg"
 *                     processingTime: 42.5
 *                     createdAt: "2024-01-15T10:30:00Z"
 *                     completedAt: "2024-01-15T10:30:57Z"
 *               with_metadata:
 *                 summary: Job details with metadata
 *                 value:
 *                   success: true
 *                   job:
 *                     id: "507f1f77bcf86cd799439011"
 *                     status: "completed"
 *                   metadata:
 *                     businessProfile:
 *                       id: "507f1f77bcf86cd799439013"
 *                       name: "Acme Corporation"
 *                     template:
 *                       id: "507f1f77bcf86cd799439014"
 *                       name: "Modern Business Card"
 *                     timing:
 *                       totalDuration: 42.5
 *                       promptGenerationTime: 3.2
 *                       imageGenerationTime: 39.3
 *       400:
 *         description: Invalid job ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: 'Invalid job ID format'
 *               message: 'The provided job ID is not a valid format'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/JobNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:jobId', authenticate, posterController.getGenerationJob.bind(posterController));
/**
 * @swagger
 * /api/posters/{jobId}/metadata:
 *   get:
 *     summary: Get comprehensive poster metadata and generation details
 *     description: |
 *       Retrieves comprehensive metadata about a poster generation job including all technical details,
 *       business profile information, template specifications, AI provider details, and processing metrics.
 *       
 *       **Metadata Categories:**
 *       - **Job Information**: Status, priority, credits, retry count
 *       - **Business Profile**: Name, tagline, colors, typography used
 *       - **Template Details**: Name, aspect ratio, type, tags
 *       - **AI Configuration**: LLM and diffusion providers used
 *       - **Generation Process**: Prompt details, parameters, timing
 *       - **Processing Metrics**: Duration breakdown, performance data
 *       - **Results**: Image URLs, file IDs, technical metadata
 *       - **Error Details**: Failure information (if applicable)
 *       
 *       **Use Cases:**
 *       - Detailed analytics and reporting
 *       - Debugging generation issues
 *       - Performance monitoring
 *       - Audit trails and compliance
 *     tags: [Poster Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: jobId
 *         in: path
 *         description: Unique generation job identifier
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Metadata retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 jobId:
 *                   type: string
 *                   example: "507f1f77bcf86cd799439011"
 *                 metadata:
 *                   $ref: '#/components/schemas/PosterMetadata'
 *             examples:
 *               completed_job:
 *                 summary: Metadata for completed job
 *                 value:
 *                   success: true
 *                   jobId: "507f1f77bcf86cd799439011"
 *                   metadata:
 *                     job:
 *                       id: "507f1f77bcf86cd799439011"
 *                       status: "completed"
 *                       priority: "normal"
 *                       creditsReserved: 1
 *                       retryCount: 0
 *                     businessProfile:
 *                       id: "507f1f77bcf86cd799439013"
 *                       name: "Acme Corporation"
 *                       tagline: "Innovation at its finest"
 *                       colorPalette:
 *                         - name: "Primary Blue"
 *                           hex: "#3B82F6"
 *                     template:
 *                       id: "507f1f77bcf86cd799439014"
 *                       name: "Modern Business Card"
 *                       aspectRatio: "3.5:2"
 *                       type: "print"
 *                       tags: ["business", "professional"]
 *                     aiProvider:
 *                       llm: "openai"
 *                       diffusion: "ideogram"
 *                     generation:
 *                       prompt: "Create a modern business card for Acme Corporation..."
 *                       promptGeneratedAt: "2024-01-15T10:30:05Z"
 *                     timing:
 *                       createdAt: "2024-01-15T10:30:00Z"
 *                       startedAt: "2024-01-15T10:30:15Z"
 *                       completedAt: "2024-01-15T10:30:57Z"
 *                       totalDuration: 42.5
 *                       promptGenerationTime: 3.2
 *                       imageGenerationTime: 39.3
 *                     result:
 *                       imageUrl: "https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png"
 *                       thumbnailUrl: "https://cdn.jomobit.com/thumbnails/507f1f77bcf86cd799439011.jpg"
 *                       imagekitFileId: "file_507f1f77bcf86cd799439011"
 *               failed_job:
 *                 summary: Metadata for failed job
 *                 value:
 *                   success: true
 *                   jobId: "507f1f77bcf86cd799439012"
 *                   metadata:
 *                     job:
 *                       id: "507f1f77bcf86cd799439012"
 *                       status: "failed"
 *                       retryCount: 2
 *                     error:
 *                       message: "AI provider temporarily unavailable"
 *                       code: "AI_PROVIDER_ERROR"
 *                       provider: "ideogram"
 *                       occurredAt: "2024-01-15T10:30:45Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/JobNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:jobId/metadata', authenticate, posterController.getPosterMetadata.bind(posterController));
/**
 * @swagger
 * /api/posters/{jobId}/cancel:
 *   post:
 *     summary: Cancel a pending poster generation job
 *     description: |
 *       Cancels a poster generation job that is currently pending or processing.
 *       
 *       **Cancellation Process:**
 *       1. Validates job ownership and current status
 *       2. Stops processing if job is currently running
 *       3. Releases reserved credits back to user's wallet
 *       4. Updates job status to 'cancelled'
 *       5. Records cancellation reason and timestamp
 *       
 *       **Cancellable Statuses:**
 *       - `pending`: Job queued but not started
 *       - `processing`: Job currently being processed (may take a moment)
 *       
 *       **Non-Cancellable Statuses:**
 *       - `completed`: Job already finished successfully
 *       - `failed`: Job already failed
 *       - `cancelled`: Job already cancelled
 *       
 *       **Credit Handling:**
 *       - Reserved credits are immediately released back to wallet
 *       - No credits are charged for cancelled jobs
 *       - Credit refund is processed automatically
 *     tags: [Poster Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: jobId
 *         in: path
 *         description: Unique generation job identifier
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Optional reason for cancellation
 *                 maxLength: 500
 *                 example: "User cancelled"
 *                 default: "User cancelled"
 *           examples:
 *             with_reason:
 *               summary: Cancel with custom reason
 *               value:
 *                 reason: "Changed requirements, will create new job"
 *             without_reason:
 *               summary: Cancel with default reason
 *               value: {}
 *     responses:
 *       200:
 *         description: Job cancelled successfully
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
 *                   example: "Generation job cancelled successfully"
 *                 jobId:
 *                   type: string
 *                   example: "507f1f77bcf86cd799439011"
 *                 status:
 *                   type: string
 *                   example: "cancelled"
 *                 creditsReleased:
 *                   type: number
 *                   description: Number of credits released back to wallet
 *                   example: 1
 *             examples:
 *               success:
 *                 summary: Successful cancellation
 *                 value:
 *                   success: true
 *                   message: "Generation job cancelled successfully"
 *                   jobId: "507f1f77bcf86cd799439011"
 *                   status: "cancelled"
 *                   creditsReleased: 1
 *       400:
 *         $ref: '#/components/responses/JobCannotBeCancelled'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/JobNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:jobId/cancel', authenticate, posterController.cancelGenerationJob.bind(posterController));
/**
 * @swagger
 * /api/posters/{jobId}/retry:
 *   post:
 *     summary: Retry a failed poster generation job
 *     description: |
 *       Retries a failed poster generation job with the same configuration and parameters.
 *       
 *       **Retry Process:**
 *       1. Validates job ownership and failure status
 *       2. Checks user has sufficient credits for retry
 *       3. Increments retry counter and resets job status
 *       4. Requeues job with same business profile and template
 *       5. Uses original AI provider configuration
 *       6. Preserves original prompt and parameters
 *       
 *       **Retry Conditions:**
 *       - Job must be in 'failed' status
 *       - User must have sufficient credits
 *       - Retry limit not exceeded (max 3 retries)
 *       - Original job data must be intact
 *       
 *       **Credit Handling:**
 *       - New credits are reserved for the retry
 *       - Original failed job credits remain released
 *       - Retry uses same credit amount as original job
 *       
 *       **Automatic Retry Logic:**
 *       - Some failures trigger automatic retries
 *       - Manual retry always available for failed jobs
 *       - Retry counter tracks total attempts
 *     tags: [Poster Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: jobId
 *         in: path
 *         description: Unique generation job identifier
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Job retry initiated successfully
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
 *                   example: "Generation job retry initiated successfully"
 *                 jobId:
 *                   type: string
 *                   example: "507f1f77bcf86cd799439011"
 *                 status:
 *                   type: string
 *                   example: "pending"
 *                 prompt:
 *                   type: string
 *                   description: Generated prompt being used for retry
 *                   example: "Create a modern business card for Acme Corporation..."
 *                 externalJobId:
 *                   type: string
 *                   description: External AI provider job ID
 *                   example: "ideogram_job_abc123"
 *             examples:
 *               success:
 *                 summary: Successful retry initiation
 *                 value:
 *                   success: true
 *                   message: "Generation job retry initiated successfully"
 *                   jobId: "507f1f77bcf86cd799439011"
 *                   status: "pending"
 *                   prompt: "Create a modern business card for Acme Corporation with blue and green colors..."
 *                   externalJobId: "ideogram_job_abc123"
 *       400:
 *         description: Job cannot be retried
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Error'
 *                 - type: object
 *                   properties:
 *                     currentStatus:
 *                       type: string
 *                       description: Current job status
 *                       example: "completed"
 *                     retryCount:
 *                       type: number
 *                       description: Current retry count
 *                       example: 3
 *                     maxRetries:
 *                       type: number
 *                       description: Maximum allowed retries
 *                       example: 3
 *             examples:
 *               not_failed:
 *                 summary: Job is not in failed status
 *                 value:
 *                   success: false
 *                   error: "CANNOT_RETRY_JOB"
 *                   message: "Job is not in failed status"
 *                   details:
 *                     currentStatus: "completed"
 *               retry_limit:
 *                 summary: Retry limit exceeded
 *                 value:
 *                   success: false
 *                   error: "RETRY_LIMIT_EXCEEDED"
 *                   message: "Maximum retry attempts exceeded"
 *                   details:
 *                     retryCount: 3
 *                     maxRetries: 3
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       402:
 *         $ref: '#/components/responses/PaymentRequired'
 *       404:
 *         $ref: '#/components/responses/JobNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:jobId/retry', authenticate, posterController.retryGenerationJob.bind(posterController));
/**
 * @swagger
 * /api/posters/{jobId}/share:
 *   get:
 *     summary: Get poster sharing options for social platforms
 *     description: |
 *       Generates platform-specific sharing options and URLs for a completed poster.
 *       
 *       **Supported Platforms:**
 *       - **Instagram**: High-quality download with optimal dimensions
 *       - **WhatsApp**: Direct share URL with image and text
 *       - **Facebook**: Share URL with poster image and description
 *       - **Twitter**: Tweet URL with hashtags and image
 *       - **LinkedIn**: Professional sharing with business context
 *       - **Direct**: Raw image URLs and download links
 *       
 *       **Platform Features:**
 *       - Optimized image dimensions for each platform
 *       - Pre-generated share text with business branding
 *       - Platform-specific hashtags and formatting
 *       - Direct download options for manual sharing
 *       - Thumbnail URLs for previews
 *       
 *       **Requirements:**
 *       - Job must be in 'completed' status
 *       - Poster image must be successfully generated
 *       - User must own the generation job
 *       
 *       **Use Cases:**
 *       - Social media marketing campaigns
 *       - Business promotion and branding
 *       - Multi-platform content distribution
 *       - Automated sharing workflows
 *     tags: [Poster Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: jobId
 *         in: path
 *         description: Unique generation job identifier
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439011"
 *       - name: platform
 *         in: query
 *         description: Filter for specific platform (returns all if omitted)
 *         required: false
 *         schema:
 *           type: string
 *           enum: [instagram, whatsapp, facebook, twitter, linkedin, direct]
 *         example: "instagram"
 *     responses:
 *       200:
 *         description: Sharing options generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PosterSharingOptions'
 *             examples:
 *               all_platforms:
 *                 summary: All platform sharing options
 *                 value:
 *                   success: true
 *                   jobId: "507f1f77bcf86cd799439011"
 *                   posterUrl: "https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png"
 *                   businessProfile:
 *                     id: "507f1f77bcf86cd799439013"
 *                     name: "Acme Corporation"
 *                   template:
 *                     id: "507f1f77bcf86cd799439014"
 *                     name: "Modern Business Card"
 *                     aspectRatio: "3.5:2"
 *                   sharingOptions:
 *                     instagram:
 *                       platform: "Instagram"
 *                       type: "download"
 *                       downloadUrl: "https://jomobit.com/api/posters/507f1f77bcf86cd799439011/download?quality=high"
 *                       instructions: "Download the high-quality image and share it on Instagram"
 *                       recommendedText: "Check out my AI-generated poster for Acme Corporation created with Jomobit! #Jomobit #AIGenerated #Poster #Marketing"
 *                       aspectRatio:
 *                         width: 1080
 *                         height: 1080
 *                     whatsapp:
 *                       platform: "WhatsApp"
 *                       type: "share_url"
 *                       url: "https://wa.me/?text=Check%20out%20my%20AI-generated%20poster%20for%20Acme%20Corporation%20created%20with%20Jomobit!%20https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png"
 *                       text: "Check out my AI-generated poster for Acme Corporation created with Jomobit!"
 *                       imageUrl: "https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png"
 *                       instructions: "Click to share via WhatsApp"
 *                     direct:
 *                       platform: "Direct Link"
 *                       type: "direct"
 *                       url: "https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png"
 *                       downloadUrl: "https://jomobit.com/api/posters/507f1f77bcf86cd799439011/download"
 *                       thumbnailUrl: "https://cdn.jomobit.com/thumbnails/507f1f77bcf86cd799439011.jpg"
 *                       instructions: "Copy link or download image directly"
 *                   supportedPlatforms: ["instagram", "whatsapp", "facebook", "twitter", "linkedin", "direct"]
 *               single_platform:
 *                 summary: Instagram-specific sharing options
 *                 value:
 *                   success: true
 *                   jobId: "507f1f77bcf86cd799439011"
 *                   posterUrl: "https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png"
 *                   sharingOptions:
 *                     instagram:
 *                       platform: "Instagram"
 *                       type: "download"
 *                       downloadUrl: "https://jomobit.com/api/posters/507f1f77bcf86cd799439011/download?quality=high"
 *                       instructions: "Download the high-quality image and share it on Instagram"
 *                       recommendedText: "Check out my AI-generated poster for Acme Corporation created with Jomobit! #Jomobit #AIGenerated #Poster #Marketing"
 *       400:
 *         $ref: '#/components/responses/JobNotCompleted'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/JobNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:jobId/share', authenticate, posterController.getPosterSharingOptions.bind(posterController));
/**
 * @swagger
 * /api/posters/{jobId}/download:
 *   get:
 *     summary: Download poster with quality and format options
 *     description: |
 *       Generates a download URL for a completed poster with ImageKit CDN optimizations.
 *       
 *       **Download Features:**
 *       - Multiple quality levels (low, medium, high)
 *       - Format conversion (PNG, JPG, WebP)
 *       - ImageKit CDN transformations for optimization
 *       - Automatic filename generation with business branding
 *       - File size estimation for bandwidth planning
 *       - Metadata including creation details
 *       
 *       **Quality Levels:**
 *       - **Low (q-60)**: Smaller file size, good for previews
 *       - **Medium (q-80)**: Balanced quality and size
 *       - **High (q-90)**: Maximum quality, larger file size
 *       
 *       **Supported Formats:**
 *       - **PNG**: Lossless, supports transparency (default)
 *       - **JPG/JPEG**: Smaller file size, good for photos
 *       - **WebP**: Modern format, excellent compression
 *       
 *       **ImageKit Integration:**
 *       - Real-time image transformations
 *       - CDN delivery for fast downloads
 *       - Automatic format optimization
 *       - Quality adjustments on-the-fly
 *       
 *       **Use Cases:**
 *       - High-quality prints and marketing materials
 *       - Web-optimized images for digital use
 *       - Batch downloads with different specifications
 *       - Archive and backup purposes
 *     tags: [Poster Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: jobId
 *         in: path
 *         description: Unique generation job identifier
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439011"
 *       - name: quality
 *         in: query
 *         description: Image quality level
 *         required: false
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *           default: high
 *         example: "high"
 *       - name: format
 *         in: query
 *         description: Image format for download
 *         required: false
 *         schema:
 *           type: string
 *           enum: [png, jpg, jpeg, webp]
 *           default: png
 *         example: "png"
 *     responses:
 *       200:
 *         description: Download URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PosterDownloadResponse'
 *             examples:
 *               high_quality_png:
 *                 summary: High quality PNG download
 *                 value:
 *                   success: true
 *                   downloadUrl: "https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png?tr=q-90"
 *                   filename: "jomobit_Acme_Corporation_2024-01-15_39011.png"
 *                   quality: "high"
 *                   format: "png"
 *                   fileSize: "2.3MB"
 *                   metadata:
 *                     businessProfile: "Acme Corporation"
 *                     templateName: "Modern Business Card"
 *                     createdAt: "2024-01-15T10:30:00Z"
 *                     aspectRatio:
 *                       width: 1080
 *                       height: 1080
 *                   message: "Download URL generated successfully"
 *               medium_quality_jpg:
 *                 summary: Medium quality JPG download
 *                 value:
 *                   success: true
 *                   downloadUrl: "https://cdn.jomobit.com/posters/507f1f77bcf86cd799439011.png?tr=q-80,f-jpg"
 *                   filename: "jomobit_Acme_Corporation_2024-01-15_39011.jpg"
 *                   quality: "medium"
 *                   format: "jpg"
 *                   fileSize: "1.1MB"
 *                   metadata:
 *                     businessProfile: "Acme Corporation"
 *                     templateName: "Modern Business Card"
 *                     createdAt: "2024-01-15T10:30:00Z"
 *                     aspectRatio:
 *                       width: 1080
 *                       height: 1080
 *                   message: "Download URL generated successfully"
 *       400:
 *         $ref: '#/components/responses/JobNotCompleted'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/JobNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:jobId/download', authenticate, posterController.downloadPoster.bind(posterController));

/**
 * @swagger
 * /api/posters/admin:
 *   get:
 *     summary: Get all generation jobs (Admin only)
 *     description: |
 *       Retrieves paginated list of all poster generation jobs across all users with advanced filtering options.
 *       
 *       **Admin Features:**
 *       - View all users' generation jobs
 *       - Advanced filtering by user, profile, template, status
 *       - Date range filtering for analytics
 *       - AI provider performance analysis
 *       - Bulk operations and monitoring
 *       - Populated data including user and profile details
 *       
 *       **Filtering Options:**
 *       - **User ID**: Filter jobs by specific user
 *       - **Profile ID**: Filter by business profile
 *       - **Template ID**: Filter by template usage
 *       - **Status**: Filter by job status
 *       - **AI Provider**: Filter by LLM or diffusion provider
 *       - **Date Range**: Filter by creation or completion dates
 *       
 *       **Use Cases:**
 *       - System monitoring and health checks
 *       - User activity analysis
 *       - Performance optimization
 *       - Troubleshooting and support
 *       - Business intelligence and reporting
 *       
 *       **Security:** Requires admin role and permissions
 *     tags: [Admin - Poster Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: query
 *         description: Filter by specific user ID
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439012"
 *       - name: profileId
 *         in: query
 *         description: Filter by business profile ID
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439013"
 *       - name: templateId
 *         in: query
 *         description: Filter by template ID
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439014"
 *       - name: status
 *         in: query
 *         description: Filter by generation status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         example: "completed"
 *       - name: aiProvider
 *         in: query
 *         description: Filter by AI provider (LLM or diffusion)
 *         required: false
 *         schema:
 *           type: string
 *           enum: [openai, gemini, ideogram]
 *         example: "ideogram"
 *       - name: startDate
 *         in: query
 *         description: Filter jobs created after this date
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2024-01-01T00:00:00Z"
 *       - name: endDate
 *         in: query
 *         description: Filter jobs created before this date
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2024-01-31T23:59:59Z"
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         example: 1
 *       - name: limit
 *         in: query
 *         description: Number of items per page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         example: 50
 *       - name: sortBy
 *         in: query
 *         description: Field to sort by
 *         required: false
 *         schema:
 *           type: string
 *           enum: [createdAt, completedAt, status, creditsUsed, processingTime]
 *           default: createdAt
 *         example: "createdAt"
 *       - name: sortOrder
 *         in: query
 *         description: Sort order
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Generation jobs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 jobs:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/GenerationJob'
 *                       - type: object
 *                         properties:
 *                           user:
 *                             $ref: '#/components/schemas/User'
 *                             description: Populated user details
 *                           profile:
 *                             $ref: '#/components/schemas/BusinessProfile'
 *                             description: Populated business profile details
 *                           template:
 *                             $ref: '#/components/schemas/Template'
 *                             description: Populated template details
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: number
 *                       example: 1
 *                     totalPages:
 *                       type: number
 *                       example: 25
 *                     totalItems:
 *                       type: number
 *                       example: 1247
 *                     itemsPerPage:
 *                       type: number
 *                       example: 50
 *                 filters:
 *                   type: object
 *                   description: Applied filters
 *             examples:
 *               admin_jobs:
 *                 summary: Admin view of all generation jobs
 *                 value:
 *                   success: true
 *                   jobs:
 *                     - id: "507f1f77bcf86cd799439011"
 *                       status: "completed"
 *                       user:
 *                         id: "507f1f77bcf86cd799439012"
 *                         email: "user@example.com"
 *                         metadata:
 *                           name: "John Doe"
 *                       profile:
 *                         id: "507f1f77bcf86cd799439013"
 *                         name: "Acme Corporation"
 *                       template:
 *                         id: "507f1f77bcf86cd799439014"
 *                         name: "Modern Business Card"
 *                       creditsUsed: 1
 *                       processingTime: 42.5
 *                       createdAt: "2024-01-15T10:30:00Z"
 *                       completedAt: "2024-01-15T10:30:57Z"
 *                   pagination:
 *                     currentPage: 1
 *                     totalPages: 25
 *                     totalItems: 1247
 *                     itemsPerPage: 50
 *                   filters:
 *                     userId: null
 *                     status: null
 *                     startDate: null
 *                     endDate: null
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// Admin poster endpoints
router.get('/admin', authenticate, requireAdmin(), posterController.getAdminGenerationJobs.bind(posterController));
/**
 * @swagger
 * /api/posters/admin/stats:
 *   get:
 *     summary: Get comprehensive generation statistics (Admin only)
 *     description: |
 *       Retrieves comprehensive system-wide statistics about poster generation activity across all users.
 *       
 *       **System-Wide Analytics:**
 *       - Total generations across all users
 *       - Success rates and failure analysis
 *       - Credit consumption patterns
 *       - AI provider performance metrics
 *       - Template and profile usage statistics
 *       - Processing time analytics
 *       - User activity patterns
 *       
 *       **Performance Metrics:**
 *       - Average processing times by provider
 *       - Success rates by template and profile
 *       - Peak usage times and patterns
 *       - Error rates and common failure points
 *       - Resource utilization statistics
 *       
 *       **Business Intelligence:**
 *       - Most popular templates and profiles
 *       - User engagement and retention metrics
 *       - Revenue and credit consumption analysis
 *       - Growth trends and usage patterns
 *       - Platform adoption and feature usage
 *       
 *       **Filtering Options:**
 *       - Date range filtering for trend analysis
 *       - User-specific statistics
 *       - Profile and template performance
 *       - AI provider comparison
 *       
 *       **Use Cases:**
 *       - System performance monitoring
 *       - Business intelligence and reporting
 *       - Capacity planning and scaling
 *       - User behavior analysis
 *       - Revenue optimization
 *       
 *       **Security:** Requires admin role and permissions
 *     tags: [Admin - Poster Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         description: Filter statistics from this date
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2024-01-01T00:00:00Z"
 *       - name: endDate
 *         in: query
 *         description: Filter statistics until this date
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2024-01-31T23:59:59Z"
 *       - name: userId
 *         in: query
 *         description: Filter statistics for specific user
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439012"
 *       - name: profileId
 *         in: query
 *         description: Filter statistics for specific business profile
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439013"
 *       - name: templateId
 *         in: query
 *         description: Filter statistics for specific template
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         example: "507f1f77bcf86cd799439014"
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PosterStats'
 *                 - type: object
 *                   properties:
 *                     stats:
 *                       allOf:
 *                         - $ref: '#/components/schemas/PosterStats/properties/stats'
 *                         - type: object
 *                           properties:
 *                             systemMetrics:
 *                               type: object
 *                               description: System-wide performance metrics
 *                               properties:
 *                                 totalUsers:
 *                                   type: number
 *                                   description: Total active users
 *                                   example: 1247
 *                                 activeUsers:
 *                                   type: number
 *                                   description: Users active in date range
 *                                   example: 342
 *                                 totalProfiles:
 *                                   type: number
 *                                   description: Total business profiles
 *                                   example: 2156
 *                                 totalTemplates:
 *                                   type: number
 *                                   description: Total available templates
 *                                   example: 156
 *                                 systemUptime:
 *                                   type: number
 *                                   description: System uptime percentage
 *                                   example: 99.8
 *                             providerPerformance:
 *                               type: object
 *                               description: AI provider performance comparison
 *                               properties:
 *                                 openai:
 *                                   type: object
 *                                   properties:
 *                                     totalJobs: { type: number, example: 1245 }
 *                                     successRate: { type: number, example: 94.2 }
 *                                     avgProcessingTime: { type: number, example: 38.5 }
 *                                 ideogram:
 *                                   type: object
 *                                   properties:
 *                                     totalJobs: { type: number, example: 987 }
 *                                     successRate: { type: number, example: 91.8 }
 *                                     avgProcessingTime: { type: number, example: 45.2 }
 *                                 gemini:
 *                                   type: object
 *                                   properties:
 *                                     totalJobs: { type: number, example: 234 }
 *                                     successRate: { type: number, example: 89.1 }
 *                                     avgProcessingTime: { type: number, example: 42.1 }
 *                             topTemplates:
 *                               type: array
 *                               description: Most popular templates system-wide
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id: { type: string, example: "507f1f77bcf86cd799439014" }
 *                                   name: { type: string, example: "Modern Business Card" }
 *                                   usageCount: { type: number, example: 342 }
 *                                   successRate: { type: number, example: 96.5 }
 *                             topProfiles:
 *                               type: array
 *                               description: Most active business profiles
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id: { type: string, example: "507f1f77bcf86cd799439013" }
 *                                   name: { type: string, example: "Acme Corporation" }
 *                                   usageCount: { type: number, example: 156 }
 *                                   userId: { type: string, example: "507f1f77bcf86cd799439012" }
 *             examples:
 *               system_stats:
 *                 summary: Comprehensive system statistics
 *                 value:
 *                   success: true
 *                   stats:
 *                     totalGenerations: 2847
 *                     completedGenerations: 2654
 *                     failedGenerations: 156
 *                     pendingGenerations: 37
 *                     totalCreditsUsed: 2654
 *                     averageProcessingTime: 41.8
 *                     systemMetrics:
 *                       totalUsers: 1247
 *                       activeUsers: 342
 *                       totalProfiles: 2156
 *                       totalTemplates: 156
 *                       systemUptime: 99.8
 *                     providerPerformance:
 *                       openai:
 *                         totalJobs: 1245
 *                         successRate: 94.2
 *                         avgProcessingTime: 38.5
 *                       ideogram:
 *                         totalJobs: 987
 *                         successRate: 91.8
 *                         avgProcessingTime: 45.2
 *                       gemini:
 *                         totalJobs: 234
 *                         successRate: 89.1
 *                         avgProcessingTime: 42.1
 *                     topTemplates:
 *                       - id: "507f1f77bcf86cd799439014"
 *                         name: "Modern Business Card"
 *                         usageCount: 342
 *                         successRate: 96.5
 *                       - id: "507f1f77bcf86cd799439015"
 *                         name: "Social Media Post"
 *                         usageCount: 287
 *                         successRate: 93.1
 *                     topProfiles:
 *                       - id: "507f1f77bcf86cd799439013"
 *                         name: "Acme Corporation"
 *                         usageCount: 156
 *                         userId: "507f1f77bcf86cd799439012"
 *                   filters:
 *                     startDate: null
 *                     endDate: null
 *                     userId: null
 *                     profileId: null
 *                     templateId: null
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/admin/stats', authenticate, requireAdmin(), posterController.getAdminGenerationStats.bind(posterController));

module.exports = router;