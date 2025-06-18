const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 GA4 Service Account Setup (Simple Version)');
console.log('============================================\n');

console.log('To use real GA4 data, you need a service account JSON file from Google Cloud Console.');
console.log('Without it, the analytics dashboard will show mock data.\n');

console.log('Steps to get a service account:');
console.log('1. Go to https://console.cloud.google.com');
console.log('2. Create/select a project');
console.log('3. Enable the Google Analytics Data API');
console.log('4. Create a service account with Analytics Reader role');
console.log('5. Download the JSON key file\n');

rl.question('Do you have a service account JSON file? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    rl.question('Enter the path to your service account JSON file: ', (jsonPath) => {
      try {
        // Read and validate the JSON file
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const credentials = JSON.parse(jsonContent);
        
        // Validate required fields
        const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
        const missingFields = requiredFields.filter(field => !credentials[field]);
        
        if (missingFields.length > 0) {
          console.error('❌ Invalid service account file. Missing fields:', missingFields.join(', '));
          process.exit(1);
        }
        
        // Create credentials directory
        const credentialsDir = path.join(__dirname, 'credentials');
        if (!fs.existsSync(credentialsDir)) {
          fs.mkdirSync(credentialsDir, { recursive: true });
        }
        
        // Save the credentials
        const targetPath = path.join(credentialsDir, 'ga4-service-account.json');
        fs.writeFileSync(targetPath, jsonContent);
        
        // Set environment variable
        console.log('\n✅ Service account credentials saved!');
        console.log(`📁 Location: ${targetPath}`);
        console.log('\nTo use these credentials, set the environment variable:');
        console.log(`export GOOGLE_APPLICATION_CREDENTIALS="${targetPath}"`);
        console.log('\nOr add to your .env file:');
        console.log(`GOOGLE_APPLICATION_CREDENTIALS=${targetPath}`);
        
        // Add to .gitignore if not already there
        const gitignorePath = path.join(__dirname, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
          if (!gitignoreContent.includes('credentials/')) {
            fs.appendFileSync(gitignorePath, '\n# GA4 credentials\ncredentials/\n');
            console.log('\n📝 Added credentials/ to .gitignore');
          }
        }
        
        console.log('\n🎉 Setup complete! The GA4 dashboard will now show real data.');
        console.log('\nMake sure this service account has access to these GA4 properties:');
        console.log('- Property 1: 320759942');
        console.log('- Property 2: 317592148');
        
      } catch (error) {
        console.error('❌ Error setting up credentials:', error.message);
        process.exit(1);
      }
      
      rl.close();
    });
  } else {
    console.log('\n📊 No problem! The analytics dashboard will use mock data.');
    console.log('You can run this setup again later when you have the credentials.\n');
    
    // Create a README for credentials
    const credentialsDir = path.join(__dirname, 'credentials');
    if (!fs.existsSync(credentialsDir)) {
      fs.mkdirSync(credentialsDir, { recursive: true });
    }
    
    const readmePath = path.join(credentialsDir, 'README.md');
    const readmeContent = `# GA4 Credentials

This directory should contain your Google Analytics service account credentials.

## Setup Instructions

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable the Google Analytics Data API
4. Create a service account with Analytics Reader role
5. Download the JSON key file
6. Run: \`npm run setup:ga4-simple\`

## Properties

The application is configured to use these GA4 property IDs:
- Property 1: 320759942
- Property 2: 317592148

Make sure your service account has access to these properties in Google Analytics.
`;
    
    fs.writeFileSync(readmePath, readmeContent);
    console.log(`📝 Created ${readmePath} with setup instructions`);
    
    rl.close();
  }
});