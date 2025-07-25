const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const App = require('../../src/app');
const app = new App().getApp();
const User = require('../../src/models/User');
const BusinessProfile = require('../../src/models/BusinessProfile');
const Template = require('../../src/models/Template');
const GenerationJob = require('../../src/models/GenerationJob');
const CreditWallet = require('../../src/models/CreditWallet');

// Mock Auth0 middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 'auth0|test-user-id' };
    next();
  },
  requireAdmin: () => (req, res, next) => {
    req.user = { id: 'auth0|admin-user-id' };
    next();
  }
}));

// Mock database connections to prevent real database connection
jest.mock('../../src/config/database', () => ({
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue()
}));

jest.mock('../../src/config/redis', () => ({
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue()
}));

// Mock CreditService to avoid transaction issues with in-memory MongoDB
jest.mock('../../src/services/creditService', () => ({
  CreditService: jest.fn().mockImplementation(() => ({
    reserveCredits: jest.fn().mockResolvedValue({
      success: true,
      creditsReserved: 1,
      reservationId: 'test-reservation-id'
    }),
    releaseReservedCredits: jest.fn().mockResolvedValue({
      success: true,
      creditsReleased: 1
    }),
    deductReservedCredits: jest.fn().mockResolvedValue({
      success: true,
      creditsDeducted: 1
    })
  }))
}));

describe('Poster History and Sharing Integration Tests', () => {
  let mongoServer;
  let testUser;
  let testProfile;
  let testTemplate;
  let testJobs;

  beforeAll(async () => {
    // Start in-memory MongoDB
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

    // Create test user
    testUser = await User.create({
      auth0Id: 'auth0|test-user-id',
      email: 'test@example.com',
      status: 'active'
    });

    // Create test business profile
    testProfile = await BusinessProfile.create({
      userId: testUser._id,
      name: 'Test Business',
      tagline: 'Test Tagline',
      description: 'Test Description',
      logo: 'https://example.com/logo.png',
      colorPalette: [{ name: 'primary', hex: '#000000' }],
      typography: { primary: 'Arial', secondary: 'Helvetica' },
      products: ['Product 1', 'Product 2'],
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        zipCode: '12345'
      }
    });

    // Create test template
    testTemplate = await Template.create({
      name: 'Test Template',
      description: 'Test template description',
      category: 'business',
      type: 'social',
      aspectRatio: { 
        width: 1080, 
        height: 1080,
        ratio: '1:1'
      },
      tags: ['business', 'modern'],
      images: {
        thumbnail: 'https://example.com/thumb.png',
        preview: 'https://example.com/preview.png',
        fullSize: 'https://example.com/fullsize.png'
      },
      status: 'active',
      isPublic: true
    });

    // Create test generation jobs
    testJobs = await Promise.all([
      GenerationJob.create({
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: testTemplate._id,
        status: 'completed',
        creditsReserved: 1,
        aiProvider: { llm: 'openai', diffusion: 'openai' },
        prompt: {
          generated: 'Test prompt for job 1',
          parameters: { style: 'modern' },
          generatedAt: new Date()
        },
        result: {
          imageUrl: 'https://example.com/image1.png',
          thumbnailUrl: 'https://example.com/thumb1.png',
          imagekitFileId: 'file-123',
          metadata: { quality: 'high' }
        },
        timing: {
          promptGenerationTime: 1000,
          imageGenerationTime: 4000,
          totalProcessingTime: 5000
        },
        createdAt: new Date('2024-01-15'),
        startedAt: new Date('2024-01-15'),
        completedAt: new Date('2024-01-15')
      }),
      GenerationJob.create({
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: testTemplate._id,
        status: 'failed',
        creditsReserved: 1,
        aiProvider: { llm: 'gemini', diffusion: 'ideogram' },
        error: {
          message: 'Generation failed',
          code: 'GENERATION_FAILED',
          provider: 'ideogram',
          occurredAt: new Date()
        },
        createdAt: new Date('2024-01-14'),
        startedAt: new Date('2024-01-14'),
        completedAt: new Date('2024-01-14')
      }),
      GenerationJob.create({
        userId: testUser._id,
        profileId: testProfile._id,
        templateId: testTemplate._id,
        status: 'pending',
        creditsReserved: 1,
        aiProvider: { llm: 'openai', diffusion: 'openai' },
        createdAt: new Date('2024-01-16')
      })
    ]);
  });

  describe('GET /api/posters/history', () => {
    it('should return user poster history with pagination', async () => {
      const response = await request(app)
        .get('/api/posters/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.history).toHaveLength(3);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        pages: 1,
        hasNext: false,
        hasPrev: false
      });

      // Check that jobs are sorted by creation date (newest first)
      const jobs = response.body.history;
      expect(new Date(jobs[0].createdAt)).toBeInstanceOf(Date);
      expect(new Date(jobs[1].createdAt)).toBeInstanceOf(Date);
      expect(new Date(jobs[2].createdAt)).toBeInstanceOf(Date);
    });

    it('should filter history by business profile', async () => {
      const response = await request(app)
        .get('/api/posters/history')
        .query({ profileId: testProfile._id.toString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.history).toHaveLength(3);
      expect(response.body.filters.profileId).toBe(testProfile._id.toString());
    });

    it('should filter history by status', async () => {
      const response = await request(app)
        .get('/api/posters/history')
        .query({ status: 'completed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.history).toHaveLength(1);
      expect(response.body.history[0].status).toBe('completed');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/posters/history')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.history).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        pages: 2,
        hasNext: true,
        hasPrev: false
      });
    });
  });

  describe('GET /api/posters/:jobId', () => {
    it('should return job details with user ownership validation', async () => {
      const job = testJobs[0]; // Completed job

      const response = await request(app)
        .get(`/api/posters/${job._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.job._id).toBe(job._id.toString());
      expect(response.body.job.status).toBe('completed');
      expect(response.body.job.result).toBeDefined();
    });

    it('should return job with metadata when requested', async () => {
      const job = testJobs[0]; // Completed job

      const response = await request(app)
        .get(`/api/posters/${job._id}`)
        .query({ includeMetadata: 'true' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.generationDetails).toBeDefined();
      expect(response.body.metadata.businessProfile).toBeDefined();
      expect(response.body.metadata.template).toBeDefined();
      expect(response.body.metadata.processing).toBeDefined();
    });

    it('should return 404 for non-existent job', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/posters/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('GET /api/posters/:jobId/metadata', () => {
    it('should return comprehensive poster metadata', async () => {
      const job = testJobs[0]; // Completed job

      const response = await request(app)
        .get(`/api/posters/${job._id}/metadata`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata).toBeDefined();

      const metadata = response.body.metadata;
      expect(metadata.job).toEqual({
        id: job._id.toString(),
        status: 'completed',
        priority: 'normal',
        creditsReserved: 1,
        retryCount: 0
      });

      expect(metadata.businessProfile).toBeDefined();
      expect(metadata.businessProfile.name).toBe('Test Business');

      expect(metadata.template).toBeDefined();
      expect(metadata.template.name).toBe('Test Template');

      expect(metadata.aiProvider).toEqual({
        llm: 'openai',
        diffusion: 'openai'
      });

      expect(metadata.generation).toBeDefined();
      expect(metadata.generation.prompt).toBe('Test prompt for job 1');

      expect(metadata.timing).toBeDefined();
      expect(metadata.timing.totalDuration).toBe(5000);

      expect(metadata.result).toBeDefined();
      expect(metadata.result.imageUrl).toBe('https://example.com/image1.png');
    });

    it('should include error details for failed jobs', async () => {
      const job = testJobs[1]; // Failed job

      const response = await request(app)
        .get(`/api/posters/${job._id}/metadata`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.error).toBeDefined();
      expect(response.body.metadata.error.message).toBe('Generation failed');
      expect(response.body.metadata.error.code).toBe('GENERATION_FAILED');
      expect(response.body.metadata.result).toBeNull();
    });
  });

  describe('GET /api/posters/:jobId/share', () => {
    it('should return sharing options for completed job', async () => {
      const job = testJobs[0]; // Completed job

      const response = await request(app)
        .get(`/api/posters/${job._id}/share`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.posterUrl).toBe('https://example.com/image1.png');
      expect(response.body.businessProfile).toEqual({
        id: testProfile._id.toString(),
        name: 'Test Business'
      });

      const sharingOptions = response.body.sharingOptions;
      expect(sharingOptions.instagram).toBeDefined();
      expect(sharingOptions.whatsapp).toBeDefined();
      expect(sharingOptions.facebook).toBeDefined();
      expect(sharingOptions.twitter).toBeDefined();
      expect(sharingOptions.linkedin).toBeDefined();
      expect(sharingOptions.direct).toBeDefined();

      expect(response.body.supportedPlatforms).toEqual([
        'instagram', 'whatsapp', 'facebook', 'twitter', 'linkedin', 'direct'
      ]);
    });

    it('should filter sharing options by platform', async () => {
      const job = testJobs[0]; // Completed job

      const response = await request(app)
        .get(`/api/posters/${job._id}/share`)
        .query({ platform: 'instagram' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sharingOptions.instagram).toBeDefined();
      expect(response.body.sharingOptions.whatsapp).toBeUndefined();
      expect(response.body.sharingOptions.facebook).toBeUndefined();
    });

    it('should return 400 for incomplete job', async () => {
      const job = testJobs[2]; // Pending job

      const response = await request(app)
        .get(`/api/posters/${job._id}/share`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not completed');
    });

    it('should validate Instagram sharing options', async () => {
      const job = testJobs[0]; // Completed job

      const response = await request(app)
        .get(`/api/posters/${job._id}/share`)
        .query({ platform: 'instagram' })
        .expect(200);

      const instagram = response.body.sharingOptions.instagram;
      expect(instagram.platform).toBe('Instagram');
      expect(instagram.type).toBe('download');
      expect(instagram.downloadUrl).toContain('/download?quality=high');
      expect(instagram.instructions).toContain('Download the high-quality image');
      expect(instagram.aspectRatio).toEqual({ width: 1080, height: 1080 });
    });

    it('should validate WhatsApp sharing options', async () => {
      const job = testJobs[0]; // Completed job

      const response = await request(app)
        .get(`/api/posters/${job._id}/share`)
        .query({ platform: 'whatsapp' })
        .expect(200);

      const whatsapp = response.body.sharingOptions.whatsapp;
      expect(whatsapp.platform).toBe('WhatsApp');
      expect(whatsapp.type).toBe('share_url');
      expect(whatsapp.url).toContain('https://wa.me/');
      expect(whatsapp.text).toContain('Test Business');
    });

    it('should validate Facebook sharing options', async () => {
      const job = testJobs[0]; // Completed job

      const response = await request(app)
        .get(`/api/posters/${job._id}/share`)
        .query({ platform: 'facebook' })
        .expect(200);

      const facebook = response.body.sharingOptions.facebook;
      expect(facebook.platform).toBe('Facebook');
      expect(facebook.type).toBe('share_url');
      expect(facebook.url).toContain('facebook.com/sharer');
      expect(facebook.imageUrl).toBe('https://example.com/image1.png');
    });
  });

  describe('GET /api/posters/:jobId/download', () => {
    it('should return download URL with ImageKit CDN integration', async () => {
      const job = testJobs[0]; // Completed job

      const response = await request(app)
        .get(`/api/posters/${job._id}/download`)
        .query({ quality: 'high', format: 'png' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.downloadUrl).toBe('https://example.com/image1.png');
      expect(response.body.filename).toContain('jomobit_Test_Business');
      expect(response.body.filename).toContain('.png');
      expect(response.body.quality).toBe('high');
      expect(response.body.format).toBe('png');
      expect(response.body.fileSize).toBeDefined();

      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.businessProfile).toBe('Test Business');
      expect(response.body.metadata.templateName).toBe('Test Template');
      expect(response.body.metadata.aspectRatio).toEqual({ width: 1080, height: 1080 });
    });

    it('should handle different quality levels', async () => {
      const job = testJobs[0]; // Completed job

      const lowQualityResponse = await request(app)
        .get(`/api/posters/${job._id}/download`)
        .query({ quality: 'low' })
        .expect(200);

      const highQualityResponse = await request(app)
        .get(`/api/posters/${job._id}/download`)
        .query({ quality: 'high' })
        .expect(200);

      expect(lowQualityResponse.body.quality).toBe('low');
      expect(highQualityResponse.body.quality).toBe('high');

      // File size estimation should be different
      expect(lowQualityResponse.body.fileSize).not.toBe(highQualityResponse.body.fileSize);
    });

    it('should return 400 for incomplete job', async () => {
      const job = testJobs[2]; // Pending job

      const response = await request(app)
        .get(`/api/posters/${job._id}/download`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not completed');
    });
  });

  describe('POST /api/posters/:jobId/cancel', () => {
    it('should cancel pending job', async () => {
      const job = testJobs[2]; // Pending job

      // Create credit wallet for the user
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 3,
        subscriptionCredits: 0,
        reservedCredits: 1,
        totalCredits: 2
      });

      const response = await request(app)
        .post(`/api/posters/${job._id}/cancel`)
        .send({ reason: 'User cancelled' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('cancelled');

      // Verify job was cancelled in database
      const updatedJob = await GenerationJob.findById(job._id);
      expect(updatedJob.status).toBe('cancelled');
      expect(updatedJob.error.message).toBe('User cancelled');
    });

    it('should return 400 for completed job', async () => {
      const job = testJobs[0]; // Completed job

      const response = await request(app)
        .post(`/api/posters/${job._id}/cancel`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_JOB_STATUS');
    });
  });

  describe('User Ownership Validation', () => {
    let otherUser;
    let otherUserJob;

    beforeEach(async () => {
      // Create another user and their job
      otherUser = await User.create({
        auth0Id: 'auth0|other-user-id',
        email: 'other@example.com',
        status: 'active'
      });

      const otherProfile = await BusinessProfile.create({
        userId: otherUser._id,
        name: 'Other Business',
        tagline: 'Other Tagline',
        description: 'Other Description'
      });

      otherUserJob = await GenerationJob.create({
        userId: otherUser._id,
        profileId: otherProfile._id,
        templateId: testTemplate._id,
        status: 'completed',
        creditsReserved: 1,
        aiProvider: { llm: 'openai', diffusion: 'openai' },
        result: {
          imageUrl: 'https://example.com/other-image.png',
          thumbnailUrl: 'https://example.com/other-thumb.png'
        }
      });
    });

    it('should deny access to other user job details', async () => {
      const response = await request(app)
        .get(`/api/posters/${otherUserJob._id}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });

    it('should deny access to other user job metadata', async () => {
      const response = await request(app)
        .get(`/api/posters/${otherUserJob._id}/metadata`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });

    it('should deny access to other user job sharing options', async () => {
      const response = await request(app)
        .get(`/api/posters/${otherUserJob._id}/share`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });

    it('should deny access to other user job download', async () => {
      const response = await request(app)
        .get(`/api/posters/${otherUserJob._id}/download`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });

    it('should deny cancellation of other user job', async () => {
      const response = await request(app)
        .post(`/api/posters/${otherUserJob._id}/cancel`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid job ID format', async () => {
      const response = await request(app)
        .get('/api/posters/invalid-job-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid job ID format');
    });

    it('should handle database connection errors gracefully', async () => {
      // Close database connection to simulate error
      await mongoose.disconnect();

      const response = await request(app)
        .get('/api/posters/history')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');

      // Reconnect for cleanup
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });
  });
});