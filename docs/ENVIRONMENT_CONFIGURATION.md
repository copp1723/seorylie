# Environment Configuration Guide

## Overview

This document provides comprehensive guidance on configuring environment variables for the Rylie AI platform. All environment variables are documented in `.env.example` with detailed comments and examples.

## Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Update the values:**
   Edit `.env` with your actual configuration values

3. **Validate configuration:**
   ```bash
   npm run env:validate
   ```

## Environment Variables Reference

### Required Variables

These variables must be set for the application to function:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `SESSION_SECRET` | Secret for session encryption | Generate with `openssl rand -base64 32` |
| `OPENAI_API_KEY` | OpenAI API key for AI functionality | `sk-...` |
| `SENDGRID_API_KEY` | SendGrid API key for email | `SG.xxx` |

### Security Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CREDENTIALS_ENCRYPTION_KEY` | Key for encrypting stored credentials | Generate with `openssl rand -base64 32` |
| `AUTH_BYPASS` | Bypass authentication (dev only) | `false` |
| `ALLOW_AUTH_BYPASS` | Allow auth bypass flag | `false` |

### Email Configuration

The platform supports multiple email providers:

#### SendGrid (Recommended)
```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
```

#### Gmail
```env
EMAIL_SERVICE=gmail
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

#### SMTP
```env
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=username
SMTP_PASSWORD=password
SMTP_SECURE=false
```

### Optional Services

| Variable | Description | Required |
|----------|-------------|----------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID | For SMS features |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | For SMS features |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | For SMS features |
| `REDIS_HOST` | Redis host | For caching (optional) |
| `REDIS_PORT` | Redis port | For caching (optional) |

### Application Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `5000` |
| `LOG_LEVEL` | Logging level | `info` |
| `REPLIT_DOMAINS` | Allowed domains for Replit | - |

## Environment Validation

### Validation Scripts

The platform includes comprehensive environment validation:

```bash
# Run full environment validation
npm run env:validate

# Quick environment check (deprecated)
npm run env:check

# Full deployment readiness check
npm run deploy:check
```

### Validation Features

- ✅ **Required Variables**: Checks all mandatory environment variables
- ⚠️ **Optional Variables**: Validates optional configurations
- 🔒 **Security Settings**: Ensures production security requirements
- 🔗 **Database Connection**: Tests database connectivity
- 📧 **Service Configuration**: Validates external service settings
- 🏗️ **Schema Validation**: Checks database schema completeness

## Environment-Specific Configuration

### Development
```env
NODE_ENV=development
AUTH_BYPASS=true
LOG_LEVEL=debug
SKIP_REDIS=true
```

### Production
```env
NODE_ENV=production
AUTH_BYPASS=false
LOG_LEVEL=info
# All security variables must be properly set
```

### Testing
```env
NODE_ENV=test
AUTH_BYPASS=true
SKIP_REDIS=true
```

## Security Best Practices

### 🔐 Secret Generation

Generate secure secrets using:
```bash
# For SESSION_SECRET and CREDENTIALS_ENCRYPTION_KEY
openssl rand -base64 32

# For API keys, use the respective service's generation tools
```

### 🚫 Never Commit Secrets

- ✅ Use `.env.example` for documentation
- ❌ Never commit `.env` files
- ✅ Use environment variables in production
- ❌ Never hardcode secrets in code

### 🛡️ Production Security

In production environments:
- Set `AUTH_BYPASS=false`
- Use strong, unique `SESSION_SECRET`
- Set custom `CREDENTIALS_ENCRYPTION_KEY`
- Enable HTTPS/TLS
- Use secure database connections

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check `DATABASE_URL` format
   - Verify database server is running
   - Check network connectivity

2. **Authentication Errors**
   - Verify `SESSION_SECRET` is set
   - Check `AUTH_BYPASS` setting
   - Ensure `CREDENTIALS_ENCRYPTION_KEY` is configured

3. **Email Service Errors**
   - Validate email service credentials
   - Check `EMAIL_SERVICE` setting
   - Verify API key permissions

### Validation Errors

Run the validation script to identify issues:
```bash
npm run env:validate
```

The script will provide detailed feedback on:
- Missing required variables
- Invalid configuration values
- Security warnings
- Service connectivity issues

## Migration from Legacy Configuration

If upgrading from an older version:

1. **Update environment variables:**
   - Add new required variables from `.env.example`
   - Update deprecated variable names
   - Add security-related variables

2. **Run validation:**
   ```bash
   npm run env:validate
   ```

3. **Update scripts:**
   - Replace `npm run check-env` with `npm run env:validate`
   - Use new validation features

## Support

For configuration issues:
1. Check this documentation
2. Run `npm run env:validate` for detailed diagnostics
3. Review the `.env.example` file for latest requirements
4. Check application logs for specific error messages
