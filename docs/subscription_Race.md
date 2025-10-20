1. Webhook Failure Scenarios & Razorpay Retry Policy
Razorpay Webhook Retry Behavior:
According to Razorpay documentation:

Retry attempts: Up to 14 attempts over 3 days

Retry schedule: Exponential backoff

Immediate
5 minutes
10 minutes
30 minutes
1 hour
2 hours
4 hours
8 hours
Then every 12 hours until 3 days
Success criteria: HTTP 200 response

Failure criteria: Non-200 response or timeout (30 seconds)

The Problem:
If your backend is down for 3+ days, webhooks will stop retrying, and the user is stuck with:

✅ Payment made
❌ Subscription status = created (never activated)
❌ No credits granted
❌ Can't create new subscription (blocked by our Phase 1 fix)
2. Complete User Story & Edge Cases
Let me map out all possible scenarios:

Scenario A: Happy Path ✅
1. User creates subscription → status='created'
2. User pays → Razorpay confirms
3. Webhook 'authenticated' arrives (30s-2min) → status='authenticated'
4. Webhook 'activated' arrives (1-3min) → status='active' + credits granted
5. User can use service ✅
Scenario B: Webhook Delayed (1-3 days) ⚠️
1. User creates subscription → status='created'
2. User pays → Razorpay confirms
3. Backend is down for 2 days
4. User sees "Payment successful" but no access
5. User tries to create new subscription → BLOCKED (status='created' exists)
6. Backend comes back online
7. Webhook retries arrive → status='active' + credits granted
8. User gets access (after 2 days delay) ⚠️
Scenario C: All Webhooks Fail (3+ days) ❌
1. User creates subscription → status='created'
2. User pays → Razorpay confirms
3. Backend down for 4 days
4. All 14 webhook retries fail
5. Razorpay stops retrying
6. User is STUCK:
   - Paid money ✅
   - No access ❌
   - Can't create new subscription ❌
   - status='created' forever ❌
Scenario D: Duplicate Active Subscription Detected 🚨
1. User has subscription A (active)
2. Race condition: User creates subscription B → status='created'
3. User pays for B
4. Webhook 'activated' for B arrives
5. Our check detects existing active subscription A
6. We throw error → Webhook retries 14 times
7. Subscription B never activates
8. User paid twice but only has 1 active subscription
3. Solution: Comprehensive Recovery System
I recommend a multi-layered recovery approach:

Layer 1: Graceful Webhook Error Handling
Instead of throwing errors that cause retries, return 200 with logged warnings:

// In handleActivated webhook
async handleActivated(payload, webhookEvent, subscription) {
  try {
    // Check for duplicate active subscription
    const existingActive = await Subscription.findOne({
      userId: subscription.userId,
      status: 'active',
      _id: { $ne: subscription._id }
    });

    if (existingActive) {
      logger.error('🚨 DUPLICATE ACTIVE SUBSCRIPTION DETECTED', {
        existingSubscriptionId: existingActive._id,
        newSubscriptionId: subscription._id,
        userId: subscription.userId,
        existingRazorpayId: existingActive.razorpaySubscriptionId,
        newRazorpayId: subscription.razorpaySubscriptionId
      });

      // ✅ DON'T throw error - handle gracefully
      // Option 1: Cancel the new subscription on Razorpay
      try {
        await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId);
        subscription.status = 'cancelled';
        subscription.cancellationReason = 'duplicate_active_subscription_detected';
        await subscription.save();
        
        logger.info('Cancelled duplicate subscription', {
          subscriptionId: subscription._id,
          razorpayId: subscription.razorpaySubscriptionId
        });
      } catch (cancelError) {
        logger.error('Failed to cancel duplicate subscription', {
          error: cancelError.message
        });
      }

      // ✅ Return 200 to stop webhook retries
      return {
        success: true,
        message: 'Duplicate subscription detected and cancelled',
        action: 'cancelled_duplicate'
      };
    }

    // Normal activation flow...
    subscription.status = 'active';
    // ... rest of activation logic

  } catch (error) {
    logger.error('Error in handleActivated', { error: error.message });
    
    // ✅ Return 200 even on error to prevent infinite retries
    // Log to monitoring system for manual review
    return {
      success: false,
      message: 'Error handled, manual review required',
      error: error.message
    };
  }
}
Layer 2: Manual Webhook Replay Endpoint
Create an admin endpoint to manually trigger webhook processing:

// POST /api/admin/webhooks/replay
async replayWebhook(req, res) {
  try {
    const { razorpaySubscriptionId } = req.body;
    
    // Fetch latest subscription state from Razorpay
    const razorpaySubscription = await razorpay.subscriptions.fetch(razorpaySubscriptionId);
    
    // Find local subscription
    const subscription = await Subscription.findOne({ razorpaySubscriptionId });
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    // Manually sync state
    if (razorpaySubscription.status === 'active' && subscription.status !== 'active') {
      subscription.status = 'active';
      subscription.currentPeriodStart = new Date(razorpaySubscription.current_start * 1000);
      subscription.currentPeriodEnd = new Date(razorpaySubscription.current_end * 1000);
      await subscription.save();
      
      // Grant credits
      const plan = await Plan.findById(subscription.planId);
      await this.grantSubscriptionCreditsWithoutPayment(subscription, {
        source: 'manual_webhook_replay',
        reason: 'webhook_failure_recovery'
      });
      
      logger.info('Manual webhook replay successful', {
        subscriptionId: subscription._id,
        userId: subscription.userId
      });
      
      return res.json({
        success: true,
        message: 'Subscription activated manually',
        subscription: subscription.toObject()
      });
    }
    
    res.json({
      success: true,
      message: 'Subscription already in sync',
      razorpayStatus: razorpaySubscription.status,
      localStatus: subscription.status
    });
    
  } catch (error) {
    logger.error('Error replaying webhook', { error: error.message });
    res.status(500).json({ error: error.message });
  }
}
Layer 3: Automated Reconciliation Job
Run a cron job every hour to detect and fix stuck subscriptions:

// src/jobs/subscriptionReconciliation.js
class SubscriptionReconciliationJob {
  async run() {
    logger.info('Starting subscription reconciliation job');
    
    // Find subscriptions stuck in 'created' or 'authenticated' for > 1 hour
    const stuckSubscriptions = await Subscription.find({
      status: { $in: ['created', 'authenticated'] },
      createdAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) } // 1 hour ago
    });
    
    logger.info(`Found ${stuckSubscriptions.length} stuck subscriptions`);
    
    for (const subscription of stuckSubscriptions) {
      try {
        // Fetch current state from Razorpay
        const razorpaySubscription = await razorpay.subscriptions.fetch(
          subscription.razorpaySubscriptionId
        );
        
        logger.info('Reconciling subscription', {
          subscriptionId: subscription._id,
          localStatus: subscription.status,
          razorpayStatus: razorpaySubscription.status
        });
        
        // Sync status
        if (razorpaySubscription.status === 'active' && subscription.status !== 'active') {
          // Check for duplicate active subscription first
          const existingActive = await Subscription.findOne({
            userId: subscription.userId,
            status: 'active',
            _id: { $ne: subscription._id }
          });
          
          if (existingActive) {
            // Cancel this subscription on Razorpay
            await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId);
            subscription.status = 'cancelled';
            subscription.cancellationReason = 'duplicate_detected_during_reconciliation';
            await subscription.save();
            
            logger.warn('Cancelled duplicate subscription during reconciliation', {
              cancelledId: subscription._id,
              existingActiveId: existingActive._id
            });
            continue;
          }
          
          // Activate subscription
          subscription.status = 'active';
          subscription.currentPeriodStart = new Date(razorpaySubscription.current_start * 1000);
          subscription.currentPeriodEnd = new Date(razorpaySubscription.current_end * 1000);
          subscription.paidCount = razorpaySubscription.paid_count;
          subscription.remainingCount = razorpaySubscription.remaining_count;
          await subscription.save();
          
          // Grant credits
          const plan = await Plan.findById(subscription.planId);
          if (plan) {
            const creditService = new CreditService();
            await creditService.grantSubscriptionCredits(
              subscription.userId,
              plan.features.credits.monthly,
              subscription.currentPeriodEnd,
              subscription._id.toString(),
              null,
              {
                source: 'reconciliation_job',
                reason: 'webhook_failure_recovery'
              }
            );
          }
          
          logger.info('Subscription activated via reconciliation', {
            subscriptionId: subscription._id,
            userId: subscription.userId
          });
        } else if (razorpaySubscription.status === 'cancelled') {
          subscription.status = 'cancelled';
          await subscription.save();
          
          logger.info('Subscription cancelled via reconciliation', {
            subscriptionId: subscription._id
          });
        }
        
      } catch (error) {
        logger.error('Error reconciling subscription', {
          subscriptionId: subscription._id,
          error: error.message
        });
      }
    }
    
    logger.info('Subscription reconciliation job completed');
  }
}

module.exports = SubscriptionReconciliationJob;
Layer 4: User Self-Service Recovery
Add a "Refresh Subscription Status" button in the frontend:

// Frontend component
const refreshSubscriptionStatus = async () => {
  setLoading(true);
  try {
    const response = await fetch('/api/subscriptions/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showSuccess('Subscription status updated!');
      // Reload subscription data
    }
  } catch (error) {
    showError('Failed to sync subscription');
  } finally {
    setLoading(false);
  }
};
Backend endpoint:

// POST /api/subscriptions/sync
async syncSubscriptionStatus(req, res) {
  try {
    const userId = req.user.id;
    
    // Get user's subscription
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['created', 'authenticated', 'pending'] }
    });
    
    if (!subscription) {
      return res.json({
        success: true,
        message: 'No pending subscription found'
      });
    }
    
    // Fetch from Razorpay
    const razorpaySubscription = await razorpay.subscriptions.fetch(
      subscription.razorpaySubscriptionId
    );
    
    // Sync status
    if (razorpaySubscription.status === 'active' && subscription.status !== 'active') {
      // Activate and grant credits
      // ... (same logic as reconciliation job)
    }
    
    res.json({
      success: true,
      subscription: subscription.toObject()
    });
    
  } catch (error) {
    logger.error('Error syncing subscription', { error: error.message });
    res.status(500).json({ error: error.message });
  }
}
Layer 5: Timeout-Based Auto-Cancellation
Cancel subscriptions stuck in created for > 7 days:

// In reconciliation job
const abandonedSubscriptions = await Subscription.find({
  status: 'created',
  createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 days
});

for (const subscription of abandonedSubscriptions) {
  try {
    // Try to cancel on Razorpay
    await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId);
  } catch (error) {
    // Razorpay might already have cancelled it
  }
  
  subscription.status = 'cancelled';
  subscription.cancellationReason = 'abandoned_never_activated';
  await subscription.save();
  
  logger.info('Cancelled abandoned subscription', {
    subscriptionId: subscription._id,
    createdAt: subscription.createdAt
  });
}
4. Preventing Webhook Retry Storms
To stop webhooks from retrying infinitely when you detect an issue:

Return 200 with Action Flag:
// In webhook handler
if (shouldNotRetry) {
  logger.warn('Webhook processing stopped intentionally', {
    reason: 'duplicate_subscription',
    subscriptionId: subscription._id
  });
  
  // ✅ Return 200 to tell Razorpay "I received it, don't retry"
  return res.status(200).json({
    success: true,
    action: 'ignored',
    reason: 'duplicate_subscription_detected'
  });
}

// ❌ DON'T do this (causes retries):
// throw new Error('Duplicate subscription');
// return res.status(500).json({ error: 'Duplicate' });
5. Monitoring & Alerting
Set up alerts for:

Stuck subscriptions (created > 1 hour)
Failed webhook processing (logged errors)
Duplicate active subscriptions (should never happen)
Reconciliation job failures
// Example: Send alert to Slack/Email
if (stuckSubscriptions.length > 0) {
  await sendAlert({
    type: 'warning',
    message: `${stuckSubscriptions.length} subscriptions stuck in pending state`,
    subscriptions: stuckSubscriptions.map(s => ({
      id: s._id,
      userId: s.userId,
      createdAt: s.createdAt
    }))
  });
}
Summary: Complete Recovery Strategy
| Issue | Solution | Recovery Time | |-------|----------|---------------| | Webhook delayed (< 3 days) | Razorpay auto-retry | Minutes to hours | | Webhook failed (> 3 days) | Reconciliation job | 1 hour (next job run) | | User impatient | Self-service sync button | Immediate | | Duplicate subscription | Webhook handler cancels duplicate | Immediate | | Abandoned subscription | Auto-cancel after 7 days | 7 days | | Manual intervention needed | Admin webhook replay endpoint | Immediate |

Would you like me to implement this complete recovery system? I can create:

Enhanced webhook handlers with graceful error handling
Reconciliation cron job
Admin webhook replay endpoint
User self-service sync endpoint
Monitoring alerts
