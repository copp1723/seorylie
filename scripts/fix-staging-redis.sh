#!/bin/bash

# Fix Staging Redis Connection Issues
# This script helps resolve Redis connection problems in staging deployment

echo "🔧 CleanRylie Staging Redis Fix Script"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📋 Current Redis Configuration Status:"
echo ""

# Check environment files
if [ -f ".env" ]; then
    echo "🔍 Checking .env file:"
    if grep -q "SKIP_REDIS" .env; then
        echo "   ✅ SKIP_REDIS found in .env: $(grep SKIP_REDIS .env)"
    else
        echo "   ⚠️  SKIP_REDIS not found in .env"
    fi
    
    if grep -q "REDIS_URL" .env; then
        echo "   📡 REDIS_URL found in .env: $(grep REDIS_URL .env | sed 's/redis:\/\/[^@]*@/redis:\/\/***@/')"
    else
        echo "   ⚠️  REDIS_URL not found in .env"
    fi
else
    echo "   ⚠️  No .env file found"
fi

echo ""
echo "🔧 Recommended Actions for Staging:"
echo ""
echo "1. 🚀 IMMEDIATE FIX - Set environment variable in Render Dashboard:"
echo "   Variable: SKIP_REDIS"
echo "   Value: true"
echo "   This will disable Redis and use in-memory fallback"
echo ""
echo "2. 📝 Alternative - Update your .env file for local testing:"
echo "   Add: SKIP_REDIS=true"
echo ""
echo "3. 🔄 After setting the environment variable:"
echo "   - Redeploy your application in Render"
echo "   - Check the logs to confirm Redis is skipped"
echo "   - Verify the white screen issue is resolved"
echo ""

# Offer to create/update .env file
read -p "🤔 Would you like to add SKIP_REDIS=true to your .env file for local testing? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f ".env" ]; then
        if grep -q "SKIP_REDIS" .env; then
            # Update existing SKIP_REDIS
            sed -i.bak 's/SKIP_REDIS=.*/SKIP_REDIS=true/' .env
            echo "✅ Updated SKIP_REDIS=true in .env file"
        else
            # Add SKIP_REDIS
            echo "" >> .env
            echo "# Redis Configuration" >> .env
            echo "SKIP_REDIS=true" >> .env
            echo "✅ Added SKIP_REDIS=true to .env file"
        fi
    else
        # Create new .env file
        echo "# CleanRylie Environment Configuration" > .env
        echo "SKIP_REDIS=true" >> .env
        echo "✅ Created .env file with SKIP_REDIS=true"
    fi
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Go to your Render Dashboard"
echo "2. Navigate to your CleanRylie service"
echo "3. Go to Environment tab"
echo "4. Add/Update: SKIP_REDIS = true"
echo "5. Redeploy the service"
echo ""
echo "📊 Monitor deployment logs for:"
echo "   ✅ 'Redis disabled via SKIP_REDIS environment variable'"
echo "   ✅ 'Using mock Redis client for development'"
echo "   ✅ 'Server running on http://0.0.0.0:PORT'"
echo ""
echo "🔗 Useful Render Dashboard URLs:"
echo "   - Services: https://dashboard.render.com/services"
echo "   - Environment Variables: https://dashboard.render.com/web/[your-service-id]/env-vars"
echo ""
echo "✨ This should resolve the white screen issue caused by Redis connection failures!"
