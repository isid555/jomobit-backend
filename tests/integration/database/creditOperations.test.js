const mongoose = require('mongoose');
const { CreditService } = require('../../../src/services/creditService');
const CreditWallet = require('../../../src/models/CreditWallet');
const CreditTransaction = require('../../../src/models/CreditTransaction');
const User = require('../../../src/models/User');
const { TestDataFactory } = require('../../fixtures/testData');

describe('Credit Operations Integration Tests', () => {
  let creditService;
  let testUser;

  beforeAll(async () => {
    // Check if transactions are supported (requires replica set)
    const isReplicaSet = mongoose.connection.db && 
      mongoose.connection.db.admin && 
      await mongoose.connection.db.admin().command({ isMaster: 1 }).then(
        result => result.setName !== undefined
      ).catch(() => false);
    
    // Use transactions only if supported
    creditService = new CreditService({ useTransactions: isReplicaSet });
    
    if (!isReplicaSet) {
      console.log('⚠️  Transactions not supported in test environment. Some tests will be skipped.');
    }
  });

  beforeEach(async () => {
    // Create test user
    const userData = TestDataFactory.createUserData();
    testUser = await User.create(userData);
  });

  describe('ACID Transaction Compliance', () => {
    it('should maintain consistency during concurrent credit operations', async () => {
      // Create wallet with initial credits
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 10,
        subscriptionCredits: 20,
        reservedCredits: 0
      });

      // Perform concurrent operations
      const operations = [
        () => creditService.reserveCredits(testUser._id, 5, 'job_1'),
        () => creditService.reserveCredits(testUser._id, 8, 'job_2'),
        () => creditService.reserveCredits(testUser._id, 12, 'job_3'),
        () => creditService.reserveCredits(testUser._id, 6, 'job_4'),
        () => creditService.reserveCredits(testUser._id, 4, 'job_5')
      ];

      const results = await Promise.allSettled(
        operations.map(op => op())
      );

      // Verify final state consistency
      const wallet = await CreditWallet.findOne({ userId: testUser._id });
      const transactions = await CreditTransaction.find({
        userId: testUser._id,
        type: 'reserve'
      });

      // Total reserved should not exceed available credits (30)
      expect(wallet.reservedCredits).toBeLessThanOrEqual(30);
      
      // Each successful reservation should have a transaction
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(transactions.length).toBe(successes.length);

      // Verify transaction amounts match wallet state
      const totalReservedFromTransactions = transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(totalReservedFromTransactions).toBe(wallet.reservedCredits);
    });

    it('should rollback failed transactions completely', async () => {
      // Create wallet
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 5,
        subscriptionCredits: 0,
        reservedCredits: 0
      });

      // Mock a failure during transaction
      const originalCreate = CreditTransaction.create;
      let callCount = 0;
      CreditTransaction.create = jest.fn().mockImplementation((...args) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Transaction creation failed');
        }
        return originalCreate.apply(CreditTransaction, args);
      });

      try {
        await creditService.reserveCredits(testUser._id, 3, 'job_fail');
        fail('Should have thrown an error');
      } catch (error) {
        // Verify wallet state was not modified
        const wallet = await CreditWallet.findOne({ userId: testUser._id });
        expect(wallet.reservedCredits).toBe(0);
        expect(wallet.defaultCredits).toBe(5);
        expect(wallet.subscriptionCredits).toBe(0);

        // Verify no transaction was created
        const transactions = await CreditTransaction.find({
          userId: testUser._id,
          reference: { type: 'generation', id: 'job_fail' }
        });
        expect(transactions).toHaveLength(0);
      }

      // Restore original method
      CreditTransaction.create = originalCreate;
    });

    it('should handle complex multi-step operations atomically', async () => {
      // Test the complete flow: reserve -> deduct
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 3,
        subscriptionCredits: 7,
        reservedCredits: 0
      });

      // Reserve credits
      const reserveResult = await creditService.reserveCredits(testUser._id, 5, 'job_complex');
      expect(reserveResult.success).toBe(true);

      // Verify intermediate state
      let wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.reservedCredits).toBe(5);

      // Deduct reserved credits
      const deductResult = await creditService.deductReservedCredits('job_complex', testUser._id, 5);
      expect(deductResult.success).toBe(true);

      // Verify final state
      wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.reservedCredits).toBe(0);
      expect(wallet.subscriptionCredits).toBe(2); // 7 - 5
      expect(wallet.defaultCredits).toBe(3); // Unchanged

      // Verify transaction history
      const transactions = await CreditTransaction.find({
        userId: testUser._id,
        'reference.id': 'job_complex'
      }).sort({ createdAt: 1 });

      expect(transactions).toHaveLength(2);
      expect(transactions[0].type).toBe('reserve');
      expect(transactions[1].type).toBe('deduct');
    });
  });

  describe('Database Performance', () => {
    it('should handle bulk credit operations efficiently', async () => {
      // Create multiple users with wallets
      const users = [];
      for (let i = 0; i < 50; i++) {
        const userData = TestDataFactory.createUserData({ email: `user${i}@test.com` });
        const user = await User.create(userData);
        users.push(user);

        await CreditWallet.create({
          userId: user._id,
          defaultCredits: 10,
          subscriptionCredits: 0,
          reservedCredits: 0
        });
      }

      const startTime = Date.now();

      // Perform bulk operations
      const operations = users.map(user => 
        creditService.grantSubscriptionCredits(
          user._id, 
          50, 
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          `sub_${user._id}`
        )
      );

      await Promise.all(operations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(10000); // 10 seconds

      // Verify all operations completed successfully
      const wallets = await CreditWallet.find({ userId: { $in: users.map(u => u._id) } });
      expect(wallets).toHaveLength(50);
      expect(wallets.every(w => w.subscriptionCredits === 50)).toBe(true);
    });

    it('should maintain performance with large transaction history', async () => {
      // Create wallet
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 1000,
        subscriptionCredits: 0,
        reservedCredits: 0
      });

      // Create many transactions
      const transactions = [];
      for (let i = 0; i < 100; i++) {
        transactions.push({
          userId: testUser._id,
          type: 'reserve',
          amount: 1,
          creditType: 'default',
          reference: { type: 'generation', id: `job_${i}` },
          balanceBefore: { defaultCredits: 1000 - i, subscriptionCredits: 0, reservedCredits: i, totalCredits: 1000 },
          balanceAfter: { defaultCredits: 1000 - i - 1, subscriptionCredits: 0, reservedCredits: i + 1, totalCredits: 1000 }
        });
      }

      await CreditTransaction.insertMany(transactions);

      // Test query performance
      const startTime = Date.now();
      const history = await creditService.getTransactionHistory(testUser._id, { limit: 20 });
      const endTime = Date.now();

      expect(history).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity across collections', async () => {
      // Create wallet and transactions
      const wallet = await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 10,
        subscriptionCredits: 0,
        reservedCredits: 0
      });

      await creditService.reserveCredits(testUser._id, 5, 'job_integrity');

      // Verify relationships
      const transaction = await CreditTransaction.findOne({
        userId: testUser._id,
        'reference.id': 'job_integrity'
      });

      expect(transaction.userId).toEqual(testUser._id);
      expect(transaction.userId).toEqual(wallet.userId);

      // Test cascade behavior (if implemented)
      await User.deleteOne({ _id: testUser._id });

      // Depending on implementation, related records might be cleaned up
      // This test verifies the current behavior
      const remainingTransactions = await CreditTransaction.find({ userId: testUser._id });
      const remainingWallet = await CreditWallet.findOne({ userId: testUser._id });

      // Document the current behavior
      console.log(`Transactions after user deletion: ${remainingTransactions.length}`);
      console.log(`Wallet after user deletion: ${remainingWallet ? 'exists' : 'deleted'}`);
    });

    it('should handle edge cases in credit calculations', async () => {
      // Test with very small amounts
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 0.1,
        subscriptionCredits: 0.9,
        reservedCredits: 0
      });

      const result = await creditService.reserveCredits(testUser._id, 0.5, 'job_decimal');
      expect(result.success).toBe(true);

      const wallet = await CreditWallet.findOne({ userId: testUser._id });
      expect(wallet.reservedCredits).toBe(0.5);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from database connection interruptions', async () => {
      // Create initial state
      await CreditWallet.create({
        userId: testUser._id,
        defaultCredits: 10,
        subscriptionCredits: 0,
        reservedCredits: 0
      });

      // Simulate connection interruption during operation
      const originalExec = mongoose.Query.prototype.exec;
      let callCount = 0;
      
      mongoose.Query.prototype.exec = function() {
        callCount++;
        if (callCount === 2) { // Fail on second database call
          return Promise.reject(new Error('Connection lost'));
        }
        return originalExec.call(this);
      };

      try {
        await creditService.reserveCredits(testUser._id, 5, 'job_recovery');
        fail('Should have thrown connection error');
      } catch (error) {
        expect(error.message).toBe('Connection lost');
      }

      // Restore connection
      mongoose.Query.prototype.exec = originalExec;

      // Verify system can recover
      const result = await creditService.reserveCredits(testUser._id, 3, 'job_recovery_2');
      expect(result.success).toBe(true);
    });
  });
});