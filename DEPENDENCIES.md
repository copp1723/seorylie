# Dependencies Documentation

This document provides comprehensive information about all project dependencies, their purposes, and installation requirements.

## 🚨 Critical Dependencies

These dependencies are **required** for the application to function properly. Missing any of these will cause build or runtime errors.

### Production Dependencies

| Package | Version | Purpose | Critical |
|---------|---------|---------|----------|
| `drizzle-kit` | ^0.31.1 | Database schema management and migrations | ✅ |
| `inquirer` | ^12.6.3 | Interactive command-line prompts for scripts | ✅ |
| `archiver` | ^7.0.1 | File compression and archiving utilities | ✅ |
| `bcrypt` | ^6.0.0 | Password hashing and encryption | ✅ |
| `cookie-parser` | ^1.4.7 | HTTP cookie parsing middleware | ✅ |
| `csv-parser` | ^3.2.0 | CSV file parsing for data imports | ✅ |
| `mailparser` | ^3.7.3 | Email parsing and processing | ✅ |
| `redis` | ^5.5.6 | Redis client for caching and sessions | ✅ |
| `ajv-formats` | ^3.0.1 | JSON schema validation formats | ✅ |

### Development Dependencies

| Package | Version | Purpose | Critical |
|---------|---------|---------|----------|
| `@playwright/test` | ^1.53.1 | End-to-end testing framework | ✅ |
| `@testing-library/react` | ^16.3.0 | React component testing utilities | ✅ |
| `jsdom` | ^26.1.0 | DOM implementation for testing | ✅ |
| `@types/archiver` | ^6.0.3 | TypeScript definitions for archiver | ✅ |
| `@types/bcrypt` | ^5.0.2 | TypeScript definitions for bcrypt | ✅ |
| `@types/cookie-parser` | ^1.4.9 | TypeScript definitions for cookie-parser | ✅ |
| `@types/mailparser` | ^3.4.6 | TypeScript definitions for mailparser | ✅ |
| `@types/inquirer` | ^9.0.8 | TypeScript definitions for inquirer | ✅ |

## 📦 Installation Guide

### Quick Installation

```bash
# Install all dependencies
pnpm install

# Verify installation
pnpm list --depth=0
```

### Manual Installation

If you need to install dependencies manually:

```bash
# Production dependencies
pnpm add -w drizzle-kit inquirer archiver bcrypt cookie-parser csv-parser mailparser redis ajv-formats

# Development dependencies
pnpm add -w -D @playwright/test @testing-library/react jsdom @types/archiver @types/bcrypt @types/cookie-parser @types/mailparser @types/inquirer
```

### Workspace Installation

This project uses pnpm workspaces. Use the `-w` flag to install to the workspace root:

```bash
# Correct way to install to workspace root
pnpm add -w package-name

# This will fail with workspace error
pnpm add package-name
```

## 🔍 Dependency Details

### Database & ORM

- **drizzle-kit**: Essential for database schema management, migrations, and the `drizzle.config.ts` file
- **bcrypt**: Used for secure password hashing in authentication systems
- **redis**: Required for caching, session storage, and rate limiting

### File Processing

- **archiver**: Used in backup scripts and file compression utilities
- **csv-parser**: Essential for importing CSV data files
- **mailparser**: Required for processing email attachments and parsing email content

### Development Tools

- **inquirer**: Used in interactive setup scripts and admin tools
- **cookie-parser**: Middleware for parsing HTTP cookies in Express
- **ajv-formats**: Provides additional validation formats for JSON schemas

### Testing Framework

- **@playwright/test**: End-to-end testing for web applications
- **@testing-library/react**: Component testing utilities for React
- **jsdom**: DOM implementation for Node.js testing environments

## 🚨 Common Issues

### Missing Dependencies Error

If you see errors like:
```
Cannot find module 'drizzle-kit' or its corresponding type declarations
```

**Solution:**
```bash
pnpm add -w drizzle-kit
```

### Workspace Root Error

If you see:
```
ERR_PNPM_ADDING_TO_ROOT Running this command will add the dependency to the workspace root
```

**Solution:** Add the `-w` flag:
```bash
pnpm add -w package-name
```

### TypeScript Errors

If you see TypeScript errors about missing type declarations:

**Solution:** Install the corresponding `@types` package:
```bash
pnpm add -w -D @types/package-name
```

## 🔧 Verification Commands

### Check for Missing Dependencies

```bash
# TypeScript check (will show missing modules)
npx tsc --noEmit --skipLibCheck

# Count remaining errors
npx tsc --noEmit --skipLibCheck 2>&1 | grep "Cannot find module" | wc -l
```

### Audit Dependencies

```bash
# Check for security vulnerabilities
pnpm audit

# Check for outdated packages
pnpm outdated

# List all installed packages
pnpm list --depth=0
```

### Build Verification

```bash
# Test build process
pnpm run build

# Run tests to verify everything works
pnpm test
```

## 📋 Maintenance

### Regular Updates

```bash
# Update all dependencies to latest compatible versions
pnpm update

# Update specific package
pnpm update package-name

# Check what would be updated
pnpm outdated
```

### Security Maintenance

```bash
# Audit for security issues
pnpm audit

# Fix security issues automatically
pnpm audit --fix

# Check for known vulnerabilities
pnpm audit --audit-level moderate
```

## 🎯 Best Practices

1. **Always use pnpm** instead of npm for this project
2. **Use `-w` flag** when installing to workspace root
3. **Install @types packages** as devDependencies
4. **Run `pnpm audit`** regularly for security
5. **Keep dependencies updated** but test thoroughly
6. **Document new dependencies** when adding them

## 📞 Support

If you encounter dependency issues:

1. Check this documentation first
2. Run the verification commands above
3. Check the main README.md troubleshooting section
4. Create an issue with the specific error message

---

**Last Updated:** January 2025
**Dependencies Count:** 17 critical packages
**Status:** ✅ All dependencies documented and verified