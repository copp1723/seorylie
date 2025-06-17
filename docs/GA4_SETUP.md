# Google Analytics 4 (GA4) Service Account Setup Guide

This guide will walk you through setting up a Google Cloud service account to integrate GA4 with the Rylie SEO platform.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Create a Google Cloud Project](#step-1-create-a-google-cloud-project)
3. [Step 2: Enable the Google Analytics Data API](#step-2-enable-the-google-analytics-data-api)
4. [Step 3: Create a Service Account](#step-3-create-a-service-account)
5. [Step 4: Download Service Account Credentials](#step-4-download-service-account-credentials)
6. [Step 5: Grant GA4 Property Access](#step-5-grant-ga4-property-access)
7. [Step 6: Configure Environment Variables](#step-6-configure-environment-variables)
8. [Step 7: Verify Setup](#step-7-verify-setup)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have:
- A Google account with access to Google Analytics 4
- Access to the GA4 property you want to integrate
- Node.js 18+ installed on your development machine
- Access to the project's environment configuration files

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click "New Project" in the top right of the popup
4. Enter a project name (e.g., "Rylie SEO GA4 Integration")
5. Leave the organization as default (or select if applicable)
6. Click "Create"
7. Wait for the project to be created (usually takes 10-30 seconds)
8. Make note of the **Project ID** - you'll need this later

## Step 2: Enable the Google Analytics Data API

1. In the Google Cloud Console, ensure your new project is selected
2. Navigate to "APIs & Services" > "Library" from the left sidebar
3. In the search bar, type "Google Analytics Data API"
4. Click on "Google Analytics Data API" from the results
5. Click the "ENABLE" button
6. Wait for the API to be enabled (this may take a minute)

## Step 3: Create a Service Account

1. In the Google Cloud Console, navigate to "IAM & Admin" > "Service Accounts"
2. Click "CREATE SERVICE ACCOUNT" at the top
3. Fill in the service account details:
   - **Service account name**: `rylie-seo-ga4-service`
   - **Service account ID**: This will auto-populate based on the name
   - **Service account description**: "Service account for Rylie SEO GA4 integration"
4. Click "CREATE AND CONTINUE"
5. Skip the "Grant this service account access to project" step by clicking "CONTINUE"
6. Skip the "Grant users access to this service account" step by clicking "DONE"

## Step 4: Download Service Account Credentials

1. In the Service Accounts list, find the service account you just created
2. Click on the service account email address to open its details
3. Navigate to the "KEYS" tab
4. Click "ADD KEY" > "Create new key"
5. Select "JSON" as the key type
6. Click "CREATE"
7. The JSON key file will be downloaded to your computer
8. **Important**: Store this file securely - it contains sensitive credentials

### Organizing the Credentials File

1. Rename the downloaded file to something clear like `ga4-service-account-key.json`
2. Move it to a secure location in your project (e.g., `/config/credentials/`)
3. **Never commit this file to version control** - add it to `.gitignore`:
   ```
   # GA4 Service Account Credentials
   config/credentials/ga4-service-account-key.json
   *.json
   ```

## Step 5: Grant GA4 Property Access

Now you need to grant the service account access to your GA4 property:

1. Open [Google Analytics](https://analytics.google.com/)
2. Select the GA4 property you want to integrate
3. Click the gear icon (⚙️) in the bottom left to open Admin
4. In the "Property" column, click "Property Access Management"
5. Click the "+" button to add a new user
6. Enter the service account email address (found in the JSON file or Google Cloud Console)
   - It will look like: `rylie-seo-ga4-service@YOUR-PROJECT-ID.iam.gserviceaccount.com`
7. Under "Direct roles and data restrictions", select "Viewer" role
8. Click "Add" to save

### Finding Your GA4 Property ID

While in Google Analytics Admin:
1. In the "Property" column, click "Property details"
2. Copy the "Property ID" (it's a number like `123456789`)
3. Save this ID - you'll need it for the environment variables

## Step 6: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update your `.env` file with the GA4 configuration:
   ```env
   # Google Analytics 4 Configuration
   GA4_PROPERTY_ID=YOUR_PROPERTY_ID_HERE
   GA4_SERVICE_ACCOUNT_KEY_PATH=./config/credentials/ga4-service-account-key.json
   
   # Alternative: Store the entire JSON as an environment variable (for production)
   # GA4_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
   ```

3. For production environments, it's recommended to store the service account key as an environment variable rather than a file:
   - Copy the entire contents of the JSON file
   - Store it as a single-line string in `GA4_SERVICE_ACCOUNT_KEY`
   - Use the setup script to validate and process this configuration

## Step 7: Verify Setup

Run the setup verification script:

```bash
npm run setup:ga4:verify
```

This script will:
- Check if all required environment variables are set
- Validate the service account credentials
- Test the connection to GA4
- Retrieve basic property information to confirm access

## Troubleshooting

### Common Issues and Solutions

#### 1. "API not enabled" Error
- **Solution**: Ensure you've enabled the Google Analytics Data API in your Google Cloud project
- Go back to Step 2 and verify the API is enabled

#### 2. "Insufficient permissions" Error
- **Solution**: Check that the service account has been granted access to the GA4 property
- Verify the email address matches exactly
- Ensure at least "Viewer" role is assigned

#### 3. "Invalid credentials" Error
- **Solution**: 
  - Check that the JSON file path is correct
  - Verify the JSON file hasn't been corrupted
  - Ensure you're using the correct project's credentials

#### 4. "Property not found" Error
- **Solution**:
  - Double-check the GA4 Property ID
  - Ensure you're using the Property ID (numbers only), not the Measurement ID (starts with "G-")
  - Verify the service account has access to this specific property

### Security Best Practices

1. **Never expose credentials**:
   - Add credential files to `.gitignore`
   - Use environment variables for production
   - Rotate keys regularly

2. **Principle of least privilege**:
   - Only grant "Viewer" access unless write access is specifically needed
   - Review and audit service account permissions regularly

3. **Monitor usage**:
   - Check Google Cloud Console for API usage
   - Set up alerts for unusual activity
   - Review GA4 user activity logs

## Next Steps

Once you've completed the setup:

1. Test the integration using the provided scripts
2. Configure data fetching schedules if needed
3. Set up monitoring for the integration
4. Document any custom configurations for your team

## Additional Resources

- [Google Analytics Data API Documentation](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Google Cloud Service Accounts Guide](https://cloud.google.com/iam/docs/service-accounts)
- [GA4 Access Management](https://support.google.com/analytics/answer/9305587)

---

For questions or issues, please refer to the project's main documentation or contact the development team.