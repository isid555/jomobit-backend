const logger = require("../../utils/logger");
const GenerationJob = require("../../models/GenerationJob");
const {
  GenerationService,
  GenerationError,
  GenerationValidationError,
} = require("../generationService");
const mongoose = require("mongoose");

class N8NService {
  constructor() {
    this.logger = logger;
    this.generationService = new GenerationService();
  }

  async handleGenerationFailure(errorContext) {
    const executionId = errorContext.execution.id;
    try {
      const job = await GenerationJob.getJobByExternalId({ externalJobId: executionId });
      if (!job) {
        throw new GenerationError(
          `Job not found for given n8n execution id`,
          "JOB_NOT_FOUND",
          { executionId }
        );
      }

      await this.generationService.handleGenerationFailure(job.id, errorContext, true);
    } catch (error) {
      this.logger.error("Error handling generation failure for failed n8n job", {
        executionId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async handleEnhancementFailure(errorContext) {
    const executionId = errorContext.execution.id;
    try {
      const job = await GenerationJob.getJobByExternalId({ externalJobId: executionId });
      if (!job) {
        throw new GenerationError(`Job not found for given n8n execution id`, "JOB_NOT_FOUND", { executionId });
      }

      if (job.status !== "pending") {
        throw new GenerationError(`Job is not in pending status: ${job.status}`, "INVALID_JOB_STATUS", { executionId, currentStatus: job.status });
      }

      if (job.retryCount < job.maxRetries) {
        job.status = "pending";
        await job.save();
        return;
      }
      
      await this.generationService.handleGenerationFailure(job.id, errorContext, true);
    } catch (error) {
      this.logger.error("Error handling enhancement failure for failed n8n job", {
        executionId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async updateStatus(jobId, status) {
    try {
      const validJobId = mongoose.Types.ObjectId.isValid(jobId);
      if (!validJobId) {
        throw new GenerationError("Invalid job ID", "INVALID_JOB_ID", {
          jobId,
        });
      }

      const job = await GenerationJob.findByIdAndUpdate(
        jobId,
        { status: status },
        { new: true }
      ).exec();

      if (!job) {
        throw new GenerationError("Job not found", "JOB_NOT_FOUND", { jobId });
      }
    } catch (error) {
      if (error.name === "ValidationError") {
        throw new GenerationValidationError(
          "Job validation failed",
          "VALIDATION_ERROR",
          {
            jobId,
            validationErrors: error.errors,
          }
        );
      } else if (error.code === "INVALID_JOB_ID") {
        throw error;
      } else if (error.code === "JOB_NOT_FOUND") {
        throw error;
      }

      // Handle other errors
      throw new GenerationError(
        "Failed to update job status",
        "UPDATE_FAILED",
        {
          jobId,
          error: error.message,
        }
      );
    }
  }

  async getJob(jobId) {
    try {
      const validJobId = mongoose.Types.ObjectId.isValid(jobId);
      if (!validJobId) {
        throw new GenerationError("Invalid job ID", "INVALID_JOB_ID", {
          jobId,
        });
      }

      const job = await GenerationJob.findById(jobId)
        .populate("profileId") // Populate the profile data
        .populate("templateId") // Populate the template data
        .exec();

      if (!job) {
        throw new GenerationError("Job not found", "JOB_NOT_FOUND", { jobId });
      }
      return job;
    } catch (error) {
      if (error.code === "INVALID_JOB_ID") {
        throw error;
      } else if (error.code === "JOB_NOT_FOUND") {
        throw error;
      }

      // Handle other errors
      throw new GenerationError(
        "Failed to update job status",
        "UPDATE_FAILED",
        {
          jobId,
          error: error.message,
        }
      );
    }
  }

  async updateJob(jobId, { jobStatus, generationContext, imageUrls }) {
    try {
      const validJobId = mongoose.Types.ObjectId.isValid(jobId);
      if (!validJobId) {
        throw new GenerationError("Invalid job ID", "INVALID_JOB_ID", {
          jobId,
        });
      }

      const job = await GenerationJob.findById(jobId);
      if (!job) {
        throw new GenerationError("Job not found", "JOB_NOT_FOUND", { jobId });
      }

      job.status = jobStatus;
      job.generationContext = generationContext;
      job.result = {
        imageUrl: null,
        metadata: {
          ...imageUrls,
        },
      };

      await job.save();
    } catch (error) {
      if (error.name === "ValidationError") {
        throw new GenerationValidationError(
          "Job validation failed",
          "VALIDATION_ERROR",
          {
            jobId,
            validationErrors: error.errors,
          }
        );
      } else if (error.code === "INVALID_JOB_ID") {
        throw error;
      } else if (error.code === "JOB_NOT_FOUND") {
        throw error;
      }

      // Handle other errors
      throw new GenerationError(
        "Failed to update job status",
        "UPDATE_FAILED",
        {
          jobId,
          error: error.message,
        }
      );
    }
  }

  async updateEnhancement(jobId, { enhancedImageUrl, enhancementMetadata, imagekitData }) {
    try {
      const validJobId = mongoose.Types.ObjectId.isValid(jobId);
      if (!validJobId) {
        throw new GenerationError("Invalid job ID", "INVALID_JOB_ID", {
          jobId,
        });
      }

      const job = await GenerationJob.findById(jobId);
      if (!job) {
        throw new GenerationError("Job not found", "JOB_NOT_FOUND", {
          jobId,
        });
      }

      let metadata = job.result.metadata || {};
      metadata = {
        ...metadata,
        enhancementMetadata,
      };
      job.status = "completed";
      job.result = {
        imageUrl: enhancedImageUrl,
        imagekitFileId: imagekitData.fileId,
        thumbnailUrl: imagekitData.thumbnailUrl,
        metadata,
      };

      // Explicitly mark the nested field as modified
      job.markModified("result.metadata");
      return await job.save();

    } catch (error) {
      if (error.name === "ValidationError") {
        throw new GenerationValidationError(
          "Job validation failed",
          "VALIDATION_ERROR",
          {
            jobId,
            validationErrors: error.errors,
          }
        );
      } else if (error.code === "INVALID_JOB_ID") {
        throw error;
      } else if (error.code === "JOB_NOT_FOUND") {
        throw error;
      }

      // Handle other errors
      throw new GenerationError(
        "Failed to update job status",
        "UPDATE_FAILED",
        {
          jobId,
          error: error.message,
        }
      );
    }
  }
}

module.exports = N8NService;
