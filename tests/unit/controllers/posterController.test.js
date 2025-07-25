const request = require('supertest');
const express = require('express');
const posterController = require('../../../src/controllers/posterController');
const { GenerationService } = require('../../../src/services/generationService');
const UserService = require('../../../src/services/userService');

// Mock dependencies
jest.mock('../../../src/services/generationService');
jest.mock('../../../src/services/userService', () => {
  return jest.fn().mockImplementation(() => ({
    getUserByAuth0Id: jest.fn()
  }));
});
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('PosterController', () => {
  let app;
  let mockGenerationService;
  let mockUserService;

  beforeEach(() => {
    // Setup Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock user middleware
    app.use((req, res, next) => {
      req.user = { id: 'auth0|test-user-id' };
      next();
    });

    // Setup routes
    app.get('/posters/history', posterController.getGenerationHistory);
    app.get('/posters/:jobId', posterController.getGenerationJob);
    app.get('/posters/:jobId/metadata', posterController.getPosterMetadata);
    app.get('/posters/:jobId/share', posterController.getPosterSharingOptions);
    app.get('/posters/:jobId/download', posterController.downloadPoster);
    app.post('/posters/:jobId/cancel', posterController.cancelGenerationJob);

    // Setup mocks
    mockGenerationService = {
      getUserGenerationHistory: jest.fn(),
      getGenerationJobForUser: jest.fn(),
      cancelGenerationJob: jest.fn()
    };

    mockUserService = {
      getUserByAuth0Id: jest.fn()
    };

    GenerationService.mockImplementation(() => mockGenerationService);
    UserService.mockImplementation(() => mockUserService);

    // Default user service mock
    mockUserService.getUserByAuth0Id.mockResolvedValue({
      user: { _id: 'user-object-id' }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getGenerationHistory', () => {
    it('should return user generation history with pagination', async () => {
      const mockHistory = {
        jobs: [
          {
            _id: 'job1',
            status: 'completed',
            profileId: { name: 'Test Business' },
            templateId: { name: 'Template 1' },
            createdAt: new Date()
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
          hasNext: false,
          hasPrev: false
        }
      };

      mockGenerationService.getUserGenerationHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/posters/history')
        .query({ page: 1, limit: 20 });

      console.log('Response status:', response.status);
      console.log('Response body:', response.body);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.history).toEqual(mockHistory.jobs);
      expect(response.body.pagination).toEqual(mockHistory.pagination);
      expect(mockGenerationService.getUserGenerationHistory).toHaveBeenCalledWith(
        'user-object-id',
        expect.objectContaining({
          page: 1,
          limit: 20
        })
      );
    });

    it('should filter history by profile ID', async () => {
      const profileId = 'profile-123';
      const mockHistory = {
        jobs: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0, hasNext: false, hasPrev: false }
      };

      mockGenerationService.getUserGenerationHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/posters/history')
        .query({ profileId });

      expect(response.status).toBe(200);
      expect(mockGenerationService.getUserGenerationHistory).toHaveBeenCalledWith(
        'user-object-id',
        expect.objectContaining({
          profileId
        })
      );
    });

    it('should handle user not found error', async () => {
      const error = new Error('User not found');
      error.name = 'UserNotFoundError';
      mockUserService.getUserByAuth0Id.mockRejectedValue(error);

      const response = await request(app).get('/posters/history');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('getGenerationJob', () => {
    const mockJob = {
      _id: 'job-123',
      status: 'completed',
      profileId: { _id: 'profile-123', name: 'Test Business' },
      templateId: { _id: 'template-123', name: 'Template 1', aspectRatio: { width: 1080, height: 1080 } },
      aiProvider: { llm: 'openai', diffusion: 'openai' },
      timing: { totalProcessingTime: 5000 },
      createdAt: new Date(),
      getProcessingDuration: jest.fn(() => 5000),
      toObject: jest.fn(() => ({ _id: 'job-123', status: 'completed' }))
    };

    it('should return job details with user ownership validation', async () => {
      mockGenerationService.getGenerationJobForUser.mockResolvedValue(mockJob);

      const response = await request(app).get('/posters/job-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.job).toBeDefined();
      expect(mockGenerationService.getGenerationJobForUser).toHaveBeenCalledWith(
        'job-123',
        'user-object-id'
      );
    });

    it('should return job with metadata when requested', async () => {
      mockGenerationService.getGenerationJobForUser.mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/posters/job-123')
        .query({ includeMetadata: 'true' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.generationDetails).toBeDefined();
      expect(response.body.metadata.businessProfile).toBeDefined();
      expect(response.body.metadata.template).toBeDefined();
      expect(response.body.metadata.processing).toBeDefined();
    });

    it('should return 404 when job not found or access denied', async () => {
      mockGenerationService.getGenerationJobForUser.mockResolvedValue(null);

      const response = await request(app).get('/posters/job-123');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('getPosterMetadata', () => {
    const mockJob = {
      _id: 'job-123',
      status: 'completed',
      priority: 'normal',
      creditsReserved: 1,
      retryCount: 0,
      profileId: {
        _id: 'profile-123',
        name: 'Test Business',
        tagline: 'Test Tagline',
        colorPalette: [{ name: 'primary', hex: '#000000' }],
        typography: { primary: 'Arial', secondary: 'Helvetica' }
      },
      templateId: {
        _id: 'template-123',
        name: 'Template 1',
        aspectRatio: { width: 1080, height: 1080 },
        type: 'social',
        tags: ['business', 'modern']
      },
      aiProvider: { llm: 'openai', diffusion: 'openai' },
      prompt: {
        generated: 'Test prompt',
        parameters: { style: 'modern' },
        generatedAt: new Date()
      },
      timing: {
        promptGenerationTime: 1000,
        imageGenerationTime: 4000
      },
      result: {
        imageUrl: 'https://example.com/image.png',
        thumbnailUrl: 'https://example.com/thumb.png',
        imagekitFileId: 'file-123',
        metadata: { quality: 'high' }
      },
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
      getProcessingDuration: jest.fn(() => 5000)
    };

    it('should return comprehensive poster metadata', async () => {
      mockGenerationService.getGenerationJobForUser.mockResolvedValue(mockJob);

      const response = await request(app).get('/posters/job-123/metadata');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.job).toEqual({
        id: 'job-123',
        status: 'completed',
        priority: 'normal',
        creditsReserved: 1,
        retryCount: 0
      });
      expect(response.body.metadata.businessProfile).toBeDefined();
      expect(response.body.metadata.template).toBeDefined();
      expect(response.body.metadata.aiProvider).toBeDefined();
      expect(response.body.metadata.generation).toBeDefined();
      expect(response.body.metadata.timing).toBeDefined();
      expect(response.body.metadata.result).toBeDefined();
    });

    it('should include error details for failed jobs', async () => {
      const failedJob = {
        ...mockJob,
        status: 'failed',
        error: {
          message: 'Generation failed',
          code: 'GENERATION_FAILED',
          provider: 'openai',
          occurredAt: new Date()
        }
      };

      mockGenerationService.getGenerationJobForUser.mockResolvedValue(failedJob);

      const response = await request(app).get('/posters/job-123/metadata');

      expect(response.status).toBe(200);
      expect(response.body.metadata.error).toBeDefined();
      expect(response.body.metadata.error.message).toBe('Generation failed');
      expect(response.body.metadata.error.code).toBe('GENERATION_FAILED');
    });
  });

  describe('getPosterSharingOptions', () => {
    const mockJob = {
      _id: 'job-123',
      status: 'completed',
      profileId: { _id: 'profile-123', name: 'Test Business' },
      templateId: { _id: 'template-123', name: 'Template 1', aspectRatio: { width: 1080, height: 1080 } },
      result: {
        imageUrl: 'https://example.com/image.png',
        thumbnailUrl: 'https://example.com/thumb.png'
      }
    };

    it('should return sharing options for all platforms', async () => {
      mockGenerationService.getGenerationJobForUser.mockResolvedValue(mockJob);

      const response = await request(app).get('/posters/job-123/share');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sharingOptions).toBeDefined();
      expect(response.body.sharingOptions.instagram).toBeDefined();
      expect(response.body.sharingOptions.whatsapp).toBeDefined();
      expect(response.body.sharingOptions.facebook).toBeDefined();
      expect(response.body.sharingOptions.twitter).toBeDefined();
      expect(response.body.sharingOptions.linkedin).toBeDefined();
      expect(response.body.sharingOptions.direct).toBeDefined();
      expect(response.body.supportedPlatforms).toEqual([
        'instagram', 'whatsapp', 'facebook', 'twitter', 'linkedin', 'direct'
      ]);
    });

    it('should filter sharing options by platform', async () => {
      mockGenerationService.getGenerationJobForUser.mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/posters/job-123/share')
        .query({ platform: 'instagram' });

      expect(response.status).toBe(200);
      expect(response.body.sharingOptions.instagram).toBeDefined();
      expect(response.body.sharingOptions.whatsapp).toBeUndefined();
    });

    it('should return 400 for incomplete jobs', async () => {
      const incompleteJob = {
        ...mockJob,
        status: 'pending',
        result: null
      };

      mockGenerationService.getGenerationJobForUser.mockResolvedValue(incompleteJob);

      const response = await request(app).get('/posters/job-123/share');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not completed');
    });
  });

  describe('downloadPoster', () => {
    const mockJob = {
      _id: 'job-123',
      status: 'completed',
      profileId: { _id: 'profile-123', name: 'Test Business' },
      templateId: { 
        _id: 'template-123', 
        name: 'Template 1', 
        aspectRatio: { width: 1080, height: 1080 } 
      },
      result: {
        imageUrl: 'https://ik.imagekit.io/jomobit/image.png',
        thumbnailUrl: 'https://ik.imagekit.io/jomobit/thumb.png'
      },
      createdAt: new Date()
    };

    it('should return download URL with ImageKit CDN integration', async () => {
      mockGenerationService.getGenerationJobForUser.mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/posters/job-123/download')
        .query({ quality: 'high', format: 'png' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.downloadUrl).toBeDefined();
      expect(response.body.filename).toContain('jomobit_Test_Business');
      expect(response.body.quality).toBe('high');
      expect(response.body.format).toBe('png');
      expect(response.body.fileSize).toBeDefined();
      expect(response.body.metadata).toBeDefined();
    });

    it('should handle different quality levels', async () => {
      mockGenerationService.getGenerationJobForUser.mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/posters/job-123/download')
        .query({ quality: 'low' });

      expect(response.status).toBe(200);
      expect(response.body.quality).toBe('low');
    });

    it('should return 400 for incomplete jobs', async () => {
      const incompleteJob = {
        ...mockJob,
        status: 'processing',
        result: null
      };

      mockGenerationService.getGenerationJobForUser.mockResolvedValue(incompleteJob);

      const response = await request(app).get('/posters/job-123/download');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not completed');
    });
  });

  describe('cancelGenerationJob', () => {
    it('should cancel job and release credits', async () => {
      const mockResult = {
        success: true,
        jobId: 'job-123',
        status: 'cancelled',
        creditsReleased: 1,
        message: 'Job cancelled successfully'
      };

      mockGenerationService.cancelGenerationJob.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/posters/job-123/cancel')
        .send({ reason: 'User cancelled' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('cancelled');
      expect(response.body.creditsReleased).toBe(1);
      expect(mockGenerationService.cancelGenerationJob).toHaveBeenCalledWith(
        'job-123',
        'user-object-id',
        'User cancelled'
      );
    });

    it('should handle job not found error', async () => {
      const error = new Error('Job not found or access denied');
      error.name = 'GenerationError';
      error.code = 'JOB_NOT_FOUND';
      mockGenerationService.cancelGenerationJob.mockRejectedValue(error);

      const response = await request(app).post('/posters/job-123/cancel');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('JOB_NOT_FOUND');
    });
  });

  describe('Helper Methods', () => {
    describe('getImageKitTransformations', () => {
      it('should generate correct transformations for different quality levels', () => {
        const controller = posterController;
        
        expect(controller.getImageKitTransformations('low', 'png')).toBe('q-60');
        expect(controller.getImageKitTransformations('medium', 'jpg')).toBe('q-80,f-jpg');
        expect(controller.getImageKitTransformations('high', 'png')).toBe('q-90');
      });
    });

    describe('estimateFileSize', () => {
      it('should estimate file size based on dimensions and quality', () => {
        const controller = posterController;
        const aspectRatio = { width: 1080, height: 1080 };
        
        const lowSize = controller.estimateFileSize(aspectRatio, 'low');
        const highSize = controller.estimateFileSize(aspectRatio, 'high');
        
        expect(lowSize).toMatch(/\d+(\.\d+)?MB/);
        expect(highSize).toMatch(/\d+(\.\d+)?MB/);
        
        // High quality should be larger than low quality
        const lowValue = parseFloat(lowSize);
        const highValue = parseFloat(highSize);
        expect(highValue).toBeGreaterThan(lowValue);
      });

      it('should return Unknown for missing aspect ratio', () => {
        const controller = posterController;
        expect(controller.estimateFileSize(null, 'high')).toBe('Unknown');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      mockGenerationService.getUserGenerationHistory.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app).get('/posters/history');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle user service errors', async () => {
      mockUserService.getUserByAuth0Id.mockRejectedValue(
        new Error('Auth0 service unavailable')
      );

      const response = await request(app).get('/posters/history');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});