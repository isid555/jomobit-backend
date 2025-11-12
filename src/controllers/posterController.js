const { GenerationService } = require('../services/generationService');
const logger = require('../utils/logger');

/**
 * Poster Controller
 * Handles poster generation and history endpoints
 */
class PosterController {
  constructor() {
    this.generationService = new GenerationService();
  }

  /**
   * Create a new poster generation job
   * POST /api/posters/generate
   */
  async generatePoster(req, res) {
    try {
      const userId = req.user.id; // Auth0 ID, need to convert to actual user ID
      const {
        profileId,
        templateId,
        aiProvider = { llm: 'openai', diffusion: 'openai' },
        priority = 'normal',
        creditsRequired = 1,
        posterType = 'wish'
      } = req.body;

      // Validate required fields
      if (!profileId || !templateId) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Profile ID and Template ID are required'
        });
      }

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const jobData = {
        userId: actualUserId,
        profileId,
        templateId,
        aiProvider,
        priority,
        creditsRequired,
        posterType
      };

      const result = await this.generationService.createGenerationJob(jobData);

      logger.info('Poster generation job created', {
        jobId: result.job.id,
        userId: actualUserId,
        profileId,
        templateId,
        posterType,
        creditsReserved: creditsRequired
      });

      res.status(201).json({
        success: true,
        message: result.message,
        job: result.job,
        creditReservation: result.creditReservation
      });

    } catch (error) {
      if (error.name === 'GenerationError') {
        const statusCode = error.code === 'INSUFFICIENT_CREDITS' ? 402 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.code,
          message: error.message,
          details: error.details
        });
      }

      if (error.name === 'GenerationValidationError') {
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
          message: 'User profile not found in database'
        });
      }

      logger.error('Error creating poster generation job:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create poster generation job'
      });
    }
  }

  /**
   * Get user's poster generation history
   * GET /api/posters/history
   */
  async getGenerationHistory(req, res) {
    try {
      const userId = req.user.id;
      const {
        profileId,
        status,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const options = {
        profileId,
        status,
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder
      };

      const result = await this.generationService.getUserGenerationHistory(actualUserId, options);

      res.json({
        success: true,
        history: result.jobs,
        pagination: result.pagination,
        filters: {
          profileId,
          status
        }
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error fetching generation history:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch generation history'
      });
    }
  }

  /**
   * Get poster generation job by ID with metadata
   * GET /api/posters/:jobId
   */
  async getGenerationJob(req, res) {
    try {
      const userId = req.user.id;
      const { jobId } = req.params;
      const { includeMetadata = 'false' } = req.query;

      // Validate ObjectId format
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(jobId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid job ID format',
          message: 'The provided job ID is not a valid format'
        });
      }

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const job = await this.generationService.getGenerationJobForUser(jobId, actualUserId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          message: 'Generation job not found or access denied'
        });
      }

      // Build response with optional metadata
      const response = {
        success: true,
        job: job.toObject()
      };

      // Add detailed metadata if requested
      if (includeMetadata === 'true') {
        response.metadata = {
          generationDetails: {
            aiProvider: job.aiProvider,
            prompt: job.prompt,
            timing: job.timing,
            retryCount: job.retryCount,
            priority: job.priority
          },
          businessProfile: {
            id: job.profileId._id,
            name: job.profileId.name
          },
          template: {
            id: job.templateId._id,
            name: job.templateId.name,
            aspectRatio: job.templateId.aspectRatio
          },
          processing: {
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            totalDuration: job.getProcessingDuration()
          }
        };

        // Add error details if job failed
        if (job.status === 'failed' && job.error) {
          response.metadata.error = {
            message: job.error.message,
            code: job.error.code,
            provider: job.error.provider,
            occurredAt: job.error.occurredAt
          };
        }
      }

      res.json(response);

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error fetching generation job:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch generation job'
      });
    }
  }

  /**
   * Cancel a pending generation job
   * POST /api/posters/:jobId/cancel
   */
  async cancelGenerationJob(req, res) {
    try {
      const userId = req.user.id;
      const { jobId } = req.params;
      const { reason = 'User cancelled' } = req.body || {};

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const result = await this.generationService.cancelGenerationJob(jobId, actualUserId, reason);

      logger.info('Generation job cancelled', {
        jobId,
        userId: actualUserId,
        reason,
        creditsReleased: result.creditsReleased
      });

      res.json({
        success: true,
        message: result.message,
        jobId: result.jobId,
        status: result.status,
        creditsReleased: result.creditsReleased
      });

    } catch (error) {
      if (error.name === 'GenerationError') {
        const statusCode = error.code === 'JOB_NOT_FOUND' ? 404 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.code === 'JOB_NOT_FOUND' ? 'Job not found' : error.code,
          message: error.message,
          details: error.details
        });
      }

      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error cancelling generation job:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to cancel generation job'
      });
    }
  }

  /**
   * Retry a failed generation job
   * POST /api/posters/:jobId/retry
   */
  async retryGenerationJob(req, res) {
    try {
      const userId = req.user.id;
      const { jobId } = req.params;

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const result = await this.generationService.retryGenerationJob(jobId, actualUserId);

      logger.info('Generation job retried', {
        jobId,
        userId: actualUserId,
        status: result.status
      });

      res.json({
        success: true,
        message: result.message,
        jobId: result.jobId,
        status: result.status,
        prompt: result.prompt,
        externalJobId: result.externalJobId
      });

    } catch (error) {
      if (error.name === 'GenerationError') {
        const statusCode = error.code === 'JOB_NOT_FOUND' ? 404 :
          error.code === 'INSUFFICIENT_CREDITS' ? 402 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.code,
          message: error.message,
          details: error.details
        });
      }

      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error retrying generation job:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retry generation job'
      });
    }
  }

  /**
   * Get poster sharing options for social platforms
   * GET /api/posters/:jobId/share
   */
  async getPosterSharingOptions(req, res) {
    try {
      const userId = req.user.id;
      const { jobId } = req.params;
      const { platform } = req.query; // Optional: filter for specific platform

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const job = await this.generationService.getGenerationJobForUser(jobId, actualUserId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          message: 'Generation job not found or access denied'
        });
      }

      if (job.status !== 'completed' || !job.result?.imageUrl) {
        return res.status(400).json({
          success: false,
          error: 'Job not completed',
          message: 'Poster generation is not completed yet'
        });
      }

      // Generate sharing URLs for different platforms
      const baseUrl = process.env.FRONTEND_URL || 'https://jomobit.com';
      const posterUrl = job.result.imageUrl;
      const businessName = job.profileId?.name || 'My Business';
      const shareText = `Check out my AI-generated poster for ${businessName} created with Jomobit!`;
      const hashtags = '#Jomobit #AIGenerated #Poster #Marketing';

      const allSharingOptions = {
        instagram: {
          platform: 'Instagram',
          type: 'download',
          url: posterUrl,
          downloadUrl: `${baseUrl}/api/posters/${jobId}/download?quality=high`,
          instructions: 'Download the high-quality image and share it on Instagram',
          recommendedText: `${shareText} ${hashtags}`,
          aspectRatio: job.templateId?.aspectRatio ?
            { width: job.templateId.aspectRatio.width, height: job.templateId.aspectRatio.height } :
            { width: 1080, height: 1080 }
        },
        whatsapp: {
          platform: 'WhatsApp',
          type: 'share_url',
          url: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${posterUrl}`)}`,
          text: shareText,
          imageUrl: posterUrl,
          instructions: 'Click to share via WhatsApp'
        },
        facebook: {
          platform: 'Facebook',
          type: 'share_url',
          url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(posterUrl)}&quote=${encodeURIComponent(shareText)}`,
          text: shareText,
          imageUrl: posterUrl,
          instructions: 'Click to share on Facebook'
        },
        twitter: {
          platform: 'Twitter',
          type: 'share_url',
          url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${hashtags}`)}&url=${encodeURIComponent(posterUrl)}`,
          text: `${shareText} ${hashtags}`,
          imageUrl: posterUrl,
          instructions: 'Click to share on Twitter'
        },
        linkedin: {
          platform: 'LinkedIn',
          type: 'share_url',
          url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(posterUrl)}&summary=${encodeURIComponent(shareText)}`,
          text: shareText,
          imageUrl: posterUrl,
          instructions: 'Click to share on LinkedIn'
        },
        direct: {
          platform: 'Direct Link',
          type: 'direct',
          url: posterUrl,
          downloadUrl: `${baseUrl}/api/posters/${jobId}/download`,
          thumbnailUrl: job.result.thumbnailUrl || posterUrl,
          instructions: 'Copy link or download image directly'
        }
      };

      // Filter by platform if specified
      const sharingOptions = platform && allSharingOptions[platform]
        ? { [platform]: allSharingOptions[platform] }
        : allSharingOptions;

      // Log sharing activity
      logger.info('Poster sharing options requested', {
        jobId,
        userId: actualUserId,
        platform: platform || 'all',
        businessProfile: job.profileId?.name
      });

      res.json({
        success: true,
        jobId,
        posterUrl,
        businessProfile: {
          id: job.profileId._id,
          name: job.profileId.name
        },
        template: {
          id: job.templateId._id,
          name: job.templateId.name,
          aspectRatio: job.templateId.aspectRatio
        },
        sharingOptions,
        supportedPlatforms: ['instagram', 'whatsapp', 'facebook', 'twitter', 'linkedin', 'direct']
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error fetching poster sharing options:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch sharing options'
      });
    }
  }

  /**
   * Download poster with ImageKit CDN integration
   * GET /api/posters/:jobId/download
   */
  async downloadPoster(req, res) {
    try {
      const userId = req.user.id;
      const { jobId } = req.params;
      const { quality = 'high', format = 'png' } = req.query;

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const job = await this.generationService.getGenerationJobForUser(jobId, actualUserId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          message: 'Generation job not found or access denied'
        });
      }

      if (job.status !== 'completed' || !job.result?.imageUrl) {
        return res.status(400).json({
          success: false,
          error: 'Job not completed',
          message: 'Poster generation is not completed yet'
        });
      }

      // Generate ImageKit CDN URL with transformations based on quality
      const baseImageUrl = job.result.imageUrl;
      let downloadUrl = baseImageUrl;

      // Apply ImageKit transformations for different quality levels
      if (baseImageUrl.includes('imagekit.io')) {
        const transformations = this.getImageKitTransformations(quality, format);
        downloadUrl = baseImageUrl.replace('/tr:', `/tr:${transformations},`);
      }

      // Generate appropriate filename
      const businessName = job.profileId?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'poster';
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `jomobit_${businessName}_${timestamp}_${jobId.slice(-8)}.${format}`;

      // Log download activity
      logger.info('Poster download requested', {
        jobId,
        userId: actualUserId,
        quality,
        format,
        filename,
        businessProfile: job.profileId?.name
      });

      res.json({
        success: true,
        downloadUrl,
        filename,
        quality,
        format,
        fileSize: this.estimateFileSize(job.templateId?.aspectRatio, quality),
        metadata: {
          businessProfile: job.profileId?.name,
          templateName: job.templateId?.name,
          createdAt: job.createdAt,
          aspectRatio: job.templateId?.aspectRatio ?
            { width: job.templateId.aspectRatio.width, height: job.templateId.aspectRatio.height } :
            { width: 1080, height: 1080 }
        },
        message: 'Download URL generated successfully'
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error downloading poster:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to download poster'
      });
    }
  }

  /**
   * Get poster metadata and generation details
   * GET /api/posters/:jobId/metadata
   */
  async getPosterMetadata(req, res) {
    try {
      const userId = req.user.id;
      const { jobId } = req.params;

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const job = await this.generationService.getGenerationJobForUser(jobId, actualUserId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          message: 'Generation job not found or access denied'
        });
      }

      // Build comprehensive metadata response
      const metadata = {
        job: {
          id: job._id,
          status: job.status,
          priority: job.priority,
          creditsReserved: job.creditsReserved,
          retryCount: job.retryCount
        },
        businessProfile: {
          id: job.profileId._id,
          name: job.profileId.name,
          tagline: job.profileId.tagline,
          colorPalette: job.profileId.colorPalette,
          typography: job.profileId.typography
        },
        template: {
          id: job.templateId._id,
          name: job.templateId.name,
          aspectRatio: job.templateId.aspectRatio,
          type: job.templateId.type,
          tags: job.templateId.tags
        },
        aiProvider: {
          llm: job.aiProvider.llm,
          diffusion: job.aiProvider.diffusion
        },
        generation: {
          prompt: job.prompt?.generated,
          promptParameters: job.prompt?.parameters,
          promptGeneratedAt: job.prompt?.generatedAt
        },
        timing: {
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          totalDuration: job.getProcessingDuration(),
          promptGenerationTime: job.timing?.promptGenerationTime,
          imageGenerationTime: job.timing?.imageGenerationTime
        },
        result: job.status === 'completed' ? {
          imageUrl: job.result.imageUrl,
          thumbnailUrl: job.result.thumbnailUrl,
          imagekitFileId: job.result.imagekitFileId,
          metadata: job.result.metadata
        } : null,
        error: job.status === 'failed' && job.error ? {
          message: job.error.message,
          code: job.error.code,
          provider: job.error.provider,
          occurredAt: job.error.occurredAt
        } : null
      };

      logger.info('Poster metadata requested', {
        jobId,
        userId: actualUserId,
        status: job.status,
        businessProfile: job.profileId?.name
      });

      res.json({
        success: true,
        jobId,
        metadata
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error fetching poster metadata:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch poster metadata'
      });
    }
  }

  /**
   * Helper method to get ImageKit transformations based on quality
   * @private
   */
  getImageKitTransformations(quality, format) {
    const transformations = [];

    // Quality settings
    switch (quality) {
      case 'low':
        transformations.push('q-60');
        break;
      case 'medium':
        transformations.push('q-80');
        break;
      case 'high':
      default:
        transformations.push('q-90');
        break;
    }

    // Format
    if (format && format !== 'png') {
      transformations.push(`f-${format}`);
    }

    return transformations.join(',');
  }

  /**
   * Helper method to estimate file size based on dimensions and quality
   * @private
   */
  estimateFileSize(aspectRatio, quality) {
    if (!aspectRatio) return 'Unknown';

    const { width, height } = aspectRatio;
    const pixels = width * height;

    // Rough estimation based on quality
    let bytesPerPixel;
    switch (quality) {
      case 'low':
        bytesPerPixel = 1.5;
        break;
      case 'medium':
        bytesPerPixel = 2.5;
        break;
      case 'high':
      default:
        bytesPerPixel = 4;
        break;
    }

    const estimatedBytes = pixels * bytesPerPixel;

    // Convert to human readable format
    if (estimatedBytes < 1024 * 1024) {
      return `${Math.round(estimatedBytes / 1024)}KB`;
    } else {
      return `${Math.round(estimatedBytes / (1024 * 1024) * 10) / 10}MB`;
    }
  }

  /**
   * Get generation statistics for user
   * GET /api/posters/stats
   */
  async getUserGenerationStats(req, res) {
    try {
      const userId = req.user.id;
      const { startDate, endDate, profileId } = req.query;

      // Get user by Auth0 ID first
      const UserService = require('../services/userService');
      const userService = new UserService();
      const userResult = await userService.getUserByAuth0Id(userId);
      const actualUserId = userResult.user._id;

      const filters = {
        userId: actualUserId,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(profileId && { profileId })
      };

      const result = await this.generationService.getGenerationStats(filters);

      res.json({
        success: true,
        stats: result.stats,
        filters
      });

    } catch (error) {
      if (error.name === 'UserNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found in database'
        });
      }

      logger.error('Error fetching user generation statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch generation statistics'
      });
    }
  }

  // Admin endpoints

  /**
   * Get all generation jobs (Admin only)
   * GET /api/posters/admin
   */
  async getAdminGenerationJobs(req, res) {
    try {
      const {
        userId,
        profileId,
        templateId,
        status,
        aiProvider,
        startDate,
        endDate,
        page = 1,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filters = {
        ...(userId && { userId }),
        ...(profileId && { profileId }),
        ...(templateId && { templateId }),
        ...(status && { status }),
        ...(aiProvider && { aiProvider }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) })
      };

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
        includePopulated: true // Include user, profile, template data
      };

      const result = await this.generationService.getUserGenerationHistory(null, { ...options, ...filters });

      res.json({
        success: true,
        jobs: result.jobs,
        pagination: result.pagination,
        filters
      });

    } catch (error) {
      logger.error('Error fetching admin generation jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch generation jobs'
      });
    }
  }

  /**
   * Get generation statistics (Admin only)
   * GET /api/posters/admin/stats
   */
  async getAdminGenerationStats(req, res) {
    try {
      const { startDate, endDate, userId, profileId, templateId } = req.query;

      const filters = {
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(userId && { userId }),
        ...(profileId && { profileId }),
        ...(templateId && { templateId })
      };

      const result = await this.generationService.getGenerationStats(filters);

      res.json({
        success: true,
        stats: result.stats,
        filters
      });

    } catch (error) {
      logger.error('Error fetching admin generation statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch generation statistics'
      });
    }
  }
}

const posterController = new PosterController();
module.exports = posterController;