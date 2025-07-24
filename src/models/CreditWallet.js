const mongoose = require('mongoose');

/**
 * Credit Wallet Schema
 * Manages user credits with different types and expiration rules
 */
const creditWalletSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Default credits (never expire, granted once on registration)
  defaultCredits: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Subscription credits (expire monthly)
  subscriptionCredits: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Reserved credits (temporarily held during generation)
  reservedCredits: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Total available credits (computed field)
  totalCredits: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Subscription credit expiry date (end of current month)
  subscriptionCreditExpiry: {
    type: Date,
    index: true
  },
  
  // Last update timestamp
  lastUpdated: {
    type: Date,
    default: Date.now,
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

// Pre-save middleware to calculate total credits and update timestamps
creditWalletSchema.pre('save', function(next) {
  // Calculate total available credits (excluding reserved)
  this.totalCredits = this.defaultCredits + this.subscriptionCredits;
  
  // Update lastUpdated timestamp
  this.lastUpdated = new Date();
  
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  
  next();
});

// Static methods
creditWalletSchema.statics = {
  /**
   * Create wallet for new user with default credits
   * @param {ObjectId} userId - User ID
   * @param {number} defaultCredits - Default credits to grant
   * @returns {Promise<CreditWallet>} Created wallet
   */
  async createForUser(userId, defaultCredits = 3) {
    return this.create({
      userId,
      defaultCredits,
      subscriptionCredits: 0,
      reservedCredits: 0
    });
  },

  /**
   * Find wallet by user ID
   * @param {ObjectId} userId - User ID
   * @returns {Promise<CreditWallet|null>} Wallet or null
   */
  async findByUserId(userId) {
    return this.findOne({ userId }).exec();
  },

  /**
   * Get or create wallet for user
   * @param {ObjectId} userId - User ID
   * @param {number} defaultCredits - Default credits if creating new wallet
   * @returns {Promise<CreditWallet>} Wallet document
   */
  async getOrCreateForUser(userId, defaultCredits = 3) {
    let wallet = await this.findByUserId(userId);
    if (!wallet) {
      wallet = await this.createForUser(userId, defaultCredits);
    }
    return wallet;
  },

  /**
   * Get wallets with expired subscription credits
   * @returns {Promise<CreditWallet[]>} Wallets with expired credits
   */
  async findExpiredSubscriptionCredits() {
    return this.find({
      subscriptionCredits: { $gt: 0 },
      subscriptionCreditExpiry: { $lt: new Date() }
    }).exec();
  },

  /**
   * Get wallets with low credit balance
   * @param {number} threshold - Credit threshold
   * @returns {Promise<CreditWallet[]>} Wallets below threshold
   */
  async findLowCreditWallets(threshold = 5) {
    return this.find({
      totalCredits: { $lt: threshold }
    }).populate('userId', 'email metadata.name').exec();
  }
};

// Instance methods
creditWalletSchema.methods = {
  /**
   * Check if user has sufficient credits
   * @param {number} amount - Required credit amount
   * @returns {boolean} True if sufficient credits available
   */
  hasSufficientCredits(amount) {
    return (this.totalCredits - this.reservedCredits) >= amount;
  },

  /**
   * Get available credits (total minus reserved)
   * @returns {number} Available credit amount
   */
  getAvailableCredits() {
    return Math.max(0, this.totalCredits - this.reservedCredits);
  },

  /**
   * Reserve credits for generation job
   * @param {number} amount - Credits to reserve
   * @returns {Promise<CreditWallet>} Updated wallet
   */
  async reserveCredits(amount) {
    if (!this.hasSufficientCredits(amount)) {
      throw new Error(`Insufficient credits: required ${amount}, available ${this.getAvailableCredits()}`);
    }
    
    this.reservedCredits += amount;
    return this.save();
  },

  /**
   * Release reserved credits
   * @param {number} amount - Credits to release
   * @returns {Promise<CreditWallet>} Updated wallet
   */
  async releaseReservedCredits(amount) {
    this.reservedCredits = Math.max(0, this.reservedCredits - amount);
    return this.save();
  },

  /**
   * Deduct credits (from reserved amount)
   * @param {number} amount - Credits to deduct
   * @param {string} type - Credit type to deduct from ('subscription' or 'default')
   * @returns {Promise<CreditWallet>} Updated wallet
   */
  async deductCredits(amount, type = 'subscription') {
    // First release from reserved
    this.reservedCredits = Math.max(0, this.reservedCredits - amount);
    
    // Then deduct from specified type
    if (type === 'subscription' && this.subscriptionCredits >= amount) {
      this.subscriptionCredits -= amount;
    } else if (type === 'default' && this.defaultCredits >= amount) {
      this.defaultCredits -= amount;
    } else {
      // Deduct from subscription first, then default
      const fromSubscription = Math.min(amount, this.subscriptionCredits);
      const fromDefault = amount - fromSubscription;
      
      this.subscriptionCredits -= fromSubscription;
      this.defaultCredits -= fromDefault;
    }
    
    return this.save();
  },

  /**
   * Add subscription credits with expiry
   * @param {number} amount - Credits to add
   * @param {Date} expiryDate - Expiry date for credits
   * @returns {Promise<CreditWallet>} Updated wallet
   */
  async addSubscriptionCredits(amount, expiryDate) {
    this.subscriptionCredits += amount;
    this.subscriptionCreditExpiry = expiryDate;
    return this.save();
  },

  /**
   * Add default credits (never expire)
   * @param {number} amount - Credits to add
   * @returns {Promise<CreditWallet>} Updated wallet
   */
  async addDefaultCredits(amount) {
    this.defaultCredits += amount;
    return this.save();
  },

  /**
   * Expire subscription credits
   * @returns {Promise<CreditWallet>} Updated wallet
   */
  async expireSubscriptionCredits() {
    if (this.subscriptionCreditExpiry && this.subscriptionCreditExpiry < new Date()) {
      this.subscriptionCredits = 0;
      this.subscriptionCreditExpiry = null;
      return this.save();
    }
    return this;
  },

  /**
   * Get credit breakdown
   * @returns {Object} Credit breakdown object
   */
  getCreditBreakdown() {
    return {
      defaultCredits: this.defaultCredits,
      subscriptionCredits: this.subscriptionCredits,
      reservedCredits: this.reservedCredits,
      totalCredits: this.totalCredits,
      availableCredits: this.getAvailableCredits(),
      subscriptionCreditExpiry: this.subscriptionCreditExpiry
    };
  }
};

// Indexes for performance
creditWalletSchema.index({ userId: 1 }, { unique: true });
creditWalletSchema.index({ subscriptionCreditExpiry: 1 });
creditWalletSchema.index({ totalCredits: 1 });
creditWalletSchema.index({ lastUpdated: -1 });

const CreditWallet = mongoose.model('CreditWallet', creditWalletSchema);

module.exports = CreditWallet;