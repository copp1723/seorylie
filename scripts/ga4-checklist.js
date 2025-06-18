#!/usr/bin/env node
/**
 * GA4 Integration Checklist
 */

console.log(`
🔍 GA4 Integration Troubleshooting Checklist
============================================

Current Status:
✅ Service account created: seo-ga4-service@onekeel-seo.iam.gserviceaccount.com
✅ Service account has Viewer access to GA4 property (confirmed in screenshot)
✅ Property ID correct: 320759942
✅ Credentials file exists and is valid
❌ API calls returning: PERMISSION_DENIED

Most Likely Issue: Google Analytics Data API not enabled

📋 IMMEDIATE ACTION REQUIRED:

1. Enable the Google Analytics Data API:
   a. Go to: https://console.cloud.google.com/apis/library
   b. Make sure you're in project: onekeel-seo
   c. Search for "Google Analytics Data API" 
   d. Click on it
   e. Click "ENABLE" button
   f. Wait for it to activate (usually instant)

2. Alternative: Enable via command line:
   gcloud services enable analyticsdatadata.googleapis.com --project=onekeel-seo

3. After enabling the API, wait 1-2 minutes then run:
   node scripts/debug-ga4.js

📊 VERIFICATION STEPS:

Once the API is enabled, the test should return real data like:
- Sessions, users, and page views from jayhatfieldchevroletvinita.com
- Traffic data from cities in Oklahoma (Vinita, Tulsa, etc.)
- Daily metrics for the past 7 days

🔧 OTHER POSSIBLE ISSUES (if API is already enabled):

1. Wrong Google Cloud Project:
   - Verify you're looking at project "onekeel-seo"
   - The service account must be from the same project

2. Property Access Propagation:
   - Though you've added the service account, it can take up to 15 minutes
   - Try again in a few minutes

3. Property ID Mismatch:
   - Double-check the property ID in GA4 matches exactly: 320759942
   - No extra spaces or characters

💡 The screenshot shows the access is configured correctly in GA4.
   The issue is almost certainly the API not being enabled in Google Cloud.

Once the API is enabled, the integration will work immediately!
`);