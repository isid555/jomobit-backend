const mongoose = require("mongoose");

/**
 * Template Schema
 * Stores poster templates with search and filter capabilities
 */
const templateSchema = new mongoose.Schema(
  {
    // Template name
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },

    // Template description
    description: {
      type: String,
      trim: true,
    },

    // Template category
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Template tags for filtering
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        index: true,
      },
    ],

    // Template images (different sizes/variations)
    images: {
      thumbnail: {
        type: String,
        required: true, // ImageKit URL for thumbnail
      },
      preview: {
        type: String,
        required: true, // ImageKit URL for preview
      },
      fullSize: {
        type: String,
        required: true, // ImageKit URL for full size
      },
    },

    // Aspect ratio information
    aspectRatio: {
      width: {
        type: Number,
        required: true,
        min: 1,
      },
      height: {
        type: Number,
        required: true,
        min: 1,
      },
      ratio: {
        type: String,
        required: true, // e.g., "16:9", "1:1", "4:3"
      },
    },

    // Template type
    type: {
      type: String,
      enum: ["social", "print", "web", "story", "post", "banner"],
      required: true,
      index: true,
    },

    // Template difficulty level
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
      index: true,
    },

    // Template metadata for AI generation
    metadata: {
      // Suggested color schemes
      colorSchemes: [
        {
          name: String,
          colors: [String], // Array of hex colors
        },
      ],

      // Typography suggestions
      typography: [
        {
          name: String,
          fontFamily: String,
          weight: String,
          size: String,
        },
      ],

      // Layout information
      layout: {
        textAreas: [
          {
            type: {
              type: String,
              enum: ["title", "subtitle", "body", "caption"],
            },
            position: {
              x: Number,
              y: Number,
              width: Number,
              height: Number,
            },
            maxLength: Number,
          },
        ],
        imageAreas: [
          {
            type: {
              type: String,
              enum: ["logo", "product", "background", "decoration"],
            },
            position: {
              x: Number,
              y: Number,
              width: Number,
              height: Number,
            },
          },
        ],
      },

      // AI generation parameters
      aiParameters: {
        promptTemplate: String,
        styleKeywords: [String],
        excludeKeywords: [String],
      },
    },

    // Template popularity metrics
    metrics: {
      usageCount: {
        type: Number,
        default: 0,
        index: true,
      },
      rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      ratingCount: {
        type: Number,
        default: 0,
      },
      lastUsed: {
        type: Date,
        index: true,
      },
    },

    // Template status
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "archived"],
      default: "active",
      index: true,
    },

    // Template visibility
    isPublic: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Featured template flag
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Creator information (for admin uploaded templates)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Text index for search functionality
templateSchema.index({
  name: "text",
  description: "text",
  tags: "text",
  category: "text",
});

// Compound indexes for performance
templateSchema.index({ status: 1, isPublic: 1, createdAt: -1 });
templateSchema.index({ category: 1, type: 1, status: 1 });
templateSchema.index({ tags: 1, status: 1 });
templateSchema.index({ isFeatured: 1, status: 1, "metrics.usageCount": -1 });
templateSchema.index({ "metrics.usageCount": -1, status: 1 });
templateSchema.index({ "metrics.rating": -1, status: 1 });

// Pre-save middleware
templateSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }

  // Calculate aspect ratio string
  if (
    this.isModified("aspectRatio.width") ||
    this.isModified("aspectRatio.height")
  ) {
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(this.aspectRatio.width, this.aspectRatio.height);
    this.aspectRatio.ratio = `${this.aspectRatio.width / divisor}:${
      this.aspectRatio.height / divisor
    }`;
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
      colors = [],
      difficulty = null,
      aspectRatio = null,
      isFeatured = null,
      search = null,
    } = filters;

    function escapeRegExp(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    const {
      page = 1,
      limit = 12,
      sort = { "metrics.usageCount": -1, createdAt: -1 },
      random = false,
    } = options;

    const festiveList = [
      "chatt puja",
      "diwali",
      "holi",
      "health day",
      "eid ul fitr",
      "christmas",
      "janmashtami",
      "independence day",
      "durga puja",
      "raakhi",
      "raksha bandhan",
      "women's day",
      "ganesh chaturthi",
      "new year",
      "makar sankranti",
      "pongal",
      "lohri",
      "republic day"

    ];

    const query = {
      status: "active",
      isPublic: true,
      ...(category && { category }),
      ...(type && { type }),
      ...(difficulty && { difficulty }),
      ...(aspectRatio && { "aspectRatio.ratio": aspectRatio }),
      ...(isFeatured !== null && { isFeatured }),
    };

    // Handle tags filtering
    const userSelectedFestiveTags = tags.filter((tag) =>
      festiveList.includes(tag.toLowerCase())
    );
    const otherTags = tags.filter(
      (tag) => !festiveList.includes(tag.toLowerCase())
    );

    if (otherTags.length > 0) {
      query.tags = { $in: otherTags };
    }

    // 🎨 FIXED: Color filtering logic (OR matching - any color matches)
    const selectedColors = colors.filter(Boolean);
    if (selectedColors.length > 0) {
      // Trim and normalize color inputs
      const normalizedColors = selectedColors.map((c) => c.trim());

      // Create regex pattern that matches ANY of the selected colors
      // Using word boundaries (\b) to match exact color words
      // Example: ["Red", "Green"] becomes /\b(Red|Green)\b/i
      const colorPattern = normalizedColors
        .map((c) => escapeRegExp(c))
        .join("|");

      const colorRegex = new RegExp(`\\b(${colorPattern})\\b`, "i");

      // DEBUG: Log the regex pattern and query
      console.log("🎨 Color Filter Applied:", {
        originalColors: selectedColors,
        normalizedColors,
        regexPattern: colorRegex.toString(),
        fullQuery: JSON.stringify(query, null, 2),
      });

      // Match templates where ANY color scheme name contains ANY of the selected colors
      query["metadata.colorSchemes"] = {
        $elemMatch: {
          name: colorRegex,
        },
      };
    }

    if (search) query.$text = { $search: search };

    // 🎯 INTERLEAVED MODE: Show variety by cycling through festives
    const shouldUseInterleavedMode =
      random && !search && userSelectedFestiveTags.length === 0;

    if (shouldUseInterleavedMode) {
      const skip = (page - 1) * limit;
      const pipeline = [];

      // 1️⃣ Match base query (including color filter if present)
      pipeline.push({ $match: query });

      // 2️⃣ Extract festive from tags
      pipeline.push({
        $addFields: {
          festive: {
            $first: {
              $filter: {
                input: "$tags",
                as: "tag",
                cond: { $in: ["$$tag", festiveList] },
              },
            },
          },
        },
      });

      // 3️⃣ Only keep templates with festive tags
      pipeline.push({
        $match: {
          festive: { $exists: true, $ne: null },
        },
      });

      // 4️⃣ Sort within each festive group
      pipeline.push({
        $sort: {
          festive: 1,
          "metrics.usageCount": -1,
          createdAt: -1,
        },
      });

      // 5️⃣ Group by festive
      pipeline.push({
        $group: {
          _id: "$festive",
          templates: { $push: "$$ROOT" },
        },
      });

      // 6️⃣ Unwind with index to get position
      pipeline.push({
        $unwind: {
          path: "$templates",
          includeArrayIndex: "positionInFestive",
        },
      });

      // 7️⃣ Calculate interleaved position
      pipeline.push({
        $addFields: {
          festiveIndex: { $indexOfArray: [festiveList, "$_id"] },
          interleavedPosition: {
            $add: [
              { $multiply: ["$positionInFestive", festiveList.length] },
              { $indexOfArray: [festiveList, "$_id"] },
            ],
          },
        },
      });

      // 8️⃣ Replace root with the actual template
      pipeline.push({
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$templates",
              {
                _interleavedPosition: "$interleavedPosition",
                _festive: "$_id",
                _positionInFestive: "$positionInFestive",
              },
            ],
          },
        },
      });

      // 9️⃣ Sort by interleaved position
      pipeline.push({ $sort: { _interleavedPosition: 1 } });

      // 🔟 Apply pagination
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      // 1️⃣1️⃣ Add the 'id' field
      pipeline.push({
        $addFields: { id: "$_id" },
      });

      // 1️⃣2️⃣ Remove internal debug fields
      pipeline.push({
        $unset: ["_interleavedPosition", "_festive", "_positionInFestive"],
      });

      const templates = await this.aggregate(pipeline).exec();

      const total = await this.countDocuments({
        ...query,
        tags: { $in: festiveList },
      }).exec();

      const totalPages = Math.ceil(total / limit);

      console.log(`📊 Interleaved Page ${page}:`, {
        templatesReturned: templates.length,
        total,
        totalPages,
        skip,
        colorsApplied: selectedColors,
      });

      return {
        templates,
        pagination: {
          page,
          limit,
          total,
          pages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    }

    // 🎨 FILTERED MODE: User selected specific festive tags
    if (userSelectedFestiveTags.length > 0) {
      const festiveQuery = {
        ...query,
        tags: {
          $all: [...otherTags],
          $in: userSelectedFestiveTags,
        },
      };

      if (otherTags.length === 0) {
        festiveQuery.tags = { $in: userSelectedFestiveTags };
      }

      const skip = (page - 1) * limit;

      const [templates, total] = await Promise.all([
        this.find(festiveQuery)
          .select("-status -isPublic -__v -createdAt -updatedAt")
          .sort(sort)
          .limit(limit)
          .skip(skip)
          .lean()
          .exec()
          .then((docs) =>
            docs.map((d) => ({ id: d._id.toString(), ...d, _id: undefined }))
          ),
        this.countDocuments(festiveQuery).exec(),
      ]);

      console.log(
        `🎨 Filtered Mode - Festive: ${userSelectedFestiveTags.join(
          ", "
        )}, Colors: ${selectedColors.join(", ")}`,
        {
          templatesReturned: templates.length,
          total,
        }
      );

      return {
        templates,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    }

    // 🧭 DEFAULT MODE: Normal pagination
    if (tags.length > 0) {
      query.tags = { $in: tags };
    }

    const skip = (page - 1) * limit;

    const [templates, total] = await Promise.all([
      this.find(query)
        .select(
          "name description category tags metadata.colorSchemes images aspectRatio type difficulty metrics isFeatured"
        )
        .sort(search ? { score: { $meta: "textScore" }, ...sort } : sort)
        .limit(limit)
        .skip(skip)
        .lean()
        .exec()
        .then((docs) =>
          docs.map((d) => ({ id: d._id.toString(), ...d, _id: undefined }))
        ),
      this.countDocuments(query).exec(),
    ]);

    console.log(`🧭 Default Mode:`, {
      templatesReturned: templates.length,
      total,
      colorsApplied: selectedColors,
      sampleColorSchemes: templates.slice(0, 3).map((t) => ({
        name: t.name,
        colorSchemes: t.metadata?.colorSchemes?.map((cs) => cs.name),
      })),
    });

    return {
      templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  },

  // 🔧 Helper function to generate consistent hash from string
  // Add this as a static method or outside function
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  },

  /**
   * Get template filter options
   * @returns {Promise<Object>} Available filter options
   */
  async getFilterOptions() {
    const pipeline = [
      {
        $match: {
          status: "active",
          isPublic: true,
        },
      },
      {
        $group: {
          _id: null,
          categories: { $addToSet: "$category" },
          types: { $addToSet: "$type" },
          difficulties: { $addToSet: "$difficulty" },
          aspectRatios: { $addToSet: "$aspectRatio.ratio" },
          allTags: { $push: "$tags" },
        },
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
              input: "$allTags",
              initialValue: [],
              in: { $setUnion: ["$$value", "$$this"] },
            },
          },
        },
      },
    ];

    const result = await this.aggregate(pipeline).exec();
    return (
      result[0] || {
        categories: [],
        types: [],
        difficulties: [],
        aspectRatios: [],
        tags: [],
      }
    );
  },

  /**
   * Get featured templates
   * @param {number} limit - Number of templates to return
   * @returns {Promise<Template[]>} Featured templates
   */
  async getFeaturedTemplates(limit = 10) {
    return this.find({
      status: "active",
      isPublic: true,
      isFeatured: true,
    })
      .select("name description images aspectRatio type metrics isFeatured")
      .sort({ "metrics.usageCount": -1, createdAt: -1 })
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
      status: "active",
      isPublic: true,
    })
      .select("name description images aspectRatio type metrics")
      .sort({ "metrics.usageCount": -1, "metrics.rating": -1 })
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
      status: "active",
      isPublic: true,
    })
      .select("name description images aspectRatio type metrics")
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
      status: "active",
      isPublic: true,
    }).exec();
  },

  /**
   * Get tags typeahead suggestions
   * @param {string} query - Search query for tags
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Matching tags with counts
   */
  async getTagsTypeahead(query, limit = 8) {
    // Escape special regex characters in query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const pipeline = [
      {
        $match: {
          status: 'active',
          isPublic: true,
        },
      },
      { $unwind: '$tags' },
      {
        $match: {
          tags: { $regex: `^${escapedQuery}`, $options: 'i' },
        },
      },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          tag: '$_id',
          count: 1,
        },
      },
    ];

    return this.aggregate(pipeline).exec();
  },

  /**
   * Get template statistics
   * @returns {Promise<Object>} Template statistics
   */
  async getTemplateStats() {
    const pipeline = [
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalUsage: { $sum: "$metrics.usageCount" },
          avgRating: { $avg: "$metrics.rating" },
        },
      },
    ];

    const statusStats = await this.aggregate(pipeline).exec();

    const totalTemplates = await this.countDocuments().exec();
    const activeTemplates = await this.countDocuments({
      status: "active",
    }).exec();
    const featuredTemplates = await this.countDocuments({
      isFeatured: true,
      status: "active",
    }).exec();

    return {
      total: totalTemplates,
      active: activeTemplates,
      featured: featuredTemplates,
      byStatus: statusStats,
      totalUsage: statusStats.reduce(
        (sum, stat) => sum + (stat.totalUsage || 0),
        0
      ),
    };
  },
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
      throw new Error("Rating must be between 1 and 5");
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
    this.status = "archived";
    return this.save();
  },

  /**
   * Activate template
   * @returns {Promise<Template>} Updated template
   */
  async activate() {
    this.status = "active";
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
        rating: Math.round(this.metrics.rating * 10) / 10, // Round to 1 decimal
      },
      isFeatured: this.isFeatured,
    };
  },
};

const Template = mongoose.model("Template", templateSchema);

module.exports = Template;
