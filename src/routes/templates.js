const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const templateController = require('../controllers/templateController');

const router = express.Router();

/**
 * @swagger
 * /templates:
 *   get:
 *     summary: Get templates with filtering and pagination
 *     description: |
 *       Retrieve a paginated list of active templates with comprehensive filtering options.
 *       Supports filtering by category, type, tags, difficulty, aspect ratio, and search terms.
 *       Results are sorted by usage count by default but can be customized.
 *     tags: [Templates]
 *     parameters:
 *       - name: category
 *         in: query
 *         description: Filter by template category
 *         schema:
 *           type: string
 *           example: business
 *       - name: type
 *         in: query
 *         description: Filter by template type
 *         schema:
 *           type: string
 *           enum: [social, print, web, story, post, banner]
 *           example: print
 *       - name: tags
 *         in: query
 *         description: Filter by tags (comma-separated)
 *         schema:
 *           type: string
 *           example: "business,professional,modern"
 *       - name: difficulty
 *         in: query
 *         description: Filter by difficulty level
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *           example: beginner
 *       - name: aspectRatio
 *         in: query
 *         description: Filter by aspect ratio
 *         schema:
 *           type: string
 *           example: "16:9"
 *       - name: isFeatured
 *         in: query
 *         description: Filter by featured status
 *         schema:
 *           type: boolean
 *           example: true
 *       - name: search
 *         in: query
 *         description: Search term for template name, description, or tags
 *         schema:
 *           type: string
 *           example: "business card"
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *       - name: limit
 *         in: query
 *         description: Number of templates per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *           example: 20
 *       - name: sortBy
 *         in: query
 *         description: Field to sort by
 *         schema:
 *           type: string
 *           enum: [usageCount, createdAt, name, rating]
 *           default: usageCount
 *           example: usageCount
 *       - name: sortOrder
 *         in: query
 *         description: Sort order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *           example: desc
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateListResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/', templateController.getTemplates);

/**
 * @swagger
 * /templates/search:
 *   get:
 *     summary: Search templates by keyword
 *     description: |
 *       Search templates using text search across name, description, and tags.
 *       Supports additional filtering options and returns relevance-scored results.
 *     tags: [Templates]
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         description: Search query term
 *         schema:
 *           type: string
 *           minLength: 1
 *           example: "modern business"
 *       - name: category
 *         in: query
 *         description: Filter by template category
 *         schema:
 *           type: string
 *           example: business
 *       - name: type
 *         in: query
 *         description: Filter by template type
 *         schema:
 *           type: string
 *           enum: [social, print, web, story, post, banner]
 *           example: print
 *       - name: tags
 *         in: query
 *         description: Filter by tags (comma-separated)
 *         schema:
 *           type: string
 *           example: "professional,minimal"
 *       - name: difficulty
 *         in: query
 *         description: Filter by difficulty level
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *           example: beginner
 *       - name: aspectRatio
 *         in: query
 *         description: Filter by aspect ratio
 *         schema:
 *           type: string
 *           example: "1:1"
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *       - name: limit
 *         in: query
 *         description: Number of templates per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *           example: 20
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateSearchResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/search', templateController.searchTemplates);

/**
 * @swagger
 * /templates/filters:
 *   get:
 *     summary: Get available filter options
 *     description: |
 *       Retrieve all available filter options for templates including categories,
 *       types, difficulties, aspect ratios, and tags. Useful for building filter UIs.
 *     tags: [Templates]
 *     responses:
 *       200:
 *         description: Filter options retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateFilterOptionsResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/filters', templateController.getFilterOptions);

/**
 * @swagger
 * /templates/featured:
 *   get:
 *     summary: Get featured templates
 *     description: |
 *       Retrieve a list of featured templates, sorted by usage count and creation date.
 *       Featured templates are curated selections highlighted for users.
 *     tags: [Templates]
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of featured templates to return
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *           example: 10
 *     responses:
 *       200:
 *         description: Featured templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateCollectionResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/featured', templateController.getFeaturedTemplates);

/**
 * @swagger
 * /templates/popular:
 *   get:
 *     summary: Get popular templates
 *     description: |
 *       Retrieve the most popular templates based on usage count and ratings.
 *       Popular templates are determined by community usage patterns.
 *     tags: [Templates]
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of popular templates to return
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *           example: 10
 *     responses:
 *       200:
 *         description: Popular templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateCollectionResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/popular', templateController.getPopularTemplates);

/**
 * @swagger
 * /templates/recent:
 *   get:
 *     summary: Get recently added templates
 *     description: |
 *       Retrieve the most recently added templates, sorted by creation date.
 *       Useful for showcasing new template additions to the library.
 *     tags: [Templates]
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of recent templates to return
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *           example: 10
 *     responses:
 *       200:
 *         description: Recent templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateCollectionResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/recent', templateController.getRecentTemplates);

/**
 * @swagger
 * /templates/{templateId}:
 *   get:
 *     summary: Get template by ID
 *     description: |
 *       Retrieve detailed information about a specific template by its ID.
 *       Returns complete template data including metadata and usage statistics.
 *     tags: [Templates]
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         description: Unique template identifier
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *           example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateDetailResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:templateId', templateController.getTemplateById);

/**
 * @swagger
 * /templates/admin:
 *   post:
 *     summary: Create new template (Admin only)
 *     description: |
 *       Create a new template with complete metadata and configuration.
 *       Requires admin authentication and validates all template properties.
 *     tags: [Admin - Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TemplateCreateRequest'
 *     responses:
 *       201:
 *         description: Template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateCreateResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *   get:
 *     summary: Get all templates for admin management
 *     description: |
 *       Retrieve all templates with admin-specific information including inactive and archived templates.
 *       Supports comprehensive filtering and sorting options for template management.
 *     tags: [Admin - Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: category
 *         in: query
 *         description: Filter by template category
 *         schema:
 *           type: string
 *           example: business
 *       - name: type
 *         in: query
 *         description: Filter by template type
 *         schema:
 *           type: string
 *           enum: [social, print, web, story, post, banner]
 *           example: print
 *       - name: tags
 *         in: query
 *         description: Filter by tags (comma-separated)
 *         schema:
 *           type: string
 *           example: "business,professional"
 *       - name: difficulty
 *         in: query
 *         description: Filter by difficulty level
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *           example: beginner
 *       - name: aspectRatio
 *         in: query
 *         description: Filter by aspect ratio
 *         schema:
 *           type: string
 *           example: "16:9"
 *       - name: isFeatured
 *         in: query
 *         description: Filter by featured status
 *         schema:
 *           type: boolean
 *           example: true
 *       - name: search
 *         in: query
 *         description: Search term for template name, description, or tags
 *         schema:
 *           type: string
 *           example: "business card"
 *       - name: status
 *         in: query
 *         description: Filter by template status (admin can see all statuses)
 *         schema:
 *           type: string
 *           enum: [draft, active, inactive, archived]
 *           example: active
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *       - name: limit
 *         in: query
 *         description: Number of templates per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *           example: 20
 *       - name: sortBy
 *         in: query
 *         description: Field to sort by
 *         schema:
 *           type: string
 *           enum: [createdAt, name, usageCount, rating, status]
 *           default: createdAt
 *           example: createdAt
 *       - name: sortOrder
 *         in: query
 *         description: Sort order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *           example: desc
 *     responses:
 *       200:
 *         description: Admin templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminTemplateListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /templates/admin/stats:
 *   get:
 *     summary: Get template statistics and analytics
 *     description: |
 *       Retrieve comprehensive template statistics including usage metrics,
 *       status distribution, and performance analytics for admin dashboard.
 *     tags: [Admin - Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Template statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateStatsResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /templates/admin/{templateId}:
 *   put:
 *     summary: Update template (Admin only)
 *     description: |
 *       Update an existing template with new information and metadata.
 *       Allows modification of all template properties including status and featured flag.
 *     tags: [Admin - Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         description: Unique template identifier
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *           example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TemplateUpdateRequest'
 *     responses:
 *       200:
 *         description: Template updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateUpdateResponse'
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
 *   delete:
 *     summary: Delete template (Admin only)
 *     description: |
 *       Permanently delete a template from the system. This action cannot be undone.
 *       Consider archiving templates instead of deletion to preserve historical data.
 *     tags: [Admin - Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         description: Unique template identifier
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *           example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateDeleteResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /templates/admin/{templateId}/toggle-featured:
 *   post:
 *     summary: Toggle template featured status (Admin only)
 *     description: |
 *       Toggle the featured status of a template. Featured templates are highlighted
 *       in the template library and given priority in recommendations.
 *     tags: [Admin - Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         description: Unique template identifier
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *           example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Template featured status toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateToggleFeaturedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /templates/admin/{templateId}/archive:
 *   post:
 *     summary: Archive template (Admin only)
 *     description: |
 *       Archive a template, making it unavailable for new generations while preserving
 *       historical data. Archived templates can be reactivated later if needed.
 *     tags: [Admin - Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         description: Unique template identifier
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *           example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Template archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateArchiveResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /templates/admin/{templateId}/activate:
 *   post:
 *     summary: Activate template (Admin only)
 *     description: |
 *       Activate an archived or inactive template, making it available for use.
 *       Activated templates will appear in public template listings.
 *     tags: [Admin - Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         description: Unique template identifier
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *           example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Template activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateActivateResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /templates/admin/batch-upload:
 *   post:
 *     summary: Batch upload templates (Admin only)
 *     description: |
 *       Upload multiple templates in a single request. Supports bulk template creation
 *       with validation and error reporting for each template in the batch.
 *     tags: [Admin - Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TemplateBatchUploadRequest'
 *     responses:
 *       200:
 *         description: Batch upload completed (may include partial failures)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateBatchUploadResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/admin', authenticate, requireAdmin(), templateController.createTemplate);
router.get('/admin', authenticate, requireAdmin(), templateController.getAdminTemplates);
router.get('/admin/stats', authenticate, requireAdmin(), templateController.getTemplateStats);
router.put('/admin/:templateId', authenticate, requireAdmin(), templateController.updateTemplate);
router.delete('/admin/:templateId', authenticate, requireAdmin(), templateController.deleteTemplate);
router.post('/admin/:templateId/toggle-featured', authenticate, requireAdmin(), templateController.toggleFeatured);
router.post('/admin/:templateId/archive', authenticate, requireAdmin(), templateController.archiveTemplate);
router.post('/admin/:templateId/activate', authenticate, requireAdmin(), templateController.activateTemplate);
router.post('/admin/batch-upload', authenticate, requireAdmin(), templateController.batchUploadTemplates);

module.exports = router;