const mongoose = require('mongoose');
const { CreditService } = require('../../src/services/creditService');
const { GenerationService } = require('../../src/services/generationService');
const User = require('../../src/models/User');
const CreditWallet = require('../../src/models/CreditWallet');
const BusinessProfile = require('../../src/models/BusinessProfile');
const Template = require('../../src/models/Template');
const GenerationJob = require('../../src/models/GenerationJob');
const { TestDataFactory } = require('../fixtures/testData');

describe('Performance Tests - Concurrent Operations', () => {
  let creditService;
  let generationService;

  beforeAll(async () => {
    creditService = new CreditService({ useTransactions: true });
    generationService = new GenerationService();
  });

  describe('Credit System Performance', () => {
    it('should handle high-volume concurrent credit reservations', async () => {
      const userCount = 50;
      const operationsPerUser = 10;
      const users = [];

      // Create test users with wallets
      for (let i = 0; i < userCount; i++) {
        const userData = TestDataFactory.createUserData({
          email: `perftest${i}@example.com`
        });
        const user = await User.create(userData);
        users.push(user);

        await CreditWallet.create({
          userId: user._id,
          defaultCredits: 100,
          subscriptionCredits: 0,
          reservedCredits: 0
        });
      }

      const startTime = Date.now();
      const operations = [];

      // Create concurrent operations
      for (let userIndex = 0; userIndex < userCount; userIndex++) {
        for (let opIndex = 0; opIndex < operationsPerUser; opIndex++) {
          const operation = creditService.reserveCredits(
            users[userIndex]._id,
            1,
            `job_${userIndex}_${opIndex}`
          );
          operations.push(operation);
        }
      }

      // Execute all operations concurrently
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      const duration = endTime - startTime;
      const totalOperations = userCount * operationsPerUser;
      const operationsPerSecond = totalOperations / (duration / 1000);

      console.log(`Performance Results:`);
      console.log(`- Total operations: ${totalOperations}`);
      console.log(`- Duration: ${duration}ms`);
      console.log(`- Operations per second: ${operationsPerSecond.toFixed(2)}`);

      // Performance assertions
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(operationsPerSecond).toBeGreaterThan(10); // At least 10 ops/sec

      // Verify data consistency
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      console.log(`- Successful operations: ${successes.length}`);
      console.log(`- Failed operations: ${failures.length}`);

      // Verify final wallet states
      for (const user of users) {
        const wallet = await CreditWallet.findOne({ userId: user._id });
        expect(wallet.reservedCredits).toBeLessThanOrEqual(100);
        expect(wallet.defaultCredits + wallet.reservedCredits).toBeLessThanOrEqual(100);
      }
    });

    it('should maintain ACID properties under high concurrency', async () => {
      const user = await User.create(TestDataFactory.createUserData());
      await CreditWallet.create({
        userId: user._id,
        defaultCredits: 50,
        subscriptionCredits: 50,
        reservedCredits: 0
      });

      const concurrentOperations = 20;
      const creditsPerOperation = 5;

      const startTime = Date.now();

      // Create operations that will compete for the same credits
      const operations = Array.from({ length: concurrentOperations }, (_, i) =>
        creditService.reserveCredits(user._id, creditsPerOperation, `concurrent_job_${i}`)
      );

      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`ACID Test Duration: ${duration}ms`);

      // Verify consistency
      const wallet = await CreditWallet.findOne({ userId: user._id });
      const successes = results.filter(r => r.status === 'fulfilled');
      const expectedReservedCredits = successes.length * creditsPerOperation;

      expect(wallet.reservedCredits).toBe(expectedReservedCredits);
      expect(wallet.reservedCredits).toBeLessThanOrEqual(100); // Total available credits

      // Verify no over-reservation occurred
      expect(wallet.defaultCredits + wallet.subscriptionCredits + wallet.reservedCredits).toBe(100);
    });

    it('should handle credit expiration under load', async () => {
      const userCount = 20;
      const users = [];

      // Create users with expired subscription credits
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      for (let i = 0; i < userCount; i++) {
        const userData = TestDataFactory.createUserData({
          email: `expiry${i}@example.com`
        });
        const user = await User.create(userData);
        users.push(user);

        await CreditWallet.create({
          userId: user._id,
          defaultCredits: 5,
          subscriptionCredits: 50,
          reservedCredits: 0,
          subscriptionCreditExpiry: pastDate
        });
      }

      const startTime = Date.now();
      const result = await creditService.expireSubscriptionCredits();
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`Credit Expiration Duration: ${duration}ms`);
      console.log(`Wallets Processed: ${result.walletsProcessed}`);
      console.log(`Total Expired Credits: ${result.totalExpiredCredits}`);

      // Performance assertions
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.walletsProcessed).toBe(userCount);
      expect(result.totalExpiredCredits).toBe(userCount * 50);

      // Verify all wallets were processed correctly
      for (const user of users) {
        const wallet = await CreditWallet.findOne({ userId: user._id });
        expect(wallet.subscriptionCredits).toBe(0);
        expect(wallet.defaultCredits).toBe(5);
      }
    });
  });

  describe('Generation Service Performance', () => {
    let users;
    let businessProfiles;
    let templates;

    beforeEach(async () => {
      const userCount = 10;
      users = [];
      businessProfiles = [];
      templates = [];

      // Create test data
      for (let i = 0; i < userCount; i++) {
        const userData = TestDataFactory.createUserData({
          email: `gentest${i}@example.com`
        });
        const user = await User.create(userData);
        users.push(user);

        await CreditWallet.create({
          userId: user._id,
          defaultCredits: 20,
          subscriptionCredits: 0,
          reservedCredits: 0
        });

        const profileData = TestDataFactory.createBusinessProfileData(user._id, {
          name: `Business ${i}`
        });
        const profile = await BusinessProfile.create(profileData);
        businessProfiles.push(profile);
      }

      // Create templates
      for (let i = 0; i < 5; i++) {
        const templateData = TestDataFactory.createTemplateData({
          name: `Template ${i}`
        });
        const template = await Template.create(templateData);
        templates.push(template);
      }
    });

    it('should handle concurrent poster generation requests', async () => {
      const concurrentGenerations = 25;
      const operations = [];

      const startTime = Date.now();

      // Create concurrent generation requests
      for (let i = 0; i < concurrentGenerations; i++) {
        const userIndex = i % users.length;
        const templateIndex = i % templates.length;

        const operation = generationService.initiateGeneration({
          userId: users[userIndex]._id,
          profileId: businessProfiles[userIndex]._id,
          templateId: templates[templateIndex]._id,
          aiProvider: {
            llm: 'openai',
            diffusion: 'ideogram'
          }
        });

        operations.push(operation);
      }

      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      const duration = endTime - startTime;
      const operationsPerSecond = concurrentGenerations / (duration / 1000);

      console.log(`Generation Performance Results:`);
      console.log(`- Total generations: ${concurrentGenerations}`);
      console.log(`- Duration: ${duration}ms`);
      console.log(`- Generations per second: ${operationsPerSecond.toFixed(2)}`);

      // Performance assertions
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(operationsPerSecond).toBeGreaterThan(1); // At least 1 generation/sec

      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      console.log(`- Successful generations: ${successes.length}`);
      console.log(`- Failed generations: ${failures.length}`);

      // Verify generation jobs were created
      const jobs = await GenerationJob.find({
        userId: { $in: users.map(u => u._id) }
      });

      expect(jobs.length).toBe(successes.length);
      expect(jobs.every(job => job.status === 'pending')).toBe(true);
    });

    it('should handle webhook processing under load', async () => {
      // Create pending generation jobs
      const jobCount = 50;
      const jobs = [];

      for (let i = 0; i < jobCount; i++) {
        const userIndex = i % users.length;
        const templateIndex = i % templates.length;

        const jobData = TestDataFactory.createGenerationJobData(
          users[userIndex]._id,
          businessProfiles[userIndex]._id,
          templates[templateIndex]._id,
          {
            externalJobId: `ext_job_${i}`,
            status: 'processing'
          }
        );

        const job = await GenerationJob.create(jobData);
        jobs.push(job);

        // Reserve credits for each job
        await CreditWallet.updateOne(
          { userId: users[userIndex]._id },
          { $inc: { reservedCredits: 1 } }
        );
      }

      const startTime = Date.now();

      // Simulate concurrent webhook processing
      const webhookOperations = jobs.map(job => 
        generationService.processGenerationWebhook({
          job_id: job.externalJobId,
          status: 'completed',
          result: {
            image_url: `https://example.com/image_${job._id}.jpg`,
            metadata: { prompt: 'Test prompt' }
          }
        })
      );

      const results = await Promise.allSettled(webhookOperations);
      const endTime = Date.now();

      const duration = endTime - startTime;
      const webhooksPerSecond = jobCount / (duration / 1000);

      console.log(`Webhook Processing Performance:`);
      console.log(`- Total webhooks: ${jobCount}`);
      console.log(`- Duration: ${duration}ms`);
      console.log(`- Webhooks per second: ${webhooksPerSecond.toFixed(2)}`);

      // Performance assertions
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(webhooksPerSecond).toBeGreaterThan(5); // At least 5 webhooks/sec

      const successes = results.filter(r => r.status === 'fulfilled');
      console.log(`- Successful webhook processing: ${successes.length}`);

      // Verify jobs were completed and credits deducted
      const completedJobs = await GenerationJob.find({
        _id: { $in: jobs.map(j => j._id) },
        status: 'completed'
      });

      expect(completedJobs.length).toBe(successes.length);

      // Verify credits were properly deducted
      for (const user of users) {
        const wallet = await CreditWallet.findOne({ userId: user._id });
        expect(wallet.reservedCredits).toBe(0);
      }
    });
  });

  describe('Database Performance Under Load', () => {
    it('should maintain query performance with large datasets', async () => {
      const userCount = 100;
      const transactionsPerUser = 50;

      // Create users and transactions
      const users = [];
      for (let i = 0; i < userCount; i++) {
        const userData = TestDataFactory.createUserData({
          email: `dbperf${i}@example.com`
        });
        const user = await User.create(userData);
        users.push(user);

        // Create wallet
        await CreditWallet.create({
          userId: user._id,
          defaultCredits: 10,
          subscriptionCredits: 40,
          reservedCredits: 0
        });

        // Create transaction history
        const transactions = [];
        for (let j = 0; j < transactionsPerUser; j++) {
          const transactionData = TestDataFactory.createCreditTransactionData(user._id, {
            type: j % 2 === 0 ? 'grant' : 'deduct',
            amount: j % 2 === 0 ? 5 : -2,
            reference: { type: 'generation', id: `job_${i}_${j}` }
          });
          transactions.push(transactionData);
        }

        await mongoose.connection.collection('credittransactions').insertMany(transactions);
      }

      // Test query performance
      const testQueries = [
        // Get credit balance
        () => creditService.getCreditBalance(users[0]._id),
        
        // Get transaction history with pagination
        () => creditService.getTransactionHistory(users[0]._id, { limit: 20 }),
        
        // Check sufficient credits
        () => creditService.checkSufficientCredits(users[0]._id, 5),
        
        // Complex aggregation query
        () => CreditWallet.aggregate([
          { $match: { userId: { $in: users.slice(0, 10).map(u => u._id) } } },
          { $group: { _id: null, totalCredits: { $sum: '$totalCredits' } } }
        ])
      ];

      const queryResults = [];

      for (const query of testQueries) {
        const startTime = Date.now();
        await query();
        const endTime = Date.now();
        const duration = endTime - startTime;
        queryResults.push(duration);
      }

      console.log('Query Performance Results:');
      console.log(`- Get credit balance: ${queryResults[0]}ms`);
      console.log(`- Get transaction history: ${queryResults[1]}ms`);
      console.log(`- Check sufficient credits: ${queryResults[2]}ms`);
      console.log(`- Aggregation query: ${queryResults[3]}ms`);

      // All queries should complete within reasonable time
      queryResults.forEach(duration => {
        expect(duration).toBeLessThan(1000); // 1 second max
      });
    });

    it('should handle connection pool exhaustion gracefully', async () => {
      const connectionCount = 20; // Exceed typical pool size
      const operations = [];

      // Create operations that will use database connections
      for (let i = 0; i < connectionCount; i++) {
        const userData = TestDataFactory.createUserData({
          email: `conntest${i}@example.com`
        });
        
        const operation = async () => {
          const user = await User.create(userData);
          await CreditWallet.create({
            userId: user._id,
            defaultCredits: 5,
            subscriptionCredits: 0,
            reservedCredits: 0
          });
          return user;
        };

        operations.push(operation());
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      const duration = endTime - startTime;
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      console.log(`Connection Pool Test Results:`);
      console.log(`- Duration: ${duration}ms`);
      console.log(`- Successful operations: ${successes.length}`);
      console.log(`- Failed operations: ${failures.length}`);

      // Should handle gracefully without complete failure
      expect(successes.length).toBeGreaterThan(connectionCount * 0.8); // At least 80% success
      expect(duration).toBeLessThan(10000); // Complete within 10 seconds
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not have memory leaks during extended operations', async () => {
      const initialMemory = process.memoryUsage();
      const operationCount = 1000;

      // Perform many operations
      for (let i = 0; i < operationCount; i++) {
        const userData = TestDataFactory.createUserData({
          email: `memtest${i}@example.com`
        });
        const user = await User.create(userData);

        await CreditWallet.create({
          userId: user._id,
          defaultCredits: 3,
          subscriptionCredits: 0,
          reservedCredits: 0
        });

        // Clean up to prevent legitimate memory growth
        await User.deleteOne({ _id: user._id });
        await CreditWallet.deleteOne({ userId: user._id });

        // Force garbage collection periodically
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      console.log(`Memory Usage Results:`);
      console.log(`- Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);

      // Memory growth should be reasonable (less than 50MB for 1000 operations)
      expect(memoryGrowthMB).toBeLessThan(50);
    });
  });
});