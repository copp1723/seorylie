# Quick Setup Checklist - Professional Email System

## Pre-Setup Requirements

- [ ] CleanRylie system deployed and running
- [ ] SendGrid account with API access
- [ ] Client domain requirements confirmed
- [ ] Database access configured

## Phase 1: Domain & Email Purchase (Client Side)

- [ ] **Purchase domain** on Namecheap (~$12/year)
- [ ] **Add Private Email service** (~$25/year)
- [ ] **Total cost confirmed:** ~$37/year per client

## Phase 2: Gmail IMAP Setup

- [ ] **Create Gmail account:** `clientname-internal@gmail.com`
- [ ] **Enable 2FA** on Gmail account
- [ ] **Generate app password** and save securely
- [ ] **Test Gmail login** with app password

## Phase 3: CleanRylie Database Configuration

- [ ] **Check existing dealerships:**
  ```bash
  node scripts/check-dealerships.js
  ```

- [ ] **Configure client in database:**
  ```bash
  node scripts/setup-client-domain-node.js \
    "Client Name" \
    "clientdomain.com" \
    "professional@clientdomain.com" \
    "gmail@gmail.com" \
    DEALERSHIP_ID
  ```

- [ ] **Verify database configuration** shows correct settings

## Phase 4: Email Forwarding Setup

- [ ] **Access Namecheap:** Domain List → Manage → Private Email → MANAGE
- [ ] **Create mailbox:** `professional@clientdomain.com`
- [ ] **Configure auto-forwarding:**
  - [ ] Auto forward: ON
  - [ ] Forward to: `gmail@gmail.com`
  - [ ] Keep copy: ✅
  - [ ] Process rules: ✅
- [ ] **Apply changes**
- [ ] **Test forwarding:** Send email to professional address, verify at Gmail

## Phase 5: SendGrid Domain Authentication

- [ ] **Access SendGrid:** Settings → Sender Authentication → Domain Authentication
- [ ] **Add domain:** `clientdomain.com`
- [ ] **Configure settings:**
  - [ ] DNS Host: Namecheap
  - [ ] Link Branding: No
  - [ ] Automated security: Yes
  - [ ] Custom return path: No
  - [ ] Custom DKIM: No
- [ ] **Get DNS records** (4 records: 3 CNAME + 1 TXT)

## Phase 6: DNS Configuration

- [ ] **Access Namecheap Advanced DNS:** Domain → Manage → Advanced DNS
- [ ] **Add CNAME records:**
  - [ ] `em####` → `u####.wl###.sendgrid.net`
  - [ ] `s1._domainkey` → `s1.domainkey.u####.wl###.sendgrid.net`
  - [ ] `s2._domainkey` → `s2.domainkey.u####.wl###.sendgrid.net`
- [ ] **Add TXT record:**
  - [ ] `_dmarc` → `v=DMARC1; p=none;`
- [ ] **Save changes**
- [ ] **Wait for DNS propagation** (24-48 hours, usually faster)

## Phase 7: Verification & Testing

- [ ] **Verify SendGrid domain** shows "Verified" status
- [ ] **Test inbound flow:**
  - [ ] Send test email to `professional@clientdomain.com`
  - [ ] Verify forwarding to Gmail works
  - [ ] Check CleanRylie IMAP processing
- [ ] **Test outbound flow:**
  - [ ] Trigger CleanRylie response
  - [ ] Verify professional sender address
  - [ ] Confirm no Gmail branding
- [ ] **Test complete ADF flow:**
  - [ ] Send ADF to professional address
  - [ ] Verify processing and response
  - [ ] Confirm professional appearance

## Success Verification

✅ **Email forwarding:** `professional@domain.com` → `gmail@gmail.com`  
✅ **SendGrid verified:** Green status in dashboard  
✅ **IMAP processing:** CleanRylie connects successfully  
✅ **Professional emails:** Custom domain sender  
✅ **Complete flow:** ADF → processing → professional response  

## Client Communication

- [ ] **Send setup confirmation** email to client
- [ ] **Provide login details** for webmail (if requested)
- [ ] **Document configuration** for future reference
- [ ] **Schedule follow-up** to monitor performance

## Time Estimates

| Phase | Time Required | Notes |
|-------|---------------|-------|
| Domain/Email Purchase | 15 minutes | Client side |
| Gmail Setup | 10 minutes | Create account + 2FA |
| Database Configuration | 5 minutes | Run script |
| Email Forwarding | 10 minutes | Namecheap interface |
| SendGrid Setup | 15 minutes | Domain authentication |
| DNS Configuration | 15 minutes | Add 4 records |
| Verification/Testing | 30 minutes | Wait for propagation |
| **Total Active Time** | **1.5 hours** | Plus 24-48h DNS wait |

## Common Issues & Solutions

**Forwarding not working:**
- Check Private Email settings
- Verify auto-forward enabled
- Test with simple email

**SendGrid verification failed:**
- Double-check DNS records
- Wait longer for propagation
- Use DNS checker tools

**IMAP connection issues:**
- Verify app password correct
- Check database configuration
- Ensure 2FA enabled on Gmail

## Files & Scripts Used

- `scripts/check-dealerships.js` - Check existing clients
- `scripts/setup-client-domain-node.js` - Configure database
- `docs/COMPLETE_CLIENT_SETUP_GUIDE.md` - Detailed instructions

## Next Client Setup

For subsequent clients, repeat this checklist with:
- Different domain name
- Different Gmail account for IMAP
- Different professional email address
- New dealership ID in database

**Estimated setup time per client:** 1.5 hours + DNS propagation wait
