const TemplateService = require("../services/templateService");
const logger = require("../utils/logger");

/**
 * Trial Controller
 * Handles trial/guest mode endpoints without authentication
 */
class TrialController {
    constructor() {
        this.templateService = new TemplateService();

        // Bind methods to preserve 'this' context
        this.getTrialTemplates = this.getTrialTemplates.bind(this);
    }

    /**
     * Get featured templates for trial users
     * GET /api/trial/templates
     * No authentication required
     */
    async getTrialTemplates(req, res) {
        try {
            const { limit } = req.query;

            logger.info("Fetching trial templates", {
                requestedLimit: limit,
                operation: "getTrialTemplates",
            });

            const result = await this.templateService.getTrialTemplates(
                limit ? parseInt(limit) : undefined
            );

            logger.info("Trial templates fetched successfully", {
                count: result.count,
                operation: "getTrialTemplates",
            });

            res.json({
                success: true,
                templates: result.templates,
                count: result.count,
            });
        } catch (error) {
            logger.error("Error fetching trial templates:", error);
            res.status(500).json({
                success: false,
                error: "Internal server error",
                message: "Failed to fetch trial templates",
            });
        }
    }
}

module.exports = new TrialController();
