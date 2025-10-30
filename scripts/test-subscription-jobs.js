#!/usr/bin/env node

/**
 * Test script for subscription jobs
 * Usage: node scripts/test-subscription-jobs.js [job-name]
 * 
 * job-name options:
 *   - credit-expiry
 *   - reconciliation
 *   - plan-change
 *   - all (default)
 */

const mongoose = require('mongoose');
const subscriptionJobs = require('../src/jobs/subscriptionJobs');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const jobName = args[0] || 'all';

async function testCreditExpiryJob() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Credit Expiry Job');
  console.log('='.repeat(60));
  
  try {
    const stats = await subscriptionJobs.runCreditExpiryJob();
    console.log('\n✅ Credit Expiry Job completed successfully');
    console.log('Statistics:', JSON.stringify(stats, null, 2));
    return true;
  } catch (error) {
    console.error('\n❌ Credit Expiry Job failed');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function testReconciliationJob() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Subscription Reconciliation Job');
  console.log('='.repeat(60));
  
  try {
    const stats = await subscriptionJobs.runReconciliationJob();
    console.log('\n✅ Reconciliation Job completed successfully');
    console.log('Statistics:', JSON.stringify(stats, null, 2));
    return true;
  } catch (error) {
    console.error('\n❌ Reconciliation Job failed');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function testPlanChangeJob() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Scheduled Plan Change Job');
  console.log('='.repeat(60));
  
  try {
    const stats = await subscriptionJobs.runScheduledPlanChangeJob();
    console.log('\n✅ Scheduled Plan Change Job completed successfully');
    console.log('Statistics:', JSON.stringify(stats, null, 2));
    return true;
  } catch (error) {
    console.error('\n❌ Scheduled Plan Change Job failed');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function testAllJobs() {
  const results = {
    creditExpiry: false,
    reconciliation: false,
    planChange: false
  };

  results.creditExpiry = await testCreditExpiryJob();
  results.reconciliation = await testReconciliationJob();
  results.planChange = await testPlanChangeJob();

  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Credit Expiry Job: ${results.creditExpiry ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Reconciliation Job: ${results.reconciliation ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Plan Change Job: ${results.planChange ? '✅ PASSED' : '❌ FAILED'}`);

  const allPassed = Object.values(results).every(result => result === true);
  console.log('\n' + (allPassed ? '✅ All tests passed!' : '❌ Some tests failed'));

  return allPassed;
}

async function main() {
  console.log('Subscription Jobs Test Script');
  console.log('==============================\n');

  // Check environment variables
  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn('⚠️  Warning: Razorpay credentials not set. Reconciliation job may fail.');
  }

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Run requested job(s)
    let success = false;

    switch (jobName.toLowerCase()) {
      case 'credit-expiry':
        success = await testCreditExpiryJob();
        break;
      
      case 'reconciliation':
        success = await testReconciliationJob();
        break;
      
      case 'plan-change':
        success = await testPlanChangeJob();
        break;
      
      case 'all':
        success = await testAllJobs();
        break;
      
      default:
        console.error(`❌ Unknown job name: ${jobName}`);
        console.error('Valid options: credit-expiry, reconciliation, plan-change, all');
        process.exit(1);
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\n✅ MongoDB disconnected');

    // Exit with appropriate code
    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('Stack:', error.stack);
    
    // Try to disconnect
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
    
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled rejection:', error);
  process.exit(1);
});

// Run main function
main();
