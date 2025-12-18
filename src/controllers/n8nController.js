const logger = require("../utils/logger");
const GenerationJob = require("../models/GenerationJob");
const BusinessProfile = require("../models/BusinessProfile");

class N8nController {
    constructor() {
        this.logger = logger;
    }

    async updateJobStatus(req, res) {
        this.logger.info("Received job status update");
        this.logger.info(`Job ID: ${req.body.jobId} | Status: ${req.body.status}`)
        res.sendStatus(200);

        try {
            const {jobId, status} = req.body;
            if (!jobId || !status) {
                throw new Error("Job ID or status not provided");
            }

            await GenerationJob.findByIdAndUpdate(jobId, {status: status}, {new: true}).exec();
        } catch (error) {
            this.logger.error(`Error updating job status for job ID ${req.body.jobId}\nError: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: "Error updating job status",
                error: error.message
            })
        }
    }

    async getGenerationJob(req, res) {
        try {
            const {jobId} = req.params;
            const job = await GenerationJob.findById(jobId)
              .populate("profileId") // Populate the profile data
              .populate("templateId") // Populate the template data
              .exec();
            res.json({
                success: true,
                jobData: job.toObject()
            });
        } catch (error) {
            this.logger.error(`Error getting job data for job ID ${req.params.jobId}\nError: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: "Error getting job data",
                error: error.message
            })
        }
    }

    async getBusinessProfile(req, res) {
        try {
            const {profileId} = req.params;
            const profile = await BusinessProfile.findById(profileId).exec();
            res.json({
                success: true,
                profileData: profile.toObject()
            });
        } catch (error) {
            this.logger.error(`Error getting profile data for profile ID ${req.params.profileId}\nError: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: "Error getting profile data",
                error: error.message
            })
        }
    }

    async getTemplate(req, res) {
        try {
            const {templateId} = req.params;
            const template = await GenerationJob.findById(templateId).exec();
            res.json({
                success: true,
                templateData: template.toObject()
            });
        } catch (error) {
            this.logger.error(`Error getting template data for template ID ${req.params.templateId}\nError: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: "Error getting template data",
                error: error.message
            })
        }
    }

    async updateJobContext(req, res) {
        try {
            const {jobStatus, generationContext, imageUrls} = req.body;
            if (!jobStatus || !generationContext || !imageUrls) {
                throw new Error("Job status, generation context, or image URLs not provided");
            }

            const job = await GenerationJob.findById(req.params.jobId).exec();
            if (!job) {
                throw new Error("Job not found");
            }

            job.status = jobStatus;
            job.generationContext = generationContext;
            job.result = {
                imageUrl: null,
                metadata: {
                    ...imageUrls
                }
            };

            await job.save();
            res.json({
                success: true,
                message: "Job context updated successfully"
            })
        } catch (error) {
            this.logger.error(`Error updating job context for job ID ${req.params.jobId}\nError: ${error.message}`);
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