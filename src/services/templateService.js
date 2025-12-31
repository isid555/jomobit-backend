const mongoose = require("mongoose");
const Template = require("../models/Template");
const logger = require("../utils/logger");

/**
 * Custom error classes for template operations
 */
class TemplateNotFoundError extends Error {
  constructor(identifier) {
    super(`Template not found: ${identifier}`);
    this.name = "TemplateNotFoundError";
    this.code = "TEMPLATE_NOT_FOUND";
    this.identifier = identifier;
  }
}

class TemplateOperationError extends Error {
  constructor(message, operation, templateId = null) {
    super(message);
    this.name = "TemplateOperationError";
    this.code = "TEMPLATE_OPERATION_ERROR";
    this.operation = operation;
    this.templateId = templateId;
  }
}

class TemplateValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = "TemplateValidationError";
    this.code = "TEMPLATE_VALIDATION_ERROR";
    this.field = field;
  }
}

/**
 * Template Management Service
 * Handles template operations, search, filtering, and admin functionality
 */
class TemplateService {
  constructor() {
    // Default pagination settings
    this.DEFAULT_PAGE_SIZE = 20;
    this.MAX_PAGE_SIZE = 100;
  }

  /**
   * Get paginated templates with filtering and search
   * @param {Object} filters - Filter options
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated template results
   */

  async getTemplates(filters = {}, options = {}) {
    try {
      const {
        category = null,
        type = null,
        tags = [],
        colors = [],
        difficulty = null,
        aspectRatio = null,
        isFeatured = null,
        search = null,
        status = "active",
      } = filters;

      const {
        page = 1,
        limit = this.DEFAULT_PAGE_SIZE,
        sort = { "metrics.usageCount": -1, createdAt: -1 },
        random = false,
      } = options;

      // Validate pagination parameters
      const validatedPage = Math.max(1, parseInt(page));
      const validatedLimit = Math.min(
        this.MAX_PAGE_SIZE,
        Math.max(1, parseInt(limit))
      );

      logger.info("Getting templates with filters", {
        filters,
        page: validatedPage,
        limit: validatedLimit,
        operation: "getTemplates",
      });

      const result = await Template.getTemplatesWithFilters(
        {
          category,
          type,
          tags,
          colors,
          difficulty,
          aspectRatio,
          isFeatured,
          search,
          status,
        },
        { page: validatedPage, limit: validatedLimit, sort, random }
      );

      logger.info("Templates retrieved successfully", {
        count: result.templates.length,
        total: result.pagination.total,
        page: validatedPage,
      });

      const templates = random
        ? result.templates
        : result.templates.map((template) => template.getSummary());

      return {
        success: true,
        templates: templates,
        pagination: result.pagination,
        filters: {
          category,
          type,
          tags,
          difficulty,
          aspectRatio,
          isFeatured,
          search,
        },
      };
    } catch (error) {
      logger.error("Error getting templates", {
        filters,
        options,
        error: error.message,
        stack: error.stack,
      });
      throw new TemplateOperationError(
        `Failed to get templates: ${error.message}`,
        "getTemplates"
      );
    }
  }

  /**
   * Search templates with text search
   * @param {string} searchTerm - Search term
   * @param {Object} filters - Additional filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Search results
   */
  async searchTemplates(searchTerm, filters = {}, options = {}) {
    try {
      if (
        !searchTerm ||
        typeof searchTerm !== "string" ||
        searchTerm.trim().length === 0
      ) {
        throw new TemplateValidationError(
          "Search term is required and must be a non-empty string"
        );
      }

      const trimmedSearchTerm = searchTerm.trim();

      logger.info("Searching templates", {
        searchTerm: trimmedSearchTerm,
        filters,
        operation: "searchTemplates",
      });

      const result = await this.getTemplates(
        { ...filters, search: trimmedSearchTerm },
        options
      );

      logger.info("Template search completed", {
        searchTerm: trimmedSearchTerm,
        resultsCount: result.templates.length,
      });

      return {
        ...result,
        searchTerm: trimmedSearchTerm,
      };
    } catch (error) {
      if (error instanceof TemplateValidationError) {
        throw error;
      }

      logger.error("Error searching templates", {
        searchTerm,
        filters,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to search templates: ${error.message}`,
        "searchTemplates"
      );
    }
  }

  /**
   * Get template filter options for UI
   * @returns {Promise<Object>} Available filter options
   */
  async getFilterOptions() {
    try {
      logger.info("Getting template filter options", {
        operation: "getFilterOptions",
      });

      const filterOptions = await Template.getFilterOptions();

      logger.info("Filter options retrieved successfully", {
        categoriesCount: filterOptions.categories.length,
        typesCount: filterOptions.types.length,
        tagsCount: filterOptions.tags.length,
      });

      return {
        success: true,
        filters: filterOptions,
      };
    } catch (error) {
      logger.error("Error getting filter options", {
        error: error.message,
        stack: error.stack,
      });
      throw new TemplateOperationError(
        `Failed to get filter options: ${error.message}`,
        "getFilterOptions"
      );
    }
  }

  /**
   * Get template by ID
   * @param {string|ObjectId} templateId - Template ID
   * @returns {Promise<Object>} Template data
   */
  async getTemplateById(templateId) {
    try {
      if (!templateId) {
        throw new TemplateValidationError("Template ID is required");
      }

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        throw new TemplateValidationError("Invalid template ID format");
      }

      logger.info("Getting template by ID", {
        templateId,
        operation: "getTemplateById",
      });

      const template = await Template.getTemplateById(templateId);
      if (!template) {
        throw new TemplateNotFoundError(templateId);
      }

      logger.info("Template retrieved successfully", {
        templateId,
        templateName: template.name,
      });

      return {
        success: true,
        template: template.toObject(),
      };
    } catch (error) {
      if (
        error instanceof TemplateNotFoundError ||
        error instanceof TemplateValidationError
      ) {
        throw error;
      }

      logger.error("Error getting template by ID", {
        templateId,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to get template: ${error.message}`,
        "getTemplateById",
        templateId
      );
    }
  }

  /**
   * Get featured templates
   * @param {number} limit - Number of templates to return
   * @returns {Promise<Object>} Featured templates
   */
  async getFeaturedTemplates(limit = 10) {
    try {
      const validatedLimit = Math.min(50, Math.max(1, parseInt(limit)));

      logger.info("Getting featured templates", {
        limit: validatedLimit,
        operation: "getFeaturedTemplates",
      });

      const templates = await Template.getFeaturedTemplates(validatedLimit);

      logger.info("Featured templates retrieved", {
        count: templates.length,
      });

      return {
        success: true,
        templates: templates.map((template) => template.getSummary()),
      };
    } catch (error) {
      logger.error("Error getting featured templates", {
        limit,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to get featured templates: ${error.message}`,
        "getFeaturedTemplates"
      );
    }
  }

  /**
   * Get popular templates
   * @param {number} limit - Number of templates to return
   * @returns {Promise<Object>} Popular templates
   */
  async getPopularTemplates(limit = 10) {
    try {
      const validatedLimit = Math.min(50, Math.max(1, parseInt(limit)));

      logger.info("Getting popular templates", {
        limit: validatedLimit,
        operation: "getPopularTemplates",
      });

      const templates = await Template.getPopularTemplates(validatedLimit);

      logger.info("Popular templates retrieved", {
        count: templates.length,
      });

      return {
        success: true,
        templates: templates.map((template) => template.getSummary()),
      };
    } catch (error) {
      logger.error("Error getting popular templates", {
        limit,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to get popular templates: ${error.message}`,
        "getPopularTemplates"
      );
    }
  }

  /**
   * Get recent templates
   * @param {number} limit - Number of templates to return
   * @returns {Promise<Object>} Recent templates
   */
  async getRecentTemplates(limit = 10) {
    try {
      const validatedLimit = Math.min(50, Math.max(1, parseInt(limit)));

      logger.info("Getting recent templates", {
        limit: validatedLimit,
        operation: "getRecentTemplates",
      });

      const templates = await Template.getRecentTemplates(validatedLimit);

      logger.info("Recent templates retrieved", {
        count: templates.length,
      });

      return {
        success: true,
        templates: templates.map((template) => template.getSummary()),
      };
    } catch (error) {
      logger.error("Error getting recent templates", {
        limit,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to get recent templates: ${error.message}`,
        "getRecentTemplates"
      );
    }
  }

  /**
   * Get featured templates for trial/guest users
   * Returns recently added featured templates without authentication
   * @param {number} limit - Number of templates to return (default: 15, max: 50)
   * @returns {Promise<Object>} Trial templates
   */
  async getTrialTemplates(limit = 15) {
    try {
      // Validate and constrain limit
      const validatedLimit = Math.min(50, Math.max(1, parseInt(limit)));

      logger.info("Getting trial templates", {
        limit: validatedLimit,
        operation: "getTrialTemplates",
      });

      // Fetch featured, active, public templates sorted by creation date (most recent first)
      const templates = await Template.find({
        isFeatured: true,
        status: "active",
        isPublic: true,
      })
        .select("-__v -createdBy") // Exclude sensitive fields
        .sort({ createdAt: -1 }) // Most recent first
        .limit(validatedLimit)
        .lean() // Return plain JavaScript objects for better performance
        .exec();

      logger.info("Trial templates retrieved successfully", {
        count: templates.length,
        requestedLimit: limit,
        actualLimit: validatedLimit,
      });

      return {
        success: true,
        templates,
        count: templates.length,
      };
    } catch (error) {
      logger.error("Error getting trial templates", {
        limit,
        error: error.message,
        stack: error.stack,
      });
      throw new TemplateOperationError(
        `Failed to get trial templates: ${error.message}`,
        "getTrialTemplates"
      );
    }
  }

  /**
   * Increment template usage count
   * @param {string|ObjectId} templateId - Template ID
   * @returns {Promise<Object>} Operation result
   */
  async incrementUsage(templateId) {
    try {
      if (!templateId) {
        throw new TemplateValidationError("Template ID is required");
      }

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        throw new TemplateValidationError("Invalid template ID format");
      }

      logger.info("Incrementing template usage", {
        templateId,
        operation: "incrementUsage",
      });

      const template = await Template.findById(templateId);
      if (!template) {
        throw new TemplateNotFoundError(templateId);
      }

      await template.incrementUsage();

      logger.info("Template usage incremented", {
        templateId,
        newUsageCount: template.metrics.usageCount,
      });

      return {
        success: true,
        template: template.getSummary(),
        message: "Template usage incremented successfully",
      };
    } catch (error) {
      if (
        error instanceof TemplateNotFoundError ||
        error instanceof TemplateValidationError
      ) {
        throw error;
      }

      logger.error("Error incrementing template usage", {
        templateId,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to increment template usage: ${error.message}`,
        "incrementUsage",
        templateId
      );
    }
  }

  // Admin functionality starts here

  /**
   * Create a new template (Admin only)
   * @param {Object} templateData - Template data
   * @param {string|ObjectId} createdBy - User ID of creator
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(templateData, createdBy) {
    try {
      this._validateTemplateData(templateData);

      if (!createdBy) {
        throw new TemplateValidationError("Creator ID is required");
      }

      if (!mongoose.Types.ObjectId.isValid(createdBy)) {
        throw new TemplateValidationError("Invalid creator ID format");
      }

      logger.info("Creating new template", {
        templateName: templateData.name,
        createdBy,
        operation: "createTemplate",
      });

      const template = new Template({
        ...templateData,
        createdBy,
        status: templateData.status || "active",
      });

      await template.save();

      logger.info("Template created successfully", {
        templateId: template._id,
        templateName: template.name,
        createdBy,
      });

      return {
        success: true,
        template: template.toObject(),
        message: "Template created successfully",
      };
    } catch (error) {
      if (error instanceof TemplateValidationError) {
        throw error;
      }

      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err) => err.message
        );
        throw new TemplateValidationError(
          `Validation failed: ${validationErrors.join(", ")}`
        );
      }

      logger.error("Error creating template", {
        templateData: {
          name: templateData?.name,
          category: templateData?.category,
        },
        createdBy,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to create template: ${error.message}`,
        "createTemplate"
      );
    }
  }

  /**
   * Update template (Admin only)
   * @param {string|ObjectId} templateId - Template ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated template
   */
  async updateTemplate(templateId, updateData) {
    try {
      if (!templateId) {
        throw new TemplateValidationError("Template ID is required");
      }

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        throw new TemplateValidationError("Invalid template ID format");
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        throw new TemplateValidationError("Update data is required");
      }

      logger.info("Updating template", {
        templateId,
        updateFields: Object.keys(updateData),
        operation: "updateTemplate",
      });

      const template = await Template.findById(templateId);
      if (!template) {
        throw new TemplateNotFoundError(templateId);
      }

      // Apply updates
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] !== undefined) {
          template[key] = updateData[key];
        }
      });

      await template.save();

      logger.info("Template updated successfully", {
        templateId,
        templateName: template.name,
      });

      return {
        success: true,
        template: template.toObject(),
        message: "Template updated successfully",
      };
    } catch (error) {
      if (
        error instanceof TemplateNotFoundError ||
        error instanceof TemplateValidationError
      ) {
        throw error;
      }

      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err) => err.message
        );
        throw new TemplateValidationError(
          `Validation failed: ${validationErrors.join(", ")}`
        );
      }

      logger.error("Error updating template", {
        templateId,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to update template: ${error.message}`,
        "updateTemplate",
        templateId
      );
    }
  }

  /**
   * Delete template (Admin only)
   * @param {string|ObjectId} templateId - Template ID
   * @returns {Promise<Object>} Operation result
   */
  async deleteTemplate(templateId) {
    try {
      if (!templateId) {
        throw new TemplateValidationError("Template ID is required");
      }

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        throw new TemplateValidationError("Invalid template ID format");
      }

      logger.info("Deleting template", {
        templateId,
        operation: "deleteTemplate",
      });

      const template = await Template.findById(templateId);
      if (!template) {
        throw new TemplateNotFoundError(templateId);
      }

      await Template.findByIdAndDelete(templateId);

      logger.info("Template deleted successfully", {
        templateId,
        templateName: template.name,
      });

      return {
        success: true,
        message: "Template deleted successfully",
      };
    } catch (error) {
      if (
        error instanceof TemplateNotFoundError ||
        error instanceof TemplateValidationError
      ) {
        throw error;
      }

      logger.error("Error deleting template", {
        templateId,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to delete template: ${error.message}`,
        "deleteTemplate",
        templateId
      );
    }
  }

  /**
   * Toggle template featured status (Admin only)
   * @param {string|ObjectId} templateId - Template ID
   * @returns {Promise<Object>} Updated template
   */
  async toggleFeatured(templateId) {
    try {
      if (!templateId) {
        throw new TemplateValidationError("Template ID is required");
      }

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        throw new TemplateValidationError("Invalid template ID format");
      }

      logger.info("Toggling template featured status", {
        templateId,
        operation: "toggleFeatured",
      });

      const template = await Template.findById(templateId);
      if (!template) {
        throw new TemplateNotFoundError(templateId);
      }

      const oldFeaturedStatus = template.isFeatured;
      await template.toggleFeatured();

      logger.info("Template featured status toggled", {
        templateId,
        oldStatus: oldFeaturedStatus,
        newStatus: template.isFeatured,
      });

      return {
        success: true,
        template: template.getSummary(),
        oldFeaturedStatus,
        newFeaturedStatus: template.isFeatured,
        message: `Template ${template.isFeatured ? "featured" : "unfeatured"
          } successfully`,
      };
    } catch (error) {
      if (
        error instanceof TemplateNotFoundError ||
        error instanceof TemplateValidationError
      ) {
        throw error;
      }

      logger.error("Error toggling template featured status", {
        templateId,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to toggle featured status: ${error.message}`,
        "toggleFeatured",
        templateId
      );
    }
  }

  /**
   * Archive template (Admin only)
   * @param {string|ObjectId} templateId - Template ID
   * @returns {Promise<Object>} Updated template
   */
  async archiveTemplate(templateId) {
    try {
      if (!templateId) {
        throw new TemplateValidationError("Template ID is required");
      }

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        throw new TemplateValidationError("Invalid template ID format");
      }

      logger.info("Archiving template", {
        templateId,
        operation: "archiveTemplate",
      });

      const template = await Template.findById(templateId);
      if (!template) {
        throw new TemplateNotFoundError(templateId);
      }

      const oldStatus = template.status;
      await template.archive();

      logger.info("Template archived successfully", {
        templateId,
        oldStatus,
        newStatus: template.status,
      });

      return {
        success: true,
        template: template.toObject(),
        oldStatus,
        newStatus: template.status,
        message: "Template archived successfully",
      };
    } catch (error) {
      if (
        error instanceof TemplateNotFoundError ||
        error instanceof TemplateValidationError
      ) {
        throw error;
      }

      logger.error("Error archiving template", {
        templateId,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to archive template: ${error.message}`,
        "archiveTemplate",
        templateId
      );
    }
  }

  /**
   * Activate template (Admin only)
   * @param {string|ObjectId} templateId - Template ID
   * @returns {Promise<Object>} Updated template
   */
  async activateTemplate(templateId) {
    try {
      if (!templateId) {
        throw new TemplateValidationError("Template ID is required");
      }

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        throw new TemplateValidationError("Invalid template ID format");
      }

      logger.info("Activating template", {
        templateId,
        operation: "activateTemplate",
      });

      const template = await Template.findById(templateId);
      if (!template) {
        throw new TemplateNotFoundError(templateId);
      }

      const oldStatus = template.status;
      await template.activate();

      logger.info("Template activated successfully", {
        templateId,
        oldStatus,
        newStatus: template.status,
      });

      return {
        success: true,
        template: template.toObject(),
        oldStatus,
        newStatus: template.status,
        message: "Template activated successfully",
      };
    } catch (error) {
      if (
        error instanceof TemplateNotFoundError ||
        error instanceof TemplateValidationError
      ) {
        throw error;
      }

      logger.error("Error activating template", {
        templateId,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to activate template: ${error.message}`,
        "activateTemplate",
        templateId
      );
    }
  }

  /**
   * Batch upload templates (Admin only)
   * @param {Array} templatesData - Array of template data
   * @param {string|ObjectId} createdBy - User ID of creator
   * @returns {Promise<Object>} Batch upload results
   */
  async batchUploadTemplates(templatesData, createdBy) {
    try {
      if (!Array.isArray(templatesData) || templatesData.length === 0) {
        throw new TemplateValidationError(
          "Templates data must be a non-empty array"
        );
      }

      if (!createdBy) {
        throw new TemplateValidationError("Creator ID is required");
      }

      if (!mongoose.Types.ObjectId.isValid(createdBy)) {
        throw new TemplateValidationError("Invalid creator ID format");
      }

      logger.info("Starting batch template upload", {
        templateCount: templatesData.length,
        createdBy,
        operation: "batchUploadTemplates",
      });

      const results = {
        successful: [],
        failed: [],
        total: templatesData.length,
      };

      // Process templates in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < templatesData.length; i += batchSize) {
        const batch = templatesData.slice(i, i + batchSize);

        await Promise.allSettled(
          batch.map(async (templateData, index) => {
            try {
              const result = await this.createTemplate(templateData, createdBy);
              results.successful.push({
                index: i + index,
                template: result.template,
                name: templateData.name,
              });
            } catch (error) {
              results.failed.push({
                index: i + index,
                name: templateData.name || "Unknown",
                error: error.message,
              });
            }
          })
        );
      }

      logger.info("Batch template upload completed", {
        total: results.total,
        successful: results.successful.length,
        failed: results.failed.length,
      });

      return {
        success: true,
        results,
        message: `Batch upload completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      };
    } catch (error) {
      if (error instanceof TemplateValidationError) {
        throw error;
      }

      logger.error("Error in batch template upload", {
        templateCount: templatesData?.length,
        createdBy,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to batch upload templates: ${error.message}`,
        "batchUploadTemplates"
      );
    }
  }

  /**
   * Get template statistics (Admin only)
   * @returns {Promise<Object>} Template statistics
   */
  async getTemplateStats() {
    try {
      logger.info("Getting template statistics", {
        operation: "getTemplateStats",
      });

      const stats = await Template.getTemplateStats();

      logger.info("Template statistics retrieved", {
        totalTemplates: stats.total,
        activeTemplates: stats.active,
      });

      return {
        success: true,
        stats,
      };
    } catch (error) {
      logger.error("Error getting template statistics", {
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to get template statistics: ${error.message}`,
        "getTemplateStats"
      );
    }
  }

  /**
   * Get all templates for admin (includes inactive)
   * @param {Object} filters - Filter options
   * @param {Object} options - Query options
   * @returns {Promise<Object>} All templates with admin data
   */
  async getAdminTemplates(filters = {}, options = {}) {
    try {
      logger.info("Getting admin templates", {
        filters,
        operation: "getAdminTemplates",
      });

      // Remove status filter restriction for admin
      const adminFilters = { ...filters };
      delete adminFilters.status;

      const result = await this.getTemplates(adminFilters, options);

      // Get full template data for admin
      const adminTemplates = await Template.find({})
        .populate("createdBy", "email metadata.name")
        .sort(options.sort || { createdAt: -1 })
        .limit(options.limit || this.DEFAULT_PAGE_SIZE)
        .skip(
          ((options.page || 1) - 1) * (options.limit || this.DEFAULT_PAGE_SIZE)
        );

      return {
        ...result,
        templates: adminTemplates.map((template) => ({
          ...template.toObject(),
          creator: template.createdBy,
        })),
      };
    } catch (error) {
      logger.error("Error getting admin templates", {
        filters,
        error: error.message,
      });
      throw new TemplateOperationError(
        `Failed to get admin templates: ${error.message}`,
        "getAdminTemplates"
      );
    }
  }

  /**
   * Validate template data
   * @private
   * @param {Object} templateData - Template data to validate
   */
  _validateTemplateData(templateData) {
    if (!templateData) {
      throw new TemplateValidationError("Template data is required");
    }

    const requiredFields = [
      "name",
      "category",
      "type",
      "images",
      "aspectRatio",
    ];
    for (const field of requiredFields) {
      if (!templateData[field]) {
        throw new TemplateValidationError(`${field} is required`, field);
      }
    }

    // Validate images object
    if (
      !templateData.images.thumbnail ||
      !templateData.images.preview ||
      !templateData.images.fullSize
    ) {
      throw new TemplateValidationError(
        "All image URLs (thumbnail, preview, fullSize) are required",
        "images"
      );
    }

    // Validate aspect ratio
    if (!templateData.aspectRatio.width || !templateData.aspectRatio.height) {
      throw new TemplateValidationError(
        "Aspect ratio width and height are required",
        "aspectRatio"
      );
    }

    // Validate enums
    const validTypes = ["social", "print", "web", "story", "post", "banner"];
    if (!validTypes.includes(templateData.type)) {
      throw new TemplateValidationError(
        `Type must be one of: ${validTypes.join(", ")}`,
        "type"
      );
    }

    const validDifficulties = ["beginner", "intermediate", "advanced"];
    if (
      templateData.difficulty &&
      !validDifficulties.includes(templateData.difficulty)
    ) {
      throw new TemplateValidationError(
        `Difficulty must be one of: ${validDifficulties.join(", ")}`,
        "difficulty"
      );
    }

    const validStatuses = ["draft", "active", "inactive", "archived"];
    if (templateData.status && !validStatuses.includes(templateData.status)) {
      throw new TemplateValidationError(
        `Status must be one of: ${validStatuses.join(", ")}`,
        "status"
      );
    }
  }
}

// Export error classes for use in other modules
TemplateService.TemplateNotFoundError = TemplateNotFoundError;
TemplateService.TemplateOperationError = TemplateOperationError;
TemplateService.TemplateValidationError = TemplateValidationError;

module.exports = TemplateService;
