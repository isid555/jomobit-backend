const mongoose = require('mongoose');

/**
 * Database Indexes Configuration
 * Ensures all performance-critical indexes are created
 */

/**
 * Create all database indexes
 * This should be run during application startup or deployment
 */
async function createIndexes() {
  try {
    console.log('Creating database indexes...');

    // User model indexes
    const User = mongoose.model('User');
    await User.collection.createIndex({ auth0Id: 1 }, { unique: true });
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ status: 1 });
    await User.collection.createIndex({ createdAt: -1 });
    await User.collection.createIndex({ lastLoginAt: -1 });
    console.log('✓ User indexes created');

    // CreditWallet model indexes
    const CreditWallet = mongoose.model('CreditWallet');
    await CreditWallet.collection.createIndex({ userId: 1 }, { unique: true });
    await CreditWallet.collection.createIndex({ subscriptionCreditExpiry: 1 });
    await CreditWallet.collection.createIndex({ totalCredits: 1 });
    await CreditWallet.collection.createIndex({ lastUpdated: -1 });
    console.log('✓ CreditWallet indexes created');

    // CreditTransaction model indexes
    const CreditTransaction = mongoose.model('CreditTransaction');
    await CreditTransaction.collection.createIndex({ userId: 1, createdAt: -1 });
    await CreditTransaction.collection.createIndex({ userId: 1, type: 1, createdAt: -1 });
    await CreditTransaction.collection.createIndex({ 'reference.type': 1, 'reference.id': 1 });
    await CreditTransaction.collection.createIndex({ type: 1, createdAt: -1 });
    await CreditTransaction.collection.createIndex({ creditType: 1, createdAt: -1 });
    console.log('✓ CreditTransaction indexes created');

    // BusinessProfile model indexes
    const BusinessProfile = mongoose.model('BusinessProfile');
    await BusinessProfile.collection.createIndex({ userId: 1, isActive: 1 });
    await BusinessProfile.collection.createIndex({ userId: 1, createdAt: -1 });
    await BusinessProfile.collection.createIndex({ name: 'text', description: 'text' });
    console.log('✓ BusinessProfile indexes created');

    // Template model indexes
    const Template = mongoose.model('Template');
    await Template.collection.createIndex({ 
      name: 'text', 
      description: 'text', 
      tags: 'text', 
      category: 'text' 
    });
    await Template.collection.createIndex({ status: 1, isPublic: 1, createdAt: -1 });
    await Template.collection.createIndex({ category: 1, type: 1, status: 1 });
    await Template.collection.createIndex({ tags: 1, status: 1 });
    await Template.collection.createIndex({ isFeatured: 1, status: 1, 'metrics.usageCount': -1 });
    await Template.collection.createIndex({ 'metrics.usageCount': -1, status: 1 });
    await Template.collection.createIndex({ 'metrics.rating': -1, status: 1 });
    console.log('✓ Template indexes created');

    // GenerationJob model indexes
    const GenerationJob = mongoose.model('GenerationJob');
    await GenerationJob.collection.createIndex({ userId: 1, status: 1, createdAt: -1 });
    await GenerationJob.collection.createIndex({ userId: 1, profileId: 1, createdAt: -1 });
    await GenerationJob.collection.createIndex({ status: 1, createdAt: 1 });
    await GenerationJob.collection.createIndex({ externalJobId: 1, status: 1 });
    await GenerationJob.collection.createIndex({ 'aiProvider.llm': 1, 'aiProvider.diffusion': 1, status: 1 });
    console.log('✓ GenerationJob indexes created');

    // Subscription model indexes
    const Subscription = mongoose.model('Subscription');
    await Subscription.collection.createIndex({ userId: 1, status: 1 });
    await Subscription.collection.createIndex({ status: 1, currentPeriodEnd: 1 });
    await Subscription.collection.createIndex({ razorpaySubscriptionId: 1, status: 1 });
    await Subscription.collection.createIndex({ currentPeriodEnd: 1, cancelAtPeriodEnd: 1 });
    console.log('✓ Subscription indexes created');

    // Plan model indexes
    const Plan = mongoose.model('Plan');
    await Plan.collection.createIndex({ planId: 1 }, { unique: true });
    await Plan.collection.createIndex({ razorpayPlanId: 1 }, { unique: true, sparse: true });
    await Plan.collection.createIndex({ status: 1, isPublic: 1, sortOrder: 1 });
    await Plan.collection.createIndex({ tier: 1, status: 1 });
    console.log('✓ Plan indexes created');

    console.log('✅ All database indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating database indexes:', error);
    throw error;
  }
}

/**
 * Drop all indexes (use with caution)
 */
async function dropIndexes() {
  try {
    console.log('Dropping database indexes...');

    const models = [
      'User',
      'CreditWallet', 
      'CreditTransaction',
      'BusinessProfile',
      'Template',
      'GenerationJob',
      'Subscription',
      'Plan'
    ];

    for (const modelName of models) {
      const Model = mongoose.model(modelName);
      await Model.collection.dropIndexes();
      console.log(`✓ ${modelName} indexes dropped`);
    }

    console.log('✅ All database indexes dropped successfully');
  } catch (error) {
    console.error('❌ Error dropping database indexes:', error);
    throw error;
  }
}

/**
 * Get index information for all models
 */
async function getIndexInfo() {
  try {
    const models = [
      'User',
      'CreditWallet', 
      'CreditTransaction',
      'BusinessProfile',
      'Template',
      'GenerationJob',
      'Subscription',
      'Plan'
    ];

    const indexInfo = {};

    for (const modelName of models) {
      const Model = mongoose.model(modelName);
      const indexes = await Model.collection.getIndexes();
      indexInfo[modelName] = indexes;
    }

    return indexInfo;
  } catch (error) {
    console.error('❌ Error getting index information:', error);
    throw error;
  }
}

module.exports = {
  createIndexes,
  dropIndexes,
  getIndexInfo
};