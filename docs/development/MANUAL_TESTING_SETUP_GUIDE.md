# 🚀 CleanRylie Manual Testing Setup Guide

**Status**: ⚠️ **SETUP REQUIRED**  
**Time Estimate**: 20-30 minutes  
**Complexity**: Medium

---

## ❌ **Critical Issues Found**

After comprehensive analysis, several **critical setup steps are missing** before manual testing can begin:

### 🔴 **BLOCKING ISSUES** (Must Fix First)

1. **❌ NO .env FILE EXISTS**

   - The `.env` file is missing completely
   - Application will fail to start without environment variables

2. **❌ NO NODE_MODULES INSTALLED**

   - Dependencies are not installed
   - `npm install` has not been run

3. **❌ NO DATABASE CONFIGURED**
   - No PostgreSQL database connection set up
   - Database schema not applied

---

## 📋 **STEP-BY-STEP SETUP CHECKLIST**

### **PHASE 1: Basic Environment Setup** ⚠️ **REQUIRED**

#### 1. **Navigate to Project Directory**

```bash
cd /Users/copp1723/Downloads/cleanrylie-main
```

#### 2. **Install Dependencies** 🔴 **CRITICAL**

```bash
# Install all required packages
npm install

# Verify installation
npm ls --depth=0
```

**Expected Result**: Should show ~200+ packages installed without errors

#### 3. **Create Environment File** 🔴 **CRITICAL**

```bash
# Copy the example file
cp .env.example .env

# Open for editing
nano .env
# OR
code .env
```

#### 4. **Configure Essential Environment Variables** 🔴 **CRITICAL**

Edit your `.env` file with these **MINIMUM REQUIRED** values:

```env
# =============================================================================
# CRITICAL: DATABASE CONFIGURATION
# =============================================================================
DATABASE_URL=postgres://username:password@localhost:5432/cleanrylie

# =============================================================================
# CRITICAL: SECURITY & AUTHENTICATION
# =============================================================================
# Generate with: openssl rand -base64 32
SESSION_SECRET=your-super-secret-session-key-here-CHANGE-THIS
CREDENTIALS_ENCRYPTION_KEY=your-credentials-encryption-key-CHANGE-THIS

# Development mode settings
NODE_ENV=development
AUTH_BYPASS=false
ALLOW_AUTH_BYPASS=true

# =============================================================================
# CRITICAL: AI SERVICES
# =============================================================================
OPENAI_API_KEY=sk-your-openai-api-key-here

# =============================================================================
# CRITICAL: EMAIL CONFIGURATION
# =============================================================================
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com

# =============================================================================
# OPTIONAL: APPLICATION SETTINGS
# =============================================================================
PORT=5000
LOG_LEVEL=info
SKIP_REDIS=true
FRONTEND_URL=http://localhost:5000
```

### **PHASE 2: Database Setup** ⚠️ **REQUIRED**

#### 5. **Set Up PostgreSQL Database** 🔴 **CRITICAL**

**Option A: Local PostgreSQL (Recommended for Testing)**

```bash
# Install PostgreSQL (if not installed)
# macOS:
brew install postgresql
brew services start postgresql

# Create database
createdb cleanrylie

# Update DATABASE_URL in .env:
DATABASE_URL=postgres://postgres:password@localhost:5432/cleanrylie
```

**Option B: Use Supabase (Cloud)**

1. Go to [supabase.com](https://supabase.com)
2. Create new project named "cleanrylie"
3. Get connection string from Settings > Database
4. Update DATABASE_URL in .env with Supabase connection string

#### 6. **Apply Database Schema** 🔴 **CRITICAL**

```bash
# Apply the complete schema
psql $DATABASE_URL -f supabase-schema.sql

# OR if using local postgres:
psql -d cleanrylie -f supabase-schema.sql
```

**Expected Result**: Should create ~29 tables without errors

#### 7. **Validate Environment** 🔴 **CRITICAL**

```bash
# Run comprehensive validation
npm run env:validate
```

**Expected Result**: Should show all critical variables as ✅ PASS

### **PHASE 3: Application Testing** ⚠️ **VERIFICATION**

#### 8. **Test TypeScript Compilation**

```bash
# Check for TypeScript errors
npm run check
```

**Expected Result**: No compilation errors

#### 9. **Test Application Startup**

```bash
# Start development server
npm run dev
```

**Expected Results**:

- ✅ Database connection successful
- ✅ Server starts on port 5000
- ✅ No critical errors in console
- ✅ Frontend accessible at http://localhost:5000

#### 10. **Test Database Connection**

```bash
# In another terminal, test database
npm run test:quick
```

**Expected Result**: Database health check passes

---

## 🔧 **Service Dependencies Setup** (Optional but Recommended)

### **OpenAI API Key** (Required for AI Features)

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Add to `.env`: `OPENAI_API_KEY=sk-...`

### **SendGrid Email** (Required for Email Features)

1. Go to [sendgrid.com](https://sendgrid.com)
2. Create API key
3. Add to `.env`: `SENDGRID_API_KEY=SG.xxx`

### **Generate Secure Keys**

```bash
# Generate session secret
openssl rand -base64 32

# Generate credentials encryption key
openssl rand -base64 32
```

---

## ✅ **Verification Checklist**

Before manual testing, ensure all these are ✅:

### **Environment Setup**

- [ ] ✅ `npm install` completed successfully
- [ ] ✅ `.env` file created and configured
- [ ] ✅ Database URL configured
- [ ] ✅ Session secrets generated
- [ ] ✅ `npm run env:validate` passes

### **Database Setup**

- [ ] ✅ PostgreSQL running
- [ ] ✅ Database created (cleanrylie)
- [ ] ✅ Schema applied successfully
- [ ] ✅ No database connection errors

### **Application Startup**

- [ ] ✅ `npm run check` passes (no TypeScript errors)
- [ ] ✅ `npm run dev` starts without errors
- [ ] ✅ Server accessible at http://localhost:5000
- [ ] ✅ Database connection test passes

### **Optional Services**

- [ ] 🔄 OpenAI API key configured (for AI features)
- [ ] 🔄 SendGrid API key configured (for email features)
- [ ] 🔄 Twilio configured (for SMS features)

---

## 🚨 **Common Issues & Solutions**

### **"Cannot connect to database"**

```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Start PostgreSQL
brew services start postgresql

# Test connection manually
psql $DATABASE_URL -c "SELECT NOW();"
```

### **"Module not found" errors**

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### **"Environment validation failed"**

```bash
# Check .env file exists
ls -la .env

# Validate specific variables
npm run env:validate
```

### **Port already in use**

```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# OR use different port
PORT=3000 npm run dev
```

---

## 🎯 **What You Can Test After Setup**

Once setup is complete, you can manually test:

### **Core Features**

- ✅ Application loads at http://localhost:5000
- ✅ Database connectivity and health endpoints
- ✅ Authentication system (login/logout)
- ✅ Basic navigation and UI components

### **Advanced Features** (with API keys)

- ✅ AI conversation system (with OpenAI key)
- ✅ Email notifications (with SendGrid key)
- ✅ Inventory management
- ✅ Multi-tenant dealership features

### **API Endpoints**

- ✅ `GET /api/health` - System health
- ✅ `GET /api/dealerships` - Dealership data
- ✅ `GET /api/vehicles` - Inventory
- ✅ `GET /api/conversations` - Chat history

---

## ⏱️ **Estimated Setup Time**

- **Basic Setup**: 10-15 minutes
- **Database Setup**: 5-10 minutes
- **Service Configuration**: 5-10 minutes
- **Testing & Verification**: 5-10 minutes

**Total**: 25-45 minutes depending on experience level

---

## 📞 **Next Steps After Setup**

1. **Verify Basic Functionality**: Test core features work
2. **Configure Services**: Add API keys for full functionality
3. **Load Test Data**: Use scripts to populate test dealerships/vehicles
4. **Begin Manual Testing**: Follow test scenarios in ticket reports

---

**Setup Status**: ⚠️ **SETUP REQUIRED - Cannot test without completing PHASE 1 & 2**
