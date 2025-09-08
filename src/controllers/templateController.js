const TemplateService = require('../services/templateService');
const logger = require('../utils/logger');

/**
 * Template Controller
 * Handles template browsing and filtering endpoints
 */
class TemplateController {
  constructor() {
    this.templateService = new TemplateService();

    // Bind all methods to preserve 'this' context
    this.getTemplates = this.getTemplates.bind(this);
    this.searchTemplates = this.searchTemplates.bind(this);
    this.getFilterOptions = this.getFilterOptions.bind(this);
    this.getTemplateById = this.getTemplateById.bind(this);
    this.getFeaturedTemplates = this.getFeaturedTemplates.bind(this);
    this.getPopularTemplates = this.getPopularTemplates.bind(this);
    this.getRecentTemplates = this.getRecentTemplates.bind(this);
    this.createTemplate = this.createTemplate.bind(this);
    this.updateTemplate = this.updateTemplate.bind(this);
    this.deleteTemplate = this.deleteTemplate.bind(this);
    this.toggleFeatured = this.toggleFeatured.bind(this);
    this.archiveTemplate = this.archiveTemplate.bind(this);
    this.activateTemplate = this.activateTemplate.bind(this);
    this.batchUploadTemplates = this.batchUploadTemplates.bind(this);
    this.getTemplateStats = this.getTemplateStats.bind(this);
    this.getAdminTemplates = this.getAdminTemplates.bind(this);
  }

  /**
   * Get templates with filtering and pagination
   * GET /api/templates
   */
  async getTemplates(req, res) {
    try {
      const {
        category,
        type,
        tags,
        difficulty,
        aspectRatio,
        isFeatured,
        search,
        status = 'active',
        page = 1,
        limit = 20,
        sortBy = 'usageCount',
        sortOrder = 'desc'
      } = req.query;

      // Parse tags if provided as comma-separated string
      const parsedTags = tags ? tags.split(',').map(tag => tag.trim()) : [];

      // Parse boolean values
      const parsedIsFeatured = isFeatured === 'true' ? true : isFeatured === 'false' ? false : null;

      // Build sort object
      const sortField = sortBy === 'usageCount' ? 'metrics.usageCount' : sortBy;
      const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

      const filters = {
        category,
        type,
        tags: parsedTags,
        difficulty,
        aspectRatio,
        isFeatured: parsedIsFeatured,
        search,
        status
      };

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort
      };

      const result = await this.templateService.getTemplates(filters, options);

      res.json({
        success: true,
        templates: result.templates,
        pagination: result.pagination,
        filters: result.filters
      });

    } catch (error) {
      logger.error('Error fetching templates:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch templates'
      });
    }
  }

  /**
   * Search templates
   * GET /api/templates/search
   */
  async searchTemplates(req, res) {
    try {
      const {
        q: searchTerm,
        category,
        type,
        tags,
        difficulty,
        aspectRatio,
        page = 1,
        limit = 20
      } = req.query;

      if (!searchTerm || searchTerm.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Search term is required'
        });
      }

      // Parse tags if provided
      const parsedTags = tags ? tags.split(',').map(tag => tag.trim()) : [];

      const filters = {
        category,
        type,
        tags: parsedTags,
        difficulty,
        aspectRatio
      };

      const options = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await this.templateService.searchTemplates(searchTerm.trim(), filters, options);

      res.json({
        success: true,
        templates: result.templates,
        pagination: result.pagination,
        searchTerm: result.searchTerm,
        filters: result.filters
      });

    } catch (error) {
      if (error.name === 'TemplateValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.message
        });
      }

      logger.error('Error searching templates:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to search templates'
      });
    }
  }

  /**
   * Get template filter options
   * GET /api/templates/filters
   */
  async getFilterOptions(req, res) {
    try {
      const result = await this.templateService.getFilterOptions();

      res.json({
        success: true,
        filters: result.filters
      });

    } catch (error) {
      logger.error('Error fetching template filter options:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch filter options'
      });
    }
  }

  /**
   * Get template by ID
   * GET /api/templates/:templateId
   */
  async getTemplateById(req, res) {
    try {
      const { templateId } = req.params;

      const result = await this.templateService.getTemplateById(templateId);

      res.json({
        success: true,
        template: result.template
      });

    } catch (error) {
      if (error.name === 'TemplateNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
          message: 'Template not found or inactive'
        });
      }

      if (error.name === 'TemplateValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.message
        });
      }

      logger.error('Error fetching template by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch template'
      });
    }
  }

  /**
   * Get featured templates
   * GET /api/templates/featured
   */
  async getFeaturedTemplates(req, res) {
    try {
      const { limit = 10 } = req.query;

      const result = await this.templateService.getFeaturedTemplates(parseInt(limit));

      res.json({
        success: true,
        templates: result.templates
      });

    } catch (error) {
      logger.error('Error fetching featured templates:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch featured templates'
      });
    }
  }

  /**
   * Get popular templates
   * GET /api/templates/popular
   */
  async getPopularTemplates(req, res) {
    try {
      const { limit = 10 } = req.query;

      const result = await this.templateService.getPopularTemplates(parseInt(limit));

      res.json({
        success: true,
        templates: result.templates
      });

    } catch (error) {
      logger.error('Error fetching popular templates:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch popular templates'
      });
    }
  }

  /**
   * Get recent templates
   * GET /api/templates/recent
   */
  async getRecentTemplates(req, res) {
    try {
      const { limit = 10 } = req.query;

      const result = await this.templateService.getRecentTemplates(parseInt(limit));

      res.json({
        success: true,
        templates: result.templates
      });

    } catch (error) {
      logger.error('Error fetching recent templates:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch recent templates'
      });
    }
  }

  // Admin endpoints

  /**
   * Create template (Admin only)
   * POST /api/templates/admin
   */
  async createTemplate(req, res) {
    try {
      const templateData = req.body;
      const createdBy = req.user.id; // Auth0 ID, need to convert to actual user ID

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(createdBy);
      const actualUserId = userResult.user._id;

      const result = await this.templateService.createTemplate(templateData, actualUserId);

      logger.info('Template created by admin', {
        templateId: result.template._id,
        templateName: result.template.name,
        createdBy: actualUserId
      });

      res.status(201).json({
        success: true,
        message: result.message,
        template: result.template
      });

    } catch (error) {
      if (error.name === 'TemplateValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.message,
          field: error.field
        });
      }

      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'Admin user not found in database'
        });
      }

      logger.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create template'
      });
    }
  }

  /**
   * Update template (Admin only)
   * PUT /api/templates/admin/:templateId
   */
  async updateTemplate(req, res) {
    try {
      const { templateId } = req.params;
      const updateData = req.body;

      const result = await this.templateService.updateTemplate(templateId, updateData);

      logger.info('Template updated by admin', {
        templateId,
        templateName: result.template.name,
        updatedBy: req.user.id
      });

      res.json({
        success: true,
        message: result.message,
        template: result.template
      });

    } catch (error) {
      if (error.name === 'TemplateNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
          message: 'Template not found'
        });
      }

      if (error.name === 'TemplateValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.message,
          field: error.field
        });
      }

      logger.error('Error updating template:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to update template'
      });
    }
  }

  /**
   * Delete template (Admin only)
   * DELETE /api/templates/admin/:templateId
   */
  async deleteTemplate(req, res) {
    try {
      const { templateId } = req.params;

      const result = await this.templateService.deleteTemplate(templateId);

      logger.info('Template deleted by admin', {
        templateId,
        deletedBy: req.user.id
      });

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      if (error.name === 'TemplateNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
          message: 'Template not found'
        });
      }

      if (error.name === 'TemplateValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.message
        });
      }

      logger.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to delete template'
      });
    }
  }

  /**
   * Toggle template featured status (Admin only)
   * POST /api/templates/admin/:templateId/toggle-featured
   */
  async toggleFeatured(req, res) {
    try {
      const { templateId } = req.params;

      const result = await this.templateService.toggleFeatured(templateId);

      logger.info('Template featured status toggled by admin', {
        templateId,
        newStatus: result.newFeaturedStatus,
        toggledBy: req.user.id
      });

      res.json({
        success: true,
        message: result.message,
        template: result.template,
        oldFeaturedStatus: result.oldFeaturedStatus,
        newFeaturedStatus: result.newFeaturedStatus
      });

    } catch (error) {
      if (error.name === 'TemplateNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
          message: 'Template not found'
        });
      }

      if (error.name === 'TemplateValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.message
        });
      }

      logger.error('Error toggling template featured status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to toggle featured status'
      });
    }
  }

  /**
   * Archive template (Admin only)
   * POST /api/templates/admin/:templateId/archive
   */
  async archiveTemplate(req, res) {
    try {
      const { templateId } = req.params;

      const result = await this.templateService.archiveTemplate(templateId);

      logger.info('Template archived by admin', {
        templateId,
        archivedBy: req.user.id
      });

      res.json({
        success: true,
        message: result.message,
        template: result.template,
        oldStatus: result.oldStatus,
        newStatus: result.newStatus
      });

    } catch (error) {
      if (error.name === 'TemplateNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
          message: 'Template not found'
        });
      }

      if (error.name === 'TemplateValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.message
        });
      }

      logger.error('Error archiving template:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to archive template'
      });
    }
  }

  /**
   * Activate template (Admin only)
   * POST /api/templates/admin/:templateId/activate
   */
  async activateTemplate(req, res) {
    try {
      const { templateId } = req.params;

      const result = await this.templateService.activateTemplate(templateId);

      logger.info('Template activated by admin', {
        templateId,
        activatedBy: req.user.id
      });

      res.json({
        success: true,
        message: result.message,
        template: result.template,
        oldStatus: result.oldStatus,
        newStatus: result.newStatus
      });

    } catch (error) {
      if (error.name === 'TemplateNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
          message: 'Template not found'
        });
      }

      if (error.name === 'TemplateValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.message
        });
      }

      logger.error('Error activating template:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to activate template'
      });
    }
  }

  /**
   * Batch upload templates (Admin only)
   * POST /api/templates/admin/batch-upload
   */
  async batchUploadTemplates(req, res) {
    try {
      const { templates: templatesData } = req.body;
      const createdBy = req.user.id; // Auth0 ID, need to convert to actual user ID

      if (!Array.isArray(templatesData) || templatesData.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Templates array is required and must not be empty'
        });
      }

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(createdBy);
      const actualUserId = userResult.user._id;

      const result = await this.templateService.batchUploadTemplates(templatesData, actualUserId);

      logger.info('Batch template upload completed by admin', {
        total: result.results.total,
        successful: result.results.successful.length,
        failed: result.results.failed.length,
        uploadedBy: actualUserId
      });

      res.json({
        success: true,
        message: result.message,
        results: result.results
      });

    } catch (error) {
      if (error.name === 'TemplateValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: error.message
        });
      }

      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'Admin user not found in database'
        });
      }

      logger.error('Error in batch template upload:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to batch upload templates'
      });
    }
  }

  /**
   * Get template statistics (Admin only)
   * GET /api/templates/admin/stats
   */
  async getTemplateStats(req, res) {
    try {
      const result = await this.templateService.getTemplateStats();

      res.json({
        success: true,
        stats: result.stats
      });

    } catch (error) {
      logger.error('Error fetching template statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch template statistics'
      });
    }
  }

  /**
   * Get all templates for admin (Admin only)
   * GET /api/templates/admin
   */
  async getAdminTemplates(req, res) {
    try {
      const {
        category,
        type,
        tags,
        difficulty,
        aspectRatio,
        isFeatured,
        search,
        status, // Admin can see all statuses
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Parse tags if provided
      const parsedTags = tags ? tags.split(',').map(tag => tag.trim()) : [];

      // Parse boolean values
      const parsedIsFeatured = isFeatured === 'true' ? true : isFeatured === 'false' ? false : null;

      // Build sort object
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const filters = {
        category,
        type,
        tags: parsedTags,
        difficulty,
        aspectRatio,
        isFeatured: parsedIsFeatured,
        search,
        status
      };

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort
      };

      const result = await this.templateService.getAdminTemplates(filters, options);

      res.json({
        success: true,
        templates: result.templates,
        pagination: result.pagination,
        filters: result.filters
      });

    } catch (error) {
      logger.error('Error fetching admin templates:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch templates'
      });
    }
  }
}

module.exports = new TemplateController();