#!/usr/bin/env node

/**
 * Database Index Setup Script
 * 
 * This script creates all required indexes for the Razorpay subscription system.
 * Run this script after deploying the models to ensure optimal database performance.
 * 
 * Usage:
 *   node scripts/setup-database-indexes.js
 * 
 * Or with environment variables:
 *   MONGODB_URI=mongodb://localhost:27017/mydb node scripts/setup-database-indexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models to ensure schemas are registered
const Payment = require('../src/models/Payment');
const WebhookEvent = require('../src/models/WebhookEvent');
const Subscription = require('../src/models/Subscription');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jomobit';

/**
 * Index definitions for each collection
 */
const indexDefinitions = {
  payments: [
    {
      name: 'razorpayPaymentId_unique',
      keys: { razorpayPaymentId: 1 },
      options: { unique: true },
      description: 'Unique index for payment deduplication'
    },
    {
      name: 'subscriptionId_createdAt',
      keys: { subscriptionId: 1, createdAt: -1 },
      options: {},
      description: 'Composite index for subscription payment history queries'
    },
    {
      name: 'userId_status_createdAt',
      keys: { userId: 1, status: 1, createdAt: -1 },
      options: {},
      description: 'Composite index for user payment queries with status filter'
    },
    {
      name: 'status_processed',
      keys: { status: 1, processed: 1 },
      options: {},
      description: 'Index for finding unprocessed payments'
    }
  ],
  
  webhookevents: [
    {
      name: 'uniqueKey_unique',
      keys: { uniqueKey: 1 },
      options: { unique: true },
      description: 'Unique index for webhook deduplication and replay protection'
    },
    {
      name: 'event_processed_receivedAt',
      keys: { event: 1, processed: 1, receivedAt: -1 },
      options: {},
      description: 'Composite index for webhook event queries'
    },
    {
      name: 'razorpaySubscriptionId_event',
      keys: { razorpaySubscriptionId: 1, event: 1 },
      options: {},
      description: 'Composite index for subscription webhook history'
    },
    {
      name: 'processed_attempts',
      keys: { processed: 1, attempts: 1 },
      options: {},
      description: 'Index for finding failed webhooks for retry'
    }
  ],
  
  subscriptions: [
    {
      name: 'razorpaySubscriptionId_unique',
      keys: { razorpaySubscriptionId: 1 },
      options: { unique: true },
      description: 'Unique index for Razorpay subscription ID'
    },
    {
      name: 'razorpayCustomerId',
      keys: { razorpayCustomerId: 1 },
      options: {},
      description: 'Index for customer subscription lookups'
    },
    {
      name: 'paidCount',
      keys: { paidCount: 1 },
      options: {},
      description: 'Index for payment count queries'
    },
    {
      name: 'chargeAt',
      keys: { chargeAt: 1 },
      options: {},
      description: 'Index for upcoming charge queries'
    },
    {
      name: 'startAt',
      keys: { startAt: 1 },
      options: {},
      description: 'Index for subscription start date queries'
    },
    {
      name: 'endAt',
      keys: { endAt: 1 },
      options: {},
      description: 'Index for subscription end date queries'
    },
    {
      name: 'endedAt',
      keys: { endedAt: 1 },
      options: {},
      description: 'Index for ended subscription queries'
    },
    {
      name: 'userId_status',
      keys: { userId: 1, status: 1 },
      options: {},
      description: 'Composite index for user subscription queries'
    },
    {
      name: 'status_currentPeriodEnd',
      keys: { status: 1, currentPeriodEnd: 1 },
      options: {},
      description: 'Composite index for expiring subscription queries'
    }
  ]
};

/**
 * Create indexes for a collection
 */
async function createIndexesForCollection(collectionName, indexes) {
  console.log(`\n📊 Creating indexes for ${collectionName}...`);
  
  const collection = mongoose.connection.collection(collectionName);
  let created = 0;
  let existing = 0;
  let errors = 0;

  for (const indexDef of indexes) {
    try {
      console.log(`  ⏳ Creating index: ${indexDef.name}`);
      console.log(`     Keys: ${JSON.stringify(indexDef.keys)}`);
      console.log(`     Description: ${indexDef.description}`);
      
      await collection.createIndex(indexDef.keys, {
        ...indexDef.options,
        name: indexDef.name,
        background: true
      });
      
      created++;
      console.log(`  ✅ Index created successfully`);
    } catch (error) {
      if (error.code === 85 || error.message.includes('already exists')) {
        existing++;
        console.log(`  ℹ️  Index already exists`);
      } else {
        errors++;
        console.error(`  ❌ Error creating index: ${error.message}`);
      }
    }
  }

  return { created, existing, errors };
}

/**
 * List existing indexes for a collection
 */
async function listExistingIndexes(collectionName) {
  console.log(`\n📋 Existing indexes for ${collectionName}:`);
  
  try {
    const collection = mongoose.connection.collection(collectionName);
    const indexes = await collection.indexes();
    
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      if (index.unique) console.log(`    (unique)`);
    });
  } catch (error) {
    console.error(`  ❌ Error listing indexes: ${error.message}`);
  }
}

/**
 * Main execution function
 */
async function setupIndexes() {
  console.log('🚀 Database Index Setup Script');
  console.log('================================\n');
  console.log(`📍 Connecting to: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    const stats = {
      totalCreated: 0,
      totalExisting: 0,
      totalErrors: 0
    };

    // Create indexes for each collection
    for (const [collectionName, indexes] of Object.entries(indexDefinitions)) {
      const result = await createIndexesForCollection(collectionName, indexes);
      stats.totalCreated += result.created;
      stats.totalExisting += result.existing;
      stats.totalErrors += result.errors;
    }

    // List all existing indexes
    console.log('\n\n📊 Index Summary');
    console.log('================');
    for (const collectionName of Object.keys(indexDefinitions)) {
      await listExistingIndexes(collectionName);
    }

    // Print summary
    console.log('\n\n✨ Setup Complete!');
    console.log('==================');
    console.log(`✅ Indexes created: ${stats.totalCreated}`);
    console.log(`ℹ️  Indexes already existing: ${stats.totalExisting}`);
    console.log(`❌ Errors: ${stats.totalErrors}`);

    if (stats.totalErrors > 0) {
      console.log('\n⚠️  Some indexes failed to create. Please review the errors above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All indexes are set up successfully!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the setup
if (require.main === module) {
  setupIndexes();
}

module.exports = { setupIndexes, indexDefinitions };
