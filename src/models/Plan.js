const mongoose = require("mongoose");

/**
 * Plan Schema
 * Defines subscription plans with features and pricing
 */
const planSchema = new mongoose.Schema(
  {
    // Plan name
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },

    // Plan identifier (for internal use)
    planId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Plan description
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Pricing information
    pricing: {
      amount: {
        type: Number,
        required: true,
        min: 0,
      },
      currency: {
        type: String,
        required: true,
        uppercase: true,
        default: "INR",
      },
      interval: {
        type: String,
        enum: ["monthly", "yearly"],
        required: true,
        default: "monthly",
      },
      intervalCount: {
        type: Number,
        default: 1,
        min: 1,
      },
    },

    // Plan features and limits
    features: {
      // Credit allocation
      credits: {
        monthly: {
          type: Number,
          required: true,
          min: 0,
        },
        rollover: {
          type: Boolean,
          default: false,
        },
      },

      // Business profile limits
      businessProfiles: {
        limit: {
          type: Number,
          required: true,
          min: 1,
        },
      },

      // Template access
      templates: {
        access: {
          type: String,
          enum: ["basic", "premium", "all"],
          default: "basic",
        },
        customTemplates: {
          type: Boolean,
          default: false,
        },
      },

      // AI provider access
      aiProviders: {
        llm: [
          {
            type: String,
            enum: ["openai", "gemini"],
          },
        ],
        diffusion: [
          {
            type: String,
            enum: ["openai", "ideogram", "nano_banana"],
          },
        ],
      },

      // Additional features
      additional: {
        prioritySupport: {
          type: Boolean,
          default: false,
        },
        analytics: {
          type: Boolean,
          default: false,
        },
        apiAccess: {
          type: Boolean,
          default: false,
        },
        whiteLabel: {
          type: Boolean,
          default: false,
        },
        bulkGeneration: {
          type: Boolean,
          default: false,
        },
      },
    },

    // Plan tier/level
    tier: {
      type: String,
      enum: ["free", "basic", "premium", "enterprise"],
      required: true,
      index: true,
    },

    // Plan status
    status: {
      type: String,
      enum: ["active", "inactive", "deprecated"],
      default: "active",
      index: true,
    },

    // Plan visibility
    isPublic: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Featured plan flag
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Plan ordering (for display)
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },

    // Razorpay plan ID
    razorpayPlanId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // Trial information
    trial: {
      enabled: {
        type: Boolean,
        default: false,
      },
      duration: {
        type: Number, // days
        default: 0,
      },
    },

    // Plan metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

// Compound indexes for performance
planSchema.index({ status: 1, isPublic: 1, sortOrder: 1 });
planSchema.index({ tier: 1, status: 1 });

// Pre-save middleware
planSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Static methods
planSchema.statics = {
  /**
   * Get all public active plans
   * @param {Object} options - Query options
   * @returns {Promise<Plan[]>} Public plans
   */
  async getPublicPlans(options = {}) {
    const { includeFree = true, sort = { sortOrder: 1, "pricing.amount": 1 } } =
      options;

    const query = {
      status: "active",
      isPublic: true,
    };

    if (!includeFree) {
      query["pricing.amount"] = { $gt: 0 };
    }

    return this.find(query).sort(sort).exec();
  },

  /**
   * Get all active public plans (alias for getPublicPlans)
   * @param {Object} options - Query options
   * @returns {Promise<Plan[]>} Active plans
   */
  async getActivePlans(options = {}) {
    return this.getPublicPlans(options);
  },

  /**
   * Get plan by plan ID
   * @param {string} planId - Plan identifier
   * @returns {Promise<Plan|null>} Plan or null
   */
  async getByPlanId(planId) {
    return this.findOne({
      planId: planId.toLowerCase(),
      status: "active",
    }).exec();
  },

  /**
   * Get plan by Razorpay plan ID
   * @param {string} razorpayPlanId - Razorpay plan ID
   * @returns {Promise<Plan|null>} Plan or null
   */
  async getByRazorpayId(razorpayPlanId) {
    return this.findOne({ razorpayPlanId }).exec();
  },

  /**
   * Get featured plans
   * @param {number} limit - Number of plans to return
   * @returns {Promise<Plan[]>} Featured plans
   */
  async getFeaturedPlans(limit = 3) {
    return this.find({
      status: "active",
      isPublic: true,
      isFeatured: true,
    })
      .sort({ sortOrder: 1 })
      .limit(limit)
      .exec();
  },

  /**
   * Get free plan
   * @returns {Promise<Plan|null>} Free plan or null
   */
  async getFreePlan() {
    return this.findOne({
      tier: "free",
      status: "active",
      "pricing.amount": 0,
    }).exec();
  },

  /**
   * Get plans by tier
   * @param {string} tier - Plan tier
   * @returns {Promise<Plan[]>} Plans in tier
   */
  async getPlansByTier(tier) {
    return this.find({
      tier,
      status: "active",
      isPublic: true,
    })
      .sort({ sortOrder: 1 })
      .exec();
  },

  /**
   * Create default plans
   * @returns {Promise<Plan[]>} Created plans
   */
  async createDefaultPlans() {
    const defaultPlans = [
      {
        name: "Free",
        planId: "free",
        description: "Perfect for trying out Jomobit",
        pricing: {
          amount: 0,
          currency: "INR",
          interval: "monthly",
        },
        features: {
          credits: {
            monthly: 3,
            rollover: false,
          },
          businessProfiles: {
            limit: 1,
          },
          templates: {
            access: "basic",
            customTemplates: false,
          },
          aiProviders: {
            llm: ["openai"],
            diffusion: ["openai"],
          },
          additional: {
            prioritySupport: false,
            analytics: false,
            apiAccess: false,
            whiteLabel: false,
            bulkGeneration: false,
          },
        },
        tier: "free",
        sortOrder: 1,
        isPublic: true,
        isFeatured: false,
      },
      {
        name: "Plus",
        planId: "plus",
        description: "Great for small businesses and entrepreneurs",
        pricing: {
          amount: 2500, // ₹25.00
          currency: "INR",
          interval: "monthly",
        },
        features: {
          credits: {
            monthly: 50,
            rollover: false,
          },
          businessProfiles: {
            limit: 3,
          },
          templates: {
            access: "premium",
            customTemplates: false,
          },
          aiProviders: {
            llm: ["openai", "gemini"],
            diffusion: ["openai", "ideogram", "nano_banana"],
          },
          additional: {
            prioritySupport: true,
            analytics: true,
            apiAccess: false,
            whiteLabel: false,
            bulkGeneration: false,
          },
        },
        tier: "basic",
        sortOrder: 2,
        isPublic: true,
        isFeatured: true,
      },
      {
        name: "Pro",
        planId: "pro",
        description: "Perfect for growing businesses and agencies",
        pricing: {
          amount: 5900, // ₹59.00
          currency: "INR",
          interval: "monthly",
        },
        features: {
          credits: {
            monthly: 120,
            rollover: true,
          },
          businessProfiles: {
            limit: 8,
          },
          templates: {
            access: "all",
            customTemplates: true,
          },
          aiProviders: {
            llm: ["openai", "gemini"],
            diffusion: ["openai", "ideogram", "nano_banana"],
          },
          additional: {
            prioritySupport: true,
            analytics: true,
            apiAccess: true,
            whiteLabel: true,
            bulkGeneration: true,
          },
        },
        tier: "premium",
        sortOrder: 3,
        isPublic: true,
        isFeatured: true,
      },
    ];

    const createdPlans = [];
    for (const planData of defaultPlans) {
      const existingPlan = await this.findOne({ planId: planData.planId });
      if (!existingPlan) {
        const plan = await this.create(planData);
        createdPlans.push(plan);
      }
    }

    return createdPlans;
  },

  /**
   * Get plan comparison data
   * @returns {Promise<Object>} Plan comparison data
   */
  async getPlanComparison() {
    const plans = await this.getPublicPlans();

    return plans.map((plan) => ({
      id: plan._id,
      name: plan.name,
      planId: plan.planId,
      description: plan.description,
      pricing: plan.pricing,
      features: plan.features,
      tier: plan.tier,
      isFeatured: plan.isFeatured,
      trial: plan.trial,
    }));
  },
};

// Instance methods
planSchema.methods = {
  /**
   * Check if plan has feature
   * @param {string} featurePath - Feature path (e.g., 'additional.analytics')
   * @returns {boolean} True if plan has feature
   */
  hasFeature(featurePath) {
    const keys = featurePath.split(".");
    let current = this.features;

    for (const key of keys) {
      if (current[key] === undefined) return false;
      current = current[key];
    }

    return Boolean(current);
  },

  /**
   * Get feature value
   * @param {string} featurePath - Feature path
   * @returns {any} Feature value
   */
  getFeatureValue(featurePath) {
    const keys = featurePath.split(".");
    let current = this.features;

    for (const key of keys) {
      if (current[key] === undefined) return null;
      current = current[key];
    }

    return current;
  },

  /**
   * Check if plan supports AI provider
   * @param {string} providerType - Provider type ('llm' or 'diffusion')
   * @param {string} provider - Provider name
   * @returns {boolean} True if supported
   */
  supportsAIProvider(providerType, provider) {
    const providers = this.features.aiProviders[providerType] || [];
    return providers.includes(provider);
  },

  /**
   * Get monthly price in smallest currency unit
   * @returns {number} Monthly price
   */
  getMonthlyPrice() {
    if (this.pricing.interval === "yearly") {
      return Math.round(this.pricing.amount / 12);
    }
    return this.pricing.amount;
  },

  /**
   * Get yearly price in smallest currency unit
   * @returns {number} Yearly price
   */
  getYearlyPrice() {
    if (this.pricing.interval === "monthly") {
      return this.pricing.amount * 12;
    }
    return this.pricing.amount;
  },

  /**
   * Calculate prorated amount for upgrade/downgrade
   * @param {Plan} newPlan - New plan to upgrade/downgrade to
   * @param {Date} changeDate - Date of change
   * @param {Date} periodEnd - Current period end
   * @returns {number} Prorated amount
   */
  calculateProratedAmount(newPlan, changeDate = new Date(), periodEnd) {
    const remainingDays = Math.ceil(
      (periodEnd - changeDate) / (1000 * 60 * 60 * 24)
    );
    const totalDays = this.pricing.interval === "monthly" ? 30 : 365;

    const currentPlanDailyRate = this.getMonthlyPrice() / 30;
    const newPlanDailyRate = newPlan.getMonthlyPrice() / 30;

    const refundAmount = currentPlanDailyRate * remainingDays;
    const chargeAmount = newPlanDailyRate * remainingDays;

    return Math.round(chargeAmount - refundAmount);
  },

  /**
   * Activate plan
   * @returns {Promise<Plan>} Updated plan
   */
  async activate() {
    this.status = "active";
    return this.save();
  },

  /**
   * Deactivate plan
   * @returns {Promise<Plan>} Updated plan
   */
  async deactivate() {
    this.status = "inactive";
    return this.save();
  },

  /**
   * Deprecate plan
   * @returns {Promise<Plan>} Updated plan
   */
  async deprecate() {
    this.status = "deprecated";
    this.isPublic = false;
    return this.save();
  },

  /**
   * Toggle featured status
   * @returns {Promise<Plan>} Updated plan
   */
  async toggleFeatured() {
    this.isFeatured = !this.isFeatured;
    return this.save();
  },

  /**
   * Get plan summary for API response
   * @returns {Object} Plan summary
   */
  getSummary() {
    return {
      id: this._id,
      name: this.name,
      planId: this.planId,
      description: this.description,
      pricing: this.pricing,
      features: this.features,
      tier: this.tier,
      isFeatured: this.isFeatured,
      trial: this.trial,
      monthlyPrice: this.getMonthlyPrice(),
      yearlyPrice: this.getYearlyPrice(),
    };
  },
};

const Plan = mongoose.model("Plan", planSchema);

module.exports = Plan;
