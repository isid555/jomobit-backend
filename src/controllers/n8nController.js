const logger = require("../utils/logger");
const { GenerationService, GenerationError } = require('../services/generationService');
const N8NService = require('../services/n8n/n8nService');

class N8nController {
    constructor() {
        this.logger = logger;
        this.generationService = new GenerationService();
        this.service = new N8NService();
    }

    async handleN8NError(req, res) {
        try {
            const errorContext = req.body;
            const workflowId = errorContext.workflow.id;
            if (!workflowId) {
                throw new GenerationError("Missing required fields: workflowId from n8n error", "MISSING_FIELDS", { workflowId });
            }

            switch (workflowId) {
              case process.env.N8N_GENERATION_FLOW_ID:
                await this.service.handleGenerationFailure(errorContext);
                break;
              case process.env.N8N_ENHANCEMENT_FLOW_ID:
                await this.service.handleEnhancementFailure(
                  errorContext
                );
                break;
              default:
                throw new GenerationError(
                  "Invalid workflow id",
                  "INVALID_WORKFLOW_ID",
                  { workflowId }
                );
            }
            return res.status(200).json({
                success: true,
                message: "Error handled successfully"
            })
        } catch (error) {
            this.logger.error(`Error handling n8n error`, { error: error.message, stack: error.stack });
            return res.status(500).json({
                success: false,
                message: "Error handling n8n error",
                error: error.message
            })
        }
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
            await this.generationService.handleGenerationFailure(jobId, error);
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
            await this.generationService.handleGenerationFailure(jobId, error);
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
            await this.generationService.handleGenerationFailure(jobId, error);
            return res.status(500).json({
                success: false,
                message: "Error updating job context",
                error: error.message
            })
        }
    }

    async updateJobEnhancement(req, res) {
        const jobId = req.params.jobId;
        try {
            if (!jobId) {
              throw new GenerationError(
                "Missing required fields",
                "MISSING_FIELDS",
                { jobId }
              );
            }

            const {enhancedImageUrl, enhancementMetadata, imagekitData} = req.body;
            if (!enhancedImageUrl || !enhancementMetadata || !imagekitData) {
              throw new GenerationError(
                "Missing required fields",
                "MISSING_FIELDS",
                { enhancedImageUrl, enhancementMetadata, imagekitData }
              );
            }

            const job = await this.service.updateEnhancement(jobId, {
              enhancedImageUrl,
              enhancementMetadata,
              imagekitData,
            });
            res.json({
                success: true,
                message: "Job enhancement updated successfully"
            })

            this.generationService.handleGenerationSuccess(job, job.result);
        } catch (error) {
            await this.generationService.handleGenerationFailure(jobId, error);
            return res.status(500).json({
                success: false,
                message: "Error updating job enhancement",
                error: error.message
            })
        }
    }
}

const n8nController = new N8nController();
module.exports = n8nController;