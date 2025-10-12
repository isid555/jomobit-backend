const mongoose = require('mongoose');

/**
 * Payment Schema
 * Tracks all payments from Razorpay with deduplication
 */
const paymentSchema = new mongoose.Schema({
  // Razorpay payment ID (unique for deduplication)
  razorpayPaymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Razorpay invoice ID
  razorpayInvoiceId: {
    type: String,
    index: true
  },

  // Associated subscription
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true,
    index: true
  },

  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Payment details
  amount: {
    type: Number,
    required: true
  },

  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'INR'
  },

  status: {
    type: String,
    enum: ['captured', 'failed', 'pending', 'authorized', 'refunded'],
    required: true,
    index: true
  },

  method: {
    type: String, // card, netbanking, upi, etc.
    trim: true
  },

  // Payment timestamps
  capturedAt: {
    type: Date,
    index: true
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Failure information
  errorCode: String,
  errorDescription: String,

  // Card details (if applicable)
  card: {
    last4: String,
    network: String,
    type: String,
    issuer: String
  },

  // Raw webhook data for debugging
  webhookData: {
    type: mongoose.Schema.Types.Mixed
  },

  // Credits granted for this payment
  creditsGranted: {
    type: Number,
    default: 0
  },

  // Processing status
  processed: {
    type: Boolean,
    default: false,
    index: true
  },

  processedAt: Date,

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ razorpayPaymentId: 1 }, { unique: true });
paymentSchema.index({ subscriptionId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, status: 1, createdAt: -1 });
paymentSchema.index({ status: 1, processed: 1 });

// Static methods
paymentSchema.statics = {
  /**
   * Create or get payment (idempotent)
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Object with payment and created flag
   */
  async createOrGet(paymentData) {
    const { razorpayPaymentId } = paymentData;
    
    // Try to find existing payment
    let payment = await this.findOne({ razorpayPaymentId });
    
    if (payment) {
      return { payment, created: false };
    }

    // Create new payment
    payment = await this.create(paymentData);
    return { payment, created: true };
  },

  /**
   * Get unprocessed payments
   * @returns {Promise<Payment[]>} Array of unprocessed payments
   */
  async getUnprocessed() {
    return this.find({
      status: 'captured',
      processed: false
    }).sort({ createdAt: 1 });
  }
};

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
