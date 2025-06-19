# GA4 Integration Setup Instructions for Rowdy

## Overview
We've set up a centralized service account to access all GA4 properties for the Rylie SEO platform. This allows us to pull analytics data without needing individual credentials for each property.

## Service Account Details
- **Service Account Email**: [Will be provided after Josh completes setup]
- **Purpose**: Read-only access to GA4 data for SEO reporting and insights

## Setup Instructions for Each Property

### Step 1: Access Google Analytics
1. Go to [Google Analytics](https://analytics.google.com)
2. Make sure you're logged in with an account that has admin access to the properties

### Step 2: Grant Access to Each Property

For each property (starting with the two test properties), follow these steps:

1. **Navigate to Property Settings**
   - Click the **Admin** gear icon (bottom left)
   - Make sure you're in the correct property (check the property name at the top)

2. **Access Property Access Management**
   - Under the "Property" column, click **"Property Access Management"**
   - You'll see a list of users who currently have access

3. **Add Service Account**
   - Click the blue **"+"** button in the top right
   - Select **"Add users"**
   - Enter the service account email: `[service-account-email]`
   - Set the role to **"Viewer"** (read-only access)
   - Uncheck "Notify new users by email" (service accounts can't receive email)
   - Click **"Add"**

4. **Verify Access**
   - The service account should now appear in the list
   - It will show as "Service Account" type with "Viewer" role

## Test Properties to Configure First

### 1. Jay Hatfield Chevrolet of Vinita
- **Property ID**: 320759942
- **Measurement ID**: G-ZJQKZZHVTM
- **Website**: https://www.jayhatfieldchevroletvinita.com/

### 2. Jay Hatfield Motorsports of Wichita
- **Property ID**: 317592148
- **Measurement ID**: G-DBMQEB1TM0
- **Website**: https://www.kansasmotorsports.com/

## What Data We'll Access

With viewer access, we can pull:
- Traffic metrics (users, sessions, pageviews)
- Traffic sources (organic search, direct, referral, etc.)
- User behavior (bounce rate, session duration, pages per session)
- Conversion data (goals, e-commerce if configured)
- Real-time data
- Custom reports based on your needs

## Security & Privacy

- **Read-Only**: The service account only has viewer permissions
- **No Data Modification**: Cannot change any settings or data
- **Secure Storage**: Credentials are encrypted and stored securely
- **Audit Trail**: All API access is logged by Google

## Timeline

1. **Today**: Set up test properties and verify connection
2. **Next 24-48 hours**: Test data retrieval and reporting
3. **By End of Week**: Ready to onboard all 100+ properties

## Bulk Property Management

Once we verify the test properties work correctly, we can:
1. Provide a spreadsheet template for all property IDs
2. Create a streamlined process for adding the service account to multiple properties
3. Set up automated monitoring to detect any access issues

## Need Help?

If you encounter any issues or have questions:
- Check that you have admin access to the property
- Verify you're adding the exact service account email
- Make sure to select "Viewer" role
- Contact Josh with any error messages or screenshots

## Next Steps

1. Add service account to the two test properties
2. Notify Josh once complete
3. We'll run connection tests and confirm data access
4. Proceed with remaining properties once verified

---

**Note**: The same service account will be used for Search Console access, so this is a one-time setup that will benefit multiple integrations.