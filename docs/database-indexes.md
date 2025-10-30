# Database Indexes Documentation

This document describes all database indexes used in the Razorpay subscription system for optimal performance.

## Overview

The subscription system uses strategic indexes to optimize query performance for:
- Payment deduplication and lookups
- Webhook event deduplication and replay protection
- Subscription lifecycle queries
- Credit expiry and reconciliation jobs

## Index Strategy

### Deduplication Indexes
Unique indexes prevent duplicate records and enable idempotent operations:
- `Payment.razorpayPaymentId` - Prevents duplicate payment processing
- `WebhookEvent.uniqueKey` - Prevents webhook replay attacks
- `Subscription.razorpaySubscriptionId` - Ensures one-to-one mapping with Razorpay

### Query Optimization Indexes
Composite indexes optimize common query patterns:
- Time-based queries (with `createdAt`, `receivedAt`)
- Status-based filtering
- User and subscription lookups

### Job Performance Indexes
Indexes support scheduled jobs:
- Credit expiry job: `currentPeriodEnd`, `status`
- Reconciliation job: `status`, `razorpaySubscriptionId`
- Plan change job: `scheduledChange.effectiveDate`

## Payment Collection Indexes

### 1. razorpayPaymentId (Unique)
```javascript
{ razorpayPaymentId: 1 }
```
**Purpose**: Payment deduplication  
**Type**: Unique  
**Use Case**: Prevents double-charging by ensuring each Razorpay payment is recorded only once  
**Query Pattern**: `Payment.findOne({ razorpayPaymentId })`

### 2. subscriptionId + createdAt (Composite)
```javascript
{ subscriptionId: 1, createdAt: -1 }
```
**Purpose**: Subscription payment history  
**Type**: Composite  
**Use Case**: Retrieve payment history for a subscription in chronological order  
**Query Pattern**: `Payment.find({ subscriptionId }).sort({ createdAt: -1 })`

### 3. userId + status + createdAt (Composite)
```javascript
{ userId: 1, status: 1, createdAt: -1 }
```
**Purpose**: User payment queries with status filter  
**Type**: Composite  
**Use Case**: Find user's payments by status (e.g., failed payments)  
**Query Pattern**: `Payment.find({ userId, status: 'failed' }).sort({ createdAt: -1 })`

### 4. status + processed (Composite)
```javascript
{ status: 1, processed: 1 }
```
**Purpose**: Find unprocessed payments  
**Type**: Composite  
**Use Case**: Identify captured payments that haven't granted credits yet  
**Query Pattern**: `Payment.find({ status: 'captured', processed: false })`

## WebhookEvent Collection Indexes

### 1. uniqueKey (Unique)
```javascript
{ uniqueKey: 1 }
```
**Purpose**: Webhook deduplication and replay protection  
**Type**: Unique  
**Use Case**: Prevents processing the same webhook multiple times  
**Query Pattern**: `WebhookEvent.findOne({ uniqueKey })`  
**Note**: uniqueKey is SHA256 hash of `event:subscriptionId:paymentId:timestamp`

### 2. event + processed + receivedAt (Composite)
```javascript
{ event: 1, processed: 1, receivedAt: -1 }
```
**Purpose**: Webhook event queries  
**Type**: Composite  
**Use Case**: Find unprocessed webhooks of a specific type  
**Query Pattern**: `WebhookEvent.find({ event: 'subscription.charged', processed: false })`

### 3. razorpaySubscriptionId + event (Composite)
```javascript
{ razorpaySubscriptionId: 1, event: 1 }
```
**Purpose**: Subscription webhook history  
**Type**: Composite  
**Use Case**: Retrieve all webhook events for a specific subscription  
**Query Pattern**: `WebhookEvent.find({ razorpaySubscriptionId, event })`

### 4. processed + attempts (Composite)
```javascript
{ processed: 1, attempts: 1 }
```
**Purpose**: Failed webhook retry  
**Type**: Composite  
**Use Case**: Find failed webhooks that haven't exceeded max retry attempts  
**Query Pattern**: `WebhookEvent.find({ processed: false, attempts: { $lt: 3 } })`

## Subscription Collection Indexes

### 1. razorpaySubscriptionId (Unique)
```javascript
{ razorpaySubscriptionId: 1 }
```
**Purpose**: Razorpay subscription mapping  
**Type**: Unique  
**Use Case**: Ensures one-to-one mapping between local and Razorpay subscriptions  
**Query Pattern**: `Subscription.findOne({ razorpaySubscriptionId })`

### 2. razorpayCustomerId
```javascript
{ razorpayCustomerId: 1 }
```
**Purpose**: Customer subscription lookups  
**Type**: Single field  
**Use Case**: Find all subscriptions for a Razorpay customer  
**Query Pattern**: `Subscription.find({ razorpayCustomerId })`

### 3. paidCount
```javascript
{ paidCount: 1 }
```
**Purpose**: Payment count queries  
**Type**: Single field  
**Use Case**: Track subscription payment progress  
**Query Pattern**: `Subscription.find({ paidCount: { $gte: 1 } })`

### 4. chargeAt
```javascript
{ chargeAt: 1 }
```
**Purpose**: Upcoming charge queries  
**Type**: Single field  
**Use Case**: Find subscriptions with upcoming charges  
**Query Pattern**: `Subscription.find({ chargeAt: { $lte: futureDate } })`

### 5. startAt
```javascript
{ startAt: 1 }
```
**Purpose**: Subscription start date queries  
**Type**: Single field  
**Use Case**: Find subscriptions starting in a date range  
**Query Pattern**: `Subscription.find({ startAt: { $gte: startDate, $lte: endDate } })`

### 6. endAt
```javascript
{ endAt: 1 }
```
**Purpose**: Subscription end date queries  
**Type**: Single field  
**Use Case**: Find subscriptions ending soon  
**Query Pattern**: `Subscription.find({ endAt: { $lte: futureDate } })`

### 7. endedAt
```javascript
{ endedAt: 1 }
```
**Purpose**: Ended subscription queries  
**Type**: Single field  
**Use Case**: Find subscriptions that have ended  
**Query Pattern**: `Subscription.find({ endedAt: { $exists: true } })`

### 8. userId + status (Composite)
```javascript
{ userId: 1, status: 1 }
```
**Purpose**: User subscription queries  
**Type**: Composite  
**Use Case**: Find user's active/cancelled subscriptions  
**Query Pattern**: `Subscription.findOne({ userId, status: 'active' })`

### 9. status + currentPeriodEnd (Composite)
```javascript
{ status: 1, currentPeriodEnd: 1 }
```
**Purpose**: Expiring subscription queries  
**Type**: Composite  
**Use Case**: Credit expiry job - find active subscriptions with expired periods  
**Query Pattern**: `Subscription.find({ status: 'active', currentPeriodEnd: { $lte: now } })`

### 10. scheduledChange.effectiveDate
```javascript
{ 'scheduledChange.effectiveDate': 1 }
```
**Purpose**: Scheduled plan change queries  
**Type**: Single field (nested)  
**Use Case**: Plan change job - find subscriptions with due plan changes  
**Query Pattern**: `Subscription.find({ 'scheduledChange.effectiveDate': { $lte: now } })`

## Index Creation

### Automatic Creation (Recommended)

Indexes are automatically created when Mongoose models are initialized. Ensure your application connects to MongoDB on startup:

```javascript
const mongoose = require('mongoose');
await mongoose.connect(process.env.MONGODB_URI);

// Models will create indexes automatically
const Payment = require('./src/models/Payment');
const WebhookEvent = require('./src/models/WebhookEvent');
const Subscription = require('./src/models/Subscription');
```

### Manual Creation Using Script

Run the provided setup script to create all indexes:

```bash
# Using default MONGODB_URI from .env
node scripts/setup-database-indexes.js

# Or specify MongoDB URI
MONGODB_URI=mongodb://localhost:27017/mydb node scripts/setup-database-indexes.js
```

The script will:
- ✅ Create all required indexes
- ℹ️ Skip indexes that already exist
- 📊 Display a summary of all indexes
- ❌ Report any errors

### Manual Creation Using MongoDB Shell

If you prefer to create indexes manually using MongoDB shell:

```javascript
// Connect to your database
use jomobit;

// Payment indexes
db.payments.createIndex({ razorpayPaymentId: 1 }, { unique: true, name: 'razorpayPaymentId_unique' });
db.payments.createIndex({ subscriptionId: 1, createdAt: -1 }, { name: 'subscriptionId_createdAt' });
db.payments.createIndex({ userId: 1, status: 1, createdAt: -1 }, { name: 'userId_status_createdAt' });
db.payments.createIndex({ status: 1, processed: 1 }, { name: 'status_processed' });

// WebhookEvent indexes
db.webhookevents.createIndex({ uniqueKey: 1 }, { unique: true, name: 'uniqueKey_unique' });
db.webhookevents.createIndex({ event: 1, processed: 1, receivedAt: -1 }, { name: 'event_processed_receivedAt' });
db.webhookevents.createIndex({ razorpaySubscriptionId: 1, event: 1 }, { name: 'razorpaySubscriptionId_event' });
db.webhookevents.createIndex({ processed: 1, attempts: 1 }, { name: 'processed_attempts' });

// Subscription indexes
db.subscriptions.createIndex({ razorpaySubscriptionId: 1 }, { unique: true, name: 'razorpaySubscriptionId_unique' });
db.subscriptions.createIndex({ razorpayCustomerId: 1 }, { name: 'razorpayCustomerId' });
db.subscriptions.createIndex({ paidCount: 1 }, { name: 'paidCount' });
db.subscriptions.createIndex({ chargeAt: 1 }, { name: 'chargeAt' });
db.subscriptions.createIndex({ startAt: 1 }, { name: 'startAt' });
db.subscriptions.createIndex({ endAt: 1 }, { name: 'endAt' });
db.subscriptions.createIndex({ endedAt: 1 }, { name: 'endedAt' });
db.subscriptions.createIndex({ userId: 1, status: 1 }, { name: 'userId_status' });
db.subscriptions.createIndex({ status: 1, currentPeriodEnd: 1 }, { name: 'status_currentPeriodEnd' });
db.subscriptions.createIndex({ 'scheduledChange.effectiveDate': 1 }, { name: 'scheduledChange_effectiveDate' });
```

## Verifying Indexes

### Using the Setup Script

The setup script automatically lists all indexes after creation:

```bash
node scripts/setup-database-indexes.js
```

### Using MongoDB Shell

```javascript
// List all indexes for a collection
db.payments.getIndexes();
db.webhookevents.getIndexes();
db.subscriptions.getIndexes();
```

### Using Mongoose

```javascript
const Payment = require('./src/models/Payment');

// List indexes
const indexes = await Payment.collection.getIndexes();
console.log(indexes);
```

## Performance Considerations

### Index Size
- Indexes consume disk space and memory
- Each index adds overhead to write operations
- Monitor index size: `db.collection.stats().indexSizes`

### Index Selectivity
All indexes are designed with high selectivity:
- Unique indexes have 100% selectivity
- Status fields have good selectivity (8-10 distinct values)
- Date fields enable efficient range queries

### Query Patterns
Indexes are optimized for these common patterns:

**High Frequency Queries:**
- Find user's active subscription: `userId + status`
- Webhook deduplication: `uniqueKey`
- Payment deduplication: `razorpayPaymentId`

**Scheduled Job Queries:**
- Credit expiry: `status + currentPeriodEnd`
- Reconciliation: `status + razorpaySubscriptionId`
- Plan changes: `scheduledChange.effectiveDate`

**Admin Queries:**
- Payment history: `subscriptionId + createdAt`
- Failed webhooks: `processed + attempts`
- Customer subscriptions: `razorpayCustomerId`

## Monitoring Index Usage

### Check Index Usage Statistics

```javascript
// MongoDB 4.4+
db.payments.aggregate([
  { $indexStats: {} }
]);
```

### Identify Unused Indexes

```javascript
// Find indexes with zero accesses
db.payments.aggregate([
  { $indexStats: {} },
  { $match: { 'accesses.ops': 0 } }
]);
```

### Explain Query Plans

```javascript
// Check if query uses expected index
db.payments.find({ razorpayPaymentId: 'pay_123' }).explain('executionStats');
```

## Maintenance

### Rebuilding Indexes

If indexes become fragmented or corrupted:

```javascript
// Rebuild all indexes for a collection
db.payments.reIndex();
db.webhookevents.reIndex();
db.subscriptions.reIndex();
```

**Note**: `reIndex()` blocks the collection during rebuild. Use with caution in production.

### Dropping Indexes

To remove an index:

```javascript
// Drop by name
db.payments.dropIndex('index_name');

// Drop all indexes except _id
db.payments.dropIndexes();
```

## Troubleshooting

### Duplicate Key Errors

If you encounter duplicate key errors:

1. **Check for existing duplicates:**
```javascript
db.payments.aggregate([
  { $group: { _id: '$razorpayPaymentId', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]);
```

2. **Remove duplicates before creating unique index:**
```javascript
// Keep only the first occurrence
db.payments.aggregate([
  { $sort: { createdAt: 1 } },
  { $group: { _id: '$razorpayPaymentId', doc: { $first: '$$ROOT' } } },
  { $replaceRoot: { newRoot: '$doc' } },
  { $out: 'payments_deduplicated' }
]);
```

### Index Creation Failures

If index creation fails:

1. **Check for insufficient disk space**
2. **Verify field names match schema**
3. **Check for data type mismatches**
4. **Review MongoDB logs for detailed errors**

### Performance Issues

If queries are slow despite indexes:

1. **Verify index is being used:** Use `.explain()`
2. **Check index selectivity:** Low selectivity may require compound indexes
3. **Monitor index size:** Large indexes may not fit in memory
4. **Consider index hints:** Force query to use specific index

## Best Practices

1. **Create indexes before production deployment**
2. **Use background index creation in production:** `{ background: true }`
3. **Monitor index usage and remove unused indexes**
4. **Test query performance with production-like data volumes**
5. **Document custom indexes added for specific use cases**
6. **Review index strategy during schema changes**
7. **Use compound indexes for multi-field queries**
8. **Place most selective fields first in compound indexes**

## References

- [MongoDB Index Documentation](https://docs.mongodb.com/manual/indexes/)
- [Mongoose Index Documentation](https://mongoosejs.com/docs/guide.html#indexes)
- [Index Performance Best Practices](https://docs.mongodb.com/manual/core/index-creation/)

## Summary

The Razorpay subscription system uses **23 indexes** across 3 collections:
- **Payment**: 4 indexes (1 unique, 3 composite)
- **WebhookEvent**: 4 indexes (1 unique, 3 composite)
- **Subscription**: 10 indexes (1 unique, 2 composite, 7 single-field)

All indexes are automatically created by Mongoose when models are loaded. Use the provided setup script for manual creation or verification.
