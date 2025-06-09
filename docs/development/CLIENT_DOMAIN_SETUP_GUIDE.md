# Client Domain Setup Guide

This guide walks through setting up a new client with their own custom domain for professional email communication.

## Overview

**Email Flow:**

- **Inbound ADF:** `leads@clientdomain.com` → `client-internal@gmail.com` → IMAP → CleanRylie
- **Outbound Responses:** CleanRylie → SendGrid → `leads@clientdomain.com` → Lead

**Lead Experience:** Professional emails from `Client Name <leads@clientdomain.com>`

## Prerequisites

- Client has purchased a domain (e.g., `abcmotors.com`)
- Client has access to DNS management
- SendGrid account with domain authentication capability
- Gmail account for IMAP processing

## Step-by-Step Setup

### Phase 1: Preparation

1. **Gather Client Information:**

   ```
   Business Name: ABC Motors
   Domain: abcmotors.com
   Preferred Email: leads@abcmotors.com
   ```

2. **Create Gmail Account:**

   ```
   Email: abcmotors-internal@gmail.com
   Purpose: IMAP processing (hidden from leads)
   ```

3. **Generate App Password:**
   - Enable 2FA on Gmail account
   - Generate app-specific password
   - Save securely for configuration

### Phase 2: SendGrid Domain Authentication

1. **Add Domain to SendGrid:**

   ```
   SendGrid Dashboard → Settings → Sender Authentication → Domain Authentication
   → Add New Domain → abcmotors.com
   ```

2. **Configure Domain Settings:**

   - Use automated security: Yes
   - Use custom return path: No (unless client requests)
   - Generate records

3. **Get DNS Records:**
   SendGrid provides 3 CNAME records:
   ```
   s1._domainkey.abcmotors.com → s1.domainkey.u12345.wl123.sendgrid.net
   s2._domainkey.abcmotors.com → s2.domainkey.u12345.wl123.sendgrid.net
   em1234.abcmotors.com → u12345.wl123.sendgrid.net
   ```

### Phase 3: Client DNS Configuration

**Send to Client:**

```
Subject: DNS Records for Email Setup - ABC Motors

Hi [Client Name],

To complete your professional email setup, please add these DNS records to your domain (abcmotors.com):

CNAME Records:
1. Host: s1._domainkey    Value: s1.domainkey.u12345.wl123.sendgrid.net
2. Host: s2._domainkey    Value: s2.domainkey.u12345.wl123.sendgrid.net
3. Host: em1234           Value: u12345.wl123.sendgrid.net

Email Forwarding:
- Set up: leads@abcmotors.com → abcmotors-internal@gmail.com

Instructions:
1. Log into your domain registrar (GoDaddy, Namecheap, etc.)
2. Go to DNS Management
3. Add the 3 CNAME records above
4. Set up email forwarding for leads@abcmotors.com
5. Changes take 24-48 hours to propagate

Let me know when complete!
```

### Phase 4: CleanRylie Configuration

1. **Run Setup Script:**

   ```bash
   chmod +x scripts/setup-client-domain.sh
   ./scripts/setup-client-domain.sh "ABC Motors" "abcmotors.com" "abcmotors-internal@gmail.com" 1
   ```

2. **Manual Database Update (Alternative):**
   ```sql
   UPDATE dealerships
   SET
     name = 'ABC Motors',
     email_config = jsonb_build_object(
       'fromEmail', 'leads@abcmotors.com',
       'fromName', 'ABC Motors',
       'replyTo', 'leads@abcmotors.com',
       'domain', 'abcmotors.com',
       'verified', false
     ),
     imap_config = jsonb_build_object(
       'host', 'imap.gmail.com',
       'port', 993,
       'user', 'abcmotors-internal@gmail.com',
       'password', 'gmail-app-password',
       'tls', true,
       'markSeen', true,
       'pollingInterval', 300
     )
   WHERE id = 1;
   ```

### Phase 5: Verification & Testing

1. **Verify Domain in SendGrid:**

   - Wait 24-48 hours after DNS changes
   - Check SendGrid dashboard for green verification

2. **Update Verification Status:**

   ```sql
   UPDATE dealerships
   SET email_config = jsonb_set(email_config, '{verified}', 'true')
   WHERE id = 1;
   ```

3. **Test Email Flow:**

   ```bash
   # Test inbound
   Send test ADF to: leads@abcmotors.com

   # Test outbound
   Trigger response from CleanRylie
   Verify lead receives from: ABC Motors <leads@abcmotors.com>
   ```

## Troubleshooting

### Common Issues

1. **DNS Propagation Delays:**

   - Wait 24-48 hours
   - Use DNS checker tools
   - Verify with `dig` command

2. **Email Forwarding Not Working:**

   - Check domain registrar settings
   - Test with simple email first
   - Consider using Google Workspace

3. **SendGrid Verification Failed:**
   - Double-check DNS records
   - Ensure exact match with SendGrid values
   - Contact SendGrid support if needed

### Verification Commands

```bash
# Check DNS propagation
dig CNAME s1._domainkey.abcmotors.com
dig CNAME s2._domainkey.abcmotors.com
dig CNAME em1234.abcmotors.com

# Test email forwarding
echo "Test message" | mail -s "Test" leads@abcmotors.com
```

## Client Communication Templates

### Initial Setup Email

```
Subject: Professional Email Setup - Next Steps

Hi [Client],

Great news! We're setting up your professional email system for lead communication.

Your leads will receive emails from: [Client Name] <leads@[domain].com>

Next steps:
1. I'll send DNS records to add to your domain
2. Set up email forwarding (I'll provide instructions)
3. We'll verify everything is working
4. Go live with professional email communication!

Timeline: 2-3 business days for complete setup.

Questions? Just reply to this email.

Best regards,
[Your Name]
```

### DNS Instructions Email

```
Subject: DNS Records for [Client] Email Setup

Hi [Client],

Please add these DNS records to [domain].com:

[Include specific DNS records]

Also set up email forwarding:
leads@[domain].com → [internal-gmail]@gmail.com

Need help? Most domain registrars have support teams that can assist with DNS changes.

Let me know when complete!
```

### Completion Email

```
Subject: ✅ Professional Email Setup Complete - [Client]

Hi [Client],

Excellent! Your professional email system is now live.

✅ Domain verified
✅ Email forwarding working
✅ Professional branding active

Your leads now receive emails from: [Client Name] <leads@[domain].com>

This creates a much more professional impression and builds trust with potential customers.

The system is monitoring for new leads and will respond professionally using your branded email address.

Welcome to professional lead communication!
```

## Maintenance

### Monthly Checks

- Verify domain authentication status
- Check email forwarding functionality
- Monitor delivery rates in SendGrid
- Review any bounced emails

### Annual Tasks

- Renew domain registration
- Update DNS records if needed
- Review and update email templates
- Check for SendGrid policy changes
