const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ProfileService = require('../../../src/services/profileService');
const BusinessProfile = require('../../../src/models/BusinessProfile');
const Plan = require('../../../src/models/Plan');
const Subscription = require('../../../src/models/Subscription');
const User = require('../../../src/models/User');

describe('ProfileService', () => {
  let mongoServer;
  let profileService;
  let testUser;
  let freePlan;
  let plusPlan;

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
    await BusinessProfile.deleteMany({});
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await User.deleteMany({});

    profileService = new ProfileService();

    // Create test user
    testUser = await User.create({
      auth0Id: 'auth0|123456789',
      email: 'test@example.com',
      status: 'active'
    });

    // Create test plans
    freePlan = await Plan.create({
      name: 'Free',
      planId: 'free',
      pricing: { amount: 0, currency: 'INR', interval: 'monthly' },
      features: {
        credits: { monthly: 3 },
        businessProfiles: { limit: 1 }
      },
      tier: 'free',
      status: 'active'
    });

    plusPlan = await Plan.create({
      name: 'Plus',
      planId: 'plus',
      pricing: { amount: 2500, currency: 'INR', interval: 'monthly' },
      features: {
        credits: { monthly: 50 },
        businessProfiles: { limit: 3 }
      },
      tier: 'basic',
      status: 'active'
    });
  });

  describe('getUserPlan', () => {
    it('should return free plan for user without subscription', async () => {
      const result = await profileService.getUserPlan(testUser._id);

      expect(result.planName).toBe('Free');
      expect(result.planId).toBe('free');
      expect(result.profileLimit).toBe(1);
    });

    it('should return active subscription plan', async () => {
      // Create active subscription
      await Subscription.create({
        userId: testUser._id,
        planId: plusPlan._id,
        razorpaySubscriptionId: 'sub_123',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billing: { amount: 2500, currency: 'INR', interval: 'monthly' }
      });

      const result = await profileService.getUserPlan(testUser._id);

      expect(result.planName).toBe('Plus');
      expect(result.planId).toBe('plus');
      expect(result.profileLimit).toBe(3);
    });

    it('should fallback to free plan on error', async () => {
      // Mock Subscription.getUserActiveSubscription to throw error
      jest.spyOn(Subscription, 'getUserActiveSubscription').mockRejectedValue(new Error('DB error'));

      const result = await profileService.getUserPlan(testUser._id);

      expect(result.planName).toBe('Free');
      expect(result.profileLimit).toBe(1);

      Subscription.getUserActiveSubscription.mockRestore();
    });
  });

  describe('createProfile', () => {
    const validProfileData = {
      name: 'Test Business',
      tagline: 'We do great things',
      description: 'A test business for testing purposes',
      logo: 'https://example.com/logo.jpg',
      colorPalette: [
        { name: 'Primary', hex: '#FF0000' },
        { name: 'Secondary', hex: '#00FF00' }
      ],
      typography: {
        primary: 'Arial',
        secondary: 'Helvetica'
      },
      products: ['Product 1', 'Product 2'],
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        zipCode: '12345'
      }
    };

    it('should create profile successfully within plan limits', async () => {
      const result = await profileService.createProfile(testUser._id, validProfileData);

      expect(result.success).toBe(true);
      expect(result.profile.name).toBe(validProfileData.name);
      expect(result.profile.userId.toString()).toBe(testUser._id.toString());
      expect(result.planInfo.currentCount).toBe(1);
      expect(result.planInfo.limit).toBe(1);
      expect(result.planInfo.planName).toBe('Free');
    });

    it('should throw PlanLimitExceededError when limit reached', async () => {
      // Create existing profile to reach limit
      await BusinessProfile.create({
        userId: testUser._id,
        name: 'Existing Business',
        tagline: 'Existing tagline',
        description: 'Existing description'
      });

      await expect(profileService.createProfile(testUser._id, validProfileData))
        .rejects.toThrow(ProfileService.PlanLimitExceededError);
    });

    it('should throw ProfileValidationError for missing required fields', async () => {
      const invalidData = { ...validProfileData };
      delete invalidData.name;

      await expect(profileService.createProfile(testUser._id, invalidData))
        .rejects.toThrow(ProfileService.ProfileValidationError);
    });

    it('should sanitize profile data correctly', async () => {
      const dataWithWhitespace = {
        ...validProfileData,
        name: '  Test Business  ',
        tagline: '  We do great things  ',
        products: ['  Product 1  ', '  Product 2  ', '']
      };

      const result = await profileService.createProfile(testUser._id, dataWithWhitespace);

      expect(result.profile.name).toBe('Test Business');
      expect(result.profile.tagline).toBe('We do great things');
      expect(result.profile.products).toEqual(['Product 1', 'Product 2']);
    });

    it('should work with higher plan limits', async () => {
      // Create Plus subscription
      await Subscription.create({
        userId: testUser._id,
        planId: plusPlan._id,
        razorpaySubscriptionId: 'sub_123',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billing: { amount: 2500, currency: 'INR', interval: 'monthly' }
      });

      const result = await profileService.createProfile(testUser._id, validProfileData);

      expect(result.success).toBe(true);
      expect(result.planInfo.limit).toBe(3);
      expect(result.planInfo.planName).toBe('Plus');
    });
  });

  describe('updateProfile', () => {
    let testProfile;

    beforeEach(async () => {
      testProfile = await BusinessProfile.create({
        userId: testUser._id,
        name: 'Test Business',
        tagline: 'Original tagline',
        description: 'Original description',
        products: ['Product 1'],
        colorPalette: [{ name: 'Primary', hex: '#FF0000' }],
        typography: { primary: 'Arial', secondary: 'Helvetica' }
      });
    });

    it('should update editable fields successfully', async () => {
      const updates = {
        tagline: 'Updated tagline',
        products: ['Product 1', 'Product 2'],
        colorPalette: [
          { name: 'Primary', hex: '#FF0000' },
          { name: 'Secondary', hex: '#00FF00' }
        ]
      };

      const result = await profileService.updateProfile(testUser._id, testProfile._id, updates);

      expect(result.success).toBe(true);
      expect(result.profile.tagline).toBe('Updated tagline');
      expect(result.profile.products).toEqual(['Product 1', 'Product 2']);
      expect(result.profile.colorPalette).toHaveLength(2);
      expect(result.updatedFields).toEqual(['tagline', 'products', 'colorPalette']);
    });

    it('should ignore non-editable fields', async () => {
      const updates = {
        name: 'Updated Name', // Not editable
        tagline: 'Updated tagline', // Editable
        description: 'Updated description' // Not editable
      };

      const result = await profileService.updateProfile(testUser._id, testProfile._id, updates);

      expect(result.success).toBe(true);
      expect(result.profile.name).toBe('Test Business'); // Unchanged
      expect(result.profile.tagline).toBe('Updated tagline'); // Changed
      expect(result.profile.description).toBe('Original description'); // Unchanged
      expect(result.updatedFields).toEqual(['tagline']);
    });

    it('should throw ProfileNotFoundError for non-existent profile', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updates = { tagline: 'Updated tagline' };

      await expect(profileService.updateProfile(testUser._id, nonExistentId, updates))
        .rejects.toThrow(ProfileService.ProfileNotFoundError);
    });

    it('should throw ProfileValidationError for no editable fields', async () => {
      const updates = {
        name: 'Updated Name', // Not editable
        description: 'Updated description' // Not editable
      };

      await expect(profileService.updateProfile(testUser._id, testProfile._id, updates))
        .rejects.toThrow(ProfileService.ProfileValidationError);
    });

    it('should validate color palette format', async () => {
      const updates = {
        colorPalette: [
          { name: 'Primary', hex: 'invalid-hex' }
        ]
      };

      await expect(profileService.updateProfile(testUser._id, testProfile._id, updates))
        .rejects.toThrow(ProfileService.ProfileValidationError);
    });

    it('should validate tagline length', async () => {
      const updates = {
        tagline: 'a'.repeat(201) // Too long
      };

      await expect(profileService.updateProfile(testUser._id, testProfile._id, updates))
        .rejects.toThrow(ProfileService.ProfileValidationError);
    });

    it('should validate products array', async () => {
      const updates = {
        products: 'not an array'
      };

      await expect(profileService.updateProfile(testUser._id, testProfile._id, updates))
        .rejects.toThrow(ProfileService.ProfileValidationError);
    });
  });

  describe('getUserProfiles', () => {
    beforeEach(async () => {
      await BusinessProfile.create([
        {
          userId: testUser._id,
          name: 'Business 1',
          tagline: 'Tagline 1',
          description: 'Description 1',
          isActive: true
        },
        {
          userId: testUser._id,
          name: 'Business 2',
          tagline: 'Tagline 2',
          description: 'Description 2',
          isActive: true
        },
        {
          userId: testUser._id,
          name: 'Business 3',
          tagline: 'Tagline 3',
          description: 'Description 3',
          isActive: false
        }
      ]);
    });

    it('should get active profiles by default', async () => {
      const result = await profileService.getUserProfiles(testUser._id);

      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(2);
      expect(result.profiles.every(p => p.isActive)).toBe(true);
      expect(result.planInfo.currentCount).toBe(2);
      expect(result.planInfo.limit).toBe(1);
      expect(result.planInfo.canCreateMore).toBe(false);
    });

    it('should include inactive profiles when requested', async () => {
      const result = await profileService.getUserProfiles(testUser._id, {
        includeInactive: true
      });

      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(3);
    });

    it('should handle pagination', async () => {
      const result = await profileService.getUserProfiles(testUser._id, {
        limit: 1,
        skip: 0
      });

      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(true);
    });
  });

  describe('getProfileById', () => {
    let testProfile;

    beforeEach(async () => {
      testProfile = await BusinessProfile.create({
        userId: testUser._id,
        name: 'Test Business',
        tagline: 'Test tagline',
        description: 'Test description'
      });
    });

    it('should get profile by ID successfully', async () => {
      const result = await profileService.getProfileById(testUser._id, testProfile._id);

      expect(result.success).toBe(true);
      expect(result.profile._id.toString()).toBe(testProfile._id.toString());
      expect(result.completeness).toBeDefined();
      expect(result.completeness.isComplete).toBe(true);
    });

    it('should throw ProfileNotFoundError for non-existent profile', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(profileService.getProfileById(testUser._id, nonExistentId))
        .rejects.toThrow(ProfileService.ProfileNotFoundError);
    });

    it('should not return other user\'s profile', async () => {
      const otherUser = await User.create({
        auth0Id: 'auth0|other',
        email: 'other@example.com',
        status: 'active'
      });

      await expect(profileService.getProfileById(otherUser._id, testProfile._id))
        .rejects.toThrow(ProfileService.ProfileNotFoundError);
    });
  });

  describe('deactivateProfile', () => {
    let testProfile;

    beforeEach(async () => {
      testProfile = await BusinessProfile.create({
        userId: testUser._id,
        name: 'Test Business',
        tagline: 'Test tagline',
        description: 'Test description',
        isActive: true
      });
    });

    it('should deactivate profile successfully', async () => {
      const result = await profileService.deactivateProfile(testUser._id, testProfile._id);

      expect(result.success).toBe(true);
      expect(result.profile.isActive).toBe(false);
    });

    it('should throw ProfileNotFoundError for non-existent profile', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(profileService.deactivateProfile(testUser._id, nonExistentId))
        .rejects.toThrow(ProfileService.ProfileNotFoundError);
    });
  });

  describe('activateProfile', () => {
    let testProfile;

    beforeEach(async () => {
      testProfile = await BusinessProfile.create({
        userId: testUser._id,
        name: 'Test Business',
        tagline: 'Test tagline',
        description: 'Test description',
        isActive: false
      });
    });

    it('should activate profile successfully within limits', async () => {
      const result = await profileService.activateProfile(testUser._id, testProfile._id);

      expect(result.success).toBe(true);
      expect(result.profile.isActive).toBe(true);
    });

    it('should throw PlanLimitExceededError when limit reached', async () => {
      // Create active profile to reach limit
      await BusinessProfile.create({
        userId: testUser._id,
        name: 'Active Business',
        tagline: 'Active tagline',
        description: 'Active description',
        isActive: true
      });

      await expect(profileService.activateProfile(testUser._id, testProfile._id))
        .rejects.toThrow(ProfileService.PlanLimitExceededError);
    });

    it('should throw ProfileNotFoundError for non-existent profile', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(profileService.activateProfile(testUser._id, nonExistentId))
        .rejects.toThrow(ProfileService.ProfileNotFoundError);
    });
  });

  describe('searchUserProfiles', () => {
    beforeEach(async () => {
      await BusinessProfile.create([
        {
          userId: testUser._id,
          name: 'Coffee Shop',
          tagline: 'Best coffee in town',
          description: 'We serve amazing coffee and pastries'
        },
        {
          userId: testUser._id,
          name: 'Pizza Place',
          tagline: 'Authentic Italian pizza',
          description: 'Traditional wood-fired pizza'
        },
        {
          userId: testUser._id,
          name: 'Bakery',
          tagline: 'Fresh bread daily',
          description: 'Artisan bakery with fresh bread and pastries'
        }
      ]);

      // Create text index for search
      await BusinessProfile.collection.createIndex({
        name: 'text',
        description: 'text'
      });
    });

    it('should search profiles by text', async () => {
      const result = await profileService.searchUserProfiles(testUser._id, 'coffee');

      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0].name).toBe('Coffee Shop');
      expect(result.searchText).toBe('coffee');
    });

    it('should search across multiple fields', async () => {
      const result = await profileService.searchUserProfiles(testUser._id, 'pastries');

      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(2); // Coffee Shop and Bakery both mention pastries
    });

    it('should handle no results', async () => {
      const result = await profileService.searchUserProfiles(testUser._id, 'nonexistent');

      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(0);
    });
  });

  describe('getProfileGenerationSummary', () => {
    let testProfile;

    beforeEach(async () => {
      testProfile = await BusinessProfile.create({
        userId: testUser._id,
        name: 'Test Business',
        tagline: 'Test tagline',
        description: 'Test description',
        logo: 'https://example.com/logo.jpg',
        colorPalette: [{ name: 'Primary', hex: '#FF0000' }],
        products: ['Product 1']
      });
    });

    it('should get profile generation summary', async () => {
      const result = await profileService.getProfileGenerationSummary(testUser._id, testProfile._id);

      expect(result.success).toBe(true);
      expect(result.generationSummary).toBeDefined();
      expect(result.generationSummary.name).toBe('Test Business');
      expect(result.completeness).toBeDefined();
      expect(result.isReadyForGeneration).toBe(true);
    });

    it('should throw ProfileNotFoundError for non-existent profile', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(profileService.getProfileGenerationSummary(testUser._id, nonExistentId))
        .rejects.toThrow(ProfileService.ProfileNotFoundError);
    });
  });

  describe('Validation Methods', () => {
    it('should validate required fields correctly', () => {
      const validData = {
        name: 'Test Business',
        tagline: 'Test tagline',
        description: 'Test description'
      };

      expect(() => profileService._validateRequiredFields(validData)).not.toThrow();

      const invalidData = { name: 'Test Business' }; // Missing tagline and description
      expect(() => profileService._validateRequiredFields(invalidData))
        .toThrow(ProfileService.ProfileValidationError);
    });

    it('should filter editable fields correctly', () => {
      const updates = {
        name: 'New Name', // Not editable
        tagline: 'New Tagline', // Editable
        description: 'New Description', // Not editable
        products: ['Product 1'], // Editable
        colorPalette: [{ name: 'Primary', hex: '#FF0000' }] // Editable
      };

      const filtered = profileService._filterEditableFields(updates);

      expect(filtered).toEqual({
        tagline: 'New Tagline',
        products: ['Product 1'],
        colorPalette: [{ name: 'Primary', hex: '#FF0000' }]
      });
      expect(filtered.name).toBeUndefined();
      expect(filtered.description).toBeUndefined();
    });

    it('should sanitize profile data correctly', () => {
      const rawData = {
        name: '  Test Business  ',
        tagline: '  Test tagline  ',
        description: '  Test description  ',
        logo: '  https://example.com/logo.jpg  ',
        products: ['  Product 1  ', '  Product 2  ', ''],
        colorPalette: [
          { name: '  Primary  ', hex: '  #FF0000  ' }
        ],
        typography: {
          primary: '  Arial  ',
          secondary: '  Helvetica  '
        },
        address: {
          street: '  123 Test St  ',
          city: '  Test City  '
        }
      };

      const sanitized = profileService._sanitizeProfileData(rawData);

      expect(sanitized.name).toBe('Test Business');
      expect(sanitized.tagline).toBe('Test tagline');
      expect(sanitized.description).toBe('Test description');
      expect(sanitized.logo).toBe('https://example.com/logo.jpg');
      expect(sanitized.products).toEqual(['Product 1', 'Product 2']);
      expect(sanitized.colorPalette[0].name).toBe('Primary');
      expect(sanitized.colorPalette[0].hex).toBe('#FF0000');
      expect(sanitized.typography.primary).toBe('Arial');
      expect(sanitized.address.street).toBe('123 Test St');
    });
  });

  describe('Error Handling', () => {
    it('should export error classes', () => {
      expect(ProfileService.ProfileNotFoundError).toBeDefined();
      expect(ProfileService.PlanLimitExceededError).toBeDefined();
      expect(ProfileService.ProfileOperationError).toBeDefined();
      expect(ProfileService.ProfileValidationError).toBeDefined();
    });

    it('should create proper error instances', () => {
      const notFoundError = new ProfileService.ProfileNotFoundError('profile-id');
      expect(notFoundError.name).toBe('ProfileNotFoundError');
      expect(notFoundError.code).toBe('PROFILE_NOT_FOUND');
      expect(notFoundError.profileId).toBe('profile-id');

      const limitError = new ProfileService.PlanLimitExceededError(2, 1, 'Free');
      expect(limitError.name).toBe('PlanLimitExceededError');
      expect(limitError.code).toBe('PLAN_LIMIT_EXCEEDED');
      expect(limitError.currentCount).toBe(2);
      expect(limitError.limit).toBe(1);
      expect(limitError.planName).toBe('Free');

      const validationError = new ProfileService.ProfileValidationError('Invalid field', 'name', 'value');
      expect(validationError.name).toBe('ProfileValidationError');
      expect(validationError.code).toBe('PROFILE_VALIDATION_ERROR');
      expect(validationError.field).toBe('name');
      expect(validationError.value).toBe('value');
    });
  });
});