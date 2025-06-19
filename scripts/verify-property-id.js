#!/usr/bin/env node
/**
 * GA4 Property ID Verification Helper
 */

console.log(`
🔍 GA4 Property ID Verification Guide
=====================================

Since permissions were added yesterday, the issue is almost certainly
a mismatch between the property ID we're using and the actual ID.

📋 STEP-BY-STEP VERIFICATION:

1. Open Google Analytics
   https://analytics.google.com/

2. Make sure you're viewing the correct property:
   - Look at the top of the page
   - It should show "Jay Hatfield Chevrolet" or similar
   - If not, use the property selector to switch

3. Click the gear icon (⚙️) for Admin

4. In the PROPERTY column (middle column), click "Property Settings"

5. Look for "PROPERTY ID" - it will be a 9-digit number

6. The EXACT value should be: 320759942

❓ COMMON ISSUES:

1. Wrong Property Selected
   - You might be looking at a different dealership
   - Or a test/demo property

2. Multiple Properties
   - The dealership might have multiple GA4 properties
   - Make sure you're in the one where you added the service account

3. Property ID Typo
   - Even one digit difference will cause permission errors
   - Common typos: 302759942, 320759924, 320759442

📊 WHAT THE PROPERTY SETTINGS PAGE LOOKS LIKE:

Property name: [Jay Hatfield Chevrolet]
Property ID: [9-digit number]  ← This is what we need!
Time zone: [US Central Time]
Currency: [US Dollar]

🔧 IF THE PROPERTY ID IS DIFFERENT:

Update it in the database:
UPDATE ga4_properties SET property_id = 'CORRECT_ID_HERE' WHERE id = 1;

Then test again:
node scripts/debug-ga4.js

💡 ALTERNATIVE CHECK:

In the Property Access Management page (where you added the service account),
look at the property name at the top of that page. Make sure it's the same
property you're checking the ID for.

The service account email shown should be:
seo-ga4-service@onekeel-seo.iam.gserviceaccount.com

Status should be: Active
Role should be: Viewer
`);