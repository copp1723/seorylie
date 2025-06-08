# SendGrid Migration Plan: Zero-Downtime Implementation

## 🎯 **Safe Migration Strategy**

This plan implements SendGrid webhooks **alongside** the existing system, allowing for gradual migration with **zero downtime**.

## Phase 1: Add SendGrid Webhook (No Breaking Changes)

### Step 1: Install SendGrid Dependencies

```bash
npm install @sendgrid/mail @sendgrid/webhook
```

### Step 2: Add Environment Variables

```bash
# Add to .env (keep existing email config)
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_WEBHOOK_SECRET=your_webhook_secret_here
SENDGRID_VERIFICATION_ENABLED=true

# Existing email config stays untouched
EMAIL_SERVICE=smtp  # Keep current service
SMTP_HOST=smtp.gmail.com
# ... etc
```

### Step 3: Create SendGrid Webhook Route (Parallel System)

```typescript
// New route: /api/sendgrid/webhook
// Does NOT affect existing email processing
```

## Phase 2: Dual Processing (Testing Phase)

### Step 4: Enable Parallel Processing

```typescript
// Both systems run simultaneously:
// 1. Existing IMAP polling continues
// 2. SendGrid webhook processes same emails
// Compare results for validation
```

### Step 5: Feature Flag Control

```typescript
// Environment control
SENDGRID_WEBHOOK_ENABLED = true;
LEGACY_EMAIL_ENABLED = true; // Keep both running
```

## Phase 3: Gradual Cutover

### Step 6: DNS Configuration (One Domain at a Time)

```bash
# Start with test subdomain
test-adf.yourdomain.com -> SendGrid MX records

# Keep production pointing to current system
adf.yourdomain.com -> Current email server
```

### Step 7: Per-Dealership Migration

```typescript
// Migrate dealerships one by one
const dealershipEmailRouting = {
  "kunes-rv-fox-valley": "sendgrid", // Migrated
  "kunes-rv-freedom": "legacy", // Not yet migrated
  // ... gradual migration
};
```

## Phase 4: Complete Migration

### Step 8: Full DNS Cutover

```bash
# Only after thorough testing
adf.yourdomain.com -> SendGrid MX records
```

### Step 9: Legacy System Removal

```typescript
// Disable legacy email processing
LEGACY_EMAIL_ENABLED = false;
```

---

## 🛠 **Implementation Files to Create**

### 1. SendGrid Webhook Route

**File:** `/server/routes/sendgrid-webhook-routes.ts`

- Webhook signature verification
- ADF XML parsing
- Integration with existing `adf-service.ts`

### 2. SendGrid Service

**File:** `/server/services/sendgrid-service.ts`

- Email sending via SendGrid API
- Webhook processing
- Security verification

### 3. Email Router Service

**File:** `/server/services/email-router.ts`

- Routes emails between SendGrid and legacy systems
- Per-dealership routing logic
- Feature flag management

### 4. Migration Scripts

**File:** `/scripts/migrate-to-sendgrid.ts`

- DNS verification
- Webhook testing
- Configuration validation

---

## 🔒 **Safety Measures**

1. **No Removal**: Don't remove existing email code initially
2. **Feature Flags**: Control which system processes each email
3. **Logging**: Comprehensive logging for both systems
4. **Rollback**: Instant rollback to legacy system if needed
5. **Testing**: Test with non-production emails first

---

## 📋 **Migration Checklist**

### Pre-Migration

- [ ] SendGrid account setup and API key
- [ ] Webhook secret generated
- [ ] Test subdomain configured
- [ ] Development environment testing

### Phase 1: Implementation

- [ ] Install SendGrid packages
- [ ] Create webhook route (parallel to existing)
- [ ] Add environment variables
- [ ] Test webhook with SendGrid test emails

### Phase 2: Validation

- [ ] Configure test dealership
- [ ] Send test ADF emails
- [ ] Compare SendGrid vs legacy processing
- [ ] Performance benchmarking

### Phase 3: Production Migration

- [ ] Migrate one dealership at a time
- [ ] Monitor error rates and latency
- [ ] Validate all ADF emails process correctly
- [ ] Update documentation

### Phase 4: Cleanup

- [ ] Full DNS cutover
- [ ] Disable legacy email system
- [ ] Remove deprecated code
- [ ] Update deployment scripts

---

## ⚡ **Immediate Next Steps**

1. **Install Dependencies**: Add SendGrid packages
2. **Create Webhook Route**: Parallel to existing ADF processing
3. **Test Environment**: Set up test subdomain for validation
4. **Feature Flags**: Control migration pace

This approach ensures **zero downtime** and allows for **instant rollback** if any issues arise during migration.
