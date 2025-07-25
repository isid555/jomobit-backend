const { GenerationService, GenerationError } = require('../../../src/services/generationService');
const GenerationJob = require('../../../src/models/GenerationJob');
const BusinessProfile = require('../../../src/models/BusinessProfile');
const Template = require('../../../src/models/Template');
const { CreditService } = require('../../../src/services/creditService');

// Mock dependencies
jest.mock('../../../src/models/GenerationJob');
jest.mock('../../../src/models/BusinessProfile');
jest.mock('../../../src/models/Template');
jest.mock('../../../src/services/creditService');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('GenerationService - Poster History and Sharing', () => {
  let generationService;
  let mockCreditService;

  beforeEach(() => {
    mockCreditService = {
      reserveCredits: jest.fn(),
      deductReservedCredits: jest.fn(),
      releaseReservedCredits: jest.fn()
    };

    CreditService.mockImplementation(() => mockCreditService);
    generationService = new GenerationService();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getUserGenerationHistory', () => {
    it('should retrieve user generation history with pagination', async () => {
      const userId = 'user-123';
      const options = {
        page: 1,
        limit: 20,
        profileId: 'profile-123',
        status: 'completed'
      };

      const mockHistory = {
        jobs: [
          {
            _id: 'job-1',
            status: 'completed',
            profileId: { name: 'Business 1' },
            templateId: { name: 'Template 1' },
            createdAt: new Date()
          },
          {
            _id: 'job-2',
            status: 'completed',
            profileId: { name: 'Business 1' },
            templateId: { name: 'Template 2' },
            createdAt: new Date()
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1,
          hasNext: false,
          hasPrev: false
        }
      };

      GenerationJob.getUserGenerationHistory.mockResolvedValue(mockHistory);

      const result = await generationService.getUserGenerationHistory(userId, options);

      expect(result).toEqual(mockHistory);
      expect(GenerationJob.getUserGenerationHistory).toHaveBeenCalledWith(userId, options);
    });

    it('should handle empty history', async () => {
      const userId = 'user-123';
      const mockEmptyHistory = {
        jobs: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false
        }
      };

      GenerationJob.getUserGenerationHistory.mockResolvedValue(mockEmptyHistory);

      const result = await generationService.getUserGenerationHistory(userId);

      expect(result.jobs).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should filter history by business profile', async () => {
      const userId = 'user-123';
      const profileId = 'profile-123';
      const options = { profileId };

      GenerationJob.getUserGenerationHistory.mockResolvedValue({
        jobs: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0, hasNext: false, hasPrev: false }
      });

      await generationService.getUserGenerationHistory(userId, options);

      expect(GenerationJob.getUserGenerationHistory).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ profileId })
      );
    });

    it('should filter history by status', async () => {
      const userId = 'user-123';
      const status = 'completed';
      const options = { status };

      GenerationJob.getUserGenerationHistory.mockResolvedValue({
        jobs: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0, hasNext: false, hasPrev: false }
      });

      await generationService.getUserGenerationHistory(userId, options);

      expect(GenerationJob.getUserGenerationHistory).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ status })
      );
    });
  });

  describe('getGenerationJobForUser', () => {
    it('should retrieve job with user ownership validation', async () => {
      const jobId = 'job-123';
      const userId = 'user-123';

      const mockJob = {
        _id: jobId,
        userId,
        status: 'completed',
        profileId: { name: 'Test Business' },
        templateId: { name: 'Template 1' },
        result: { imageUrl: 'https://example.com/image.png' }
      };

      GenerationJob.getJobByIdForUser.mockResolvedValue(mockJob);

      const result = await generationService.getGenerationJobForUser(jobId, userId);

      expect(result).toEqual(mockJob);
      expect(GenerationJob.getJobByIdForUser).toHaveBeenCalledWith(jobId, userId);
    });

    it('should return null for non-existent job', async () => {
      const jobId = 'non-existent-job';
      const userId = 'user-123';

      GenerationJob.getJobByIdForUser.mockResolvedValue(null);

      const result = await generationService.getGenerationJobForUser(jobId, userId);

      expect(result).toBeNull();
    });

    it('should return null for job owned by different user', async () => {
      const jobId = 'job-123';
      const userId = 'user-123';

      // Job exists but belongs to different user
      GenerationJob.getJobByIdForUser.mockResolvedValue(null);

      const result = await generationService.getGenerationJobForUser(jobId, userId);

      expect(result).toBeNull();
    });
  });

  describe('cancelGenerationJob', () => {
    it('should cancel pending job and release credits', async () => {
      const jobId = 'job-123';
      const userId = 'user-123';
      const reason = 'User cancelled';

      const mockJob = {
        _id: jobId,
        userId,
        status: 'pending',
        creditsReserved: 1,
        isFinal: jest.fn(() => false),
        cancel: jest.fn().mockResolvedValue(),
        save: jest.fn().mockResolvedValue()
      };

      GenerationJob.getJobByIdForUser.mockResolvedValue(mockJob);
      mockCreditService.releaseReservedCredits.mockResolvedValue({
        success: true,
        creditsReleased: 1
      });

      const result = await generationService.cancelGenerationJob(jobId, userId, reason);

      expect(result.success).toBe(true);
      expect(result.status).toBe('cancelled');
      expect(result.creditsReleased).toBe(1);
      expect(mockJob.cancel).toHaveBeenCalledWith(reason);
      expect(mockCreditService.releaseReservedCredits).toHaveBeenCalledWith(
        jobId,
        userId,
        1,
        expect.objectContaining({
          cancelledAt: expect.any(Date),
          reason
        })
      );
    });

    it('should throw error for non-existent job', async () => {
      const jobId = 'non-existent-job';
      const userId = 'user-123';

      GenerationJob.getJobByIdForUser.mockResolvedValue(null);

      await expect(
        generationService.cancelGenerationJob(jobId, userId)
      ).rejects.toThrow(GenerationError);

      await expect(
        generationService.cancelGenerationJob(jobId, userId)
      ).rejects.toThrow('Job not found or access denied');
    });

    it('should throw error for completed job', async () => {
      const jobId = 'job-123';
      const userId = 'user-123';

      const mockJob = {
        _id: jobId,
        userId,
        status: 'completed',
        isFinal: jest.fn(() => true)
      };

      GenerationJob.getJobByIdForUser.mockResolvedValue(mockJob);

      await expect(
        generationService.cancelGenerationJob(jobId, userId)
      ).rejects.toThrow(GenerationError);

      await expect(
        generationService.cancelGenerationJob(jobId, userId)
      ).rejects.toThrow('Cannot cancel job in completed status');
    });
  });

  describe('getGenerationStats', () => {
    it('should retrieve generation statistics', async () => {
      const filters = {
        userId: 'user-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const mockStats = {
        totalJobs: 10,
        completedJobs: 8,
        failedJobs: 1,
        pendingJobs: 1,
        processingJobs: 0,
        totalCreditsUsed: 10,
        avgProcessingTime: 5000,
        successRate: 80
      };

      GenerationJob.getJobStats.mockResolvedValue(mockStats);

      const result = await generationService.getGenerationStats(filters);

      expect(result).toEqual(mockStats);
      expect(GenerationJob.getJobStats).toHaveBeenCalledWith(filters);
    });

    it('should handle empty statistics', async () => {
      const mockEmptyStats = {
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        pendingJobs: 0,
        processingJobs: 0,
        totalCreditsUsed: 0,
        avgProcessingTime: 0,
        successRate: 0
      };

      GenerationJob.getJobStats.mockResolvedValue(mockEmptyStats);

      const result = await generationService.getGenerationStats();

      expect(result.totalJobs).toBe(0);
      expect(result.successRate).toBe(0);
    });
  });

  describe('processGeneratedImage', () => {
    it('should process generated image for ImageKit storage', async () => {
      const result = { imageUrl: 'https://ai-service.com/image.png' };
      const mockJob = {
        _id: 'job-123',
        userId: 'user-123',
        profileId: 'profile-123',
        templateId: 'template-123'
      };

      const processedResult = await generationService.processGeneratedImage(result, mockJob);

      expect(processedResult).toEqual({
        url: result.imageUrl,
        fileId: expect.stringContaining('job_job-123_'),
        thumbnailUrl: result.imageUrl,
        metadata: {
          originalUrl: result.imageUrl,
          jobId: mockJob._id,
          userId: mockJob.userId,
          profileId: mockJob.profileId,
          templateId: mockJob.templateId,
          uploadedAt: expect.any(Date)
        }
      });
    });

    it('should handle image processing errors', async () => {
      const result = null; // Invalid result
      const mockJob = { _id: 'job-123' };

      await expect(
        generationService.processGeneratedImage(result, mockJob)
      ).rejects.toThrow(GenerationError);
    });
  });

  describe('prepareImageParameters', () => {
    it('should prepare image parameters based on template', () => {
      const mockTemplate = {
        aspectRatio: { width: 1080, height: 1080 },
        type: 'social',
        metadata: {
          aiParameters: {
            style: 'vibrant',
            enhancement: true
          }
        }
      };

      const parameters = generationService.prepareImageParameters(mockTemplate);

      expect(parameters).toEqual({
        size: '1080x1080',
        quality: 'high',
        style: 'vibrant',
        format: 'png',
        enhancement: true
      });
    });

    it('should handle template without metadata', () => {
      const mockTemplate = {
        aspectRatio: { width: 1920, height: 1080 },
        type: 'banner'
      };

      const parameters = generationService.prepareImageParameters(mockTemplate);

      expect(parameters).toEqual({
        size: '1920x1080',
        quality: 'high',
        style: 'professional',
        format: 'png'
      });
    });
  });

  describe('validateGenerationRequest', () => {
    it('should validate successful generation request', async () => {
      const userId = 'user-123';
      const profileId = 'profile-123';
      const templateId = 'template-123';
      const aiProvider = { llm: 'openai', diffusion: 'openai' };

      const mockProfile = {
        _id: profileId,
        validateCompleteness: jest.fn(() => ({ isComplete: true, missing: [] }))
      };

      const mockTemplate = {
        _id: templateId,
        name: 'Test Template'
      };

      BusinessProfile.getProfileByIdForUser.mockResolvedValue(mockProfile);
      Template.getTemplateById.mockResolvedValue(mockTemplate);

      // Mock provider factory
      const mockProviderFactory = {
        getAvailableLLMProviders: jest.fn(() => ['openai', 'gemini']),
        getAvailableDiffusionProviders: jest.fn(() => ['openai', 'ideogram'])
      };

      generationService.constructor.prototype.constructor = jest.fn();
      const originalProviderFactory = require('../../../src/services/aiProviders/providerFactory');
      jest.doMock('../../../src/services/aiProviders/providerFactory', () => ({
        providerFactory: mockProviderFactory
      }));

      await expect(
        generationService.validateGenerationRequest(userId, profileId, templateId, aiProvider)
      ).resolves.not.toThrow();
    });

    it('should throw error for non-existent profile', async () => {
      const userId = 'user-123';
      const profileId = 'non-existent-profile';
      const templateId = 'template-123';
      const aiProvider = { llm: 'openai', diffusion: 'openai' };

      BusinessProfile.getProfileByIdForUser.mockResolvedValue(null);

      await expect(
        generationService.validateGenerationRequest(userId, profileId, templateId, aiProvider)
      ).rejects.toThrow('Business profile not found or access denied');
    });

    it('should throw error for non-existent template', async () => {
      const userId = 'user-123';
      const profileId = 'profile-123';
      const templateId = 'non-existent-template';
      const aiProvider = { llm: 'openai', diffusion: 'openai' };

      const mockProfile = {
        validateCompleteness: jest.fn(() => ({ isComplete: true, missing: [] }))
      };

      BusinessProfile.getProfileByIdForUser.mockResolvedValue(mockProfile);
      Template.getTemplateById.mockResolvedValue(null);

      await expect(
        generationService.validateGenerationRequest(userId, profileId, templateId, aiProvider)
      ).rejects.toThrow('Template not found or inactive');
    });

    it('should throw error for incomplete profile', async () => {
      const userId = 'user-123';
      const profileId = 'profile-123';
      const templateId = 'template-123';
      const aiProvider = { llm: 'openai', diffusion: 'openai' };

      const mockProfile = {
        validateCompleteness: jest.fn(() => ({
          isComplete: false,
          missing: ['logo', 'description']
        }))
      };

      const mockTemplate = { _id: templateId };

      BusinessProfile.getProfileByIdForUser.mockResolvedValue(mockProfile);
      Template.getTemplateById.mockResolvedValue(mockTemplate);

      await expect(
        generationService.validateGenerationRequest(userId, profileId, templateId, aiProvider)
      ).rejects.toThrow('Business profile incomplete. Missing: logo, description');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const userId = 'user-123';
      GenerationJob.getUserGenerationHistory.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        generationService.getUserGenerationHistory(userId)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle credit service errors during cancellation', async () => {
      const jobId = 'job-123';
      const userId = 'user-123';

      const mockJob = {
        _id: jobId,
        userId,
        status: 'pending',
        creditsReserved: 1,
        isFinal: jest.fn(() => false),
        cancel: jest.fn().mockResolvedValue(),
        save: jest.fn().mockResolvedValue()
      };

      GenerationJob.getJobByIdForUser.mockResolvedValue(mockJob);
      mockCreditService.releaseReservedCredits.mockRejectedValue(
        new Error('Credit service unavailable')
      );

      await expect(
        generationService.cancelGenerationJob(jobId, userId)
      ).rejects.toThrow('Credit service unavailable');
    });
  });
});