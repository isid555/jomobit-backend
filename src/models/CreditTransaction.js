const mongoose = require('mongoose');

/**
 * Credit Transaction Schema
 * Maintains audit trail for all credit operations
 */
const creditTransactionSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Transaction type
  type: {
    type: String,
    enum: ['grant', 'reserve', 'deduct', 'release', 'expire'],
    required: true,
    index: true
  },
  
  // Credit amount (positive for additions, negative for deductions)
  amount: {
    type: Number,
    required: true
  },
  
  // Type of credits affected
  creditType: {
    type: String,
    enum: ['default', 'subscription', 'mixed'],
    required: true,
    index: true
  },
  
  // Reference information
  reference: {
    type: {
      type: String,
      enum: ['registration', 'subscription', 'generation', 'expiry', 'admin', 'refund'],
      required: true,
      index: true
    },
    id: {
      type: String, // Job ID, subscription ID, admin action ID, etc.
      index: true
    },
    description: String
  },
  
  // Wallet balance before transaction
  balanceBefore: {
    defaultCredits: { type: Number, required: true },
    subscriptionCredits: { type: Number, required: true },
    reservedCredits: { type: Number, required: true },
    totalCredits: { type: Number, required: true }
  },
  
  // Wallet balance after transaction
  balanceAfter: {
    defaultCredits: { type: Number, required: true },
    subscriptionCredits: { type: Number, required: true },
    reservedCredits: { type: Number, required: true },
    totalCredits: { type: Number, required: true }
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Transaction timestamp
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for performance
creditTransactionSchema.index({ userId: 1, createdAt: -1 });
creditTransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });
creditTransactionSchema.index({ 'reference.type': 1, 'reference.id': 1 });
creditTransactionSchema.index({ type: 1, createdAt: -1 });
creditTransactionSchema.index({ creditType: 1, createdAt: -1 });

// Static methods
creditTransactionSchema.statics = {
  /**
   * Create transaction record
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<CreditTransaction>} Created transaction
   */
  async createTransaction(transactionData) {
    const {
      userId,
      type,
      amount,
      creditType,
      reference,
      balanceBefore,
      balanceAfter,
      metadata = {}
    } = transactionData;

    return this.create({
      userId,
      type,
      amount,
      creditType,
      reference,
      balanceBefore,
      balanceAfter,
      metadata
    });
  },

  /**
   * Get user transaction history
   * @param {ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<CreditTransaction[]>} Transaction history
   */
  async getUserTransactionHistory(userId, options = {}) {
    const {
      limit = 50,
      skip = 0,
      type = null,
      creditType = null,
      startDate = null,
      endDate = null,
      sort = { createdAt: -1 }
    } = options;

    const query = { userId };
    
    if (type) query.type = type;
    if (creditType) query.creditType = creditType;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    return this.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .populate('userId', 'email metadata.name')
      .exec();
  },

  /**
   * Get transactions by reference
   * @param {string} referenceType - Reference type
   * @param {string} referenceId - Reference ID
   * @returns {Promise<CreditTransaction[]>} Related transactions
   */
  async getTransactionsByReference(referenceType, referenceId) {
    return this.find({
      'reference.type': referenceType,
      'reference.id': referenceId
    })
    .populate('userId', 'email metadata.name')
    .sort({ createdAt: -1 })
    .exec();
  },

  /**
   * Get transaction statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Transaction statistics
   */
  async getTransactionStats(filters = {}) {
    const {
      startDate = null,
      endDate = null,
      userId = null
    } = filters;

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
          totalTransactions: { $sum: 1 },
          totalCreditsGranted: {
            $sum: {
              $cond: [
                { $in: ['$type', ['grant']] },
                '$amount',
                0
              ]
            }
          },
          totalCreditsDeducted: {
            $sum: {
              $cond: [
                { $in: ['$type', ['deduct']] },
                { $abs: '$amount' },
                0
              ]
            }
          },
          totalCreditsExpired: {
            $sum: {
              $cond: [
                { $eq: ['$type', 'expire'] },
                { $abs: '$amount' },
                0
              ]
            }
          },
          transactionsByType: {
            $push: {
              type: '$type',
              amount: '$amount'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalTransactions: 1,
          totalCreditsGranted: 1,
          totalCreditsDeducted: 1,
          totalCreditsExpired: 1,
          netCreditFlow: {
            $subtract: ['$totalCreditsGranted', '$totalCreditsDeducted']
          }
        }
      }
    ];

    const result = await this.aggregate(pipeline).exec();
    return result[0] || {
      totalTransactions: 0,
      totalCreditsGranted: 0,
      totalCreditsDeducted: 0,
      totalCreditsExpired: 0,
      netCreditFlow: 0
    };
  },

  /**
   * Get daily transaction summary
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} Daily transaction summary
   */
  async getDailyTransactionSummary(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            type: '$type'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          },
          date: {
            $first: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: '$_id.day'
              }
            }
          },
          transactions: {
            $push: {
              type: '$_id.type',
              count: '$count',
              totalAmount: '$totalAmount'
            }
          },
          totalTransactions: { $sum: '$count' }
        }
      },
      {
        $sort: { date: -1 }
      }
    ];

    return this.aggregate(pipeline).exec();
  }
};

// Instance methods
creditTransactionSchema.methods = {
  /**
   * Get transaction summary
   * @returns {Object} Transaction summary
   */
  getSummary() {
    return {
      id: this._id,
      type: this.type,
      amount: this.amount,
      creditType: this.creditType,
      reference: this.reference,
      balanceChange: {
        defaultCredits: this.balanceAfter.defaultCredits - this.balanceBefore.defaultCredits,
        subscriptionCredits: this.balanceAfter.subscriptionCredits - this.balanceBefore.subscriptionCredits,
        reservedCredits: this.balanceAfter.reservedCredits - this.balanceBefore.reservedCredits,
        totalCredits: this.balanceAfter.totalCredits - this.balanceBefore.totalCredits
      },
      createdAt: this.createdAt,
      metadata: this.metadata
    };
  },

  /**
   * Check if transaction is reversible
   * @returns {boolean} True if transaction can be reversed
   */
  isReversible() {
    // Only grant and deduct transactions can be reversed
    // Reserve/release are temporary operations
    // Expire transactions are system-driven
    return ['grant', 'deduct'].includes(this.type) && 
           this.reference.type !== 'expiry';
  }
};

const CreditTransaction = mongoose.model('CreditTransaction', creditTransactionSchema);

module.exports = CreditTransaction;