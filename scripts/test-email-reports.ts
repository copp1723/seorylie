import fetch from 'node-fetch';

// Test script to demonstrate the email reporting functionality

async function testEmailReports() {
  try {
    // Get the first dealership
    console.log("Getting dealership...");
    const dealershipsResponse = await fetch('http://localhost:5000/api/dealerships');
    const dealerships = await dealershipsResponse.json();
    const dealership = dealerships[0];
    console.log(`Using dealership: ${dealership.name} (ID: ${dealership.id})`);
    
    // Generate a test API key
    console.log("\nGenerating a test API key...");
    const apiKeyResponse = await fetch(`http://localhost:5000/api/dealerships/${dealership.id}/apikeys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Email Reports Test' })
    });
    
    const apiKeyData = await apiKeyResponse.json();
    const apiKey = apiKeyData.key;
    console.log(`API Key generated: ${apiKey}`);
    
    // 1. Test creating a scheduled email report
    console.log("\n----- TESTING SCHEDULED EMAIL REPORTS -----");
    
    console.log("Creating a daily email report schedule...");
    const scheduleResponse = await fetch(`http://localhost:5000/api/dealerships/${dealership.id}/reports/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        recipientEmails: ['manager@example.com', 'sales@example.com'],
        frequency: 'daily',
        timeOfDay: '09:00',
        includeStatus: ['active', 'escalated']
      })
    });
    
    const scheduleData = await scheduleResponse.json();
    console.log("Schedule created:", scheduleData);
    
    // 2. Test retrieving scheduled reports
    console.log("\nRetrieving scheduled reports...");
    const getSchedulesResponse = await fetch(`http://localhost:5000/api/dealerships/${dealership.id}/reports/schedule`, {
      headers: {
        'X-API-Key': apiKey
      }
    });
    
    const schedulesData = await getSchedulesResponse.json();
    console.log(`Found ${schedulesData.length} scheduled reports:`, schedulesData);
    
    // 3. Test generating a report on demand
    console.log("\n----- TESTING ON-DEMAND EMAIL REPORTS -----");
    
    console.log("Generating a report for recent conversations...");
    const generateResponse = await fetch(`http://localhost:5000/api/dealerships/${dealership.id}/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        email: 'test@example.com',
        days: 7, // Conversations from the last 7 days
        status: ['active', 'escalated', 'completed']
      })
    });
    
    const generateData = await generateResponse.json();
    console.log("Report generation result:", generateData);
    
    // 4. Cleanup - delete the schedule we created
    if (scheduleData && scheduleData.id) {
      console.log(`\nCleaning up - deleting schedule ${scheduleData.id}...`);
      const deleteResponse = await fetch(`http://localhost:5000/api/dealerships/${dealership.id}/reports/schedule/${scheduleData.id}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': apiKey
        }
      });
      
      const deleteData = await deleteResponse.json();
      console.log("Delete result:", deleteData);
    }
    
    console.log("\n----- EMAIL REPORT TESTS COMPLETED -----");
    
  } catch (error) {
    console.error("Error during email report tests:", error);
  }
}

// Run the test
testEmailReports();