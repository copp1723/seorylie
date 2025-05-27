import fetch from 'node-fetch';

/**
 * Test script to demonstrate the manual report trigger functionality
 */
async function testReportTrigger() {
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
      body: JSON.stringify({ description: 'Report Trigger Test' })
    });
    
    const apiKeyData = await apiKeyResponse.json();
    const apiKey = apiKeyData.key;
    console.log(`API Key generated: ${apiKey}`);
    
    // Create a test schedule
    console.log("\nCreating a test schedule for reference...");
    const scheduleResponse = await fetch(`http://localhost:5000/api/dealerships/${dealership.id}/reports/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        recipientEmails: ['manager@example.com'],
        frequency: 'daily',
        timeOfDay: '09:00',
        includeStatus: ['active', 'escalated', 'completed']
      })
    });
    
    const scheduleData = await scheduleResponse.json();
    console.log("Schedule created:", scheduleData);
    
    // Test manual report trigger
    console.log("\n----- TESTING MANUAL REPORT TRIGGER -----");
    const triggerResponse = await fetch('http://localhost:5000/api/reports/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
    });
    
    const triggerResult = await triggerResponse.json();
    console.log("Report trigger result:", triggerResult);
    
    // Clean up - delete the test schedule
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
    
    console.log("\n----- REPORT TRIGGER TEST COMPLETED -----");
    
  } catch (error) {
    console.error("Error during report trigger test:", error);
  }
}

// Run the test
testReportTrigger();