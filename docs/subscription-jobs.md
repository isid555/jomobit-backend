# Subscription Jobs Documentation

## Overview

The subscription jobs system provides automated maintenance tasks for subscription and credit management. These jobs run on scheduled intervals to ensure data consistency and proper credit lifecycle management.

## Jobs

### 1. Credit Expiry Job
**Schedule:** Runs hourly (`0 * * * *`)

**Purpose:** Expires credits for subscriptions that have ended without renewal.

**Process:**
1. Finds subscriptions with `currentPeriodEnd <= now` and status not `active`, `cancelled`, or `completed`
2. Checks if next payment was made by comparing `paidCount` and `currentPeriodStart`
3. If no new payment, expires subscription credits using `creditService.expireSubscriptionCredits()`
4. Logs statistics: subscriptions processed, credits expired, errors

**Example Log Output:**
```json
{
  "message": "Credit expiry job completed",
  "subscriptionsProcessed": 5,
  "creditsExpired": 250,
  "errors": 0,
  "executionTimeMs": 1234
}
```

### 2. Subscription Reconciliation Job
**Schedule:** Runs daily at 1 AM (`0 1 * * *`)

**Purpose:** Reconciles local subscription data with Razorpay to ensure consistency.

**Process:**
1. Checks if reconciliation is enabled via `SUBSCRIPTION_RECONCILIATION_ENABLED` env var
2. Fetches active/pending subscriptions in batches of 100
3. For each subscription, fetches status from Razorpay API
4. Compares local status with Razorpay status
5. Updates local subscription if mismatch found
6. Logs statistics: total checked, mismatches found, errors

**Example Log Output:**
```json
{
  "message": "Subscription reconciliation job completed",
  "totalChecked": 150,
  "mismatchesFound": 3,
  "errors": 0,
  "executionTimeMs": 5678
}
```

### 3. Scheduled Plan Change Job
**Schedule:** Runs every 6 hours (`0 */6 * * *`)

**Purpose:** Processes scheduled plan changes that are due.

**Process:**
1. Finds subscriptions with `scheduledChange.effectiveDate <= now`
2. Updates `subscription.planId` to `scheduledChange.newPlanId`
3. Updates billing details from new plan
4. Updates Razorpay subscription with new `plan_id`
5. Records change in `planChanges` array
6. Clears `scheduledChange` field
7. Logs statistics: plan changes processed, errors

**Example Log Output:**
```json
{
  "message": "Scheduled plan change job completed",
  "planChangesProcessed": 2,
  "errors": 0,
  "executionTimeMs": 2345
}
```

## Usage

### Initialization

The jobs are initialized automatically when the server starts. In your `server.js` or `app.js`:

```javascript
const subscriptionJobs = require('./src/jobs/subscriptionJobs');
const mongoose = require('mongoose');

// After MongoDB connection succeeds
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    
    // Initialize subscription jobs
    subscriptionJobs.initializeJobs();
    console.log('Subscription jobs initialized');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
```

### Manual Execution

You can manually trigger any job for testing or maintenance:

```javascript
const subscriptionJobs = require('./src/jobs/subscriptionJobs');

// Run credit expiry job manually
await subscriptionJobs.runCreditExpiryJob();

// Run reconciliation job manually
await subscriptionJobs.runReconciliationJob();

// Run scheduled plan change job manually
await subscriptionJobs.runScheduledPlanChangeJob();
```

### Stopping Jobs

For graceful shutdown:

```javascript
const subscriptionJobs = require('./src/jobs/subscriptionJobs');

// Stop all jobs
subscriptionJobs.stopAllJobs();
```

### Job Status

Check the status of all jobs:

```javascript
const subscriptionJobs = require('./src/jobs/subscriptionJobs');

const status = subscriptionJobs.getJobStatus();
console.log(status);
// Output:
// {
//   initialized: true,
//   jobCount: 3,
//   jobs: [
//     { name: 'creditExpiry' },
//     { name: 'reconciliation' },
//     { name: 'scheduledPlanChange' }
//   ]
// }
```

## Environment Variables

### Required
- `RAZORPAY_KEY_ID` - Razorpay API key ID
- `RAZORPAY_KEY_SECRET` - Razorpay API secret
- `MONGODB_URI` - MongoDB connection string

### Optional
- `SUBSCRIPTION_RECONCILIATION_ENABLED` - Enable/disable reconciliation job (default: `true`)
  - Set to `false` to disable reconciliation

## Testing

### Manual Testing

You can test each job manually using Node.js REPL or a test script:

```javascript
// test-jobs.js
const mongoose = require('mongoose');
const subscriptionJobs = require('./src/jobs/subscriptionJobs');
require('dotenv').config();

async function testJobs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    // Test credit expiry job
    console.log('\n=== Testing Credit Expiry Job ===');
    const creditStats = await subscriptionJobs.runCreditExpiryJob();
    console.log('Credit Expiry Stats:', creditStats);

    // Test reconciliation job
    console.log('\n=== Testing Reconciliation Job ===');
    const reconStats = await subscriptionJobs.runReconciliationJob();
    console.log('Reconciliation Stats:', reconStats);

    // Test scheduled plan change job
    console.log('\n=== Testing Scheduled Plan Change Job ===');
    const planChangeStats = await subscriptionJobs.runScheduledPlanChangeJob();
    console.log('Plan Change Stats:', planChangeStats);

    // Disconnect
    await mongoose.disconnect();
    console.log('\nTests completed');
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

testJobs();
```

Run the test:
```bash
node test-jobs.js
```

## Monitoring

### Logs

All jobs log their execution with structured logging:

- **INFO**: Normal operation, job start/completion, statistics
- **WARN**: Status mismatches, non-critical issues
- **ERROR**: Processing failures, API errors

### Metrics to Monitor

1. **Credit Expiry Job**
   - Subscriptions processed per hour
   - Credits expired per hour
   - Error rate

2. **Reconciliation Job**
   - Total subscriptions checked per day
   - Mismatches found per day
   - Error rate

3. **Scheduled Plan Change Job**
   - Plan changes processed per run
   - Error rate

### Alerting

Consider setting up alerts for:
- Job execution failures
- High error rates (> 5%)
- Reconciliation mismatches (> 10% of checked subscriptions)
- Job execution time exceeding thresholds

## Troubleshooting

### Job Not Running

1. Check if jobs are initialized:
   ```javascript
   const status = subscriptionJobs.getJobStatus();
   console.log(status.initialized); // Should be true
   ```

2. Check server logs for initialization errors

3. Verify cron patterns are valid

### High Error Rates

1. Check Razorpay API connectivity
2. Verify Razorpay credentials are correct
3. Check MongoDB connection stability
4. Review error logs for specific issues

### Reconciliation Mismatches

1. Review webhook processing logs
2. Check for webhook delivery failures
3. Verify webhook signature verification is working
4. Consider running reconciliation more frequently

### Performance Issues

1. Monitor job execution time
2. Consider reducing batch size for reconciliation
3. Add indexes to subscription queries if needed
4. Review database query performance

## Best Practices

1. **Always initialize jobs after MongoDB connection**
   - Ensures database is ready before jobs run

2. **Monitor job execution**
   - Set up logging aggregation
   - Create dashboards for job metrics

3. **Test jobs in staging first**
   - Run manual tests before deploying to production
   - Verify job behavior with production-like data

4. **Handle graceful shutdown**
   - Stop jobs before shutting down server
   - Ensure in-progress operations complete

5. **Keep job execution time reasonable**
   - Credit expiry: < 5 minutes
   - Reconciliation: < 15 minutes
   - Plan changes: < 5 minutes

## Future Enhancements

Potential improvements to consider:

1. **Job Queue System**
   - Use Bull or BullMQ for more robust job management
   - Better retry logic and failure handling

2. **Job Metrics Dashboard**
   - Real-time job execution monitoring
   - Historical performance tracking

3. **Configurable Schedules**
   - Allow schedule configuration via environment variables
   - Support different schedules per environment

4. **Job Locking**
   - Prevent concurrent job execution in multi-instance deployments
   - Use Redis or MongoDB for distributed locking

5. **Notification System**
   - Send notifications on job failures
   - Alert on high error rates or anomalies
