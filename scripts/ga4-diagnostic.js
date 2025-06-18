#!/usr/bin/env node
/**
 * GA4 Tracking Diagnostic Summary
 */

console.log(`
🔍 GA4 TRACKING DIAGNOSTIC
==========================

Current Status: API ✅ | Data ❌

Since your visit isn't showing up, here's what to check:

1️⃣ CHECK GA4 REAL-TIME REPORTS (Most Important)
   - Go to Google Analytics
   - Navigate to Reports → Real-time
   - Visit the website again
   - You should see yourself appear immediately
   
   If you DON'T see yourself in real-time:
   → The tracking isn't working properly

2️⃣ VERIFY GTM SETUP
   - Go to Google Tag Manager
   - Check if the container is PUBLISHED (not just saved)
   - Look for a GA4 Configuration tag
   - Ensure it has the correct Measurement ID
   - Check that it fires on "All Pages"

3️⃣ USE TAG ASSISTANT
   - Install Google Tag Assistant Chrome extension
   - Visit jayhatfieldchevroletvinita.com
   - Check if GA4 tags are firing
   - Look for any errors

4️⃣ CHECK MEASUREMENT ID
   The GA4 property needs a Measurement ID (format: G-XXXXXXXXX)
   This is different from the Property ID (493777160)
   
   To find it:
   - GA4 Admin → Data Streams → Click on web stream
   - Copy the Measurement ID
   - This should be configured in GTM

5️⃣ COMMON GTM ISSUES
   - Container not published (most common)
   - GA4 tag not created
   - Wrong trigger (should be "All Pages")
   - Measurement ID not configured
   - Tag paused or has exceptions

📊 WHAT WE KNOW:
   ✅ API Connection: Working perfectly
   ✅ Property ID: 493777160 (correct)
   ✅ Permissions: All set correctly
   ✅ Service Account: Connected
   ❌ Data Collection: Not receiving data

🎯 NEXT ACTION:
   Please check GA4 Real-time reports while visiting the site.
   If you see yourself there but not in the API, wait 10-15 minutes.
   If you don't see yourself, the GTM/GA4 setup needs to be fixed.

💡 Once tracking is confirmed in GA4 Real-time, the API data will follow!
`);