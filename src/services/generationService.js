const GenerationJob = require('../models/GenerationJob');
const BusinessProfile = require('../models/BusinessProfile');
const Template = require('../models/Template');
const webhookTriggerApi = require("./n8n/webhookTriggerApi");
const { CreditService } = require('./creditService');
const { providerFactory } = require('./aiProviders/providerFactory');
const posterGenerationService = require('./posterGeneration');
const logger = require('../utils/logger');

/**
 * Custom error classes for generation operations
 */
class GenerationError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'GenerationError';
    this.code = code;
    this.details = details;
  }
}

class GenerationValidationError extends GenerationError {
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.field = field;
    this.value = value;
  }
}

/**
 * Generation Service
 * Orchestrates AI poster generation workflow
 */
class GenerationService {
  constructor(options = {}) {
    this.creditService = options.creditService || new CreditService();
    this.imagekitConfig = options.imagekitConfig || this.getImageKitConfig();
    this.defaultCreditsRequired = options.defaultCreditsRequired || 1;
    this.maxRetries = options.maxRetries || 3;
    this.webhookTimeout = options.webhookTimeout || 300000; // 5 minutes
    // 👇 add it here so it starts as "false"
    this.hasLoadedOnce = false;
  }

  /**
   * Get ImageKit configuration from environment
   * @returns {Object} ImageKit configuration
   */
  getImageKitConfig() {
    return {
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint:
        process.env.IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/jomobit",
    };
  }

  /**
   * Create a new generation job with credit reservation
   * @param {Object} jobData - Generation job data
   * @returns {Promise<Object>} Created job with reservation details
   */
  async createGenerationJob(jobData) {
    const {
      userId,
      profileId,
      templateId,
      priority = "normal",
      creditsRequired = this.defaultCreditsRequired,
      generationContext,
    } = jobData;

    logger.info("Creating generation job", {
      userId,
      profileId,
      templateId,
      creditsRequired,
      generationContext,
    });

    try {
      // Validate input data
      await this.validateGenerationRequest(
        userId,
        profileId,
        templateId,
        generationContext
      );

      logger.info(`Diffusion Model: ${generationContext.diffusionModel}`);
      logger.info(`Diffusion Provider: ${generationContext.diffusionProvider}`);

      // Reserve credits before creating job
      const job = await GenerationJob.createJob({
        userId,
        profileId,
        templateId,
        priority,
        creditsReserved: creditsRequired,
        generationContext,
      });

      // Reserve credits with job ID
      const creditReservation = await this.creditService.reserveCredits(
        userId,
        creditsRequired,
        job._id.toString(),
        {
          jobType: "poster_generation",
          profileId,
          templateId,
          generationContext,
        }
      );

      logger.info("Generation job created successfully", {
        jobId: job._id,
        userId,
        creditsReserved: creditsRequired,
        availableCredits: creditReservation.availableCredits,
        generationContext,
      });

      // 🚀 THIS IS THE MISSING PIECE - TRIGGER BACKGROUND PROCESSING
      // setImmediate(() => {
      //   this.processGenerationJob(job._id.toString()).catch((error) => {
      //     logger.error("Background processing failed", {
      //       jobId: job._id,
      //       error: error.message,
      //       stack: error.stack,
      //     });
      //   });
      // });

      // 🚀 THIS IS THE MISSING PIECE - TRIGGER BACKGROUND PROCESSING
      setImmediate(() => {
        this.startGenerationWorkflow(job._id.toString()).catch((error) => {
          logger.error("Background processing failed", {
            jobId: job._id,
            error: error.message,
            stack: error.stack,
          });
        });
      });

      return {
        success: true,
        job: job.getSummary(),
        creditReservation: {
          reserved: creditsRequired,
          availableAfter: creditReservation.availableCredits,
        },
        message: "Generation job created and credits reserved successfully",
      };
    } catch (error) {
      logger.error("Error creating generation job", {
        userId,
        profileId,
        templateId,
        error: error.message,
        stack: error.stack,
      });

      if (error.name === "CreditInsufficientError") {
        throw new GenerationError(
          `Insufficient credits: ${error.required} required, ${error.available} available`,
          "INSUFFICIENT_CREDITS",
          { required: error.required, available: error.available }
        );
      }

      throw error;
    }
  }

  /**
   * Process a generation job through the AI pipeline
   * @param {string|ObjectId} jobId - Generation job ID
   * @returns {Promise<Object>} Processing result
   */
  async startGenerationWorkflow(jobId) {
    logger.info("Starting generation workflow", { jobId });
    
    try {
      const response = await webhookTriggerApi.triggerGenerationWebhook(jobId);
      logger.info(`${response.message} - ${response.details}`);
    } catch (error) {
      logger.error("Error starting generation workflow", {
        jobId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Process a generation job through the AI pipeline
   * @param {string|ObjectId} jobId - Generation job ID
   * @returns {Promise<Object>} Processing result
   */
  async processGenerationJob(jobId) {
    logger.info("Processing generation job", { jobId });

    try {
      // Get job with populated references
      const job = await GenerationJob.findById(jobId)
        .populate("userId", "email")
        .populate("profileId")
        .populate("templateId")
        .exec();

      if (!job) {
        throw new GenerationError("Generation job not found", "JOB_NOT_FOUND", {
          jobId,
        });
      }

      if (job.status !== "pending") {
        throw new GenerationError(
          `Job is not in pending status: ${job.status}`,
          "INVALID_JOB_STATUS",
          { jobId, currentStatus: job.status }
        );
      }

      // Start processing
      await job.startProcessing();

      // NEW: Use poster generation service based on posterType
      const result = await posterGenerationService.generatePoster(job);

      // Update job with prompt data
      if (result.prompt && result.promptParameters) {
        await job.updatePrompt(result.prompt, result.promptParameters);
      }

      // Update job with timing
      if (result.timing) {
        job.timing = result.timing;
      }

      // Update job with result
      job.externalJobId = result.jobId;
      job.result.imageUrl = result.imageUrl;
      job.result.metadata = result.metadata;
      job.status = result.status;
      await job.save();

      logger.info("Generation job processing completed", {
        jobId,
        status: result.status,
        externalJobId: result.jobId,
        posterType: job.posterType,
        hasPrompt: !!result.prompt,
        timing: result.timing,
      });

      await this.handleGenerationSuccess(job, result);
    } catch (error) {
      logger.error("Error processing generation job", {
        jobId,
        error: error.message,
        stack: error.stack,
      });

      // Mark job as failed and release credits
      await this.handleGenerationFailure(jobId, error);
      throw error;
    }
  }

  /**
   * Generate prompt using selected LLM provider
   * @param {GenerationJob} job - Generation job with populated references
   * @returns {Promise<Object>} Generated prompt and parameters
   */
  async generatePrompt(job) {
    const startTime = Date.now();

    try {
      logger.info("Generating prompt", {
        jobId: job._id,
        llmProvider: job.aiProvider.llm,
        profileName: job.profileId.name,
        templateName: job.templateId.name,
        posterType: job.posterType,
        template: job.templateId,
        profile: job.profileId,
      });

      // Create LLM provider instance
      const llmProvider = providerFactory.createLLMProvider(job.aiProvider.llm);

      // Generate prompt using business profile, template, and posterType
      const prompt = await llmProvider.generatePrompt(
        job.profileId.getGenerationSummary(),
        job.templateId,
        job.posterType
      );

      const promptGenerationTime = Date.now() - startTime;

      // Update job timing
      if (!job.timing) job.timing = {};
      job.timing.promptGenerationTime = promptGenerationTime;
      await job.save();

      logger.info("Prompt generated successfully", {
        jobId: job._id,
        promptLength: prompt.length,
        generationTime: promptGenerationTime,
        provider: job.aiProvider.llm,
        posterType: job.posterType,
      });

      return {
        prompt,
        parameters: {
          llmProvider: job.aiProvider.llm,
          generationTime: promptGenerationTime,
          profileId: job.profileId._id,
          templateId: job.templateId._id,
          posterType: job.posterType,
        },
      };
    } catch (error) {
      logger.error("Error generating prompt", {
        jobId: job._id,
        llmProvider: job.aiProvider.llm,
        error: error.message,
      });

      throw new GenerationError(
        `Failed to generate prompt: ${error.message}`,
        "PROMPT_GENERATION_FAILED",
        { provider: job.aiProvider.llm, originalError: error.message }
      );
    }
  }

  /**
   * Generate image using selected diffusion provider
   * @param {GenerationJob} job - Generation job
   * @param {string} prompt - Generated prompt
   * @returns {Promise<Object>} Image generation result
   */
  async generateImage(job, prompt) {
    const startTime = Date.now();

    try {
      logger.info("Generating image", {
        jobId: job._id,
        diffusionProvider: job.aiProvider.diffusion,
        promptLength: prompt.length,
      });

      // Create diffusion provider instance
      const diffusionProvider = providerFactory.createDiffusionProvider(
        job.aiProvider.diffusion
      );

      // Prepare generation parameters based on template and brand
      const templateParameters = this.prepareImageTemplateParameters(
        job.templateId
      );
      const brandParameter = this.prepareImageBrandParameters(
        job.profileId.getGenerationSummary()
      );

      const { image: templateUrl, ...restOfTemplate } = templateParameters;
      const { logo: logoUrl, ...restOfBrand } = brandParameter;

      const parameters = {
        ...restOfTemplate,
        ...restOfBrand,
        image_urls: {
          template: templateUrl,
          logo: logoUrl,
        },
      };

      logger.info("Parameters before image generation: ", parameters);

      // Generate image
      const result = await diffusionProvider.generateImage(prompt, parameters);

      const imageGenerationTime = Date.now() - startTime;

      // Update job timing
      if (!job.timing) job.timing = {};
      job.timing.imageGenerationTime = imageGenerationTime;
      await job.save();

      logger.info("Image generation initiated", {
        jobId: job._id,
        externalJobId: result.jobId,
        provider: job.aiProvider.diffusion,
        initiationTime: imageGenerationTime,
      });

      return {
        externalJobId: result.jobId,
        imageUrl: result.imageUrl,
        metadata: result.metadata,
        status: result.status,
        parameters,
        provider: job.aiProvider.diffusion,
      };
    } catch (error) {
      logger.error("Error generating image", {
        jobId: job._id,
        diffusionProvider: job.aiProvider.diffusion,
        error: error.message,
      });

      throw new GenerationError(
        `Failed to generate image: ${error.message}`,
        "IMAGE_GENERATION_FAILED",
        { provider: job.aiProvider.diffusion, originalError: error.message }
      );
    }
  }

  /**
   * Process webhook from AI service for generation completion
   * @param {Object} webhookData - Webhook payload
   * @returns {Promise<Object>} Processing result
   */
  async processGenerationWebhook(webhookData) {
    const { externalJobId, status, result, error } = webhookData;

    logger.info("Processing generation webhook", {
      externalJobId,
      status,
      hasResult: !!result,
      hasError: !!error,
    });

    try {
      // Find job by external job ID
      const job = await GenerationJob.getJobByExternalId(externalJobId);

      if (!job) {
        logger.warn("Job not found for webhook", { externalJobId });
        return {
          success: false,
          error: "Job not found",
          externalJobId,
        };
      }

      // Update webhook data
      await job.updateWebhookData(webhookData);

      if (status === "completed" && result) {
        return await this.handleGenerationSuccess(job, result);
      } else if (status === "failed" || error) {
        return await this.handleGenerationFailure(
          job._id,
          error || { message: "Generation failed" }
        );
      } else {
        // Update job status for intermediate states
        job.status = status === "processing" ? "processing" : job.status;
        await job.save();

        return {
          success: true,
          jobId: job._id,
          status: job.status,
          message: "Webhook processed successfully",
        };
      }
    } catch (error) {
      logger.error("Error processing generation webhook", {
        externalJobId,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Handle successful generation completion
   * @param {GenerationJob} job - Generation job
   * @param {Object} result - Generation result from AI service
   * @returns {Promise<Object>} Success handling result
   */
  async handleGenerationSuccess(job, result) {
    logger.info("Handling generation success", {
      jobId: job._id,
      userId: job.userId,
      hasImageUrl: !!result.imageUrl,
    });

    try {
      // Process and store image via ImageKit
      // const imageResult = await this.processGeneratedImage(result, job);

      // Complete the job
      // await job.complete({
      //     imageUrl: imageResult.url,
      //     imagekitFileId: imageResult.fileId,
      //     thumbnailUrl: imageResult.thumbnailUrl,
      //     metadata: {
      //         ...result,
      //         imagekit: imageResult,
      //         processedAt: new Date()
      //     }
      // });

      // Deduct reserved credits
      await this.creditService.deductReservedCredits(
        job._id.toString(),
        job.userId,
        job.creditsReserved,
        {
          completedAt: new Date(),
          imageUrl: result.imageUrl,
          provider: job.aiProvider,
        }
      );

      logger.info("Generation completed successfully", {
        jobId: job._id,
        userId: job.userId,
        imageUrl: result.imageUrl,
        creditsDeducted: job.creditsReserved,
      });

      return {
        success: true,
        jobId: job._id,
        status: "completed",
        result: {
          imageUrl: result.imageUrl,
          thumbnailUrl: result.imageUrl,
        },
        creditsDeducted: job.creditsReserved,
        message: "Generation completed successfully",
      };
    } catch (error) {
      logger.error("Error handling generation success", {
        jobId: job._id,
        error: error.message,
      });

      // If processing success fails, treat as failure
      return await this.handleGenerationFailure(job._id, error);
    }
  }

  /**
   * Handle generation failure and release credits
   * @param {string|ObjectId} jobId - Generation job ID
   * @param {Object} error - Error information
   * @returns {Promise<Object>} Failure handling result
   */
  async handleGenerationFailure(jobId, error) {
    logger.info("Handling generation failure", {
      jobId,
      errorMessage: error.message || "Unknown error",
    });

    try {
      const job = await GenerationJob.findById(jobId);

      if (!job) {
        throw new GenerationError(
          "Job not found for failure handling",
          "JOB_NOT_FOUND",
          { jobId }
        );
      }

      // Mark job as failed
      await job.fail({
        message: error.message || "Generation failed",
        code: error.code || "GENERATION_FAILED",
        provider: error.provider || job.aiProvider.diffusion,
        details: error.details || error,
      });

      // Release reserved credits - handle case where credits might already be processed
      try {
        await this.creditService.releaseReservedCredits(
          job._id.toString(),
          job.userId,
          job.creditsReserved,
          {
            failedAt: new Date(),
            errorMessage: error.message,
            provider: job.aiProvider,
          }
        );
      } catch (creditError) {
        // If credits were already processed, log but don't fail the operation
        if (
          creditError.name === "CreditOperationError" &&
          creditError.message.includes("Credits already processed")
        ) {
          logger.warn("Credits already processed for job", {
            jobId,
            creditError: creditError.message,
          });
        } else {
          // Re-throw other credit errors
          throw creditError;
        }
      }

      logger.info("Generation failure handled", {
        jobId,
        userId: job.userId,
        creditsReleased: job.creditsReserved,
        errorMessage: error.message,
      });

      return {
        success: false,
        jobId,
        status: "failed",
        error: {
          message: error.message || "Generation failed",
          code: error.code || "GENERATION_FAILED",
        },
        creditsReleased: job.creditsReserved,
        message: "Generation failed, credits released",
      };
    } catch (releaseError) {
      logger.error("Error handling generation failure", {
        jobId,
        originalError: error.message,
        releaseError: releaseError.message,
      });

      throw releaseError;
    }
  }

  /**
   * Process generated image and store via ImageKit
   * @param {Object} result - Generation result with image URL
   * @param {GenerationJob} job - Generation job
   * @returns {Promise<Object>} ImageKit storage result
   */
  async processGeneratedImage(result, job) {
    logger.info("Processing generated image", {
      jobId: job._id,
      originalUrl: result.imageUrl,
    });

    try {
      // For now, return the original URL as ImageKit integration would require actual API calls
      // In a real implementation, this would:
      // 1. Download the image from the AI service
      // 2. Upload to ImageKit with proper naming and metadata
      // 3. Generate thumbnails
      // 4. Return ImageKit URLs

      const imagekitResult = {
        url: result.imageUrl, // In real implementation: ImageKit CDN URL
        fileId: `job_${job._id}_${Date.now()}`, // In real implementation: ImageKit file ID
        thumbnailUrl: result.imageUrl, // In real implementation: ImageKit thumbnail URL
        metadata: {
          originalUrl: result.imageUrl,
          jobId: job._id,
          userId: job.userId,
          profileId: job.profileId,
          templateId: job.templateId,
          uploadedAt: new Date(),
        },
      };

      logger.info("Image processed successfully", {
        jobId: job._id,
        imagekitUrl: imagekitResult.url,
        fileId: imagekitResult.fileId,
      });

      return imagekitResult;
    } catch (error) {
      logger.error("Error processing generated image", {
        jobId: job._id,
        error: error.message,
      });

      throw new GenerationError(
        `Failed to process generated image: ${error.message}`,
        "IMAGE_PROCESSING_FAILED",
        { jobId: job._id, originalError: error.message }
      );
    }
  }

  /**
   * Validate generation request
   * @param {string|ObjectId} userId - User ID
   * @param {string|ObjectId} profileId - Business profile ID
   * @param {string|ObjectId} templateId - Template ID
   * @param {Object} aiProvider - AI provider configuration
   * @param {string} posterType - Poster type
   * @returns {Promise<void>} Validation result
   */
  async validateGenerationRequest(
    userId,
    profileId,
    templateId,
    generationContext
  ) {
    // Validate posterType
    const validPosterTypes = ["wish", "cta", "awareness"];
    if (!validPosterTypes.includes(generationContext.posterType)) {
      throw new GenerationValidationError(
        `Invalid poster type: ${posterType}. Must be one of: ${validPosterTypes.join(
          ", "
        )}`,
        "posterType",
        posterType
      );
    }

    // Validate user exists and has access to profile
    const profile = await BusinessProfile.getProfileByIdForUser(
      profileId,
      userId
    );
    if (!profile) {
      throw new GenerationValidationError(
        "Business profile not found or access denied",
        "profileId",
        profileId
      );
    }

    // Validate template exists and is active
    const template = await Template.getTemplateById(templateId);
    if (!template) {
      throw new GenerationValidationError(
        "Template not found or inactive",
        "templateId",
        templateId
      );
    }

    // Validate profile completeness
    const completeness = profile.validateCompleteness();
    if (!completeness.isComplete) {
      throw new GenerationValidationError(
        `Business profile incomplete. Missing: ${completeness.missing.join(
          ", "
        )}`,
        "profile",
        completeness.missing
      );
    }
  }

  /**
   * Prepare image generation parameters based on template
   * @param {Template} template - Template data
   * @returns {Object} Image generation parameters
   */
  prepareImageTemplateParameters(template) {
    const parameters = {
      size: `${template.aspectRatio.width}x${template.aspectRatio.height}`,
      quality: "high",
      style: template.type === "social" ? "vibrant" : "professional",
      format: "png",
      image: template.images.fullSize,
    };

    // Add template-specific parameters
    if (template.metadata?.aiParameters) {
      Object.assign(parameters, template.metadata.aiParameters);
    }

    return parameters;
  }

  /**
   * Prepare image generation parameters based on business profile
   * @param {BusinessProfile} profile - Business profile data
   * @returns {Object} Image generation parameters
   */
  prepareImageBrandParameters(profile) {
    const parameters = {
      logo: profile.logo || null,
    };

    // Add brand-specific parameters
    if (profile.metadata?.aiParameters) {
      Object.assign(parameters, profile.metadata.aiParameters);
    }

    return parameters;
  }

  /**
   * Get user's generation history
   * @param {string|ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated generation history
   */
  async getUserGenerationHistory(userId, options = {}) {
    return GenerationJob.getUserGenerationHistory(userId, options);
  }

  /**
   * Get generation job by ID for user
   * @param {string|ObjectId} jobId - Job ID
   * @param {string|ObjectId} userId - User ID
   * @returns {Promise<GenerationJob|null>} Generation job or null
   */
  async getGenerationJobForUser(jobId, userId) {
    return GenerationJob.getJobByIdForUser(jobId, userId);
  }

  /**
   * Cancel a pending generation job
   * @param {string|ObjectId} jobId - Job ID
   * @param {string|ObjectId} userId - User ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelGenerationJob(jobId, userId, reason = "User cancelled") {
    logger.info("Cancelling generation job", { jobId, userId, reason });

    try {
      const job = await GenerationJob.getJobByIdForUser(jobId, userId);

      if (!job) {
        throw new GenerationError(
          "Job not found or access denied",
          "JOB_NOT_FOUND",
          { jobId }
        );
      }

      if (job.isFinal()) {
        throw new GenerationError(
          `Cannot cancel job in ${job.status} status`,
          "INVALID_JOB_STATUS",
          { jobId, status: job.status }
        );
      }

      // Cancel the job
      await job.cancel(reason);

      // Release reserved credits
      await this.creditService.releaseReservedCredits(
        job._id.toString(),
        job.userId,
        job.creditsReserved,
        {
          cancelledAt: new Date(),
          reason,
        }
      );

      logger.info("Generation job cancelled successfully", {
        jobId,
        userId,
        creditsReleased: job.creditsReserved,
      });

      return {
        success: true,
        jobId,
        status: "cancelled",
        creditsReleased: job.creditsReserved,
        message: "Job cancelled successfully",
      };
    } catch (error) {
      logger.error("Error cancelling generation job", {
        jobId,
        userId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Get generation statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Generation statistics
   */
  async getGenerationStats(filters = {}) {
    return GenerationJob.getJobStats(filters);
  }

  /**
   * Retry a failed generation job
   * @param {string|ObjectId} jobId - Job ID
   * @param {string|ObjectId} userId - User ID
   * @returns {Promise<Object>} Retry result
   */
  async retryGenerationJob(jobId, userId) {
    logger.info("Retrying generation job", { jobId, userId });

    try {
      const job = await GenerationJob.getJobByIdForUser(jobId, userId);

      if (!job) {
        throw new GenerationError(
          "Job not found or access denied",
          "JOB_NOT_FOUND",
          { jobId }
        );
      }

      if (!job.canRetry()) {
        throw new GenerationError(
          `Job cannot be retried. Status: ${job.status}, Retries: ${job.retryCount}`,
          "RETRY_NOT_ALLOWED",
          { jobId, status: job.status, retryCount: job.retryCount }
        );
      }

      // Increment retry count and reset status
      await job.incrementRetry();
      job.status = "pending";
      job.completedAt = undefined;

      await job.save();

      // Use $unset to completely remove the error field
      await GenerationJob.updateOne({ _id: job._id }, { $unset: { error: 1 } });

      // Process the job again
      return await this.processGenerationJob(jobId);
    } catch (error) {
      logger.error("Error retrying generation job", {
        jobId,
        userId,
        error: error.message,
      });

      throw error;
    }
  }
}

module.exports = {
  GenerationService,
  GenerationError,
  GenerationValidationError
};