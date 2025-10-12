const mongoose = require('mongoose');
const CreditWallet = require('../models/CreditWallet');
const CreditTransaction = require('../models/CreditTransaction');
const logger = require('../utils/logger');

/**
 * Custom error classes for credit operations
 */

class CreditInsufficientError extends Error {
  constructor(required, available) {
    super(`Insufficient credits: required ${required}, available ${available}`);
    this.name = 'CreditInsufficientError';
    this.code = 'INSUFFICIENT_CREDITS';
    this.required = required;
    this.available = available;
  }
}

class CreditOperationError extends Error {
  constructor(message, operation, userId) {
    super(message);
    this.name = 'CreditOperationError';
    this.code = 'CREDIT_OPERATION_ERROR';
    this.operation = operation;
    this.userId = userId;
  }
}

/**
 * Credit Management Service
 * Handles all credit operations with ACID transaction support
 */
class CreditService {
  constructor(options = {}) {
    this.DEFAULT_CREDITS = 3; // Default credits for new users
    this.useTransactions = options.useTransactions !== false; // Default to true, can be disabled for testing
  }

  /**
   * Grant default credits to a new user (one-time allocation)
   * @param {string|ObjectId} userId - User ID
   * @param {number} amount - Credit amount to grant (default: 3)
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Operation result with wallet and transaction
   */
  async grantDefaultCredits(userId, amount = this.DEFAULT_CREDITS, metadata = {}) {
    if (this.useTransactions) {
      return this._grantDefaultCreditsWithTransaction(userId, amount, metadata);
    } else {
      return this._grantDefaultCreditsWithoutTransaction(userId, amount, metadata);
    }
  }

  async _grantDefaultCreditsWithTransaction(userId, amount, metadata) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        return this._grantDefaultCreditsCore(userId, amount, metadata, session);
      });
    } catch (error) {
      logger.error('Error granting default credits', {
        userId,
        amount,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async _grantDefaultCreditsWithoutTransaction(userId, amount, metadata) {
    try {
      return this._grantDefaultCreditsCore(userId, amount, metadata, null);
    } catch (error) {
      logger.error('Error granting default credits', {
        userId,
        amount,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async _grantDefaultCreditsCore(userId, amount, metadata, session) {
    logger.info('Granting default credits', { userId, amount });

    // Get or create wallet
    const query = CreditWallet.findOne({ userId });
    let wallet = session ? await query.session(session) : await query;
    
    if (!wallet) {
      wallet = new CreditWallet({
        userId,
        defaultCredits: 0,
        subscriptionCredits: 0,
        reservedCredits: 0
      });
    }

    // Check if default credits were already granted
    const existingQuery = CreditTransaction.findOne({
      userId,
      type: 'grant',
      creditType: 'default',
      'reference.type': 'registration'
    });
    const existingDefaultGrant = session ? await existingQuery.session(session) : await existingQuery;

    if (existingDefaultGrant) {
      throw new CreditOperationError(
        'Default credits already granted for this user',
        'grantDefaultCredits',
        userId
      );
    }

    // Store balance before transaction
    const balanceBefore = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Add default credits
    wallet.defaultCredits += amount;
    await wallet.save(session ? { session } : {});

    // Store balance after transaction
    const balanceAfter = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Create transaction record
    const transaction = await CreditTransaction({
      userId,
      type: 'grant',
      amount,
      creditType: 'default',
      reference: {
        type: 'registration',
        id: userId.toString(),
        description: 'Default credits for new user registration'
      },
      balanceBefore,
      balanceAfter,
      metadata: {
        grantedAt: new Date(),
        source: 'system',
        ...metadata
      }
    });

    await transaction.save(session ? { session } : {});

    logger.info('Default credits granted successfully', {
      userId,
      amount,
      newBalance: wallet.totalCredits
    });

    return {
      success: true,
      wallet: wallet.toObject(),
      transaction: transaction.toObject(),
      message: `${amount} default credits granted successfully`
    };
  }

  /**
   * Grant subscription credits with expiry date and payment deduplication
   * This is the atomic operation that expires old credits and grants new ones
   * @param {string|ObjectId} userId - User ID
   * @param {number} amount - Credit amount to grant
   * @param {Date} expiryDate - Credit expiry date
   * @param {string} subscriptionId - Subscription reference ID
   * @param {string} paymentId - Payment ID for deduplication (optional)
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Operation result
   */
  async grantSubscriptionCredits(userId, amount, expiryDate, subscriptionId, paymentId = null, metadata = {}) {
    if (this.useTransactions) {
      return this._grantSubscriptionCreditsWithTransaction(userId, amount, expiryDate, subscriptionId, paymentId, metadata);
    } else {
      return this._grantSubscriptionCreditsWithoutTransaction(userId, amount, expiryDate, subscriptionId, paymentId, metadata);
    }
  }

  async _grantSubscriptionCreditsWithTransaction(userId, amount, expiryDate, subscriptionId, paymentId, metadata) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        return this._grantSubscriptionCreditsCore(userId, amount, expiryDate, subscriptionId, paymentId, metadata, session);
      });
    } catch (error) {
      logger.error('Error granting subscription credits', {
        userId,
        amount,
        paymentId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async _grantSubscriptionCreditsWithoutTransaction(userId, amount, expiryDate, subscriptionId, paymentId, metadata) {
    try {
      return this._grantSubscriptionCreditsCore(userId, amount, expiryDate, subscriptionId, paymentId, metadata, null);
    } catch (error) {
      logger.error('Error granting subscription credits', {
        userId,
        amount,
        paymentId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async _grantSubscriptionCreditsCore(userId, amount, expiryDate, subscriptionId, paymentId, metadata, session) {
    logger.info('Granting subscription credits', { userId, amount, expiryDate, paymentId });

    // Payment deduplication check - if paymentId provided, check if already processed
    if (paymentId) {
      const Payment = require('../models/Payment');
      const paymentQuery = Payment.findOne({ razorpayPaymentId: paymentId });
      const payment = session ? await paymentQuery.session(session) : await paymentQuery;
      
      if (payment && payment.processed) {
        logger.info('Payment already processed, skipping credit grant', {
          userId,
          paymentId,
          creditsGranted: payment.creditsGranted,
          processedAt: payment.processedAt
        });
        
        // Return success without processing
        const wallet = await CreditWallet.findOne({ userId });
        return {
          success: true,
          alreadyProcessed: true,
          wallet: wallet ? wallet.toObject() : null,
          transaction: null,
          message: 'Payment already processed, credits previously granted'
        };
      }
    }

    // Get or create wallet
    const query = CreditWallet.findOne({ userId });
    let wallet = session ? await query.session(session) : await query;
    
    if (!wallet) {
      wallet = new CreditWallet({
        userId,
        defaultCredits: 0,
        subscriptionCredits: 0,
        reservedCredits: 0
      });
    }

    // Store balance before transaction (before expiring old credits)
    const balanceBefore = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    const oldSubscriptionCredits = wallet.subscriptionCredits;

    // ATOMIC OPERATION: Expire old subscription credits first
    if (wallet.subscriptionCredits > 0) {
      logger.info('Expiring old subscription credits before granting new ones', {
        userId,
        oldCredits: wallet.subscriptionCredits,
        oldExpiry: wallet.subscriptionCreditExpiry
      });

      // Create expire transaction for old credits
      const expireTransaction = await CreditTransaction.createTransaction({
        userId,
        type: 'expire',
        amount: -wallet.subscriptionCredits,
        creditType: 'subscription',
        reference: {
          type: 'subscription',
          id: subscriptionId,
          description: 'Subscription credits expired before renewal'
        },
        balanceBefore: { ...balanceBefore },
        balanceAfter: {
          defaultCredits: wallet.defaultCredits,
          subscriptionCredits: 0,
          reservedCredits: wallet.reservedCredits,
          totalCredits: wallet.defaultCredits
        },
        metadata: {
          expiredAt: new Date(),
          originalExpiryDate: wallet.subscriptionCreditExpiry,
          reason: 'subscription_renewal',
          paymentId
        }
      });

      await expireTransaction.save(session ? { session } : {});

      // Expire the credits
      wallet.subscriptionCredits = 0;
      wallet.subscriptionCreditExpiry = null;
    }

    // Store balance after expiry, before grant
    const balanceAfterExpiry = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Add new subscription credits with expiry
    wallet.subscriptionCredits = amount;
    wallet.subscriptionCreditExpiry = expiryDate;
    await wallet.save(session ? { session } : {});

    // Store balance after grant
    const balanceAfter = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Create grant transaction record
    const grantTransaction = await CreditTransaction.createTransaction({
      userId,
      type: 'grant',
      amount,
      creditType: 'subscription',
      reference: {
        type: 'subscription',
        id: subscriptionId,
        description: 'Monthly subscription credits'
      },
      balanceBefore: balanceAfterExpiry,
      balanceAfter,
      metadata: {
        ...metadata,
        expiryDate,
        grantedAt: new Date(),
        source: 'subscription',
        paymentId,
        oldCreditsExpired: oldSubscriptionCredits
      }
    });

    await grantTransaction.save(session ? { session } : {});

    // Update payment record if paymentId provided
    if (paymentId) {
      const Payment = require('../models/Payment');
      const paymentQuery = Payment.findOne({ razorpayPaymentId: paymentId });
      const payment = session ? await paymentQuery.session(session) : await paymentQuery;
      
      if (payment) {
        payment.creditsGranted = amount;
        payment.processed = true;
        payment.processedAt = new Date();
        await payment.save(session ? { session } : {});
        
        logger.info('Payment marked as processed', {
          paymentId,
          creditsGranted: amount,
          processedAt: payment.processedAt
        });
      }
    }

    logger.info('Subscription credits granted successfully', {
      userId,
      amount,
      expiryDate,
      oldCreditsExpired: oldSubscriptionCredits,
      newBalance: wallet.totalCredits,
      paymentId
    });

    return {
      success: true,
      wallet: wallet.toObject(),
      transaction: grantTransaction.toObject(),
      oldCreditsExpired: oldSubscriptionCredits,
      message: `${amount} subscription credits granted successfully`
    };
  }

  /**
   * Reserve credits for a generation job (atomic operation)
   * @param {string|ObjectId} userId - User ID
   * @param {number} amount - Credit amount to reserve
   * @param {string} jobId - Generation job ID
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Operation result
   */
  async reserveCredits(userId, amount, jobId, metadata = {}) {
    if (this.useTransactions) {
      return this._reserveCreditsWithTransaction(userId, amount, jobId, metadata);
    } else {
      return this._reserveCreditsWithoutTransaction(userId, amount, jobId, metadata);
    }
  }

  async _reserveCreditsWithTransaction(userId, amount, jobId, metadata) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        return this._reserveCreditsCore(userId, amount, jobId, metadata, session);
      });
    } catch (error) {
      logger.error('Error reserving credits', {
        userId,
        amount,
        jobId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async _reserveCreditsWithoutTransaction(userId, amount, jobId, metadata) {
    try {
      return this._reserveCreditsCore(userId, amount, jobId, metadata, null);
    } catch (error) {
      logger.error('Error reserving credits', {
        userId,
        amount,
        jobId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async _reserveCreditsCore(userId, amount, jobId, metadata, session) {
    logger.info('Reserving credits', { userId, amount, jobId });

    // Get wallet
    const query = CreditWallet.findOne({ userId });
    const wallet = session ? await query.session(session) : await query;
    
    if (!wallet) {
      throw new CreditOperationError(
        'Credit wallet not found for user',
        'reserveCredits',
        userId
      );
    }

    // Check if sufficient credits are available
    const availableCredits = wallet.totalCredits - wallet.reservedCredits;
    if (availableCredits < amount) {
      throw new CreditInsufficientError(amount, availableCredits);
    }

    // Check if credits are already reserved for this job
    const existingQuery = CreditTransaction.findOne({
      userId,
      type: 'reserve',
      'reference.type': 'generation',
      'reference.id': jobId
    });
    const existingReservation = session ? await existingQuery.session(session) : await existingQuery;

    if (existingReservation) {
      throw new CreditOperationError(
        'Credits already reserved for this job',
        'reserveCredits',
        userId
      );
    }

    // Store balance before transaction
    const balanceBefore = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Reserve credits
    wallet.reservedCredits += amount;
    await wallet.save(session ? { session } : {});

    // Store balance after transaction
    const balanceAfter = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Create transaction record
    const transaction = await CreditTransaction({
      userId,
      type: 'reserve',
      amount,
      creditType: 'mixed', // Could be from either type
      reference: {
        type: 'generation',
        id: jobId,
        description: 'Credits reserved for poster generation'
      },
      balanceBefore,
      balanceAfter,
      metadata: {
        ...metadata,
        reservedAt: new Date(),
        availableCreditsAfter: wallet.totalCredits - wallet.reservedCredits
      }
    });

    await transaction.save(session ? { session } : {});

    logger.info('Credits reserved successfully', {
      userId,
      amount,
      jobId,
      reservedCredits: wallet.reservedCredits,
      availableCredits: wallet.totalCredits - wallet.reservedCredits
    });

    return {
      success: true,
      wallet: wallet.toObject(),
      transaction: transaction.toObject(),
      availableCredits: wallet.totalCredits - wallet.reservedCredits,
      message: `${amount} credits reserved successfully`
    };
  }

  /**
   * Deduct reserved credits after successful generation
   * @param {string} jobId - Generation job ID
   * @param {string|ObjectId} userId - User ID
   * @param {number} amount - Credit amount to deduct
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Operation result
   */
  async deductReservedCredits(jobId, userId, amount, metadata = {}) {
    if (this.useTransactions) {
      return this._deductReservedCreditsWithTransaction(jobId, userId, amount, metadata);
    } else {
      return this._deductReservedCreditsWithoutTransaction(jobId, userId, amount, metadata);
    }
  }

  async _deductReservedCreditsWithTransaction(jobId, userId, amount, metadata) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        return this._deductReservedCreditsCore(jobId, userId, amount, metadata, session);
      });
    } catch (error) {
      logger.error('Error deducting reserved credits', {
        userId,
        amount,
        jobId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async _deductReservedCreditsWithoutTransaction(jobId, userId, amount, metadata) {
    try {
      return this._deductReservedCreditsCore(jobId, userId, amount, metadata, null);
    } catch (error) {
      logger.error('Error deducting reserved credits', {
        userId,
        amount,
        jobId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async _deductReservedCreditsCore(jobId, userId, amount, metadata, session) {
    logger.info('Deducting reserved credits', { userId, amount, jobId });

    // Get wallet
    const query = CreditWallet.findOne({ userId });
    const wallet = session ? await query.session(session) : await query;
    
    if (!wallet) {
      throw new CreditOperationError(
        'Credit wallet not found for user',
        'deductReservedCredits',
        userId
      );
    }

    // Verify credits were reserved for this job
    const reservationQuery = CreditTransaction.findOne({
      userId,
      type: 'reserve',
      'reference.type': 'generation',
      'reference.id': jobId
    });
    const reservationTransaction = session ? await reservationQuery.session(session) : await reservationQuery;

    if (!reservationTransaction) {
      throw new CreditOperationError(
        'No credit reservation found for this job',
        'deductReservedCredits',
        userId
      );
    }

    // Check if credits were already deducted
    const existingQuery = CreditTransaction.findOne({
      userId,
      type: 'deduct',
      'reference.type': 'generation',
      'reference.id': jobId
    });
    const existingDeduction = session ? await existingQuery.session(session) : await existingQuery;

    if (existingDeduction) {
      throw new CreditOperationError(
        'Credits already deducted for this job',
        'deductReservedCredits',
        userId
      );
    }

    // Verify reserved amount matches
    if (reservationTransaction.amount !== amount) {
      throw new CreditOperationError(
        `Deduction amount (${amount}) doesn't match reserved amount (${reservationTransaction.amount})`,
        'deductReservedCredits',
        userId
      );
    }

    // Store balance before transaction
    const balanceBefore = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Deduct credits (subscription first, then default)
    let remainingToDeduct = amount;
    
    // First, deduct from subscription credits
    const fromSubscription = Math.min(remainingToDeduct, wallet.subscriptionCredits);
    wallet.subscriptionCredits -= fromSubscription;
    remainingToDeduct -= fromSubscription;
    
    // Then, deduct from default credits if needed
    if (remainingToDeduct > 0) {
      wallet.defaultCredits -= remainingToDeduct;
    }
    
    // Release reserved credits
    wallet.reservedCredits -= amount;
    
    await wallet.save(session ? { session } : {});

    // Store balance after transaction
    const balanceAfter = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Create transaction record
    const transaction = await CreditTransaction({
      userId,
      type: 'deduct',
      amount: -amount, // Negative for deduction
      creditType: fromSubscription > 0 && remainingToDeduct === 0 ? 'subscription' : 
                 fromSubscription === 0 ? 'default' : 'mixed',
      reference: {
        type: 'generation',
        id: jobId,
        description: 'Credits deducted for successful poster generation'
      },
      balanceBefore,
      balanceAfter,
      metadata: {
        ...metadata,
        deductedAt: new Date(),
        deductionBreakdown: {
          fromSubscription,
          fromDefault: remainingToDeduct > 0 ? remainingToDeduct : 0
        }
      }
    });

    await transaction.save(session ? { session } : {});

    logger.info('Reserved credits deducted successfully', {
      userId,
      amount,
      jobId,
      newBalance: wallet.totalCredits,
      deductionBreakdown: {
        fromSubscription,
        fromDefault: amount - fromSubscription
      }
    });

    return {
      success: true,
      wallet: wallet.toObject(),
      transaction: transaction.toObject(),
      deductionBreakdown: {
        fromSubscription,
        fromDefault: amount - fromSubscription
      },
      message: `${amount} credits deducted successfully`
    };
  }

  /**
   * Release reserved credits for failed generation
   * @param {string} jobId - Generation job ID
   * @param {string|ObjectId} userId - User ID
   * @param {number} amount - Credit amount to release
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Operation result
   */
  async releaseReservedCredits(jobId, userId, amount, metadata = {}) {
    if (this.useTransactions) {
      return this._releaseReservedCreditsWithTransaction(jobId, userId, amount, metadata);
    } else {
      return this._releaseReservedCreditsWithoutTransaction(jobId, userId, amount, metadata);
    }
  }

  async _releaseReservedCreditsWithTransaction(jobId, userId, amount, metadata) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        return this._releaseReservedCreditsCore(jobId, userId, amount, metadata, session);
      });
    } catch (error) {
      logger.error('Error releasing reserved credits', {
        userId,
        amount,
        jobId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async _releaseReservedCreditsWithoutTransaction(jobId, userId, amount, metadata) {
    try {
      return this._releaseReservedCreditsCore(jobId, userId, amount, metadata, null);
    } catch (error) {
      logger.error('Error releasing reserved credits', {
        userId,
        amount,
        jobId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async _releaseReservedCreditsCore(jobId, userId, amount, metadata, session) {
    logger.info('Releasing reserved credits', { userId, amount, jobId });

    // Get wallet
    const query = CreditWallet.findOne({ userId });
    const wallet = session ? await query.session(session) : await query;
    
    if (!wallet) {
      throw new CreditOperationError(
        'Credit wallet not found for user',
        'releaseReservedCredits',
        userId
      );
    }

    // Verify credits were reserved for this job
    const reservationQuery = CreditTransaction.findOne({
      userId,
      type: 'reserve',
      'reference.type': 'generation',
      'reference.id': jobId
    });
    const reservationTransaction = session ? await reservationQuery.session(session) : await reservationQuery;
    logger.info("Now here is the bug: ")

    if (!reservationTransaction) {
      throw new CreditOperationError(
        'No credit reservation found for this job',
        'releaseReservedCredits',
        userId
      );
    }

    logger.info("THis line wont be executed!");

    // Check if credits were already released or deducted
    const existingReleaseQuery = CreditTransaction.findOne({
      userId,
      type: 'release',
      'reference.type': 'generation',
      'reference.id': jobId
    });
    const existingRelease = session ? await existingReleaseQuery.session(session) : await existingReleaseQuery;

    const existingDeductionQuery = CreditTransaction.findOne({
      userId,
      type: 'deduct',
      'reference.type': 'generation',
      'reference.id': jobId
    });
    const existingDeduction = session ? await existingDeductionQuery.session(session) : await existingDeductionQuery;

    if (existingRelease || existingDeduction) {
      throw new CreditOperationError(
        'Credits already processed for this job',
        'releaseReservedCredits',
        userId
      );
    }

    // Verify reserved amount matches
    if (reservationTransaction.amount !== amount) {
      throw new CreditOperationError(
        `Release amount (${amount}) doesn't match reserved amount (${reservationTransaction.amount})`,
        'releaseReservedCredits',
        userId
      );
    }

    // Store balance before transaction
    const balanceBefore = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Release reserved credits
    wallet.reservedCredits = Math.max(0, wallet.reservedCredits - amount);
    await wallet.save(session ? { session } : {});

    // Store balance after transaction
    const balanceAfter = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Create transaction record
    const transaction = await CreditTransaction({
      userId,
      type: 'release',
      amount,
      creditType: 'mixed',
      reference: {
        type: 'generation',
        id: jobId,
        description: 'Credits released due to failed generation'
      },
      balanceBefore,
      balanceAfter,
      metadata: {
        ...metadata,
        releasedAt: new Date(),
        reason: 'generation_failed'
      }
    });

    await transaction.save(session ? { session } : {});

    logger.info('Reserved credits released successfully', {
      userId,
      amount,
      jobId,
      availableCredits: wallet.totalCredits - wallet.reservedCredits
    });

    return {
      success: true,
      wallet: wallet.toObject(),
      transaction: transaction.toObject(),
      availableCredits: wallet.totalCredits - wallet.reservedCredits,
      message: `${amount} reserved credits released successfully`
    };
  }

  /**
   * Atomic operation: Expire old subscription credits and grant new ones with payment deduplication
   * This is the main method used by webhook handlers for subscription renewals
   * @param {string|ObjectId} userId - User ID
   * @param {string} subscriptionId - Subscription ID
   * @param {string} paymentId - Razorpay payment ID for deduplication
   * @param {number} amount - Credit amount to grant
   * @param {Date} expiryDate - Credit expiry date
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Operation result
   */
  async grantSubscriptionCreditsWithPayment(userId, subscriptionId, paymentId, amount, expiryDate, metadata = {}) {
    if (this.useTransactions) {
      return this._grantSubscriptionCreditsWithPaymentTransaction(userId, subscriptionId, paymentId, amount, expiryDate, metadata);
    } else {
      return this._grantSubscriptionCreditsWithPaymentNoTransaction(userId, subscriptionId, paymentId, amount, expiryDate, metadata);
    }
  }

  async _grantSubscriptionCreditsWithPaymentTransaction(userId, subscriptionId, paymentId, amount, expiryDate, metadata) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        return this._grantSubscriptionCreditsWithPaymentCore(userId, subscriptionId, paymentId, amount, expiryDate, metadata, session);
      });
    } catch (error) {
      logger.error('Error granting subscription credits with payment', {
        userId,
        subscriptionId,
        paymentId,
        amount,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async _grantSubscriptionCreditsWithPaymentNoTransaction(userId, subscriptionId, paymentId, amount, expiryDate, metadata) {
    try {
      return this._grantSubscriptionCreditsWithPaymentCore(userId, subscriptionId, paymentId, amount, expiryDate, metadata, null);
    } catch (error) {
      logger.error('Error granting subscription credits with payment', {
        userId,
        subscriptionId,
        paymentId,
        amount,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async _grantSubscriptionCreditsWithPaymentCore(userId, subscriptionId, paymentId, amount, expiryDate, metadata, session) {
    const Payment = require('../models/Payment');
    
    logger.info('Starting atomic credit operation with payment deduplication', {
      userId,
      subscriptionId,
      paymentId,
      amount,
      expiryDate
    });

    // Step 1: Check payment deduplication
    const paymentQuery = Payment.findOne({ razorpayPaymentId: paymentId });
    const payment = session ? await paymentQuery.session(session) : await paymentQuery;
    
    if (!payment) {
      throw new CreditOperationError(
        'Payment record not found',
        'grantSubscriptionCreditsWithPayment',
        userId
      );
    }

    if (payment.processed) {
      logger.info('Payment already processed, skipping credit operations', {
        userId,
        paymentId,
        creditsGranted: payment.creditsGranted,
        processedAt: payment.processedAt
      });
      
      const wallet = await CreditWallet.findOne({ userId });
      return {
        success: true,
        alreadyProcessed: true,
        wallet: wallet ? wallet.toObject() : null,
        payment: payment.toObject(),
        message: 'Payment already processed, credits previously granted'
      };
    }

    // Step 2: Get or create wallet
    const walletQuery = CreditWallet.findOne({ userId });
    let wallet = session ? await walletQuery.session(session) : await walletQuery;
    
    if (!wallet) {
      wallet = new CreditWallet({
        userId,
        defaultCredits: 0,
        subscriptionCredits: 0,
        reservedCredits: 0
      });
    }

    // Store initial balance
    const initialBalance = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    const oldSubscriptionCredits = wallet.subscriptionCredits;
    const oldExpiry = wallet.subscriptionCreditExpiry;

    // Step 3: ATOMIC - Expire old subscription credits
    if (wallet.subscriptionCredits > 0) {
      logger.info('Expiring old subscription credits', {
        userId,
        oldCredits: wallet.subscriptionCredits,
        oldExpiry: wallet.subscriptionCreditExpiry
      });

      // Create expire transaction
      const expireTransaction = await CreditTransaction.createTransaction({
        userId,
        type: 'expire',
        amount: -wallet.subscriptionCredits,
        creditType: 'subscription',
        reference: {
          type: 'subscription',
          id: subscriptionId,
          description: 'Subscription credits expired before renewal'
        },
        balanceBefore: { ...initialBalance },
        balanceAfter: {
          defaultCredits: wallet.defaultCredits,
          subscriptionCredits: 0,
          reservedCredits: wallet.reservedCredits,
          totalCredits: wallet.defaultCredits
        },
        metadata: {
          expiredAt: new Date(),
          originalExpiryDate: oldExpiry,
          reason: 'subscription_renewal',
          paymentId,
          subscriptionId
        }
      });

      await expireTransaction.save(session ? { session } : {});

      // Expire the credits
      wallet.subscriptionCredits = 0;
      wallet.subscriptionCreditExpiry = null;
    }

    // Balance after expiry
    const balanceAfterExpiry = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Step 4: ATOMIC - Grant new subscription credits
    wallet.subscriptionCredits = amount;
    wallet.subscriptionCreditExpiry = expiryDate;
    await wallet.save(session ? { session } : {});

    // Final balance
    const finalBalance = {
      defaultCredits: wallet.defaultCredits,
      subscriptionCredits: wallet.subscriptionCredits,
      reservedCredits: wallet.reservedCredits,
      totalCredits: wallet.totalCredits
    };

    // Create grant transaction
    const grantTransaction = await CreditTransaction.createTransaction({
      userId,
      type: 'grant',
      amount,
      creditType: 'subscription',
      reference: {
        type: 'subscription',
        id: subscriptionId,
        description: 'Subscription credits granted'
      },
      balanceBefore: balanceAfterExpiry,
      balanceAfter: finalBalance,
      metadata: {
        ...metadata,
        expiryDate,
        grantedAt: new Date(),
        source: 'subscription',
        paymentId,
        subscriptionId,
        oldCreditsExpired: oldSubscriptionCredits
      }
    });

    await grantTransaction.save(session ? { session } : {});

    // Step 5: Update payment record
    payment.creditsGranted = amount;
    payment.processed = true;
    payment.processedAt = new Date();
    await payment.save(session ? { session } : {});

    logger.info('Atomic credit operation completed successfully', {
      userId,
      subscriptionId,
      paymentId,
      oldCreditsExpired: oldSubscriptionCredits,
      newCreditsGranted: amount,
      newBalance: wallet.totalCredits
    });

    return {
      success: true,
      wallet: wallet.toObject(),
      payment: payment.toObject(),
      grantTransaction: grantTransaction.toObject(),
      oldCreditsExpired: oldSubscriptionCredits,
      newCreditsGranted: amount,
      message: `Atomic operation completed: expired ${oldSubscriptionCredits} credits, granted ${amount} new credits`
    };
  }

  /**
   * Expire subscription credits (monthly cleanup)
   * @param {Date} expiryDate - Expiry date to check against (default: current date)
   * @returns {Promise<Object>} Operation result with expired wallets count
   */
  async expireSubscriptionCredits(expiryDate = new Date()) {
    if (this.useTransactions) {
      return this._expireSubscriptionCreditsWithTransaction(expiryDate);
    } else {
      return this._expireSubscriptionCreditsWithoutTransaction(expiryDate);
    }
  }

  async _expireSubscriptionCreditsWithTransaction(expiryDate) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        return this._expireSubscriptionCreditsCore(expiryDate, session);
      });
    } catch (error) {
      logger.error('Error expiring subscription credits', {
        expiryDate,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async _expireSubscriptionCreditsWithoutTransaction(expiryDate) {
    try {
      return this._expireSubscriptionCreditsCore(expiryDate, null);
    } catch (error) {
      logger.error('Error expiring subscription credits', {
        expiryDate,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async _expireSubscriptionCreditsCore(expiryDate, session) {
    logger.info('Starting subscription credit expiration process', { expiryDate });

    // Find wallets with expired subscription credits
    const query = CreditWallet.find({
      subscriptionCredits: { $gt: 0 },
      subscriptionCreditExpiry: { $lt: expiryDate }
    });
    const expiredWallets = session ? await query.session(session) : await query;

    const results = [];
    let totalExpiredCredits = 0;

    for (const wallet of expiredWallets) {
      const expiredAmount = wallet.subscriptionCredits;
      
      if (expiredAmount > 0) {
        // Store balance before transaction
        const balanceBefore = {
          defaultCredits: wallet.defaultCredits,
          subscriptionCredits: wallet.subscriptionCredits,
          reservedCredits: wallet.reservedCredits,
          totalCredits: wallet.totalCredits
        };

        // Expire subscription credits
        wallet.subscriptionCredits = 0;
        wallet.subscriptionCreditExpiry = null;
        await wallet.save(session ? { session } : {});

        // Store balance after transaction
        const balanceAfter = {
          defaultCredits: wallet.defaultCredits,
          subscriptionCredits: wallet.subscriptionCredits,
          reservedCredits: wallet.reservedCredits,
          totalCredits: wallet.totalCredits
        };

        // Create transaction record
        const transaction = await CreditTransaction.createTransaction({
          userId: wallet.userId,
          type: 'expire',
          amount: -expiredAmount, // Negative for expiration
          creditType: 'subscription',
          reference: {
            type: 'expiry',
            id: `expiry_${Date.now()}_${wallet.userId}`,
            description: 'Monthly subscription credit expiration'
          },
          balanceBefore,
          balanceAfter,
          metadata: {
            expiredAt: new Date(),
            originalExpiryDate: wallet.subscriptionCreditExpiry,
            reason: 'monthly_expiration'
          }
        });

        await transaction.save(session ? { session } : {});

        results.push({
          userId: wallet.userId,
          expiredCredits: expiredAmount,
          remainingCredits: wallet.totalCredits
        });

        totalExpiredCredits += expiredAmount;
      }
    }

    logger.info('Subscription credit expiration completed', {
      walletsProcessed: expiredWallets.length,
      totalExpiredCredits,
      expiryDate
    });

    return {
      success: true,
      walletsProcessed: expiredWallets.length,
      totalExpiredCredits,
      results,
      message: `Expired ${totalExpiredCredits} credits from ${expiredWallets.length} wallets`
    };
  }

  /**
   * Get user credit balance and breakdown
   * @param {string|ObjectId} userId - User ID
   * @returns {Promise<Object>} Credit balance information
   */
  async getCreditBalance(userId) {
    try {
      const wallet = await CreditWallet.findByUserId(userId);
      
      if (!wallet) {
        return {
          userId,
          defaultCredits: 0,
          subscriptionCredits: 0,
          reservedCredits: 0,
          totalCredits: 0,
          availableCredits: 0,
          subscriptionCreditExpiry: null,
          walletExists: false
        };
      }

      return {
        userId,
        defaultCredits: wallet.defaultCredits,
        subscriptionCredits: wallet.subscriptionCredits,
        reservedCredits: wallet.reservedCredits,
        totalCredits: wallet.totalCredits,
        availableCredits: wallet.getAvailableCredits(),
        subscriptionCreditExpiry: wallet.subscriptionCreditExpiry,
        walletExists: true,
        lastUpdated: wallet.lastUpdated
      };
    } catch (error) {
      logger.error('Error getting credit balance', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get user transaction history
   * @param {string|ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(userId, options = {}) {
    try {
      return await CreditTransaction.getUserTransactionHistory(userId, options);
    } catch (error) {
      logger.error('Error getting transaction history', {
        userId,
        options,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Check if user has sufficient credits
   * @param {string|ObjectId} userId - User ID
   * @param {number} requiredAmount - Required credit amount
   * @returns {Promise<Object>} Credit check result
   */
  async checkSufficientCredits(userId, requiredAmount) {
    try {
      const balance = await this.getCreditBalance(userId);
      const hasSufficient = balance.availableCredits >= requiredAmount;
      
      return {
        userId,
        requiredAmount,
        availableCredits: balance.availableCredits,
        hasSufficient,
        shortfall: hasSufficient ? 0 : requiredAmount - balance.availableCredits
      };
    } catch (error) {
      logger.error('Error checking sufficient credits', {
        userId,
        requiredAmount,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

// Export the service class and custom errors
module.exports = {
  CreditService,
  CreditInsufficientError,
  CreditOperationError
};