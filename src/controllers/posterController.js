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
        creditsRequired = 1
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
        creditsRequired
      };

      const result = await this.generationService.createGenerationJob(jobData);

      logger.info('Poster generation job created', {
        jobId: result.job.id,
        userId: actualUserId,
        profileId,
        templateId,
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
   * Get poster generation job by ID
   * GET /api/posters/:jobId
   */
  async getGenerationJob(req, res) {
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

      res.json({
        success: true,
        job: job.toObject()
      });

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
      const { reason = 'User cancelled' } = req.body;

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
   * Get poster sharing options
   * GET /api/posters/:jobId/share
   */
  async getPosterSharingOptions(req, res) {
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
      const shareText = `Check out my AI-generated poster created with Jomobit!`;

      const sharingOptions = {
        instagram: {
          url: posterUrl,
          instructions: 'Download the image and share it on Instagram'
        },
        whatsapp: {
          url: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${posterUrl}`)}`,
          text: shareText
        },
        facebook: {
          url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(posterUrl)}`,
          text: shareText
        },
        twitter: {
          url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(posterUrl)}`,
          text: shareText
        },
        linkedin: {
          url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(posterUrl)}`,
          text: shareText
        },
        direct: {
          url: posterUrl,
          downloadUrl: posterUrl // In real implementation, this would be a download endpoint
        }
      };

      res.json({
        success: true,
        jobId,
        posterUrl,
        sharingOptions
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
   * Download poster
   * GET /api/posters/:jobId/download
   */
  async downloadPoster(req, res) {
    try {
      const userId = req.user.id;
      const { jobId } = req.params;
      const { quality = 'high' } = req.query;

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

      // In a real implementation, this would:
      // 1. Get the appropriate quality version from ImageKit
      // 2. Set proper headers for download
      // 3. Stream the file to the client
      
      // For now, redirect to the image URL
      const downloadUrl = job.result.imageUrl;
      
      logger.info('Poster download requested', {
        jobId,
        userId: actualUserId,
        quality,
        imageUrl: downloadUrl
      });

      res.json({
        success: true,
        downloadUrl,
        filename: `jomobit-poster-${jobId}.png`,
        quality,
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

module.exports = new PosterController();