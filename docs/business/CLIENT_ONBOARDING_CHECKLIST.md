# Client Onboarding Checklist

## Pre-Setup (Client Requirements)

- [ ] Client has purchased domain (e.g., `abcmotors.com`)
- [ ] Client has DNS access (registrar login)
- [ ] Business name confirmed
- [ ] Preferred email address confirmed (usually `leads@domain.com`)

## Setup Process

### Phase 1: Preparation

**Hybrid Approach (Recommended for Namecheap domains):**

- [ ] **Domain:** Client's professional domain (e.g., `kunesrvfox.com`)
- [ ] **Outbound Email:** Professional address (e.g., `kelseyb@kunesrvfox.com`)
- [ ] **IMAP Processing:** Gmail account for reliable processing
- [ ] **Email Forwarding:** Domain email → Gmail for IMAP

**Setup Steps:**

- [ ] Create Gmail account for IMAP: `clientname-internal@gmail.com`
- [ ] Enable 2FA on Gmail account
- [ ] Generate Gmail app password
- [ ] Set up email forwarding: `professional@domain.com` → `gmail@gmail.com`
- [ ] Record dealership ID from database

### Phase 2: SendGrid Configuration

- [ ] Add domain to SendGrid dashboard
- [ ] Generate DNS records
- [ ] Save DNS records for client

### Phase 3: Client Communication

- [ ] Send DNS records to client
- [ ] Provide email forwarding instructions
- [ ] Set timeline expectations (24-48 hours)

### Phase 4: CleanRylie Configuration

- [ ] Run setup script: `./scripts/setup-client-domain.sh`
- [ ] Verify database configuration
- [ ] Test IMAP connection

### Phase 5: Verification

- [ ] Wait for DNS propagation (24-48 hours)
- [ ] Verify domain in SendGrid dashboard
- [ ] Update verification status in database
- [ ] Test complete email flow

### Phase 6: Go Live

- [ ] Send completion email to client
- [ ] Monitor first few leads
- [ ] Confirm professional email appearance
- [ ] Document setup for future reference

## Quick Setup Commands

```bash
# 1. Check existing dealerships
node scripts/check-dealerships.js

# 2. Run setup script
node scripts/setup-client-domain-node.js "Kunes RV Fox Valley" "kunesrvfox.com" "kelseyb@kunesrvfox.com" "rylieai1234@gmail.com" 2

# 3. Test email flow
# Send test ADF to kelseyb@kunesrvfox.com
```

## Client Communication Templates

### Initial Contact

```
Subject: Professional Email Setup for [Client]

Hi [Client],

I'm setting up your professional email system for lead communication.

Your leads will receive emails from: [Client] <leads@[domain].com>

This creates a much more professional impression than generic email addresses.

Next steps:
1. I'll send DNS records (technical setup)
2. You'll add them to your domain
3. We'll verify everything works
4. Go live with professional communication!

Timeline: 2-3 business days

Questions? Just reply!
```

### DNS Instructions

```
Subject: DNS Setup Required - [Client] Email System

Hi [Client],

Please add these DNS records to [domain].com:

[Paste specific DNS records from SendGrid]

Also set up email forwarding:
leads@[domain].com → [internal-gmail]@gmail.com

Most domain registrars (GoDaddy, Namecheap, etc.) have support teams that can help with DNS changes if needed.

Let me know when complete!
```

### Completion Notice

```
Subject: ✅ Professional Email System Live - [Client]

Hi [Client],

Great news! Your professional email system is now active.

✅ Domain verified
✅ Professional branding active
✅ Lead communication ready

Your leads now receive emails from: [Client] <leads@[domain].com>

This builds much more trust and credibility with potential customers.

The system is monitoring for leads and will respond professionally using your branded email address.

Welcome to professional lead communication!
```

## Troubleshooting Quick Reference

| Issue                        | Solution                                         |
| ---------------------------- | ------------------------------------------------ |
| DNS not propagating          | Wait 24-48 hours, use DNS checker tools          |
| SendGrid verification failed | Double-check DNS records match exactly           |
| Email forwarding not working | Check registrar settings, test with simple email |
| IMAP connection failed       | Verify Gmail credentials and app password        |
| Leads not receiving emails   | Check SendGrid delivery logs                     |

## Time Estimates

- **Setup script:** 5 minutes
- **Client DNS changes:** 30 minutes (client side)
- **DNS propagation:** 24-48 hours
- **Verification & testing:** 15 minutes
- **Total timeline:** 2-3 business days

## Success Metrics

- [ ] Domain shows "Verified" in SendGrid
- [ ] Test ADF email reaches IMAP inbox
- [ ] Outbound emails show professional sender
- [ ] Email forwarding works both ways
- [ ] Client confirms professional appearance
