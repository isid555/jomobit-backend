const mongoose = require('mongoose');

/**
 * Template Schema
 * Stores poster templates with search and filter capabilities
 */
const templateSchema = new mongoose.Schema({
  // Template name
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  
  // Template description
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Template category
  category: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Template tags for filtering
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    index: true
  }],
  
  // Template images (different sizes/variations)
  images: {
    thumbnail: {
      type: String,
      required: true // ImageKit URL for thumbnail
    },
    preview: {
      type: String,
      required: true // ImageKit URL for preview
    },
    fullSize: {
      type: String,
      required: true // ImageKit URL for full size
    }
  },
  
  // Aspect ratio information
  aspectRatio: {
    width: {
      type: Number,
      required: true,
      min: 1
    },
    height: {
      type: Number,
      required: true,
      min: 1
    },
    ratio: {
      type: String,
      required: true // e.g., "16:9", "1:1", "4:3"
    }
  },
  
  // Template type
  type: {
    type: String,
    enum: ['social', 'print', 'web', 'story', 'post', 'banner'],
    required: true,
    index: true
  },
  
  // Template difficulty level
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
    index: true
  },
  
  // Template metadata for AI generation
  metadata: {
    // Suggested color schemes
    colorSchemes: [{
      name: String,
      colors: [String] // Array of hex colors
    }],
    
    // Typography suggestions
    typography: [{
      name: String,
      fontFamily: String,
      weight: String,
      size: String
    }],
    
    // Layout information
    layout: {
      textAreas: [{
        type: { type: String, enum: ['title', 'subtitle', 'body', 'caption'] },
        position: {
          x: Number,
          y: Number,
          width: Number,
          height: Number
        },
        maxLength: Number
      }],
      imageAreas: [{
        type: { type: String, enum: ['logo', 'product', 'background', 'decoration'] },
        position: {
          x: Number,
          y: Number,
          width: Number,
          height: Number
        }
      }]
    },
    
    // AI generation parameters
    aiParameters: {
      promptTemplate: String,
      styleKeywords: [String],
      excludeKeywords: [String]
    }
  },
  
  // Template popularity metrics
  metrics: {
    usageCount: {
      type: Number,
      default: 0,
      index: true
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    ratingCount: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      index: true
    }
  },
  
  // Template status
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'archived'],
    default: 'active',
    index: true
  },
  
  // Template visibility
  isPublic: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Featured template flag
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Creator information (for admin uploaded templates)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Text index for search functionality
templateSchema.index({
  name: 'text',
  description: 'text',
  tags: 'text',
  category: 'text'
});

// Compound indexes for performance
templateSchema.index({ status: 1, isPublic: 1, createdAt: -1 });
templateSchema.index({ category: 1, type: 1, status: 1 });
templateSchema.index({ tags: 1, status: 1 });
templateSchema.index({ isFeatured: 1, status: 1, 'metrics.usageCount': -1 });
templateSchema.index({ 'metrics.usageCount': -1, status: 1 });
templateSchema.index({ 'metrics.rating': -1, status: 1 });

// Pre-save middleware
templateSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  
  // Calculate aspect ratio string
  if (this.isModified('aspectRatio.width') || this.isModified('aspectRatio.height')) {
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(this.aspectRatio.width, this.aspectRatio.height);
    this.aspectRatio.ratio = `${this.aspectRatio.width / divisor}:${this.aspectRatio.height / divisor}`;
  }
  
  next();
});

// Static methods
templateSchema.statics = {
  /**
   * Get paginated templates with filters
   * @param {Object} filters - Filter options
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated results
   */
  async getTemplatesWithFilters(filters = {}, options = {}) {
    const {
      category = null,
      type = null,
      tags = [],
      difficulty = null,
      aspectRatio = null,
      isFeatured = null,
      search = null
    } = filters;

    const {
      page = 1,
      limit = 20,
      sort = { 'metrics.usageCount': -1, createdAt: -1 }
    } = options;

    const query = {
      status: 'active',
      isPublic: true
    };

    // Apply filters
    if (category) query.category = category;
    if (type) query.type = type;
    if (tags.length > 0) query.tags = { $in: tags };
    if (difficulty) query.difficulty = difficulty;
    if (aspectRatio) query['aspectRatio.ratio'] = aspectRatio;
    if (isFeatured !== null) query.isFeatured = isFeatured;
    
    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    const [templates, total] = await Promise.all([
      this.find(query)
        .select('name description category tags images aspectRatio type difficulty metrics isFeatured')
        .sort(search ? { score: { $meta: 'textScore' }, ...sort } : sort)
        .limit(limit)
        .skip(skip)
        .exec(),
      this.countDocuments(query).exec()
    ]);

    return {
      templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  },

  /**
   * Get template filter options
   * @returns {Promise<Object>} Available filter options
   */
  async getFilterOptions() {
    const pipeline = [
      {
        $match: {
          status: 'active',
          isPublic: true
        }
      },
      {
        $group: {
          _id: null,
          categories: { $addToSet: '$category' },
          types: { $addToSet: '$type' },
          difficulties: { $addToSet: '$difficulty' },
          aspectRatios: { $addToSet: '$aspectRatio.ratio' },
          allTags: { $push: '$tags' }
        }
      },
      {
        $project: {
          _id: 0,
          categories: 1,
          types: 1,
          difficulties: 1,
          aspectRatios: 1,
          tags: {
            $reduce: {
              input: '$allTags',
              initialValue: [],
              in: { $setUnion: ['$$value', '$$this'] }
            }
          }
        }
      }
    ];

    const result = await this.aggregate(pipeline).exec();
    return result[0] || {
      categories: [],
      types: [],
      difficulties: [],
      aspectRatios: [],
      tags: []
    };
  },

  /**
   * Get featured templates
   * @param {number} limit - Number of templates to return
   * @returns {Promise<Template[]>} Featured templates
   */
  async getFeaturedTemplates(limit = 10) {
    return this.find({
      status: 'active',
      isPublic: true,
      isFeatured: true
    })
    .select('name description images aspectRatio type metrics')
    .sort({ 'metrics.usageCount': -1, createdAt: -1 })
    .limit(limit)
    .exec();
  },

  /**
   * Get popular templates
   * @param {number} limit - Number of templates to return
   * @returns {Promise<Template[]>} Popular templates
   */
  async getPopularTemplates(limit = 10) {
    return this.find({
      status: 'active',
      isPublic: true
    })
    .select('name description images aspectRatio type metrics')
    .sort({ 'metrics.usageCount': -1, 'metrics.rating': -1 })
    .limit(limit)
    .exec();
  },

  /**
   * Get recent templates
   * @param {number} limit - Number of templates to return
   * @returns {Promise<Template[]>} Recent templates
   */
  async getRecentTemplates(limit = 10) {
    return this.find({
      status: 'active',
      isPublic: true
    })
    .select('name description images aspectRatio type metrics')
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
  },

  /**
   * Get template by ID
   * @param {ObjectId} templateId - Template ID
   * @returns {Promise<Template|null>} Template or null
   */
  async getTemplateById(templateId) {
    return this.findOne({
      _id: templateId,
      status: 'active',
      isPublic: true
    }).exec();
  },

  /**
   * Get template statistics
   * @returns {Promise<Object>} Template statistics
   */
  async getTemplateStats() {
    const pipeline = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalUsage: { $sum: '$metrics.usageCount' },
          avgRating: { $avg: '$metrics.rating' }
        }
      }
    ];

    const statusStats = await this.aggregate(pipeline).exec();
    
    const totalTemplates = await this.countDocuments().exec();
    const activeTemplates = await this.countDocuments({ status: 'active' }).exec();
    const featuredTemplates = await this.countDocuments({ isFeatured: true, status: 'active' }).exec();

    return {
      total: totalTemplates,
      active: activeTemplates,
      featured: featuredTemplates,
      byStatus: statusStats,
      totalUsage: statusStats.reduce((sum, stat) => sum + (stat.totalUsage || 0), 0)
    };
  }
};

// Instance methods
templateSchema.methods = {
  /**
   * Increment usage count
   * @returns {Promise<Template>} Updated template
   */
  async incrementUsage() {
    this.metrics.usageCount += 1;
    this.metrics.lastUsed = new Date();
    return this.save();
  },

  /**
   * Update rating
   * @param {number} newRating - New rating (1-5)
   * @returns {Promise<Template>} Updated template
   */
  async updateRating(newRating) {
    if (newRating < 1 || newRating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const currentTotal = this.metrics.rating * this.metrics.ratingCount;
    this.metrics.ratingCount += 1;
    this.metrics.rating = (currentTotal + newRating) / this.metrics.ratingCount;
    
    return this.save();
  },

  /**
   * Toggle featured status
   * @returns {Promise<Template>} Updated template
   */
  async toggleFeatured() {
    this.isFeatured = !this.isFeatured;
    return this.save();
  },

  /**
   * Archive template
   * @returns {Promise<Template>} Updated template
   */
  async archive() {
    this.status = 'archived';
    return this.save();
  },

  /**
   * Activate template
   * @returns {Promise<Template>} Updated template
   */
  async activate() {
    this.status = 'active';
    return this.save();
  },

  /**
   * Get template summary for API response
   * @returns {Object} Template summary
   */
  getSummary() {
    return {
      id: this._id,
      name: this.name,
      description: this.description,
      category: this.category,
      tags: this.tags,
      images: this.images,
      aspectRatio: this.aspectRatio,
      type: this.type,
      difficulty: this.difficulty,
      metrics: {
        usageCount: this.metrics.usageCount,
        rating: Math.round(this.metrics.rating * 10) / 10 // Round to 1 decimal
      },
      isFeatured: this.isFeatured
    };
  }
};

const Template = mongoose.model('Template', templateSchema);

module.exports = Template;