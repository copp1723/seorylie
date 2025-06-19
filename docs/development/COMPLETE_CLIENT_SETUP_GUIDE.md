# Complete Client Setup Guide - Professional Email System

## Overview

This guide documents the complete process for setting up a new client with professional email communication using CleanRylie. The setup eliminates Gmail red flags by using custom domains while maintaining reliable IMAP processing.

## Architecture

```
Inbound Flow:
Lead sends ADF → client@customdomain.com → forwards → gmail@gmail.com → CleanRylie IMAP

Outbound Flow:
CleanRylie → SendGrid → client@customdomain.com → Lead (professional branding)
```

## Prerequisites

- CleanRylie system deployed and running
- SendGrid account with API access
- Access to client's domain registrar (Namecheap recommended)

## Step-by-Step Process

### Phase 1: Domain and Email Purchase

#### 1.1 Purchase Domain (Client Side)

- **Platform:** Namecheap (recommended)
- **Domain:** Client's business domain (e.g., `kunesrvfox.com`)
- **Cost:** ~$10-15/year

#### 1.2 Add Business Email Service

- **Service:** Namecheap Private Email
- **Cost:** ~$25/year for 1 mailbox
- **Total:** ~$35/year per client

### Phase 2: Gmail Setup for IMAP

#### 2.1 Create Gmail Account

```
Purpose: Hidden IMAP processing
Email: clientname-internal@gmail.com
Example: rylieai1234@gmail.com
```

#### 2.2 Enable 2FA and App Password

1. **Enable 2-Factor Authentication** on Gmail account
2. **Generate App Password:**
   - Google Account → Security → 2-Step Verification → App passwords
   - Select "Mail" and generate password
   - **Save securely:** Example: `yyym ukwm halz fzwo`

### Phase 3: CleanRylie Database Configuration

#### 3.1 Check Existing Dealerships

```bash
cd /path/to/cleanrylie
export DATABASE_URL="your-database-url"
node scripts/check-dealerships.js
```

#### 3.2 Configure Client in Database

```bash
node scripts/setup-client-domain-node.js \
  "Kunes RV Fox Valley" \
  "kunesrvfox.com" \
  "kelseyb@kunesrvfox.com" \
  "rylieai1234@gmail.com" \
  2
```

**What this configures:**

- Professional email address for outbound
- Gmail IMAP for inbound processing
- Dealership name and contact info
- Operation mode set to 'rylie_ai'

### Phase 4: Email Forwarding Setup

#### 4.1 Access Namecheap Email Management

1. **Login to Namecheap**
2. **Domain List** → Find domain → **Manage**
3. **Look for "Private Email"** section
4. **Click "MANAGE"** button

#### 4.2 Create Professional Mailbox

1. **Add Mailbox** or **Create Email Account**
2. **Email:** `kelseyb@kunesrvfox.com`
3. **Password:** Set secure password
4. **Storage:** Use default (usually 5GB+)

#### 4.3 Configure Auto-Forwarding

1. **Mailbox Settings** → **Forwarding**
2. **Auto forward:** ON
3. **Forward to:** `rylieai1234@gmail.com`
4. **Keep a copy:** ✅ (recommended for backup)
5. **Process subsequent rules:** ✅
6. **Click "Apply changes"**

#### 4.4 Test Forwarding

- Send test email to `kelseyb@kunesrvfox.com`
- Verify it arrives at `rylieai1234@gmail.com`
- Should work within 5 minutes

### Phase 5: SendGrid Domain Authentication

#### 5.1 Access SendGrid Dashboard

1. **Login to SendGrid**
2. **Settings** → **Sender Authentication** → **Domain Authentication**
3. **Click "Authenticate Your Domain"**

#### 5.2 Configure Domain Settings

- **DNS Host:** Namecheap
- **Domain:** `kunesrvfox.com`
- **Link Branding:** No
- **Use automated security:** Yes (enabled)
- **Use custom return path:** No (disabled)
- **Use custom DKIM selector:** No (disabled)

#### 5.3 Get DNS Records

SendGrid will generate 4 DNS records:

```
Type: CNAME | Host: em2903 | Value: u52963080.wl081.sendgrid.net
Type: CNAME | Host: s1._domainkey | Value: s1.domainkey.u52963080.wl081.sendgrid.net
Type: CNAME | Host: s2._domainkey | Value: s2.domainkey.u52963080.wl081.sendgrid.net
Type: TXT | Host: _dmarc | Value: v=DMARC1; p=none;
```

### Phase 6: DNS Configuration

#### 6.1 Access Namecheap Advanced DNS

1. **Domain List** → **kunesrvfox.com** → **Manage**
2. **Click "Advanced DNS" tab**

#### 6.2 Add DNS Records

For each record from SendGrid:

**CNAME Records:**

- **Type:** CNAME Record
- **Host:** Remove domain part (e.g., `em2903` not `em2903.kunesrvfox.com`)
- **Value:** Exact value from SendGrid
- **TTL:** Automatic

**TXT Record:**

- **Type:** TXT Record
- **Host:** `_dmarc`
- **Value:** `v=DMARC1; p=none;`
- **TTL:** Automatic

#### 6.3 Save and Wait

- **Save changes** in Namecheap
- **Wait 24-48 hours** for DNS propagation
- Usually works within a few hours

### Phase 7: Verification and Testing

#### 7.1 Verify SendGrid Domain

1. **Return to SendGrid dashboard**
2. **Check domain status** (should show "Verified")
3. **If not verified yet:** Wait longer for DNS propagation

#### 7.2 Test Complete Email Flow

**Test Inbound:**

1. Send test ADF to `kelseyb@kunesrvfox.com`
2. Verify it forwards to `rylieai1234@gmail.com`
3. Check CleanRylie processes via IMAP

**Test Outbound:**

1. Trigger response from CleanRylie
2. Verify lead receives from `Kunes RV Fox Valley <kelseyb@kunesrvfox.com>`
3. Confirm professional appearance (no Gmail branding)

## Success Criteria

✅ **Email forwarding works:** `professional@domain.com` → `gmail@gmail.com`  
✅ **SendGrid domain verified:** Green status in dashboard  
✅ **CleanRylie IMAP processing:** Connects to Gmail successfully  
✅ **Professional outbound emails:** Show custom domain, not Gmail  
✅ **Complete flow tested:** ADF in → processing → professional response out

## Cost Summary

| Item                    | Annual Cost | Notes                    |
| ----------------------- | ----------- | ------------------------ |
| Domain Registration     | ~$12        | .com domains             |
| Namecheap Private Email | ~$25        | 1 professional mailbox   |
| **Total per Client**    | **~$37**    | Professional email setup |

## Troubleshooting

### Common Issues

**Email forwarding not working:**

- Check mailbox settings in Namecheap Private Email
- Verify auto-forward is enabled
- Test with simple email first

**SendGrid verification failed:**

- Double-check DNS records match exactly
- Wait longer for DNS propagation (up to 48 hours)
- Use DNS checker tools to verify propagation

**CleanRylie IMAP connection failed:**

- Verify Gmail app password is correct
- Check database configuration
- Ensure Gmail 2FA is enabled

### Support Resources

- **Namecheap Support:** 24/7 live chat
- **SendGrid Support:** Email/ticket system
- **DNS Checker:** https://dnschecker.org/

## Templates for Client Communication

### Initial Setup Email

```
Subject: Professional Email Setup - [Client Name]

Hi [Client],

I'm setting up your professional email system for lead communication.

Your leads will receive emails from: [Client Name] <email@yourdomain.com>

This creates a much more professional impression than generic email addresses.

Next steps:
1. Purchase domain and email service (~$37/year)
2. I'll handle all technical configuration
3. Test and verify everything works
4. Go live with professional communication!

Timeline: 2-3 business days

Questions? Just reply!
```

### Completion Email

```
Subject: ✅ Professional Email System Live - [Client Name]

Hi [Client],

Excellent! Your professional email system is now active.

✅ Domain verified and configured
✅ Professional branding active
✅ Lead communication ready

Your leads now receive emails from: [Client Name] <email@yourdomain.com>

This builds much more trust and credibility with potential customers.

The system is monitoring for leads and will respond professionally using your branded email address.

Welcome to professional lead communication!
```

## Next Steps

After successful setup:

1. **Monitor email delivery rates** in SendGrid
2. **Review lead responses** for improved engagement
3. **Document any client-specific customizations**
4. **Plan rollout to additional clients** using this proven process

## Files Created/Modified

- `scripts/check-dealerships.js` - Database inspection tool
- `scripts/setup-client-domain-node.js` - Automated client configuration
- Database record for dealership with professional email settings
- DNS records in client's domain for SendGrid authentication
