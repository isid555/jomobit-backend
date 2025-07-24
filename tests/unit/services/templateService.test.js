const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const TemplateService = require('../../../src/services/templateService');
const Template = require('../../../src/models/Template');

describe('TemplateService', () => {
  let mongoServer;
  let templateService;

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
    await Template.deleteMany({});
    
    // Create text index for search functionality
    try {
      await Template.collection.createIndex({
        name: 'text',
        description: 'text',
        tags: 'text',
        category: 'text'
      });
    } catch (error) {
      // Index might already exist, ignore error
    }
    
    templateService = new TemplateService();
  });

  // Helper function to create test template data
  const createTestTemplateData = (overrides = {}) => {
    const data = {
      name: 'Test Template',
      description: 'A test template for unit testing',
      category: 'business',
      tags: ['test', 'business', 'poster'],
      images: {
        thumbnail: 'https://imagekit.io/test/thumbnail.jpg',
        preview: 'https://imagekit.io/test/preview.jpg',
        fullSize: 'https://imagekit.io/test/full.jpg'
      },
      aspectRatio: {
        width: 16,
        height: 9,
        ratio: '16:9' // Add the ratio field that's required
      },
      type: 'social',
      difficulty: 'beginner',
      ...overrides
    };
    
    // If aspectRatio is overridden, ensure ratio is calculated
    if (overrides.aspectRatio && overrides.aspectRatio.width && overrides.aspectRatio.height) {
      const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
      const divisor = gcd(overrides.aspectRatio.width, overrides.aspectRatio.height);
      data.aspectRatio.ratio = `${overrides.aspectRatio.width / divisor}:${overrides.aspectRatio.height / divisor}`;
    }
    
    return data;
  };

  // Helper function to create test template in database
  const createTestTemplate = async (overrides = {}) => {
    const templateData = createTestTemplateData(overrides);
    const template = new Template(templateData);
    await template.save();
    return template;
  };

  describe('getTemplates', () => {
    beforeEach(async () => {
      // Create test templates
      await createTestTemplate({ 
        name: 'Social Template 1', 
        category: 'social', 
        type: 'social',
        tags: ['social', 'instagram'],
        isFeatured: true,
        'metrics.usageCount': 100
      });
      await createTestTemplate({ 
        name: 'Business Template 1', 
        category: 'business', 
        type: 'post',
        tags: ['business', 'corporate'],
        difficulty: 'intermediate',
        'metrics.usageCount': 50
      });
      await createTestTemplate({ 
        name: 'Print Template 1', 
        category: 'print', 
        type: 'print',
        tags: ['print', 'flyer'],
        status: 'inactive'
      });
    });

    it('should get templates with default pagination', async () => {
      const result = await templateService.getTemplates();

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(2); // Only active templates
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter templates by category', async () => {
      const result = await templateService.getTemplates({ category: 'social' });

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].category).toBe('social');
    });

    it('should filter templates by type', async () => {
      const result = await templateService.getTemplates({ type: 'post' });

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].type).toBe('post');
    });

    it('should filter templates by tags', async () => {
      const result = await templateService.getTemplates({ tags: ['business'] });

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].tags).toContain('business');
    });

    it('should filter templates by difficulty', async () => {
      const result = await templateService.getTemplates({ difficulty: 'intermediate' });

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].difficulty).toBe('intermediate');
    });

    it('should filter featured templates', async () => {
      const result = await templateService.getTemplates({ isFeatured: true });

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].isFeatured).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const result = await templateService.getTemplates({}, { page: 1, limit: 1 });

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should validate and limit page size', async () => {
      const result = await templateService.getTemplates({}, { limit: 200 });

      expect(result.pagination.limit).toBe(100); // MAX_PAGE_SIZE
    });

    it('should handle search functionality', async () => {
      const result = await templateService.getTemplates({ search: 'Social' });

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].name).toContain('Social');
    });
  });

  describe('searchTemplates', () => {
    beforeEach(async () => {
      await createTestTemplate({ 
        name: 'Marketing Poster', 
        description: 'Great for marketing campaigns',
        tags: ['marketing', 'campaign']
      });
      await createTestTemplate({ 
        name: 'Social Media Post', 
        description: 'Perfect for social media',
        tags: ['social', 'media']
      });
    });

    it('should search templates by term', async () => {
      const result = await templateService.searchTemplates('marketing');

      expect(result.success).toBe(true);
      expect(result.searchTerm).toBe('marketing');
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].name).toContain('Marketing');
    });

    it('should search with additional filters', async () => {
      const result = await templateService.searchTemplates('Post', { category: 'business' });

      expect(result.success).toBe(true);
      expect(result.searchTerm).toBe('Post');
      expect(result.templates).toHaveLength(1);
    });

    it('should throw error for empty search term', async () => {
      await expect(templateService.searchTemplates(''))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for non-string search term', async () => {
      await expect(templateService.searchTemplates(123))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should trim search term', async () => {
      const result = await templateService.searchTemplates('  marketing  ');

      expect(result.searchTerm).toBe('marketing');
    });
  });

  describe('getFilterOptions', () => {
    beforeEach(async () => {
      await createTestTemplate({ 
        category: 'business', 
        type: 'social', 
        tags: ['business', 'corporate'],
        difficulty: 'beginner'
      });
      await createTestTemplate({ 
        category: 'marketing', 
        type: 'post', 
        tags: ['marketing', 'campaign'],
        difficulty: 'intermediate'
      });
    });

    it('should return available filter options', async () => {
      const result = await templateService.getFilterOptions();

      expect(result.success).toBe(true);
      expect(result.filters.categories).toContain('business');
      expect(result.filters.categories).toContain('marketing');
      expect(result.filters.types).toContain('social');
      expect(result.filters.types).toContain('post');
      expect(result.filters.difficulties).toContain('beginner');
      expect(result.filters.difficulties).toContain('intermediate');
      expect(result.filters.tags).toContain('business');
      expect(result.filters.tags).toContain('marketing');
    });
  });

  describe('getTemplateById', () => {
    let testTemplate;

    beforeEach(async () => {
      testTemplate = await createTestTemplate();
    });

    it('should get template by valid ID', async () => {
      const result = await templateService.getTemplateById(testTemplate._id);

      expect(result.success).toBe(true);
      expect(result.template._id.toString()).toBe(testTemplate._id.toString());
      expect(result.template.name).toBe(testTemplate.name);
    });

    it('should throw error for invalid ID format', async () => {
      await expect(templateService.getTemplateById('invalid-id'))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for missing ID', async () => {
      await expect(templateService.getTemplateById(null))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for non-existent template', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(templateService.getTemplateById(nonExistentId))
        .rejects.toThrow(TemplateService.TemplateNotFoundError);
    });
  });

  describe('getFeaturedTemplates', () => {
    beforeEach(async () => {
      await createTestTemplate({ name: 'Featured 1', isFeatured: true });
      await createTestTemplate({ name: 'Featured 2', isFeatured: true });
      await createTestTemplate({ name: 'Not Featured', isFeatured: false });
    });

    it('should get featured templates', async () => {
      const result = await templateService.getFeaturedTemplates();

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(2);
      expect(result.templates.every(t => t.isFeatured)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const result = await templateService.getFeaturedTemplates(1);

      expect(result.templates).toHaveLength(1);
    });

    it('should validate and limit the limit parameter', async () => {
      const result = await templateService.getFeaturedTemplates(100);
      expect(result.templates.length).toBeLessThanOrEqual(50);
    });
  });

  describe('getPopularTemplates', () => {
    beforeEach(async () => {
      await createTestTemplate({ name: 'Popular 1', 'metrics.usageCount': 100 });
      await createTestTemplate({ name: 'Popular 2', 'metrics.usageCount': 50 });
      await createTestTemplate({ name: 'Not Popular', 'metrics.usageCount': 1 });
    });

    it('should get popular templates', async () => {
      const result = await templateService.getPopularTemplates();

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(3);
      // Should be sorted by usage count descending
      expect(result.templates[0].name).toBe('Popular 1');
    });

    it('should respect limit parameter', async () => {
      const result = await templateService.getPopularTemplates(2);

      expect(result.templates).toHaveLength(2);
    });
  });

  describe('getRecentTemplates', () => {
    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      await createTestTemplate({ name: 'Recent 1', createdAt: now });
      await createTestTemplate({ name: 'Recent 2', createdAt: yesterday });
    });

    it('should get recent templates', async () => {
      const result = await templateService.getRecentTemplates();

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(2);
      // Should be sorted by creation date descending
      expect(result.templates[0].name).toBe('Recent 1');
    });

    it('should respect limit parameter', async () => {
      const result = await templateService.getRecentTemplates(1);

      expect(result.templates).toHaveLength(1);
    });
  });

  describe('incrementUsage', () => {
    let testTemplate;

    beforeEach(async () => {
      testTemplate = await createTestTemplate({ 'metrics.usageCount': 5 });
    });

    it('should increment template usage count', async () => {
      const result = await templateService.incrementUsage(testTemplate._id);

      expect(result.success).toBe(true);
      expect(result.template.metrics.usageCount).toBe(6);
      expect(result.message).toContain('incremented successfully');
    });

    it('should throw error for invalid ID', async () => {
      await expect(templateService.incrementUsage('invalid-id'))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for non-existent template', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(templateService.incrementUsage(nonExistentId))
        .rejects.toThrow(TemplateService.TemplateNotFoundError);
    });
  });

  describe('createTemplate', () => {
    const creatorId = new mongoose.Types.ObjectId();

    it('should create template successfully', async () => {
      const templateData = createTestTemplateData();
      const result = await templateService.createTemplate(templateData, creatorId);

      expect(result.success).toBe(true);
      expect(result.template.name).toBe(templateData.name);
      expect(result.template.createdBy.toString()).toBe(creatorId.toString());
      expect(result.message).toContain('created successfully');
    });

    it('should throw error for missing required fields', async () => {
      const incompleteData = { name: 'Test' }; // Missing required fields
      
      await expect(templateService.createTemplate(incompleteData, creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for invalid creator ID', async () => {
      const templateData = createTestTemplateData();
      
      await expect(templateService.createTemplate(templateData, 'invalid-id'))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for missing creator ID', async () => {
      const templateData = createTestTemplateData();
      
      await expect(templateService.createTemplate(templateData, null))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should validate template type enum', async () => {
      const templateData = createTestTemplateData({ type: 'invalid-type' });
      
      await expect(templateService.createTemplate(templateData, creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should validate difficulty enum', async () => {
      const templateData = createTestTemplateData({ difficulty: 'invalid-difficulty' });
      
      await expect(templateService.createTemplate(templateData, creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should validate images object', async () => {
      const templateData = createTestTemplateData({ 
        images: { thumbnail: 'test.jpg' } // Missing preview and fullSize
      });
      
      await expect(templateService.createTemplate(templateData, creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should validate aspect ratio', async () => {
      const templateData = createTestTemplateData({ 
        aspectRatio: { width: 16 } // Missing height
      });
      
      await expect(templateService.createTemplate(templateData, creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });
  });

  describe('updateTemplate', () => {
    let testTemplate;

    beforeEach(async () => {
      testTemplate = await createTestTemplate();
    });

    it('should update template successfully', async () => {
      const updateData = { name: 'Updated Template Name', description: 'Updated description' };
      const result = await templateService.updateTemplate(testTemplate._id, updateData);

      expect(result.success).toBe(true);
      expect(result.template.name).toBe('Updated Template Name');
      expect(result.template.description).toBe('Updated description');
      expect(result.message).toContain('updated successfully');
    });

    it('should throw error for invalid template ID', async () => {
      await expect(templateService.updateTemplate('invalid-id', { name: 'Test' }))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for non-existent template', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(templateService.updateTemplate(nonExistentId, { name: 'Test' }))
        .rejects.toThrow(TemplateService.TemplateNotFoundError);
    });

    it('should throw error for empty update data', async () => {
      await expect(templateService.updateTemplate(testTemplate._id, {}))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for missing update data', async () => {
      await expect(templateService.updateTemplate(testTemplate._id, null))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });
  });

  describe('deleteTemplate', () => {
    let testTemplate;

    beforeEach(async () => {
      testTemplate = await createTestTemplate();
    });

    it('should delete template successfully', async () => {
      const result = await templateService.deleteTemplate(testTemplate._id);

      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');

      // Verify template is deleted
      const deletedTemplate = await Template.findById(testTemplate._id);
      expect(deletedTemplate).toBeNull();
    });

    it('should throw error for invalid template ID', async () => {
      await expect(templateService.deleteTemplate('invalid-id'))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for non-existent template', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(templateService.deleteTemplate(nonExistentId))
        .rejects.toThrow(TemplateService.TemplateNotFoundError);
    });
  });

  describe('toggleFeatured', () => {
    let testTemplate;

    beforeEach(async () => {
      testTemplate = await createTestTemplate({ isFeatured: false });
    });

    it('should toggle featured status from false to true', async () => {
      const result = await templateService.toggleFeatured(testTemplate._id);

      expect(result.success).toBe(true);
      expect(result.oldFeaturedStatus).toBe(false);
      expect(result.newFeaturedStatus).toBe(true);
      expect(result.template.isFeatured).toBe(true);
      expect(result.message).toContain('featured successfully');
    });

    it('should toggle featured status from true to false', async () => {
      // First make it featured
      await templateService.toggleFeatured(testTemplate._id);
      
      // Then toggle back
      const result = await templateService.toggleFeatured(testTemplate._id);

      expect(result.success).toBe(true);
      expect(result.oldFeaturedStatus).toBe(true);
      expect(result.newFeaturedStatus).toBe(false);
      expect(result.message).toContain('unfeatured successfully');
    });

    it('should throw error for invalid template ID', async () => {
      await expect(templateService.toggleFeatured('invalid-id'))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for non-existent template', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(templateService.toggleFeatured(nonExistentId))
        .rejects.toThrow(TemplateService.TemplateNotFoundError);
    });
  });

  describe('archiveTemplate', () => {
    let testTemplate;

    beforeEach(async () => {
      testTemplate = await createTestTemplate({ status: 'active' });
    });

    it('should archive template successfully', async () => {
      const result = await templateService.archiveTemplate(testTemplate._id);

      expect(result.success).toBe(true);
      expect(result.oldStatus).toBe('active');
      expect(result.newStatus).toBe('archived');
      expect(result.template.status).toBe('archived');
      expect(result.message).toContain('archived successfully');
    });

    it('should throw error for invalid template ID', async () => {
      await expect(templateService.archiveTemplate('invalid-id'))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for non-existent template', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(templateService.archiveTemplate(nonExistentId))
        .rejects.toThrow(TemplateService.TemplateNotFoundError);
    });
  });

  describe('activateTemplate', () => {
    let testTemplate;

    beforeEach(async () => {
      testTemplate = await createTestTemplate({ status: 'archived' });
    });

    it('should activate template successfully', async () => {
      const result = await templateService.activateTemplate(testTemplate._id);

      expect(result.success).toBe(true);
      expect(result.oldStatus).toBe('archived');
      expect(result.newStatus).toBe('active');
      expect(result.template.status).toBe('active');
      expect(result.message).toContain('activated successfully');
    });

    it('should throw error for invalid template ID', async () => {
      await expect(templateService.activateTemplate('invalid-id'))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for non-existent template', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await expect(templateService.activateTemplate(nonExistentId))
        .rejects.toThrow(TemplateService.TemplateNotFoundError);
    });
  });

  describe('batchUploadTemplates', () => {
    const creatorId = new mongoose.Types.ObjectId();

    it('should batch upload templates successfully', async () => {
      const templatesData = [
        createTestTemplateData({ name: 'Batch Template 1' }),
        createTestTemplateData({ name: 'Batch Template 2' }),
        createTestTemplateData({ name: 'Batch Template 3' })
      ];

      const result = await templateService.batchUploadTemplates(templatesData, creatorId);

      expect(result.success).toBe(true);
      expect(result.results.total).toBe(3);
      expect(result.results.successful).toHaveLength(3);
      expect(result.results.failed).toHaveLength(0);
      expect(result.message).toContain('3 successful, 0 failed');
    });

    it('should handle partial failures in batch upload', async () => {
      const templatesData = [
        createTestTemplateData({ name: 'Valid Template' }),
        { name: 'Invalid Template' }, // Missing required fields
        createTestTemplateData({ name: 'Another Valid Template' })
      ];

      const result = await templateService.batchUploadTemplates(templatesData, creatorId);

      expect(result.success).toBe(true);
      expect(result.results.total).toBe(3);
      expect(result.results.successful).toHaveLength(2);
      expect(result.results.failed).toHaveLength(1);
      expect(result.results.failed[0].index).toBe(1);
      expect(result.results.failed[0].name).toBe('Invalid Template');
    });

    it('should throw error for empty templates array', async () => {
      await expect(templateService.batchUploadTemplates([], creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for non-array input', async () => {
      await expect(templateService.batchUploadTemplates('not-array', creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should throw error for invalid creator ID', async () => {
      const templatesData = [createTestTemplateData()];
      
      await expect(templateService.batchUploadTemplates(templatesData, 'invalid-id'))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });
  });

  describe('getTemplateStats', () => {
    beforeEach(async () => {
      await createTestTemplate({ status: 'active', 'metrics.usageCount': 10 });
      await createTestTemplate({ status: 'active', 'metrics.usageCount': 20 });
      await createTestTemplate({ status: 'archived', 'metrics.usageCount': 5 });
      await createTestTemplate({ status: 'draft', 'metrics.usageCount': 0 });
    });

    it('should return template statistics', async () => {
      const result = await templateService.getTemplateStats();

      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(4);
      expect(result.stats.active).toBe(2);
      expect(result.stats.totalUsage).toBe(35);
      expect(result.stats.byStatus).toBeDefined();
    });
  });

  describe('getAdminTemplates', () => {
    beforeEach(async () => {
      await createTestTemplate({ status: 'active', name: 'Active Template' });
      await createTestTemplate({ status: 'archived', name: 'Archived Template' });
      await createTestTemplate({ status: 'draft', name: 'Draft Template' });
    });

    it('should get all templates for admin including inactive', async () => {
      const result = await templateService.getAdminTemplates();

      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(3); // Should include all statuses
    });
  });

  describe('Error Handling', () => {
    it('should export error classes', () => {
      expect(TemplateService.TemplateNotFoundError).toBeDefined();
      expect(TemplateService.TemplateOperationError).toBeDefined();
      expect(TemplateService.TemplateValidationError).toBeDefined();
    });

    it('should create proper error instances', () => {
      const notFoundError = new TemplateService.TemplateNotFoundError('test-id');
      expect(notFoundError.name).toBe('TemplateNotFoundError');
      expect(notFoundError.code).toBe('TEMPLATE_NOT_FOUND');
      expect(notFoundError.identifier).toBe('test-id');

      const operationError = new TemplateService.TemplateOperationError('test message', 'testOp', 'templateId');
      expect(operationError.name).toBe('TemplateOperationError');
      expect(operationError.code).toBe('TEMPLATE_OPERATION_ERROR');
      expect(operationError.operation).toBe('testOp');
      expect(operationError.templateId).toBe('templateId');

      const validationError = new TemplateService.TemplateValidationError('test message', 'testField');
      expect(validationError.name).toBe('TemplateValidationError');
      expect(validationError.code).toBe('TEMPLATE_VALIDATION_ERROR');
      expect(validationError.field).toBe('testField');
    });
  });

  describe('_validateTemplateData', () => {
    const creatorId = new mongoose.Types.ObjectId();

    it('should validate required fields', async () => {
      const invalidData = { name: 'Test' }; // Missing required fields
      
      await expect(templateService.createTemplate(invalidData, creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should validate type enum values', async () => {
      const invalidData = createTestTemplateData({ type: 'invalid-type' });
      
      await expect(templateService.createTemplate(invalidData, creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should validate difficulty enum values', async () => {
      const invalidData = createTestTemplateData({ difficulty: 'invalid-difficulty' });
      
      await expect(templateService.createTemplate(invalidData, creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should validate status enum values', async () => {
      const invalidData = createTestTemplateData({ status: 'invalid-status' });
      
      await expect(templateService.createTemplate(invalidData, creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should validate images object completeness', async () => {
      const invalidData = createTestTemplateData({ 
        images: { thumbnail: 'test.jpg' } // Missing preview and fullSize
      });
      
      await expect(templateService.createTemplate(invalidData, creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });

    it('should validate aspect ratio completeness', async () => {
      const invalidData = createTestTemplateData({ 
        aspectRatio: { width: 16 } // Missing height
      });
      
      await expect(templateService.createTemplate(invalidData, creatorId))
        .rejects.toThrow(TemplateService.TemplateValidationError);
    });
  });
});