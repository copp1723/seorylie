#!/bin/bash

# GA4 Integration Setup Script for Rylie SEO Hub
# This script helps set up the centralized GA4 service account integration

echo \"🚀 Setting up GA4 Integration for Rylie SEO Hub\"
echo \"=============================================\"

# Check if we're in the right directory
if [ ! -f \"package.json\" ]; then
    echo \"❌ Error: Please run this script from the root of the Rylie SEO project\"
    exit 1
fi

echo \"📦 Installing dependencies for GA4 Service Manager...\"

# Navigate to ga4-service-manager package and install dependencies
if [ -d \"packages/ga4-service-manager\" ]; then
    cd packages/ga4-service-manager
    if command -v npm &> /dev/null; then
        npm install
    elif command -v yarn &> /dev/null; then
        yarn install
    else
        echo \"❌ Error: npm or yarn not found. Please install Node.js and npm\"
        exit 1
    fi
    cd ../..
else
    echo \"❌ Error: GA4 Service Manager package not found\"
    exit 1
fi

# Build the package
echo \"🔨 Building GA4 Service Manager package...\"
cd packages/ga4-service-manager
if command -v npx &> /dev/null; then
    npx tsc
    echo \"✅ GA4 Service Manager built successfully\"
else
    echo \"⚠️  Warning: TypeScript compiler not found. You may need to build manually\"
fi
cd ../..

# Check for required environment variables
echo \"🔧 Checking environment configuration...\"

ENV_FILE=\".env\"
EXAMPLE_FILE=\".env.example\"

if [ ! -f \"$ENV_FILE\" ]; then
    if [ -f \"$EXAMPLE_FILE\" ]; then
        echo \"📋 Creating .env file from .env.example...\"
        cp \"$EXAMPLE_FILE\" \"$ENV_FILE\"
        echo \"✅ .env file created\"
    else
        echo \"❌ Error: .env.example file not found\"
        exit 1
    fi
fi

# Check for GA4 configuration
echo \"📊 Checking GA4 configuration...\"

REQUIRED_VARS=(
    \"GA4_SERVICE_ACCOUNT_EMAIL\"
    \"GA4_PROJECT_ID\"
    \"GA4_PRIVATE_KEY\"
    \"GA4_KEY_ID\"
    \"GA4_ENCRYPTION_KEY\"
)

MISSING_VARS=()

for var in \"${REQUIRED_VARS[@]}\"; do
    if ! grep -q \"^$var=\" \"$ENV_FILE\" || grep -q \"^$var=$\" \"$ENV_FILE\" || grep -q \"^$var=.*your-.*\" \"$ENV_FILE\"; then
        MISSING_VARS+=(\"$var\")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo \"⚠️  Warning: The following GA4 environment variables need to be configured:\"
    for var in \"${MISSING_VARS[@]}\"; do
        echo \"   - $var\"
    done
    echo \"\"
    echo \"📝 Please update your .env file with the actual values before using GA4 features.\"
    echo \"   See the setup documentation for instructions on creating a Google Cloud service account.\"
else
    echo \"✅ GA4 environment variables are configured\"
fi

# Database migration check
echo \"🗄️  Checking database migrations...\"

if [ -f \"migrations/0002_add_ga4_integration.sql\" ]; then
    echo \"✅ GA4 database migration file found\"
    echo \"   Run 'npm run migrate' to apply the migration to your database\"
else
    echo \"❌ Error: GA4 migration file not found\"
fi

# Final setup summary
echo \"\"
echo \"🎉 GA4 Integration Setup Complete!\"
echo \"=================================\"
echo \"\"
echo \"📋 Next Steps:\"
echo \"1. Configure your GA4 environment variables in .env\"
echo \"2. Run 'npm run migrate' to create the GA4 database tables\"
echo \"3. Start your server with 'npm run dev'\"
echo \"4. Test the GA4 endpoints at: http://localhost:3000/api/ga4/health\"
echo \"\"
echo \"📚 Documentation:\"
echo \"- GA4 API endpoints: /api/ga4/*\"
echo \"- Onboarding flow: /api/ga4/onboarding/*\"
echo \"- Service account info: /api/ga4/service-account-info\"
echo \"\"
echo \"🔧 Troubleshooting:\"
echo \"- Check logs for any configuration issues\"
echo \"- Ensure your Google Cloud service account has Analytics API access\"
echo \"- Verify the encryption key is at least 32 characters\"
echo \"\"

# Make the script executable
chmod +x setup-ga4.sh

echo \"✅ Setup script completed successfully!\"