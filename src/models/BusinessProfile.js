const mongoose = require('mongoose');

/**
 * Business Profile Schema
 * Stores business information for personalized poster generation
 */
const businessProfileSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Business name (required)
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },

  // Business tagline/slogan (required, editable)
  tagline: {
    type: String,
    // required: true,
    trim: true,
    maxlength: 200
  },

  // Business description (required)
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10000
  },

  // Business logo (ImageKit URL)
  logo: {
    type: String,
    trim: true
  },

  // Color palette (editable)
  colorPalette: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    hex: {
      type: String,
      required: true,
      match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    }
  }],

  // Typography settings (editable)
  typography: {
    primary: {
      type: String,
      trim: true,
      default: 'Arial'
    },
    secondary: {
      type: String,
      trim: true,
      default: 'Helvetica'
    }
  },

  // Products/services (editable)
  products: [{
    type: String,
    trim: true,
    maxlength: 100
  }],

  // Business niche (auto-detected or manually set)
  niche: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },

  // Business address
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: 200
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100
    },
    state: {
      type: String,
      trim: true,
      maxlength: 100
    },
    country: {
      type: String,
      trim: true,
      maxlength: 100
    },
    zipCode: {
      type: String,
      trim: true,
      maxlength: 20
    }
  },

  // Profile status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Pre-save middleware to update timestamps
businessProfileSchema.pre('save', function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Compound indexes for performance
businessProfileSchema.index({ userId: 1, isActive: 1 });
businessProfileSchema.index({ userId: 1, createdAt: -1 });
businessProfileSchema.index({ name: 'text', description: 'text' });

// Static methods
businessProfileSchema.statics = {
  /**
   * Plan limits for business profiles
   */
  PLAN_LIMITS: {
    free: 1,
    plus: 3,
    pro: 8
  },

  /**
   * Get user's business profiles
   * @param {ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<BusinessProfile[]>} User's profiles
   */
  async getUserProfiles(userId, options = {}) {
    const {
      includeInactive = false,
      limit = 50,
      skip = 0,
      sort = { createdAt: -1 }
    } = options;

    const query = { userId };
    if (!includeInactive) {
      query.isActive = true;
    }

    return this.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .exec();
  },

  /**
   * Get profile by ID with user validation
   * @param {ObjectId} profileId - Profile ID
   * @param {ObjectId} userId - User ID for validation
   * @returns {Promise<BusinessProfile|null>} Profile or null
   */
  async getProfileByIdForUser(profileId, userId) {
    return this.findOne({
      _id: profileId,
      userId,
      isActive: true
    }).exec();
  },

  /**
   * Check if user can create more profiles
   * @param {ObjectId} userId - User ID
   * @param {string} userPlan - User's subscription plan
   * @returns {Promise<boolean>} True if user can create more profiles
   */
  async canUserCreateProfile(userId, userPlan = 'free') {
    const currentCount = await this.countDocuments({
      userId,
      isActive: true
    });

    const limit = this.PLAN_LIMITS[userPlan.toLowerCase()] || this.PLAN_LIMITS.free;
    return currentCount < limit;
  },

  /**
   * Get user's profile count
   * @param {ObjectId} userId - User ID
   * @returns {Promise<number>} Profile count
   */
  async getUserProfileCount(userId) {
    return this.countDocuments({
      userId,
      isActive: true
    });
  },

  /**
   * Search profiles by text
   * @param {ObjectId} userId - User ID
   * @param {string} searchText - Search text
   * @param {Object} options - Query options
   * @returns {Promise<BusinessProfile[]>} Matching profiles
   */
  async searchUserProfiles(userId, searchText, options = {}) {
    const {
      limit = 20,
      skip = 0
    } = options;

    return this.find({
      userId,
      isActive: true,
      $text: { $search: searchText }
    })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .skip(skip)
      .exec();
  },

  /**
   * Get profiles created in date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<BusinessProfile[]>} Profiles in date range
   */
  async getProfilesInDateRange(startDate, endDate) {
    return this.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      },
      isActive: true
    })
      .populate('userId', 'email metadata.name')
      .sort({ createdAt: -1 })
      .exec();
  },

  /**
   * Get profile statistics
   * @returns {Promise<Object>} Profile statistics
   */
  async getProfileStats() {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalProfiles: { $sum: 1 },
          activeProfiles: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          inactiveProfiles: {
            $sum: { $cond: ['$isActive', 0, 1] }
          }
        }
      }
    ];

    const result = await this.aggregate(pipeline).exec();
    return result[0] || {
      totalProfiles: 0,
      activeProfiles: 0,
      inactiveProfiles: 0
    };
  }
};

// Instance methods
businessProfileSchema.methods = {
  /**
   * Update editable fields only
   * @param {Object} updates - Fields to update
   * @returns {Promise<BusinessProfile>} Updated profile
   */
  async updateEditableFields(updates) {
    const editableFields = ['tagline', 'description', 'products', 'colorPalette', 'typography', 'address'];

    editableFields.forEach(field => {
      if (updates[field] !== undefined) {
        this[field] = updates[field];
      }
    });

    return this.save();
  },

  /**
   * Deactivate profile
   * @returns {Promise<BusinessProfile>} Updated profile
   */
  async deactivate() {
    this.isActive = false;
    return this.save();
  },

  /**
   * Activate profile
   * @returns {Promise<BusinessProfile>} Updated profile
   */
  async activate() {
    this.isActive = true;
    return this.save();
  },

  /**
   * Get profile summary for generation
   * @returns {Object} Profile summary
   */
  getGenerationSummary() {
    return {
      id: this._id,
      name: this.name,
      tagline: this.tagline,
      description: this.description,
      logo: this.logo,
      colorPalette: this.colorPalette,
      typography: this.typography,
      products: this.products,
      address: this.address
    };
  },

  /**
   * Validate profile completeness
   * @returns {Object} Validation result
   */
  validateCompleteness() {
    const missing = [];
    const warnings = [];

    // Required fields
    if (!this.name) missing.push('name');
    if (!this.tagline) missing.push('tagline');
    if (!this.description) missing.push('description');

    // Recommended fields
    if (!this.logo) warnings.push('logo');
    if (!this.colorPalette || this.colorPalette.length === 0) warnings.push('colorPalette');
    if (!this.products || this.products.length === 0) warnings.push('products');

    return {
      isComplete: missing.length === 0,
      missing,
      warnings,
      completionScore: Math.round(((7 - missing.length - warnings.length) / 7) * 100)
    };
  },

  /**
   * Get formatted address
   * @returns {string} Formatted address string
   */
  getFormattedAddress() {
    const parts = [];

    if (this.address.street) parts.push(this.address.street);
    if (this.address.city) parts.push(this.address.city);
    if (this.address.state) parts.push(this.address.state);
    if (this.address.zipCode) parts.push(this.address.zipCode);
    if (this.address.country) parts.push(this.address.country);

    return parts.join(', ');
  }
};

const BusinessProfile = mongoose.model('BusinessProfile', businessProfileSchema);

module.exports = BusinessProfile;