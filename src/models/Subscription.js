const mongoose = require('mongoose');

/**
 * Subscription Schema
 * Manages user subscriptions and billing information
 */
const subscriptionSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Plan reference
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true,
    index: true
  },
  
  // Razorpay subscription ID
  razorpaySubscriptionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Subscription status
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'paused', 'pending'],
    default: 'pending',
    index: true
  },
  
  // Billing cycle information
  currentPeriodStart: {
    type: Date,
    required: true,
    index: true
  },
  
  currentPeriodEnd: {
    type: Date,
    required: true,
    index: true
  },
  
  // Cancellation settings
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
    index: true
  },
  
  cancelledAt: {
    type: Date,
    index: true
  },
  
  cancellationReason: {
    type: String,
    trim: true
  },
  
  // Trial information
  trialStart: {
    type: Date
  },
  
  trialEnd: {
    type: Date,
    index: true
  },
  
  // Billing information
  billing: {
    currency: {
      type: String,
      default: 'INR',
      uppercase: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    interval: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly'
    },
    intervalCount: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  
  // Payment history
  billingHistory: [{
    razorpayPaymentId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      required: true,
      uppercase: true
    },
    status: {
      type: String,
      enum: ['paid', 'failed', 'pending', 'refunded'],
      required: true
    },
    paymentMethod: {
      type: String,
      trim: true
    },
    paidAt: {
      type: Date,
      required: true
    },
    failureReason: {
      type: String,
      trim: true
    },
    webhookData: {
      type: mongoose.Schema.Types.Mixed
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Discount information
  discount: {
    couponCode: {
      type: String,
      trim: true,
      uppercase: true
    },
    discountPercent: {
      type: Number,
      min: 0,
      max: 100
    },
    discountAmount: {
      type: Number,
      min: 0
    },
    validUntil: {
      type: Date
    }
  },
  
  // Upgrade/downgrade tracking
  planChanges: [{
    fromPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan'
    },
    toPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true
    },
    changeType: {
      type: String,
      enum: ['upgrade', 'downgrade', 'change'],
      required: true
    },
    proratedAmount: {
      type: Number
    },
    effectiveDate: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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
      // Don't expose sensitive webhook data
      if (ret.billingHistory) {
        ret.billingHistory = ret.billingHistory.map(bill => {
          const { webhookData, ...safeBill } = bill;
          return safeBill;
        });
      }
      return ret;
    }
  }
});

// Compound indexes for performance
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ razorpaySubscriptionId: 1, status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1, cancelAtPeriodEnd: 1 });

// Pre-save middleware
subscriptionSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  
  // Set cancellation timestamp
  if (this.isModified('status') && this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
  
  next();
});

// Static methods
subscriptionSchema.statics = {
  /**
   * Create new subscription
   * @param {Object} subscriptionData - Subscription data
   * @returns {Promise<Subscription>} Created subscription
   */
  async createSubscription(subscriptionData) {
    const {
      userId,
      planId,
      razorpaySubscriptionId,
      currentPeriodStart,
      currentPeriodEnd,
      billing,
      trialStart = null,
      trialEnd = null
    } = subscriptionData;

    return this.create({
      userId,
      planId,
      razorpaySubscriptionId,
      currentPeriodStart,
      currentPeriodEnd,
      billing,
      trialStart,
      trialEnd,
      status: trialEnd ? 'active' : 'pending'
    });
  },

  /**
   * Get user's active subscription
   * @param {ObjectId} userId - User ID
   * @returns {Promise<Subscription|null>} Active subscription or null
   */
  async getUserActiveSubscription(userId) {
    return this.findOne({
      userId,
      status: 'active'
    })
    .populate('planId')
    .exec();
  },

  /**
   * Get subscription by Razorpay ID
   * @param {string} razorpaySubscriptionId - Razorpay subscription ID
   * @returns {Promise<Subscription|null>} Subscription or null
   */
  async getByRazorpayId(razorpaySubscriptionId) {
    return this.findOne({ razorpaySubscriptionId })
      .populate('userId', 'email metadata.name')
      .populate('planId')
      .exec();
  },

  /**
   * Get user's subscription history
   * @param {ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Subscription[]>} Subscription history
   */
  async getUserSubscriptionHistory(userId, options = {}) {
    const {
      limit = 10,
      skip = 0,
      sort = { createdAt: -1 }
    } = options;

    return this.find({ userId })
      .populate('planId', 'name price')
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .exec();
  },

  /**
   * Get subscriptions expiring soon
   * @param {number} days - Days ahead to check
   * @returns {Promise<Subscription[]>} Expiring subscriptions
   */
  async getExpiringSoon(days = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.find({
      status: 'active',
      currentPeriodEnd: { $lte: futureDate },
      cancelAtPeriodEnd: false
    })
    .populate('userId', 'email metadata.name')
    .populate('planId', 'name')
    .exec();
  },

  /**
   * Get subscriptions to cancel
   * @returns {Promise<Subscription[]>} Subscriptions to cancel
   */
  async getSubscriptionsToCancel() {
    return this.find({
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { $lte: new Date() }
    })
    .populate('userId', 'email')
    .populate('planId', 'name')
    .exec();
  },

  /**
   * Get subscription statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Subscription statistics
   */
  async getSubscriptionStats(filters = {}) {
    const {
      startDate = null,
      endDate = null
    } = filters;

    const matchStage = {};
    
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$billing.amount' }
        }
      }
    ];

    const statusStats = await this.aggregate(pipeline).exec();
    
    // Get additional metrics
    const totalSubscriptions = await this.countDocuments(matchStage).exec();
    const activeSubscriptions = await this.countDocuments({ 
      ...matchStage, 
      status: 'active' 
    }).exec();
    
    const monthlyRevenue = await this.aggregate([
      {
        $match: {
          ...matchStage,
          status: 'active',
          'billing.interval': 'monthly'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$billing.amount' }
        }
      }
    ]).exec();

    return {
      total: totalSubscriptions,
      active: activeSubscriptions,
      byStatus: statusStats,
      monthlyRecurringRevenue: monthlyRevenue[0]?.totalRevenue || 0
    };
  }
};

// Instance methods
subscriptionSchema.methods = {
  /**
   * Add payment to billing history
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Subscription>} Updated subscription
   */
  async addPayment(paymentData) {
    this.billingHistory.push({
      razorpayPaymentId: paymentData.razorpayPaymentId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: paymentData.status,
      paymentMethod: paymentData.paymentMethod,
      paidAt: paymentData.paidAt,
      failureReason: paymentData.failureReason,
      webhookData: paymentData.webhookData
    });
    
    return this.save();
  },

  /**
   * Update subscription period
   * @param {Date} periodStart - New period start
   * @param {Date} periodEnd - New period end
   * @returns {Promise<Subscription>} Updated subscription
   */
  async updatePeriod(periodStart, periodEnd) {
    this.currentPeriodStart = periodStart;
    this.currentPeriodEnd = periodEnd;
    return this.save();
  },

  /**
   * Cancel subscription
   * @param {boolean} immediately - Cancel immediately or at period end
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Subscription>} Updated subscription
   */
  async cancel(immediately = false, reason = null) {
    if (immediately) {
      this.status = 'cancelled';
      this.cancelledAt = new Date();
    } else {
      this.cancelAtPeriodEnd = true;
    }
    
    if (reason) {
      this.cancellationReason = reason;
    }
    
    return this.save();
  },

  /**
   * Reactivate cancelled subscription
   * @returns {Promise<Subscription>} Updated subscription
   */
  async reactivate() {
    this.status = 'active';
    this.cancelAtPeriodEnd = false;
    this.cancelledAt = null;
    this.cancellationReason = null;
    return this.save();
  },

  /**
   * Change subscription plan
   * @param {ObjectId} newPlanId - New plan ID
   * @param {string} changeType - Type of change
   * @param {number} proratedAmount - Prorated amount
   * @param {string} reason - Change reason
   * @returns {Promise<Subscription>} Updated subscription
   */
  async changePlan(newPlanId, changeType, proratedAmount = 0, reason = null) {
    this.planChanges.push({
      fromPlanId: this.planId,
      toPlanId: newPlanId,
      changeType,
      proratedAmount,
      effectiveDate: new Date(),
      reason
    });
    
    this.planId = newPlanId;
    return this.save();
  },

  /**
   * Apply discount
   * @param {Object} discountData - Discount information
   * @returns {Promise<Subscription>} Updated subscription
   */
  async applyDiscount(discountData) {
    this.discount = {
      couponCode: discountData.couponCode,
      discountPercent: discountData.discountPercent,
      discountAmount: discountData.discountAmount,
      validUntil: discountData.validUntil
    };
    
    return this.save();
  },

  /**
   * Check if subscription is in trial
   * @returns {boolean} True if in trial period
   */
  isInTrial() {
    if (!this.trialEnd) return false;
    return new Date() <= this.trialEnd;
  },

  /**
   * Check if subscription is active
   * @returns {boolean} True if subscription is active
   */
  isActive() {
    return this.status === 'active' && new Date() <= this.currentPeriodEnd;
  },

  /**
   * Get days until renewal
   * @returns {number} Days until renewal
   */
  getDaysUntilRenewal() {
    const now = new Date();
    const diffTime = this.currentPeriodEnd.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Get total amount paid
   * @returns {number} Total amount paid
   */
  getTotalAmountPaid() {
    return this.billingHistory
      .filter(payment => payment.status === 'paid')
      .reduce((total, payment) => total + payment.amount, 0);
  },

  /**
   * Get subscription summary
   * @returns {Object} Subscription summary
   */
  getSummary() {
    return {
      id: this._id,
      status: this.status,
      currentPeriodStart: this.currentPeriodStart,
      currentPeriodEnd: this.currentPeriodEnd,
      cancelAtPeriodEnd: this.cancelAtPeriodEnd,
      billing: this.billing,
      isInTrial: this.isInTrial(),
      isActive: this.isActive(),
      daysUntilRenewal: this.getDaysUntilRenewal(),
      totalAmountPaid: this.getTotalAmountPaid(),
      discount: this.discount
    };
  }
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;