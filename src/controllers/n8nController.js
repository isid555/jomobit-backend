const logger = require("../utils/logger");
const { GenerationService, GenerationError } = require('../services/generationService');
const N8NService = require('../services/n8n/n8nService');

class N8nController {
    constructor() {
        this.logger = logger;
        this.generationService = new GenerationService();
        this.service = new N8NService();
    }

    async updateJobStatus(req, res) {
        const {jobId, status} = req.body;
        try {
            if (!jobId || !status) {
                throw new GenerationError("Missing required fields", "MISSING_FIELDS", { jobId, status });
            }

            await this.service.updateStatus(jobId, status);
            res.json({
                success: true,
                message: "Job status updated successfully"
            })
        } catch (error) {
            this.generationService.handleGenerationFailure(jobId, error);
            return res.status(500).json({
                success: false,
                message: "Error updating job status",
                error: error.message
            })
        }
    }

    async getGenerationJob(req, res) {
        const { jobId } = req.params;
        try {
            if (!jobId) {
                throw new GenerationError("Missing required fields", "MISSING_FIELDS", { jobId });
            }

            const job = await this.service.getJob(jobId);
            res.json({
                success: true,
                jobData: job.toObject()
            });
        } catch (error) {
            this.generationService.handleGenerationFailure(jobId, error);
            return res.status(500).json({
                success: false,
                message: "Error getting job data",
                error: error.message
            })
        }
    }

    // async getBusinessProfile(req, res) {
    //     try {
    //         const {profileId} = req.params;
    //         const profile = await BusinessProfile.findById(profileId).exec();
    //         res.json({
    //             success: true,
    //             profileData: profile.toObject()
    //         });
    //     } catch (error) {
    //         this.logger.error(`Error getting profile data for profile ID ${req.params.profileId}\nError: ${error.message}`);
    //         return res.status(500).json({
    //             success: false,
    //             message: "Error getting profile data",
    //             error: error.message
    //         })
    //     }
    // }

    // async getTemplate(req, res) {
    //     try {
    //         const {templateId} = req.params;
    //         const template = await GenerationJob.findById(templateId).exec();
    //         res.json({
    //             success: true,
    //             templateData: template.toObject()
    //         });
    //     } catch (error) {
    //         this.logger.error(`Error getting template data for template ID ${req.params.templateId}\nError: ${error.message}`);
    //         return res.status(500).json({
    //             success: false,
    //             message: "Error getting template data",
    //             error: error.message
    //         })
    //     }
    // }

    async updateJobContext(req, res) {
        const jobId = req.params.jobId;
        try {
            if (!jobId) {
                throw new GenerationError("Missing required fields", "MISSING_FIELDS", { jobId });
            }
            const {jobStatus, generationContext, imageUrls} = req.body;
            if (!jobStatus || !generationContext || !imageUrls) {
                throw new GenerationError("Missing required fields", "MISSING_FIELDS", { jobStatus, generationContext, imageUrls });
            }

            await this.service.updateJob(jobId, {
              jobStatus,
              generationContext,
              imageUrls,
            });
            res.json({
                success: true,
                message: "Job context updated successfully"
            })
        } catch (error) {
            this.generationService.handleGenerationFailure(jobId, error);
            return res.status(500).json({
                success: false,
                message: "Error updating job context",
                error: error.message
            })
        }
    }
}

const n8nController = new N8nController();
module.exports = n8nController;