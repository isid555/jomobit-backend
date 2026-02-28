# Database Indexes Quick Reference

## Payment Collection

| Index Name | Fields | Type | Purpose |
|------------|--------|------|---------|
| `razorpayPaymentId_unique` | `razorpayPaymentId: 1` | Unique | Payment deduplication |
| `subscriptionId_createdAt` | `subscriptionId: 1, createdAt: -1` | Composite | Payment history queries |
| `userId_status_createdAt` | `userId: 1, status: 1, createdAt: -1` | Composite | User payment queries |
| `status_processed` | `status: 1, processed: 1` | Composite | Unprocessed payment queries |

**Total**: 4 indexes + 1 default (_id)

## WebhookEvent Collection

| Index Name | Fields | Type | Purpose |
|------------|--------|------|---------|
| `uniqueKey_unique` | `uniqueKey: 1` | Unique | Webhook deduplication |
| `event_processed_receivedAt` | `event: 1, processed: 1, receivedAt: -1` | Composite | Event queries |
| `razorpaySubscriptionId_event` | `razorpaySubscriptionId: 1, event: 1` | Composite | Subscription webhook history |
| `processed_attempts` | `processed: 1, attempts: 1` | Composite | Failed webhook retry |

**Total**: 4 indexes + 1 default (_id)

## Subscription Collection

| Index Name | Fields | Type | Purpose |
|------------|--------|------|---------|
| `razorpaySubscriptionId_unique` | `razorpaySubscriptionId: 1` | Unique | Razorpay mapping |
| `razorpayCustomerId` | `razorpayCustomerId: 1` | Single | Customer lookups |
| `paidCount` | `paidCount: 1` | Single | Payment tracking |
| `chargeAt` | `chargeAt: 1` | Single | Upcoming charges |
| `startAt` | `startAt: 1` | Single | Start date queries |
| `endAt` | `endAt: 1` | Single | End date queries |
| `endedAt` | `endedAt: 1` | Single | Ended subscriptions |
| `userId_status` | `userId: 1, status: 1` | Composite | User subscription queries |
| `status_currentPeriodEnd` | `status: 1, currentPeriodEnd: 1` | Composite | Expiring subscriptions |
| `scheduledChange_effectiveDate` | `scheduledChange.effectiveDate: 1` | Single | Plan change job |

**Total**: 10 indexes + 1 default (_id)

## MongoDB Shell Commands

### Create All Indexes

```javascript
use jomobit;

// Payment
db.payments.createIndex({ razorpayPaymentId: 1 }, { unique: true });
db.payments.createIndex({ subscriptionId: 1, createdAt: -1 });
db.payments.createIndex({ userId: 1, status: 1, createdAt: -1 });
db.payments.createIndex({ status: 1, processed: 1 });

// WebhookEvent
db.webhookevents.createIndex({ uniqueKey: 1 }, { unique: true });
db.webhookevents.createIndex({ event: 1, processed: 1, receivedAt: -1 });
db.webhookevents.createIndex({ razorpaySubscriptionId: 1, event: 1 });
db.webhookevents.createIndex({ processed: 1, attempts: 1 });

// Subscription
db.subscriptions.createIndex({ razorpaySubscriptionId: 1 }, { unique: true });
db.subscriptions.createIndex({ razorpayCustomerId: 1 });
db.subscriptions.createIndex({ paidCount: 1 });
db.subscriptions.createIndex({ chargeAt: 1 });
db.subscriptions.createIndex({ startAt: 1 });
db.subscriptions.createIndex({ endAt: 1 });
db.subscriptions.createIndex({ endedAt: 1 });
db.subscriptions.createIndex({ userId: 1, status: 1 });
db.subscriptions.createIndex({ status: 1, currentPeriodEnd: 1 });
db.subscriptions.createIndex({ 'scheduledChange.effectiveDate': 1 });
```

### Verify Indexes

```javascript
db.payments.getIndexes();
db.webhookevents.getIndexes();
db.subscriptions.getIndexes();
```

### Drop All Indexes (Except _id)

```javascript
db.payments.dropIndexes();
db.webhookevents.dropIndexes();
db.subscriptions.dropIndexes();
```

## Common Query Patterns

### Payment Queries

```javascript
// Find payment by Razorpay ID (uses: razorpayPaymentId_unique)
db.payments.findOne({ razorpayPaymentId: 'pay_123' });

// Get subscription payment history (uses: subscriptionId_createdAt)
db.payments.find({ subscriptionId: ObjectId('...') }).sort({ createdAt: -1 });

// Find user's failed payments (uses: userId_status_createdAt)
db.payments.find({ userId: ObjectId('...'), status: 'failed' }).sort({ createdAt: -1 });

// Get unprocessed payments (uses: status_processed)
db.payments.find({ status: 'captured', processed: false });
```

### WebhookEvent Queries

```javascript
// Check if webhook processed (uses: uniqueKey_unique)
db.webhookevents.findOne({ uniqueKey: 'abc123...' });

// Find unprocessed charged events (uses: event_processed_receivedAt)
db.webhookevents.find({ event: 'subscription.charged', processed: false });

// Get subscription webhook history (uses: razorpaySubscriptionId_event)
db.webhookevents.find({ razorpaySubscriptionId: 'sub_123' });

// Find failed webhooks for retry (uses: processed_attempts)
db.webhookevents.find({ processed: false, attempts: { $lt: 3 } });
```

### Subscription Queries

```javascript
// Find by Razorpay ID (uses: razorpaySubscriptionId_unique)
db.subscriptions.findOne({ razorpaySubscriptionId: 'sub_123' });

// Get customer subscriptions (uses: razorpayCustomerId)
db.subscriptions.find({ razorpayCustomerId: 'cust_123' });

// Find user's active subscription (uses: userId_status)
db.subscriptions.findOne({ userId: ObjectId('...'), status: 'active' });

// Get expiring subscriptions (uses: status_currentPeriodEnd)
db.subscriptions.find({ 
  status: 'active', 
  currentPeriodEnd: { $lte: new Date() } 
});

// Find due plan changes (uses: scheduledChange_effectiveDate)
db.subscriptions.find({ 
  'scheduledChange.effectiveDate': { $lte: new Date() } 
});
```

## Index Statistics

### Check Index Usage

```javascript
// MongoDB 4.4+
db.payments.aggregate([{ $indexStats: {} }]);
```

### Find Unused Indexes

```javascript
db.payments.aggregate([
  { $indexStats: {} },
  { $match: { 'accesses.ops': 0 } }
]);
```

### Explain Query Plan

```javascript
db.payments.find({ razorpayPaymentId: 'pay_123' }).explain('executionStats');
```

## Performance Tips

1. **Unique indexes** provide fastest lookups (O(log n))
2. **Composite indexes** must match query field order
3. **Date indexes** enable efficient range queries
4. **Background creation** prevents blocking in production
5. **Monitor index size** to ensure they fit in memory

## Maintenance Commands

```javascript
// Rebuild indexes (blocks collection)
db.payments.reIndex();

// Get collection statistics
db.payments.stats();

// Get index sizes
db.payments.stats().indexSizes;
```

---

**Quick Setup**: `node scripts/setup-database-indexes.js`  
**Full Documentation**: `docs/database-indexes.md`
