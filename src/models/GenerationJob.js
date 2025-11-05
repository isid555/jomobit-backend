const mongoose = require("mongoose");

/**
 * Generation Job Schema
 * Tracks AI poster generation jobs and their status
 */
const generationJobSchema = new mongoose.Schema(
  {
    // User reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Business profile reference
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessProfile",
      required: true,
      index: true,
    },

    // Template reference
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      required: true,
      index: true,
    },

    // Job status
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },

    // Credits reserved for this job
    creditsReserved: {
      type: Number,
      required: true,
      min: 0,
    },

    // AI provider configuration
    aiProvider: {
      llm: {
        type: String,
        required: true,
        enum: ["openai", "gemini"],
        index: true,
      },
      diffusion: {
        type: String,
        required: true,
        enum: ["openai", "ideogram", "nano_banana"],
        index: true,
      },
    },

    // Generated prompt information
    prompt: {
      generated: {
        type: String,
        maxlength: 2500,
      },
      parameters: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      generatedAt: {
        type: Date,
      },
    },

    // Generation result
    result: {
      imageUrl: {
        type: String, // Final ImageKit URL
      },
      imagekitFileId: {
        type: String, // ImageKit file ID for management
      },
      thumbnailUrl: {
        type: String, // Thumbnail URL
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },

    // External service job tracking
    externalJobId: {
      type: String,
      index: true,
    },

    // Webhook data from AI services
    webhookData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Processing times
    timing: {
      promptGenerationTime: {
        type: Number, // milliseconds
      },
      imageGenerationTime: {
        type: Number, // milliseconds
      },
      totalProcessingTime: {
        type: Number, // milliseconds
      },
    },

    // Error information
    error: {
      message: {
        type: String,
      },
      code: {
        type: String,
      },
      provider: {
        type: String,
      },
      details: {
        type: mongoose.Schema.Types.Mixed,
      },
      occurredAt: {
        type: Date,
      },
    },

    // Retry information
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },

    // Job priority (for queue processing)
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
      index: true,
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    startedAt: {
      type: Date,
      index: true,
    },

    completedAt: {
      type: Date,
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
        delete ret.webhookData; // Don't expose webhook data in API
        return ret;
      },
    },
  }
);

// Compound indexes for performance
generationJobSchema.index({ userId: 1, status: 1, createdAt: -1 });
generationJobSchema.index({ userId: 1, profileId: 1, createdAt: -1 });
generationJobSchema.index({ status: 1, createdAt: 1 }); // For job processing queue
generationJobSchema.index({ externalJobId: 1, status: 1 });
generationJobSchema.index({
  "aiProvider.llm": 1,
  "aiProvider.diffusion": 1,
  status: 1,
});

// Pre-save middleware
generationJobSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }

  // Set timestamps based on status changes
  if (this.isModified("status")) {
    const now = new Date();

    if (this.status === "processing" && !this.startedAt) {
      this.startedAt = now;
    }

    if (
      ["completed", "failed", "cancelled"].includes(this.status) &&
      !this.completedAt
    ) {
      this.completedAt = now;

      // Calculate total processing time
      if (this.startedAt) {
        this.timing.totalProcessingTime =
          now.getTime() - this.startedAt.getTime();
      }
    }
  }

  next();
});

// Static methods
generationJobSchema.statics = {
  /**
   * Create new generation job
   * @param {Object} jobData - Job creation data
   * @returns {Promise<GenerationJob>} Created job
   */
  async createJob(jobData) {
    const {
      userId,
      profileId,
      templateId,
      creditsReserved,
      aiProvider,
      priority = "normal",
    } = jobData;

    return this.create({
      userId,
      profileId,
      templateId,
      creditsReserved,
      aiProvider,
      priority,
      status: "pending",
    });
  },

  /**
   * Get user's generation history
   * @param {ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated job history
   */
  async getUserGenerationHistory(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
      profileId = null,
      startDate = null,
      endDate = null,
      sortBy, // <-- Get the raw value
      sortOrder, // <-- Get the raw value
    } = options;

    // Your query logic is perfect
    const query = { userId };
    if (status) query.status = status;
    if (profileId) query.profileId = profileId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    // --- NEW LOGIC START ---

    // 1. Set a default sort object
    let sortQuery = { createdAt: -1 };

    // 2. Check if custom sorting is provided
    if (sortBy && sortOrder) {
      // 3. Convert 'asc'/'desc' to 1/-1 for MongoDB
      const direction = sortOrder.toLowerCase() === "desc" ? -1 : 1;

      // 4. Create the dynamic sort object
      // We use [sortBy] to use the *value* of the sortBy variable as the key
      sortQuery = { [sortBy]: direction };
    }

    // --- NEW LOGIC END ---

    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      this.find(query)
        .populate("profileId", "name")
        .populate("templateId", "name images.thumbnail aspectRatio")
        .sort(sortQuery) // <-- Use the new dynamic sortQuery
        .limit(limit)
        .skip(skip)
        .exec(),
      this.countDocuments(query).exec(),
    ]);

    return {
      jobs,
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

  /**
   * Get job by ID for user
   * @param {ObjectId} jobId - Job ID
   * @param {ObjectId} userId - User ID for validation
   * @returns {Promise<GenerationJob|null>} Job or null
   */
  async getJobByIdForUser(jobId, userId) {
    return this.findOne({ _id: jobId, userId })
      .populate("profileId", "name")
      .populate("templateId", "name images aspectRatio")
      .exec();
  },

  /**
   * Get job by external job ID
   * @param {string} externalJobId - External service job ID
   * @returns {Promise<GenerationJob|null>} Job or null
   */
  async getJobByExternalId(externalJobId) {
    return this.findOne({ externalJobId }).exec();
  },

  /**
   * Get pending jobs for processing
   * @param {number} limit - Number of jobs to return
   * @returns {Promise<GenerationJob[]>} Pending jobs
   */
  async getPendingJobs(limit = 10) {
    return this.find({ status: "pending" })
      .populate("userId", "email")
      .populate("profileId")
      .populate("templateId")
      .sort({ priority: -1, createdAt: 1 }) // High priority first, then FIFO
      .limit(limit)
      .exec();
  },

  /**
   * Get job statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Job statistics
   */
  async getJobStats(filters = {}) {
    const { startDate = null, endDate = null, userId = null } = filters;

    const matchStage = {};

    if (userId) matchStage.userId = new mongoose.Types.ObjectId(userId);

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalJobs: { $sum: 1 },
          completedJobs: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          failedJobs: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          pendingJobs: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          processingJobs: {
            $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] },
          },
          totalCreditsUsed: { $sum: "$creditsReserved" },
          avgProcessingTime: { $avg: "$timing.totalProcessingTime" },
        },
      },
    ];

    const result = await this.aggregate(pipeline).exec();
    const stats = result[0] || {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      pendingJobs: 0,
      processingJobs: 0,
      totalCreditsUsed: 0,
      avgProcessingTime: 0,
    };

    // Calculate success rate
    stats.successRate =
      stats.totalJobs > 0
        ? Math.round((stats.completedJobs / stats.totalJobs) * 100)
        : 0;

    return stats;
  },

  /**
   * Get jobs that need cleanup (old failed/completed jobs)
   * @param {number} daysOld - Days old threshold
   * @returns {Promise<GenerationJob[]>} Jobs to cleanup
   */
  async getJobsForCleanup(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.find({
      status: { $in: ["completed", "failed", "cancelled"] },
      completedAt: { $lt: cutoffDate },
    }).exec();
  },
};

// Instance methods
generationJobSchema.methods = {
  /**
   * Start job processing
   * @param {string} externalJobId - External service job ID
   * @returns {Promise<GenerationJob>} Updated job
   */
  async startProcessing(externalJobId = null) {
    this.status = "processing";
    this.startedAt = new Date();
    if (externalJobId) {
      this.externalJobId = externalJobId;
    }
    return this.save();
  },

  /**
   * Complete job successfully
   * @param {Object} result - Generation result
   * @returns {Promise<GenerationJob>} Updated job
   */
  async complete(result) {
    this.status = "completed";
    this.result = result;
    this.completedAt = new Date();
    return this.save();
  },

  /**
   * Mark job as failed
   * @param {Object} error - Error information
   * @returns {Promise<GenerationJob>} Updated job
   */
  async fail(error) {
    this.status = "failed";
    this.error = {
      message: error.message,
      code: error.code,
      provider: error.provider,
      details: error.details,
      occurredAt: new Date(),
    };
    this.completedAt = new Date();
    return this.save();
  },

  /**
   * Cancel job
   * @param {string} reason - Cancellation reason
   * @returns {Promise<GenerationJob>} Updated job
   */
  async cancel(reason = "User cancelled") {
    this.status = "cancelled";
    this.error = {
      message: reason,
      code: "CANCELLED",
      occurredAt: new Date(),
    };
    this.completedAt = new Date();
    return this.save();
  },

  /**
   * Update prompt information
   * @param {string} prompt - Generated prompt
   * @param {Object} parameters - Prompt parameters
   * @returns {Promise<GenerationJob>} Updated job
   */
  async updatePrompt(prompt, parameters = {}) {
    this.prompt = {
      generated: prompt,
      parameters,
      generatedAt: new Date(),
    };
    return this.save();
  },

  /**
   * Update webhook data
   * @param {Object} data - Webhook data
   * @returns {Promise<GenerationJob>} Updated job
   */
  async updateWebhookData(data) {
    this.webhookData = { ...this.webhookData, ...data };
    return this.save();
  },

  /**
   * Increment retry count
   * @returns {Promise<GenerationJob>} Updated job
   */
  async incrementRetry() {
    this.retryCount += 1;
    return this.save();
  },

  /**
   * Check if job can be retried
   * @returns {boolean} True if job can be retried
   */
  canRetry() {
    return this.retryCount < 3 && ["failed", "cancelled"].includes(this.status);
  },

  /**
   * Get job summary for API response
   * @returns {Object} Job summary
   */
  getSummary() {
    return {
      id: this._id,
      status: this.status,
      creditsReserved: this.creditsReserved,
      aiProvider: this.aiProvider,
      result: this.result,
      error: this.error,
      timing: this.timing,
      retryCount: this.retryCount,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
    };
  },

  /**
   * Check if job is in final state
   * @returns {boolean} True if job is in final state
   */
  isFinal() {
    return ["completed", "failed", "cancelled"].includes(this.status);
  },

  /**
   * Get processing duration in milliseconds
   * @returns {number|null} Processing duration or null
   */
  getProcessingDuration() {
    // Use timing.totalProcessingTime if available
    if (this.timing && this.timing.totalProcessingTime) {
      return this.timing.totalProcessingTime;
    }

    // Fall back to timestamp calculation
    if (this.startedAt && this.completedAt) {
      return this.completedAt.getTime() - this.startedAt.getTime();
    }

    return null;
  },
};

const GenerationJob = mongoose.model("GenerationJob", generationJobSchema);

module.exports = GenerationJob;
