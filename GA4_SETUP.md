# GA4 Setup Instructions for Render

## Option 1: Using Environment Variable (Recommended)

1. Get your GA4 service account JSON file
2. Convert it to base64:
   ```bash
   base64 -i ga4-service-account.json | tr -d '\n' > ga4-base64.txt
   ```
3. Copy the contents of `ga4-base64.txt`
4. In Render dashboard:
   - Go to Environment Variables
   - Add: `GA4_CREDENTIALS_JSON` = [paste base64 content]

## Option 2: Using Secret Files

1. In Render dashboard:
   - Go to "Secret Files"
   - Click "Add Secret File"
   - Path: `/opt/render/project/src/credentials/ga4-service-account.json`
   - Contents: Paste your JSON key file contents
   
2. Optionally set:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/opt/render/project/src/credentials/ga4-service-account.json
   ```

## Testing Locally

To test with environment variable:
```bash
export GA4_CREDENTIALS_JSON=$(base64 -i ga4-service-account.json)
npm run dev
```

To test with file:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=./credentials/ga4-service-account.json
npm run dev
```

## Troubleshooting

If you see "GA4 service account credentials not found", check:
1. The base64 encoding is correct (no line breaks)
2. The JSON is valid
3. The environment variable name is exactly `GA4_CREDENTIALS_JSON`