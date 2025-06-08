# Namecheap Business Email Setup Guide

## Overview

Namecheap Business Email provides a cost-effective, professional email solution that integrates perfectly with CleanRylie's IMAP processing.

**Benefits:**

- Professional email addresses (`leads@clientdomain.com`)
- Full IMAP support for CleanRylie
- Single vendor for domain + email
- Cost-effective (~$35/year total per client)
- Easy management through Namecheap dashboard

## Cost Breakdown

| Item                       | Annual Cost | Notes              |
| -------------------------- | ----------- | ------------------ |
| Domain Registration        | ~$10        | .com domains       |
| Business Email (1 mailbox) | ~$25        | $1.88-$2.88/month  |
| **Total per Client**       | **~$35**    | Professional setup |

## Setup Process

### Step 1: Domain + Email Purchase

1. **Purchase Domain:**

   - Go to Namecheap.com
   - Search for client domain (e.g., `kunesrvfox.com`)
   - Purchase domain (~$10/year)

2. **Add Business Email:**
   - During checkout or after purchase
   - Select "Private Email" or "Business Email"
   - Choose 1 mailbox plan (~$25/year)
   - Create mailbox: `leads@kunesrvfox.com`

### Step 2: Email Configuration

1. **Access Email Dashboard:**

   - Login to Namecheap account
   - Go to "Domain List" → Select domain
   - Click "Manage" next to Private Email

2. **Create Mailbox:**

   ```
   Email: leads@kunesrvfox.com
   Password: [Strong password - save securely]
   Storage: 5GB (usually sufficient)
   ```

3. **Verify IMAP Settings:**
   ```
   IMAP Server: mail.privateemail.com
   IMAP Port: 993
   Security: SSL/TLS
   Username: leads@kunesrvfox.com
   Password: [mailbox password]
   ```

### Step 3: DNS Configuration for SendGrid

1. **Access DNS Management:**

   - In Namecheap dashboard
   - Go to "Domain List" → Select domain
   - Click "Manage" → "Advanced DNS"

2. **Add SendGrid DNS Records:**

   ```
   Type: CNAME
   Host: s1._domainkey
   Value: s1.domainkey.u12345.wl123.sendgrid.net
   TTL: Automatic

   Type: CNAME
   Host: s2._domainkey
   Value: s2.domainkey.u12345.wl123.sendgrid.net
   TTL: Automatic

   Type: CNAME
   Host: em1234
   Value: u12345.wl123.sendgrid.net
   TTL: Automatic
   ```

### Step 4: CleanRylie Configuration

1. **Run Setup Script:**

   ```bash
   ./scripts/setup-client-domain.sh \
     "Kunes RV Fox" \
     "kunesrvfox.com" \
     "leads@kunesrvfox.com" \
     "namecheap" \
     1
   ```

2. **Manual Database Update:**
   ```sql
   UPDATE dealerships
   SET
     name = 'Kunes RV Fox',
     email_config = jsonb_build_object(
       'fromEmail', 'leads@kunesrvfox.com',
       'fromName', 'Kunes RV Fox',
       'replyTo', 'leads@kunesrvfox.com',
       'domain', 'kunesrvfox.com',
       'verified', false
     ),
     imap_config = jsonb_build_object(
       'host', 'mail.privateemail.com',
       'port', 993,
       'user', 'leads@kunesrvfox.com',
       'password', 'mailbox-password',
       'tls', true,
       'markSeen', true,
       'pollingInterval', 300,
       'provider', 'namecheap'
     )
   WHERE id = 1;
   ```

## Testing & Verification

### Test IMAP Connection

```bash
# Test IMAP connectivity
openssl s_client -connect mail.privateemail.com:993 -crlf
```

### Test Email Flow

1. **Send Test ADF:**

   - Send test email with ADF attachment to `leads@kunesrvfox.com`
   - Verify CleanRylie processes it via IMAP

2. **Test Outbound:**
   - Trigger response from CleanRylie
   - Verify lead receives from `Kunes RV Fox <leads@kunesrvfox.com>`

### Verify SendGrid Domain

1. Wait 24-48 hours for DNS propagation
2. Check SendGrid dashboard for domain verification
3. Update database verification status:
   ```sql
   UPDATE dealerships
   SET email_config = jsonb_set(email_config, '{verified}', 'true')
   WHERE id = 1;
   ```

## Namecheap Email Features

### Webmail Access

- URL: `https://privateemail.com`
- Login: `leads@kunesrvfox.com`
- Password: [mailbox password]

### Mobile Setup (Optional)

```
IMAP Server: mail.privateemail.com
IMAP Port: 993
Security: SSL/TLS
Username: leads@kunesrvfox.com
Password: [mailbox password]

SMTP Server: mail.privateemail.com
SMTP Port: 465 or 587
Security: SSL/TLS
```

### Storage & Limits

- **Storage:** 5GB per mailbox (upgradeable)
- **Attachments:** 25MB max
- **Daily Sending:** 300 emails/day
- **IMAP Connections:** Unlimited

## Troubleshooting

### Common Issues

1. **IMAP Connection Failed:**

   - Verify credentials in Namecheap dashboard
   - Check if IMAP is enabled (usually default)
   - Test connection manually

2. **DNS Not Propagating:**

   - Wait 24-48 hours
   - Use DNS checker tools
   - Verify records in Namecheap DNS management

3. **SendGrid Verification Failed:**
   - Double-check DNS records match exactly
   - Ensure no typos in CNAME values
   - Contact Namecheap support if needed

### Support Resources

- **Namecheap Support:** 24/7 live chat
- **Documentation:** https://www.namecheap.com/support/knowledgebase/
- **DNS Checker:** https://dnschecker.org/

## Advantages vs Other Providers

| Feature                | Namecheap    | Google Workspace | Zoho Mail |
| ---------------------- | ------------ | ---------------- | --------- |
| **Annual Cost**        | ~$35         | ~$72             | ~$36      |
| **Setup Complexity**   | Low          | Medium           | Medium    |
| **IMAP Support**       | ✅ Excellent | ✅ Excellent     | ✅ Good   |
| **Single Vendor**      | ✅ Yes       | ❌ No            | ❌ No     |
| **Professional Email** | ✅ Yes       | ✅ Yes           | ✅ Yes    |
| **Support Quality**    | ✅ Good      | ✅ Excellent     | ✅ Good   |

## Client Communication

### Setup Email Template

```
Subject: Professional Email Setup - Kunes RV Fox

Hi [Client],

Great news! I've set up your professional email system.

Your Setup:
- Domain: kunesrvfox.com
- Professional Email: leads@kunesrvfox.com
- Annual Cost: ~$35 (domain + email)

Benefits:
✅ Professional appearance for all lead communication
✅ Builds trust and credibility
✅ No Gmail red flags
✅ Easy management through Namecheap

The system is now monitoring leads@kunesrvfox.com and will respond professionally using your branded email address.

Login Details:
- Webmail: https://privateemail.com
- Username: leads@kunesrvfox.com
- Password: [provided separately]

Welcome to professional lead communication!
```

## Maintenance

### Annual Tasks

- Renew domain registration (~$10)
- Renew email service (~$25)
- Update passwords if needed
- Review email storage usage

### Monthly Monitoring

- Check email delivery rates
- Monitor IMAP connection health
- Review any bounced emails
- Verify SendGrid domain status
