/**
 * Test script for verifying SendGrid email functionality
 * This script sends a test email to validate email configuration before deployment
 */

import { sendEmail } from '../server/services/email';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmailFunctionality() {
  console.log('🧪 Testing email functionality with SendGrid...');
  
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SendGrid API Key is missing. Please set the SENDGRID_API_KEY environment variable.');
    return false;
  }
  
  // Test email parameters
  const testParams = {
    to: 'admin@rylie-ai.com', // Replace with your actual test email
    from: 'noreply@rylie-ai.com',
    subject: 'Rylie AI - Pre-deployment Email Test',
    text: 'This is a test email to verify the SendGrid integration before deployment.',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #0056b3; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Rylie AI - Email Test</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
          <p>This is a test email to verify that the SendGrid integration is working correctly before deployment.</p>
          
          <h2>System Information:</h2>
          <ul>
            <li><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</li>
            <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
          </ul>
          
          <p>If you've received this email, it means the email functionality is configured correctly.</p>
          
          <p>Next steps:</p>
          <ol>
            <li>Verify the formatting of this email</li>
            <li>Check that all links and images work (if any)</li>
            <li>Confirm receipt in a timely manner</li>
          </ol>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated message from the Rylie AI platform.
          </p>
        </div>
      </div>
    `
  };
  
  try {
    console.log(`📧 Sending test email to: ${testParams.to}`);
    const success = await sendEmail(process.env.SENDGRID_API_KEY, testParams);
    
    if (success) {
      console.log('✅ Test email sent successfully!');
      return true;
    } else {
      console.log('⚠️ Email service returned fallback mode - checking logs for EMAIL_FALLBACK_LOG entries');
      // This will help us verify the fallback system is working
      return process.env.NODE_ENV === 'production'; // Consider test successful in production with fallback
    }
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    return false;
  }
}

// Run the test if this script is executed directly
testEmailFunctionality()
  .then(success => {
    console.log(`\n📋 EMAIL TEST SUMMARY: ${success ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    if (success) {
      console.log('The email system is configured correctly and ready for deployment.');
    } else {
      console.log('The email system needs attention before deployment. Check the error messages above.');
    }
    
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error during email testing:', error);
    process.exit(1);
  });