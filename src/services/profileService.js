const mongoose = require('mongoose');
const BusinessProfile = require('../models/BusinessProfile');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const logger = require('../utils/logger');

/**
 * Custom error classes for profile operations
 */
class ProfileNotFoundError extends Error {
  constructor(profileId) {
    super(`Business profile not found: ${profileId}`);
    this.name = 'ProfileNotFoundError';
    this.code = 'PROFILE_NOT_FOUND';
    this.profileId = profileId;
  }
}

class PlanLimitExceededError extends Error {
  constructor(currentCount, limit, planName) {
    super(`Plan limit exceeded: ${currentCount}/${limit} profiles for ${planName} plan`);
    this.name = 'PlanLimitExceededError';
    this.code = 'PLAN_LIMIT_EXCEEDED';
    this.currentCount = currentCount;
    this.limit = limit;
    this.planName = planName;
  }
}

class ProfileOperationError extends Error {
  constructor(message, operation, userId, profileId = null) {
    super(message);
    this.name = 'ProfileOperationError';
    this.code = 'PROFILE_OPERATION_ERROR';
    this.operation = operation;
    this.userId = userId;
    this.profileId = profileId;
  }
}

class ProfileValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ProfileValidationError';
    this.code = 'PROFILE_VALIDATION_ERROR';
    this.field = field;
    this.value = value;
  }
}

/**
 * Business Profile Management Service
 * Handles business profile operations with plan-based limitations
 */
class ProfileService {
  constructor() {
    // Editable fields that users can modify after profile creation
    this.EDITABLE_FIELDS = ['tagline', 'description', 'products', 'colorPalette', 'typography', 'address'];

    // Required fields for profile creation
    this.REQUIRED_FIELDS = ['name', 'niche', 'description'];
  }

  /**
   * Get user's current plan information
   * @param {string|ObjectId} userId - User ID
   * @returns {Promise<Object>} Plan information
   */
  async getUserPlan(userId) {
    try {
      // Get user's active subscription
      const subscription = await Subscription.getUserActiveSubscription(userId);

      if (subscription && subscription.planId) {
        return {
          plan: subscription.planId,
          planName: subscription.planId.name,
          planId: subscription.planId.planId,
          profileLimit: subscription.planId.features.businessProfiles.limit
        };
      }

      // Default to free plan if no active subscription
      const freePlan = await Plan.getFreePlan();
      return {
        plan: freePlan,
        planName: freePlan?.name || 'Free',
        planId: freePlan?.planId || 'free',
        profileLimit: freePlan?.features.businessProfiles.limit || BusinessProfile.PLAN_LIMITS.free
      };

    } catch (error) {
      logger.error('Error getting user plan', {
        userId,
        error: error.message
      });

      // Fallback to free plan limits
      return {
        plan: null,
        planName: 'Free',
        planId: 'free',
        profileLimit: BusinessProfile.PLAN_LIMITS.free
      };
    }
  }

  /**
   * Create a new business profile
   * @param {string|ObjectId} userId - User ID
   * @param {Object} profileData - Profile data
   * @returns {Promise<Object>} Operation result with created profile
   */
  async createProfile(userId, profileData) {
    try {
      logger.info('Creating business profile', {
        userId,
        profileName: profileData.name,
        operation: 'createProfile'
      });

      // Validate required fields
      this._validateRequiredFields(profileData);

      // Get user's plan and check limits
      const userPlan = await this.getUserPlan(userId);
      const currentCount = await BusinessProfile.getUserProfileCount(userId);

      if (currentCount >= userPlan.profileLimit) {
        throw new PlanLimitExceededError(
          currentCount,
          userPlan.profileLimit,
          userPlan.planName
        );
      }

      // Validate and sanitize profile data
      const sanitizedData = this._sanitizeProfileData(profileData);

      // Create profile
      const profile = new BusinessProfile({
        userId,
        ...sanitizedData
      });

      await profile.save();

      logger.info('Business profile created successfully', {
        userId,
        profileId: profile._id,
        profileName: profile.name,
        currentCount: currentCount + 1,
        planLimit: userPlan.profileLimit
      });

      return {
        success: true,
        profile: profile.toObject(),
        planInfo: {
          currentCount: currentCount + 1,
          limit: userPlan.profileLimit,
          planName: userPlan.planName
        },
        message: 'Business profile created successfully'
      };

    } catch (error) {
      if (error instanceof PlanLimitExceededError ||
        error instanceof ProfileValidationError) {
        throw error;
      }

      logger.error('Error creating business profile', {
        userId,
        profileData: { name: profileData.name },
        error: error.message,
        stack: error.stack
      });
      throw new ProfileOperationError(
        `Failed to create profile: ${error.message}`,
        'createProfile',
        userId
      );
    }
  }

  /**
   * Update business profile with restricted field editing
   * @param {string|ObjectId} userId - User ID
   * @param {string|ObjectId} profileId - Profile ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Operation result with updated profile
   */
  async updateProfile(userId, profileId, updates) {
    try {
      logger.info('Updating business profile', {
        userId,
        profileId,
        updateFields: Object.keys(updates),
        operation: 'updateProfile'
      });

      // Get profile and verify ownership
      const profile = await BusinessProfile.getProfileByIdForUser(profileId, userId);
      if (!profile) {
        throw new ProfileNotFoundError(profileId);
      }

      // Filter updates to only include editable fields
      const editableUpdates = this._filterEditableFields(updates);

      if (Object.keys(editableUpdates).length === 0) {
        throw new ProfileValidationError(
          'No editable fields provided for update',
          'updates',
          Object.keys(updates)
        );
      }

      // Validate update data
      this._validateUpdateData(editableUpdates);

      // Update profile using model method
      await profile.updateEditableFields(editableUpdates);

      logger.info('Business profile updated successfully', {
        userId,
        profileId,
        updatedFields: Object.keys(editableUpdates)
      });

      return {
        success: true,
        profile: profile.toObject(),
        updatedFields: Object.keys(editableUpdates),
        message: 'Business profile updated successfully'
      };

    } catch (error) {
      if (error instanceof ProfileNotFoundError ||
        error instanceof ProfileValidationError) {
        throw error;
      }

      logger.error('Error updating business profile', {
        userId,
        profileId,
        updates: Object.keys(updates),
        error: error.message,
        stack: error.stack
      });
      throw new ProfileOperationError(
        `Failed to update profile: ${error.message}`,
        'updateProfile',
        userId,
        profileId
      );
    }
  }

  /**
   * Get user's business profiles
   * @param {string|ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User's profiles with plan information
   */
  async getUserProfiles(userId, options = {}) {
    try {
      const {
        includeInactive = false,
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 }
      } = options;

      const profiles = await BusinessProfile.getUserProfiles(userId, {
        includeInactive,
        limit,
        skip,
        sort
      });

      const totalCount = await BusinessProfile.getUserProfileCount(userId);
      const userPlan = await this.getUserPlan(userId);

      return {
        success: true,
        profiles: profiles.map(profile => profile.toObject()),
        planInfo: {
          currentCount: totalCount,
          limit: userPlan.profileLimit,
          planName: userPlan.planName,
          canCreateMore: totalCount < userPlan.profileLimit
        },
        pagination: {
          total: totalCount,
          limit,
          skip,
          hasMore: skip + profiles.length < totalCount
        }
      };

    } catch (error) {
      logger.error('Error getting user profiles', {
        userId,
        options,
        error: error.message
      });
      throw new ProfileOperationError(
        `Failed to get user profiles: ${error.message}`,
        'getUserProfiles',
        userId
      );
    }
  }

  /**
   * Get business profile by ID
   * @param {string|ObjectId} userId - User ID
   * @param {string|ObjectId} profileId - Profile ID
   * @returns {Promise<Object>} Profile data
   */
  async getProfileById(userId, profileId) {
    try {
      const profile = await BusinessProfile.getProfileByIdForUser(profileId, userId);
      if (!profile) {
        throw new ProfileNotFoundError(profileId);
      }

      return {
        success: true,
        profile: profile.toObject(),
        completeness: profile.validateCompleteness()
      };

    } catch (error) {
      if (error instanceof ProfileNotFoundError) {
        throw error;
      }

      logger.error('Error getting profile by ID', {
        userId,
        profileId,
        error: error.message
      });
      throw new ProfileOperationError(
        `Failed to get profile: ${error.message}`,
        'getProfileById',
        userId,
        profileId
      );
    }
  }

  /**
   * Deactivate business profile
   * @param {string|ObjectId} userId - User ID
   * @param {string|ObjectId} profileId - Profile ID
   * @returns {Promise<Object>} Operation result
   */
  async deactivateProfile(userId, profileId) {
    try {
      logger.info('Deactivating business profile', {
        userId,
        profileId,
        operation: 'deactivateProfile'
      });

      const profile = await BusinessProfile.getProfileByIdForUser(profileId, userId);
      if (!profile) {
        throw new ProfileNotFoundError(profileId);
      }

      await profile.deactivate();

      logger.info('Business profile deactivated successfully', {
        userId,
        profileId
      });

      return {
        success: true,
        profile: profile.toObject(),
        message: 'Business profile deactivated successfully'
      };

    } catch (error) {
      if (error instanceof ProfileNotFoundError) {
        throw error;
      }

      logger.error('Error deactivating business profile', {
        userId,
        profileId,
        error: error.message
      });
      throw new ProfileOperationError(
        `Failed to deactivate profile: ${error.message}`,
        'deactivateProfile',
        userId,
        profileId
      );
    }
  }

  /**
   * Activate business profile
   * @param {string|ObjectId} userId - User ID
   * @param {string|ObjectId} profileId - Profile ID
   * @returns {Promise<Object>} Operation result
   */
  async activateProfile(userId, profileId) {
    try {
      logger.info('Activating business profile', {
        userId,
        profileId,
        operation: 'activateProfile'
      });

      // Check if user can have more active profiles
      const userPlan = await this.getUserPlan(userId);
      const currentCount = await BusinessProfile.getUserProfileCount(userId);

      if (currentCount >= userPlan.profileLimit) {
        throw new PlanLimitExceededError(
          currentCount,
          userPlan.profileLimit,
          userPlan.planName
        );
      }

      const profile = await BusinessProfile.findOne({
        _id: profileId,
        userId
      });

      if (!profile) {
        throw new ProfileNotFoundError(profileId);
      }

      await profile.activate();

      logger.info('Business profile activated successfully', {
        userId,
        profileId
      });

      return {
        success: true,
        profile: profile.toObject(),
        message: 'Business profile activated successfully'
      };

    } catch (error) {
      if (error instanceof ProfileNotFoundError ||
        error instanceof PlanLimitExceededError) {
        throw error;
      }

      logger.error('Error activating business profile', {
        userId,
        profileId,
        error: error.message
      });
      throw new ProfileOperationError(
        `Failed to activate profile: ${error.message}`,
        'activateProfile',
        userId,
        profileId
      );
    }
  }

  /**
   * Search user's business profiles
   * @param {string|ObjectId} userId - User ID
   * @param {string} searchText - Search text
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchUserProfiles(userId, searchText, options = {}) {
    try {
      const {
        limit = 20,
        skip = 0
      } = options;

      const profiles = await BusinessProfile.searchUserProfiles(userId, searchText, {
        limit,
        skip
      });

      return {
        success: true,
        profiles: profiles.map(profile => profile.toObject()),
        searchText,
        pagination: {
          limit,
          skip,
          hasMore: profiles.length === limit
        }
      };

    } catch (error) {
      logger.error('Error searching user profiles', {
        userId,
        searchText,
        options,
        error: error.message
      });
      throw new ProfileOperationError(
        `Failed to search profiles: ${error.message}`,
        'searchUserProfiles',
        userId
      );
    }
  }

  /**
   * Create a guest profile for trial generation
   * @param {string|ObjectId} userId - Guest user ID
   * @param {string} nicheId - Niche identifier
   * @returns {Promise<Object>} Created guest profile
   */
  async createGuestProfile(userId, nicheId) {
    try {
      logger.info('Creating guest profile', {
        userId,
        nicheId,
        operation: 'createGuestProfile'
      });

      const randomString = (length) => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      // Extract niche name from nicheId (e.g., GUEST_USER_FASHION -> fashion)
      const nicheName = nicheId.replace('GUEST_USER_', '').toLowerCase();

      const guestProfile = new BusinessProfile({
        userId,
        name: `Guest Business ${randomString(4)}`,
        tagline: `Trial ${nicheName} business`,
        description: `Guest trial profile for ${nicheName} niche`,
        niche: nicheName,
        isActive: true
      });

      await guestProfile.save();

      logger.info('Guest profile created successfully', {
        userId,
        profileId: guestProfile._id,
        niche: nicheName
      });

      return {
        success: true,
        profile: guestProfile.toObject(),
        message: 'Guest profile created successfully'
      };

    } catch (error) {
      logger.error('Error creating guest profile', {
        userId,
        nicheId,
        error: error.message,
        stack: error.stack
      });
      throw new ProfileOperationError(
        `Failed to create guest profile: ${error.message}`,
        'createGuestProfile',
        userId
      );
    }
  }

  /**
   * Get profile generation summary
   * @param {string|ObjectId} userId - User ID
   * @param {string|ObjectId} profileId - Profile ID
   * @returns {Promise<Object>} Profile generation summary
   */
  async getProfileGenerationSummary(userId, profileId) {
    try {
      const profile = await BusinessProfile.getProfileByIdForUser(profileId, userId);
      if (!profile) {
        throw new ProfileNotFoundError(profileId);
      }

      const generationSummary = profile.getGenerationSummary();
      const completeness = profile.validateCompleteness();

      return {
        success: true,
        generationSummary,
        completeness,
        isReadyForGeneration: completeness.isComplete
      };

    } catch (error) {
      if (error instanceof ProfileNotFoundError) {
        throw error;
      }

      logger.error('Error getting profile generation summary', {
        userId,
        profileId,
        error: error.message
      });
      throw new ProfileOperationError(
        `Failed to get profile generation summary: ${error.message}`,
        'getProfileGenerationSummary',
        userId,
        profileId
      );
    }
  }

  /**
   * Validate required fields for profile creation
   * @private
   * @param {Object} profileData - Profile data to validate
   * @throws {ProfileValidationError} If validation fails
   */
  _validateRequiredFields(profileData) {
    for (const field of this.REQUIRED_FIELDS) {
      if (!profileData[field] || (typeof profileData[field] === 'string' && !profileData[field].trim())) {
        throw new ProfileValidationError(
          `Required field '${field}' is missing or empty`,
          field,
          profileData[field]
        );
      }
    }
  }

  /**
   * Filter updates to only include editable fields
   * @private
   * @param {Object} updates - Update data
   * @returns {Object} Filtered updates
   */
  _filterEditableFields(updates) {
    const editableUpdates = {};

    for (const field of this.EDITABLE_FIELDS) {
      if (updates[field] !== undefined) {
        editableUpdates[field] = updates[field];
      }
    }

    return editableUpdates;
  }

  /**
   * Validate update data
   * @private
   * @param {Object} updates - Update data to validate
   * @throws {ProfileValidationError} If validation fails
   */
  _validateUpdateData(updates) {
    // Validate tagline
    if (updates.tagline !== undefined) {
      if (typeof updates.tagline !== 'string' || updates.tagline.trim().length === 0) {
        throw new ProfileValidationError(
          'Tagline must be a non-empty string',
          'tagline',
          updates.tagline
        );
      }
      if (updates.tagline.length > 200) {
        throw new ProfileValidationError(
          'Tagline must be 200 characters or less',
          'tagline',
          updates.tagline
        );
      }
    }

    // Validate description
    if (updates.description !== undefined) {
      if (typeof updates.description !== 'string' || updates.description.trim().length === 0) {
        throw new ProfileValidationError(
          'Description must be a non-empty string',
          'description',
          updates.description
        );
      }
    }

    // Validate products array
    if (updates.products !== undefined) {
      if (!Array.isArray(updates.products)) {
        throw new ProfileValidationError(
          'Products must be an array',
          'products',
          updates.products
        );
      }

      for (const product of updates.products) {
        if (typeof product !== 'string' || product.trim().length === 0) {
          throw new ProfileValidationError(
            'Each product must be a non-empty string',
            'products',
            product
          );
        }
        if (product.length > 100) {
          throw new ProfileValidationError(
            'Each product must be 100 characters or less',
            'products',
            product
          );
        }
      }
    }

    // Validate color palette
    if (updates.colorPalette !== undefined) {
      if (!Array.isArray(updates.colorPalette)) {
        throw new ProfileValidationError(
          'Color palette must be an array',
          'colorPalette',
          updates.colorPalette
        );
      }

      for (const color of updates.colorPalette) {
        if (!color.name || !color.hex) {
          throw new ProfileValidationError(
            'Each color must have name and hex properties',
            'colorPalette',
            color
          );
        }

        if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color.hex)) {
          throw new ProfileValidationError(
            'Invalid hex color format',
            'colorPalette',
            color.hex
          );
        }
      }
    }

    // Validate typography
    if (updates.typography !== undefined) {
      if (typeof updates.typography !== 'object' || updates.typography === null) {
        throw new ProfileValidationError(
          'Typography must be an object',
          'typography',
          updates.typography
        );
      }

      if (updates.typography.primary && typeof updates.typography.primary !== 'string') {
        throw new ProfileValidationError(
          'Primary typography must be a string',
          'typography.primary',
          updates.typography.primary
        );
      }

      if (updates.typography.secondary && typeof updates.typography.secondary !== 'string') {
        throw new ProfileValidationError(
          'Secondary typography must be a string',
          'typography.secondary',
          updates.typography.secondary
        );
      }
    }

    // Validate address
    if (updates.address !== undefined) {
      if (typeof updates.address !== 'object' || updates.address === null) {
        throw new ProfileValidationError(
          'Address must be an object',
          'address',
          updates.address
        );
      }

      const requiredAddressFields = ['street', 'city', 'state', 'country', 'zipCode'];
      for (const field of requiredAddressFields) {
        if (updates.address[field] && typeof updates.address[field] !== 'string') {
          throw new ProfileValidationError(
            `Address ${field} must be a string`,
            `address.${field}`,
            updates.address[field]
          );
        }
      }
    }
  }

  /**
   * Sanitize profile data for creation
   * @private
   * @param {Object} profileData - Raw profile data
   * @returns {Object} Sanitized profile data
   */
  _sanitizeProfileData(profileData) {
    const sanitized = {};

    // Required fields
    sanitized.name = profileData.name.trim();
    sanitized.niche = profileData.niche.trim();
    sanitized.description = profileData.description.trim();

    // Optional fields
    if (profileData.tagline) {
      sanitized.tagline = profileData.tagline.trim();
    }

    if (profileData.logo) {
      sanitized.logo = profileData.logo.trim();
    }

    if (profileData.colorPalette && Array.isArray(profileData.colorPalette)) {
      sanitized.colorPalette = profileData.colorPalette.map(color => ({
        name: color.name.trim(),
        hex: color.hex.trim()
      }));
    }

    if (profileData.typography) {
      sanitized.typography = {
        primary: profileData.typography.primary?.trim() || 'Arial',
        secondary: profileData.typography.secondary?.trim() || 'Helvetica'
      };
    }

    if (profileData.products && Array.isArray(profileData.products)) {
      sanitized.products = profileData.products
        .map(product => product.trim())
        .filter(product => product.length > 0);
    }

    if (profileData.address) {
      sanitized.address = {
        street: profileData.address.street?.trim() || '',
        city: profileData.address.city?.trim() || '',
        state: profileData.address.state?.trim() || '',
        country: profileData.address.country?.trim() || '',
        zipCode: profileData.address.zipCode?.trim() || ''
      };
    }

    return sanitized;
  }
}

// Export error classes for use in other modules
ProfileService.ProfileNotFoundError = ProfileNotFoundError;
ProfileService.PlanLimitExceededError = PlanLimitExceededError;
ProfileService.ProfileOperationError = ProfileOperationError;
ProfileService.ProfileValidationError = ProfileValidationError;

module.exports = ProfileService;