const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * WebhookEvent Schema
 * Tracks all webhook deliveries for deduplication and replay protection
 */
const webhookEventSchema = new mongoose.Schema({
  // Unique key for deduplication
  uniqueKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Razorpay event details
  event: {
    type: String,
    required: true,
    index: true
  },

  // Entity IDs
  razorpaySubscriptionId: {
    type: String,
    index: true
  },

  razorpayPaymentId: {
    type: String,
    index: true
  },

  // Local references
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    index: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Processing status
  processed: {
    type: Boolean,
    default: false,
    index: true
  },

  processedAt: Date,

  // Processing attempts
  attempts: {
    type: Number,
    default: 0
  },

  lastAttemptAt: Date,

  // Error tracking
  error: {
    message: String,
    stack: String,
    code: String
  },

  // Raw webhook body
  rawBody: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Request metadata
  requestMeta: {
    ip: String,
    userAgent: String,
    headers: mongoose.Schema.Types.Mixed
  },

  // Timestamps
  receivedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
webhookEventSchema.index({ uniqueKey: 1 }, { unique: true });
webhookEventSchema.index({ event: 1, processed: 1, receivedAt: -1 });
webhookEventSchema.index({ razorpaySubscriptionId: 1, event: 1 });
webhookEventSchema.index({ processed: 1, attempts: 1 });

// Static methods
webhookEventSchema.statics = {
  /**
   * Generate unique key for webhook
   * @param {string} event - Event type
   * @param {string} subscriptionId - Subscription ID
   * @param {string} paymentId - Payment ID
   * @param {number} timestamp - Timestamp
   * @returns {string} Unique key hash
   */
  generateUniqueKey(event, subscriptionId, paymentId, timestamp) {
    const data = `${event}:${subscriptionId || ''}:${paymentId || ''}:${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  },

  /**
   * Check if webhook was already processed
   * @param {string} uniqueKey - Unique key
   * @returns {Promise<boolean>} True if already processed
   */
  async isProcessed(uniqueKey) {
    const existing = await this.findOne({ uniqueKey, processed: true });
    return !!existing;
  },

  /**
   * Record webhook attempt
   * @param {Object} webhookData - Webhook data
   * @param {Object} requestMeta - Request metadata
   * @returns {Promise<Object>} Object with webhookEvent and isNew flag
   */
  async recordWebhook(webhookData, requestMeta = {}) {
    const { event, payload, created_at } = webhookData;
    const subscriptionId = payload?.subscription?.entity?.id;
    const paymentId = payload?.payment?.entity?.id;
    
    const uniqueKey = this.generateUniqueKey(
      event,
      subscriptionId,
      paymentId,
      created_at || Date.now()
    );

    // Try to create or update
    const existing = await this.findOne({ uniqueKey });
    
    if (existing) {
      existing.attempts += 1;
      existing.lastAttemptAt = new Date();
      existing.requestMeta = requestMeta;
      await existing.save();
      return { webhookEvent: existing, isNew: false };
    }

    const webhookEvent = await this.create({
      uniqueKey,
      event,
      razorpaySubscriptionId: subscriptionId,
      razorpayPaymentId: paymentId,
      rawBody: webhookData,
      requestMeta,
      attempts: 1,
      lastAttemptAt: new Date()
    });

    return { webhookEvent, isNew: true };
  },

  /**
   * Mark webhook as processed
   * @param {string} uniqueKey - Unique key
   * @param {ObjectId} subscriptionId - Subscription ID
   * @param {ObjectId} userId - User ID
   * @returns {Promise<WebhookEvent>} Updated webhook event
   */
  async markProcessed(uniqueKey, subscriptionId = null, userId = null) {
    return this.findOneAndUpdate(
      { uniqueKey },
      {
        processed: true,
        processedAt: new Date(),
        ...(subscriptionId && { subscriptionId }),
        ...(userId && { userId })
      },
      { new: true }
    );
  },

  /**
   * Mark webhook as failed
   * @param {string} uniqueKey - Unique key
   * @param {Error} error - Error object
   * @returns {Promise<WebhookEvent>} Updated webhook event
   */
  async markFailed(uniqueKey, error) {
    return this.findOneAndUpdate(
      { uniqueKey },
      {
        processed: false,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code
        }
      },
      { new: true }
    );
  },

  /**
   * Get failed webhooks for retry
   * @param {number} maxAttempts - Maximum attempts
   * @returns {Promise<WebhookEvent[]>} Array of failed webhooks
   */
  async getFailedWebhooks(maxAttempts = 3) {
    return this.find({
      processed: false,
      attempts: { $lt: maxAttempts }
    }).sort({ receivedAt: 1 }).limit(100);
  }
};

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
module.exports = WebhookEvent;
