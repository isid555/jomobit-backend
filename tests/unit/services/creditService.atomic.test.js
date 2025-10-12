const mongoose = require('mongoose');
const { CreditService } = require('../../../src/services/creditService');
const CreditWallet = require('../../../src/models/CreditWallet');
const CreditTransaction = require('../../../src/models/CreditTransaction');
const Payment = require('../../../src/models/Payment');
const Subscription = require('../../../src/models/Subscription');

describe('CreditService - Atomic Operations with Deduplication', () => {
  let creditService;
  let testUserId;
  let testSubscriptionId;
  let testPaymentId;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jomobit-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }
  });

  beforeEach(async () => {
    // Disable transactions for testing (standalone MongoDB doesn't support them)
    creditService = new CreditService({ useTransactions: false });
    testUserId = new mongoose.Types.ObjectId();
    testSubscriptionId = new mongoose.Types.ObjectId();
    testPaymentId = `pay_test_${Date.now()}`;

    // Clean up test data
    await CreditWallet.deleteMany({ userId: testUserId });
    await CreditTransaction.deleteMany({ userId: testUserId });
    await Payment.deleteMany({ userId: testUserId });
  });

  afterAll(async () => {
    // Clean up and close connection
    await CreditWallet.deleteMany({ userId: testUserId });
    await CreditTransaction.deleteMany({ userId: testUserId });
    await Payment.deleteMany({ userId: testUserId });
    await mongoose.connection.close();
  });

  describe('grantSubscriptionCreditsWithPayment', () => {
    it('should grant credits and mark payment as processed', async () => {
      // Create a payment record
      const payment = await Payment.create({
        razorpayPaymentId: testPaymentId,
        subscriptionId: testSubscriptionId,
        userId: testUserId,
        amount: 99900,
        currency: 'INR',
        status: 'captured',
        processed: false
      });

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);

      // Grant credits
      const result = await creditService.grantSubscriptionCreditsWithPayment(
        testUserId,
        testSubscriptionId.toString(),
        testPaymentId,
        100,
        expiryDate,
        { source: 'test' }
      );

      expect(result.success).toBe(true);
      expect(result.newCreditsGranted).toBe(100);
      expect(result.wallet.subscriptionCredits).toBe(100);

      // Verify payment is marked as processed
      const updatedPayment = await Payment.findOne({ razorpayPaymentId: testPaymentId });
      expect(updatedPayment.processed).toBe(true);
      expect(updatedPayment.creditsGranted).toBe(100);
      expect(updatedPayment.processedAt).toBeDefined();
    });

    it('should prevent double-granting credits for same payment', async () => {
      // Create a payment record
      await Payment.create({
        razorpayPaymentId: testPaymentId,
        subscriptionId: testSubscriptionId,
        userId: testUserId,
        amount: 99900,
        currency: 'INR',
        status: 'captured',
        processed: false
      });

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);

      // First grant
      await creditService.grantSubscriptionCreditsWithPayment(
        testUserId,
        testSubscriptionId.toString(),
        testPaymentId,
        100,
        expiryDate
      );

      // Second grant attempt (should be deduplicated)
      const result = await creditService.grantSubscriptionCreditsWithPayment(
        testUserId,
        testSubscriptionId.toString(),
        testPaymentId,
        100,
        expiryDate
      );

      expect(result.success).toBe(true);
      expect(result.alreadyProcessed).toBe(true);

      // Verify wallet still has only 100 credits
      const wallet = await CreditWallet.findOne({ userId: testUserId });
      expect(wallet.subscriptionCredits).toBe(100);

      // Verify only one grant transaction exists
      const grantTransactions = await CreditTransaction.find({
        userId: testUserId,
        type: 'grant'
      });
      expect(grantTransactions.length).toBe(1);
    });

    it('should expire old credits before granting new ones', async () => {
      // Create initial wallet with existing credits
      const oldExpiryDate = new Date();
      oldExpiryDate.setDate(oldExpiryDate.getDate() + 15);

      await CreditWallet.create({
        userId: testUserId,
        defaultCredits: 0,
        subscriptionCredits: 50,
        subscriptionCreditExpiry: oldExpiryDate,
        reservedCredits: 0
      });

      // Create payment for renewal
      await Payment.create({
        razorpayPaymentId: testPaymentId,
        subscriptionId: testSubscriptionId,
        userId: testUserId,
        amount: 99900,
        currency: 'INR',
        status: 'captured',
        processed: false
      });

      const newExpiryDate = new Date();
      newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

      // Grant new credits (should expire old ones first)
      const result = await creditService.grantSubscriptionCreditsWithPayment(
        testUserId,
        testSubscriptionId.toString(),
        testPaymentId,
        100,
        newExpiryDate
      );

      expect(result.success).toBe(true);
      expect(result.oldCreditsExpired).toBe(50);
      expect(result.newCreditsGranted).toBe(100);

      // Verify wallet has only new credits
      const wallet = await CreditWallet.findOne({ userId: testUserId });
      expect(wallet.subscriptionCredits).toBe(100);
      expect(wallet.subscriptionCreditExpiry).toEqual(newExpiryDate);

      // Verify both expire and grant transactions exist
      const transactions = await CreditTransaction.find({ userId: testUserId });
      const expireTransaction = transactions.find(t => t.type === 'expire');
      const grantTransaction = transactions.find(t => t.type === 'grant');

      expect(expireTransaction).toBeDefined();
      expect(expireTransaction.amount).toBe(-50);
      expect(grantTransaction).toBeDefined();
      expect(grantTransaction.amount).toBe(100);
    });

    it('should rollback on failure', async () => {
      // Create payment with invalid subscription ID to cause error
      await Payment.create({
        razorpayPaymentId: testPaymentId,
        subscriptionId: testSubscriptionId,
        userId: testUserId,
        amount: 99900,
        currency: 'INR',
        status: 'captured',
        processed: false
      });

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);

      // Mock a failure by passing invalid amount
      try {
        await creditService.grantSubscriptionCreditsWithPayment(
          testUserId,
          testSubscriptionId.toString(),
          testPaymentId,
          -100, // Invalid negative amount should cause validation error
          expiryDate
        );
        fail('Should have thrown an error');
      } catch (error) {
        // Error expected
      }

      // Verify payment is still not processed
      const payment = await Payment.findOne({ razorpayPaymentId: testPaymentId });
      expect(payment.processed).toBe(false);

      // Verify no wallet was created
      const wallet = await CreditWallet.findOne({ userId: testUserId });
      expect(wallet).toBeNull();
    });

    it('should throw error if payment not found', async () => {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);

      await expect(
        creditService.grantSubscriptionCreditsWithPayment(
          testUserId,
          testSubscriptionId.toString(),
          'nonexistent_payment_id',
          100,
          expiryDate
        )
      ).rejects.toThrow('Payment record not found');
    });
  });

  describe('grantSubscriptionCredits with paymentId', () => {
    it('should check payment deduplication when paymentId provided', async () => {
      // Create already processed payment
      await Payment.create({
        razorpayPaymentId: testPaymentId,
        subscriptionId: testSubscriptionId,
        userId: testUserId,
        amount: 99900,
        currency: 'INR',
        status: 'captured',
        processed: true,
        creditsGranted: 100,
        processedAt: new Date()
      });

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);

      // Try to grant credits
      const result = await creditService.grantSubscriptionCredits(
        testUserId,
        100,
        expiryDate,
        testSubscriptionId.toString(),
        testPaymentId
      );

      expect(result.success).toBe(true);
      expect(result.alreadyProcessed).toBe(true);
    });

    it('should grant credits normally when payment not processed', async () => {
      // Create unprocessed payment
      await Payment.create({
        razorpayPaymentId: testPaymentId,
        subscriptionId: testSubscriptionId,
        userId: testUserId,
        amount: 99900,
        currency: 'INR',
        status: 'captured',
        processed: false
      });

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);

      // Grant credits
      const result = await creditService.grantSubscriptionCredits(
        testUserId,
        100,
        expiryDate,
        testSubscriptionId.toString(),
        testPaymentId
      );

      expect(result.success).toBe(true);
      expect(result.wallet.subscriptionCredits).toBe(100);

      // Verify payment is marked as processed
      const payment = await Payment.findOne({ razorpayPaymentId: testPaymentId });
      expect(payment.processed).toBe(true);
      expect(payment.creditsGranted).toBe(100);
    });
  });
});
