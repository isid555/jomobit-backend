const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { GenerationService, GenerationError, GenerationValidationError } = require('../../../src/services/generationService');
const { CreditService, CreditOperationError } = require('../../../src/services/creditService');
const GenerationJob = require('../../../src/models/GenerationJob');
const BusinessProfile = require('../../../src/models/BusinessProfile');
const Template = require('../../../src/models/Template');
const User = require('../../../src/models/User');
const CreditWallet = require('../../../src/models/CreditWallet');

// Mock AI providers
jest.mock('../../../src/services/aiProviders/providerFactory', () => ({
  providerFactory: {
    createLLMProvider: jest.fn(),
    createDiffusionProvider: jest.fn(),
    getAvailableLLMProviders: jest.fn(() => ['openai', 'gemini']),
    getAvailableDiffusionProviders: jest.fn(() => ['openai', 'ideogram'])
  }
}));

const { providerFactory } = require('../../../src/services/aiProviders/providerFactory');

describe('GenerationService Integration Tests', () => {
  let mongoServer;
  let generationService;
  let creditService;
  let testUser;
  let testProfile;
  let testTemplate;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await BusinessProfile.deleteMany({});
    await Template.deleteMany({});
    await GenerationJob.deleteMany({});
    await CreditWallet.deleteMany({});

    // Initialize services
    creditService = new CreditService({ useTransactions: false });
    generationService = new GenerationService({ 
      creditService,
      imagekitConfig: {
        publicKey: 'test_public_key',
        privateKey: 'test_private_key',
        urlEndpoint: 'https://test.imagekit.io'
      }
    });

    // Create test data
    testUser = await User.create({
      auth0Id: 'test_user_123',
      email: 'test@example.com',
      status: 'active'
    });

    testProfile = await BusinessProfile.create({
      userId: testUser._id,
      name: 'Test Business',
      tagline: 'Test tagline',
      description: 'Test business description',
      products: ['Product 1', 'Product 2'],
      colorPalette: [
        { name: 'Primary', hex: '#FF0000' },
        { name: 'Secondary', hex: '#00FF00' }
      ]
    });

    testTemplate = await Template.create({
      name: 'Test Template',
      description: 'Test template description',
      category: 'business',
      tags: ['test', 'business'],
      images: {
        thumbnail: 'https://test.imagekit.io/thumbnail.jpg',
        preview: 'https://test.imagekit.io/preview.jpg',
        fullSize: 'https://test.imagekit.io/full.jpg'
      },
      aspectRatio: {
        width: 1080,
        height: 1080,
        ratio: '1:1'
      },
      type: 'social',
      status: 'active',
      isPublic: true
    });

    // Grant default credits to user
    await creditService.grantDefaultCredits(testUser._id, 5);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createGenerationJob', () => {
    it('should create generation job and reserve credits successfully', async () => {
      const jobData = {
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: testTemplate._id,
        aiProvider: { llm: 'openai', diffusion: 'openai' },
        creditsRequired: 1
      };

      const result = await generationService.createGenerationJob(jobData);

      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      expect(result.job.status).toBe('pending');
      expect(result.job.creditsReserved).toBe(1);
      expect(result.creditReservation.reserved).toBe(1);
      expect(result.creditReservation.availableAfter).toBe(4); // 5 - 1 reserved

      // Verify job was created in database
      const job = await GenerationJob.findById(result.job.id);
      expect(job).toBeTruthy();
      expect(job.userId.toString()).toBe(testUser._id.toString());
      expect(job.profileId.toString()).toBe(testProfile._id.toString());
      expect(job.templateId.toString()).toBe(testTemplate._id.toString());
    });

    it('should fail when user has insufficient credits', async () => {
      const jobData = {
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: testTemplate._id,
        aiProvider: { llm: 'openai', diffusion: 'openai' },
        creditsRequired: 10 // More than available
      };

      await expect(generationService.createGenerationJob(jobData))
        .rejects.toThrow(GenerationError);

      await expect(generationService.createGenerationJob(jobData))
        .rejects.toThrow('Insufficient credits');
    });

    it('should fail when profile does not exist', async () => {
      const jobData = {
        userId: testUser._id,
        profileId: new mongoose.Types.ObjectId(),
        templateId: testTemplate._id,
        aiProvider: { llm: 'openai', diffusion: 'openai' }
      };

      await expect(generationService.createGenerationJob(jobData))
        .rejects.toThrow(GenerationValidationError);
    });

    it('should fail when template does not exist', async () => {
      const jobData = {
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: new mongoose.Types.ObjectId(),
        aiProvider: { llm: 'openai', diffusion: 'openai' }
      };

      await expect(generationService.createGenerationJob(jobData))
        .rejects.toThrow(GenerationValidationError);
    });

    it('should fail with invalid AI provider', async () => {
      const jobData = {
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: testTemplate._id,
        aiProvider: { llm: 'invalid', diffusion: 'openai' }
      };

      await expect(generationService.createGenerationJob(jobData))
        .rejects.toThrow(GenerationValidationError);
    });
  });

  describe('processGenerationJob', () => {
    let testJob;
    let mockLLMProvider;
    let mockDiffusionProvider;

    beforeEach(async () => {
      // Create a test job
      testJob = await GenerationJob.createJob({
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: testTemplate._id,
        creditsReserved: 1,
        aiProvider: { llm: 'openai', diffusion: 'openai' }
      });

      // Reserve credits
      await creditService.reserveCredits(testUser._id, 1, testJob._id.toString());

      // Mock providers
      mockLLMProvider = {
        generatePrompt: jest.fn().mockResolvedValue('Generated marketing prompt for Test Business')
      };

      mockDiffusionProvider = {
        generateImage: jest.fn().mockResolvedValue({
          jobId: 'external_job_123',
          status: 'processing'
        })
      };

      providerFactory.createLLMProvider.mockReturnValue(mockLLMProvider);
      providerFactory.createDiffusionProvider.mockReturnValue(mockDiffusionProvider);
    });

    it('should process generation job successfully', async () => {
      const result = await generationService.processGenerationJob(testJob._id);

      expect(result.success).toBe(true);
      expect(result.status).toBe('processing');
      expect(result.prompt).toBe('Generated marketing prompt for Test Business');
      expect(result.externalJobId).toBe('external_job_123');

      // Verify providers were called correctly
      expect(mockLLMProvider.generatePrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Business',
          tagline: 'Test tagline'
        }),
        expect.objectContaining({
          name: 'Test Template'
        })
      );

      expect(mockDiffusionProvider.generateImage).toHaveBeenCalledWith(
        'Generated marketing prompt for Test Business',
        expect.objectContaining({
          size: '1080x1080',
          quality: 'high'
        })
      );

      // Verify job was updated
      const updatedJob = await GenerationJob.findById(testJob._id);
      expect(updatedJob.status).toBe('processing');
      expect(updatedJob.prompt.generated).toBe('Generated marketing prompt for Test Business');
      expect(updatedJob.externalJobId).toBe('external_job_123');
    });

    it('should handle prompt generation failure', async () => {
      mockLLMProvider.generatePrompt.mockRejectedValue(new Error('LLM service unavailable'));

      await expect(generationService.processGenerationJob(testJob._id))
        .rejects.toThrow(GenerationError);

      // Verify job was marked as failed and credits released
      const updatedJob = await GenerationJob.findById(testJob._id);
      expect(updatedJob.status).toBe('failed');

      const wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.reservedCredits).toBe(0); // Credits should be released
    });

    it('should handle image generation failure', async () => {
      mockDiffusionProvider.generateImage.mockRejectedValue(new Error('Diffusion service unavailable'));

      await expect(generationService.processGenerationJob(testJob._id))
        .rejects.toThrow(GenerationError);

      // Verify job was marked as failed and credits released
      const updatedJob = await GenerationJob.findById(testJob._id);
      expect(updatedJob.status).toBe('failed');

      const wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.reservedCredits).toBe(0); // Credits should be released
    });

    it('should fail when job is not in pending status', async () => {
      // Create a fresh job and reserve credits for it
      const newJob = await GenerationJob.createJob({
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: testTemplate._id,
        creditsReserved: 1,
        aiProvider: { llm: 'openai', diffusion: 'openai' }
      });
      
      // Reserve credits for this job
      await creditService.reserveCredits(testUser._id, 1, newJob._id.toString());
      
      // Set status to processing
      newJob.status = 'processing';
      await newJob.save();

      await expect(generationService.processGenerationJob(newJob._id))
        .rejects.toThrow(GenerationError);

      await expect(generationService.processGenerationJob(newJob._id))
        .rejects.toThrow(GenerationError);
    });
  });

  describe('processGenerationWebhook', () => {
    let testJob;

    beforeEach(async () => {
      testJob = await GenerationJob.createJob({
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: testTemplate._id,
        creditsReserved: 1,
        aiProvider: { llm: 'openai', diffusion: 'openai' }
      });

      testJob.externalJobId = 'external_job_123';
      testJob.status = 'processing';
      await testJob.save();

      await creditService.reserveCredits(testUser._id, 1, testJob._id.toString());
    });

    it('should handle successful completion webhook', async () => {
      const webhookData = {
        externalJobId: 'external_job_123',
        status: 'completed',
        result: {
          imageUrl: 'https://ai-service.com/generated-image.png',
          metadata: { quality: 'high' }
        }
      };

      const result = await generationService.processGenerationWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.result.imageUrl).toBeDefined();
      expect(result.creditsDeducted).toBe(1);

      // Verify job was completed
      const updatedJob = await GenerationJob.findById(testJob._id);
      expect(updatedJob.status).toBe('completed');
      expect(updatedJob.result.imageUrl).toBeDefined();

      // Verify credits were deducted
      const wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.reservedCredits).toBe(0);
      expect(wallet.defaultCredits).toBe(4); // 5 - 1 deducted
    });

    it('should handle failure webhook', async () => {
      const webhookData = {
        externalJobId: 'external_job_123',
        status: 'failed',
        error: {
          message: 'Content policy violation',
          code: 'CONTENT_POLICY_ERROR'
        }
      };

      const result = await generationService.processGenerationWebhook(webhookData);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.creditsReleased).toBe(1);

      // Verify job was marked as failed
      const updatedJob = await GenerationJob.findById(testJob._id);
      expect(updatedJob.status).toBe('failed');
      expect(updatedJob.error.message).toBe('Content policy violation');

      // Verify credits were released
      const wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.reservedCredits).toBe(0);
      expect(wallet.defaultCredits).toBe(5); // Credits released back
    });

    it('should handle webhook for non-existent job', async () => {
      const webhookData = {
        externalJobId: 'non_existent_job',
        status: 'completed',
        result: { imageUrl: 'https://example.com/image.png' }
      };

      const result = await generationService.processGenerationWebhook(webhookData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Job not found');
    });
  });

  describe('cancelGenerationJob', () => {
    let testJob;

    beforeEach(async () => {
      testJob = await GenerationJob.createJob({
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: testTemplate._id,
        creditsReserved: 1,
        aiProvider: { llm: 'openai', diffusion: 'openai' }
      });

      await creditService.reserveCredits(testUser._id, 1, testJob._id.toString());
    });

    it('should cancel pending job successfully', async () => {
      const result = await generationService.cancelGenerationJob(
        testJob._id,
        testUser._id,
        'User requested cancellation'
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('cancelled');
      expect(result.creditsReleased).toBe(1);

      // Verify job was cancelled
      const updatedJob = await GenerationJob.findById(testJob._id);
      expect(updatedJob.status).toBe('cancelled');

      // Verify credits were released
      const wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.reservedCredits).toBe(0);
    });

    it('should fail to cancel completed job', async () => {
      testJob.status = 'completed';
      await testJob.save();

      await expect(generationService.cancelGenerationJob(testJob._id, testUser._id))
        .rejects.toThrow(GenerationError);

      await expect(generationService.cancelGenerationJob(testJob._id, testUser._id))
        .rejects.toThrow('Cannot cancel job in completed status');
    });

    it('should fail when user does not own job', async () => {
      const otherUser = await User.create({
        auth0Id: 'other_user_123',
        email: 'other@example.com',
        status: 'active'
      });

      await expect(generationService.cancelGenerationJob(testJob._id, otherUser._id))
        .rejects.toThrow(GenerationError);

      await expect(generationService.cancelGenerationJob(testJob._id, otherUser._id))
        .rejects.toThrow('Job not found or access denied');
    });
  });

  describe('retryGenerationJob', () => {
    let testJob;

    beforeEach(async () => {
      testJob = await GenerationJob.createJob({
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: testTemplate._id,
        creditsReserved: 1,
        aiProvider: { llm: 'openai', diffusion: 'openai' }
      });

      // Mark job as failed
      await testJob.fail({
        message: 'Test failure',
        code: 'TEST_ERROR'
      });

      // Mock providers for retry
      const mockLLMProvider = {
        generatePrompt: jest.fn().mockResolvedValue('Retry prompt')
      };

      const mockDiffusionProvider = {
        generateImage: jest.fn().mockResolvedValue({
          jobId: 'retry_job_123',
          status: 'processing'
        })
      };

      providerFactory.createLLMProvider.mockReturnValue(mockLLMProvider);
      providerFactory.createDiffusionProvider.mockReturnValue(mockDiffusionProvider);
    });

    it('should retry failed job successfully', async () => {
      const result = await generationService.retryGenerationJob(testJob._id, testUser._id);

      expect(result.success).toBe(true);
      expect(result.status).toBe('processing');

      // Verify job was reset and retry count incremented
      const updatedJob = await GenerationJob.findById(testJob._id);
      expect(updatedJob.status).toBe('processing');
      expect(updatedJob.retryCount).toBe(1);
      
      // Check if error field is effectively cleared (all properties are undefined/falsy)
      const errorCleared = !updatedJob.error?.message && 
                          !updatedJob.error?.code && 
                          !updatedJob.error?.provider && 
                          !updatedJob.error?.details && 
                          !updatedJob.error?.occurredAt;
      expect(errorCleared).toBe(true);
    });

    it('should fail to retry job that has exceeded max retries', async () => {
      // Set retry count to maximum
      testJob.retryCount = 3;
      await testJob.save();

      await expect(generationService.retryGenerationJob(testJob._id, testUser._id))
        .rejects.toThrow(GenerationError);

      await expect(generationService.retryGenerationJob(testJob._id, testUser._id))
        .rejects.toThrow('Job cannot be retried');
    });

    it('should fail to retry completed job', async () => {
      testJob.status = 'completed';
      testJob.retryCount = 0;
      await testJob.save();

      await expect(generationService.retryGenerationJob(testJob._id, testUser._id))
        .rejects.toThrow(GenerationError);
    });
  });

  describe('getUserGenerationHistory', () => {
    beforeEach(async () => {
      // Create multiple jobs for testing
      for (let i = 0; i < 5; i++) {
        const job = await GenerationJob.createJob({
          userId: testUser._id,
          profileId: testProfile._id,
          templateId: testTemplate._id,
          creditsReserved: 1,
          aiProvider: { llm: 'openai', diffusion: 'openai' }
        });

        if (i < 2) {
          await job.complete({
            imageUrl: `https://example.com/image${i}.png`,
            imagekitFileId: `file_${i}`
          });
        }
      }
    });

    it('should return paginated generation history', async () => {
      const result = await generationService.getUserGenerationHistory(testUser._id, {
        page: 1,
        limit: 3
      });

      expect(result.jobs).toHaveLength(3);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.pages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should filter by status', async () => {
      const result = await generationService.getUserGenerationHistory(testUser._id, {
        status: 'completed'
      });

      expect(result.jobs).toHaveLength(2);
      result.jobs.forEach(job => {
        expect(job.status).toBe('completed');
      });
    });

    it('should filter by profile', async () => {
      const result = await generationService.getUserGenerationHistory(testUser._id, {
        profileId: testProfile._id
      });

      expect(result.jobs).toHaveLength(5);
      result.jobs.forEach(job => {
        expect(job.profileId._id.toString()).toBe(testProfile._id.toString());
      });
    });
  });

  describe('getGenerationStats', () => {
    beforeEach(async () => {
      // Create jobs with different statuses
      const statuses = ['completed', 'completed', 'failed', 'pending', 'processing'];
      
      for (const status of statuses) {
        const job = await GenerationJob.createJob({
          userId: testUser._id,
          profileId: testProfile._id,
          templateId: testTemplate._id,
          creditsReserved: 1,
          aiProvider: { llm: 'openai', diffusion: 'openai' }
        });

        job.status = status;
        if (['completed', 'failed'].includes(status)) {
          job.completedAt = new Date();
        }
        await job.save();
      }
    });

    it('should return generation statistics', async () => {
      const stats = await generationService.getGenerationStats();

      expect(stats.totalJobs).toBe(5);
      expect(stats.completedJobs).toBe(2);
      expect(stats.failedJobs).toBe(1);
      expect(stats.pendingJobs).toBe(1);
      expect(stats.processingJobs).toBe(1);
      expect(stats.successRate).toBe(40); // 2/5 * 100
      expect(stats.totalCreditsUsed).toBe(5);
    });

    it('should filter stats by user', async () => {
      const stats = await generationService.getGenerationStats({
        userId: testUser._id
      });

      expect(stats.totalJobs).toBe(5);
    });

    it('should filter stats by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const stats = await generationService.getGenerationStats({
        startDate: yesterday,
        endDate: tomorrow
      });

      expect(stats.totalJobs).toBe(5);
    });
  });
});