# Subscription API Quick Reference

Quick reference card for frontend developers.

---

## 🔑 Authentication

All endpoints (except `/plans`) require Bearer token:

```javascript
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
}
```

---

## 📋 Endpoints Cheat Sheet

### 1. Get Available Plans
```
GET /api/subscriptions/plans
Auth: Not required
```

**Response:**
```json
{
  "success": true,
  "plans": [{ planId, name, pricing, features }]
}
```

---

### 2. Create Subscription (New User)
```
POST /api/subscriptions/create
Auth: Required
Body: { planId, customerNotify?, notes? }
```

**Success (201):**
```json
{
  "success": true,
  "subscription": {
    "short_url": "https://rzp.io/i/abc123",
    "status": "created"
  }
}
```

**Error (409):** User already has subscription → Use `/upgrade` instead

**Next Step:** Redirect to `subscription.short_url` for payment

---

### 3. Get Current Subscription
```
GET /api/subscriptions/current
Auth: Required
```

**Has Subscription (200):**
```json
{
  "success": true,
  "subscription": { status, billing, currentPeriodEnd },
  "plan": { name, pricing, features }
}
```

**No Subscription (404):**
```json
{
  "success": false,
  "error": "No active subscription"
}
```

---

### 4. Upgrade/Downgrade Plan
```
POST /api/subscriptions/upgrade
Auth: Required
Body: { newPlanId, immediate?, reason? }
```

**Success (200):**
```json
{
  "success": true,
  "immediate": true/false,
  "changeType": "upgrade" | "downgrade",
  "scheduledChange": { effectiveDate }  // if scheduled
}
```

**Important:**
- Upgrades: Can be immediate (prorated) or scheduled
- Downgrades: Always scheduled (cycle end)

---

### 5. Cancel Subscription
```
POST /api/subscriptions/cancel
Auth: Required
Body: { immediately?, reason? }
```

**Success (200):**
```json
{
  "success": true,
  "cancelledImmediately": true/false,
  "subscription": { cancelAtPeriodEnd, currentPeriodEnd }
}
```

---

## 🎯 Common Patterns

### Check if User Has Subscription

```javascript
const hasSubscription = async () => {
  const res = await fetch('/api/subscriptions/current', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.status === 200;
};
```

### Create Subscription Flow

```javascript
// 1. Create subscription
const res = await fetch('/api/subscriptions/create', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ planId: 'pro_monthly' })
});

const data = await res.json();

// 2. Redirect to payment
if (data.success) {
  window.location.href = data.subscription.short_url;
}
```

### Upgrade Plan Flow

```javascript
const res = await fetch('/api/subscriptions/upgrade', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    newPlanId: 'max_monthly',
    immediate: true  // false for scheduled
  })
});

const data = await res.json();

if (data.success) {
  if (data.immediate) {
    alert('Upgraded successfully!');
  } else {
    alert(`Upgrade scheduled for ${data.scheduledChange.effectiveDate}`);
  }
}
```

---

## ⚠️ Error Codes

| Code | Status | Meaning | Action |
|------|--------|---------|--------|
| `Active subscription exists` | 409 | Already subscribed | Use `/upgrade` |
| `NO_ACTIVE_SUBSCRIPTION` | 404 | No subscription | Use `/create` |
| `PLAN_NOT_FOUND` | 400 | Invalid plan | Check plan ID |
| `SAME_PLAN` | 400 | Same plan selected | Disable button |
| `RAZORPAY_UPDATE_FAILED` | 500 | Payment error | Retry/contact support |

---

## 💡 Business Rules

1. **New Subscription:** User must NOT have active subscription
2. **Upgrade:** Can be immediate (prorated charge) or scheduled
3. **Downgrade:** Always scheduled (no immediate refunds)
4. **Cancel:** Can be immediate or at period end
5. **Scheduled Changes:** Take effect at next billing cycle

---

## 🔄 State Management

```javascript
// Subscription states
const states = {
  'created': 'Awaiting payment',
  'authenticated': 'Payment authorized',
  'active': 'Active subscription',
  'pending': 'Payment pending',
  'halted': 'Payment failed',
  'cancelled': 'Cancelled',
  'completed': 'Completed',
  'expired': 'Expired'
};
```

---

## 📱 UI Recommendations

### Show "Subscribe" Button When:
- `GET /current` returns 404
- User has no active subscription

### Show "Upgrade/Downgrade" Buttons When:
- `GET /current` returns 200
- User has active subscription

### Show "Scheduled Change" Notice When:
- `subscription.scheduledChange` exists
- Display: "Plan will change to X on Y"

### Show "Cancellation" Notice When:
- `subscription.cancelAtPeriodEnd === true`
- Display: "Subscription ends on X"

---

## 🧪 Testing Checklist

- [ ] User with no subscription can create one
- [ ] User with subscription cannot create another (409 error)
- [ ] User can upgrade immediately
- [ ] User can schedule upgrade
- [ ] User can downgrade (always scheduled)
- [ ] User can cancel at period end
- [ ] User can cancel immediately
- [ ] Scheduled changes display correctly
- [ ] Payment redirect works
- [ ] Error messages display properly

---

## 📞 Support

For detailed examples and complete flows, see `FRONTEND_SUBSCRIPTION_API_GUIDE.md`
