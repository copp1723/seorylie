/**
 * Test script for the inventory TSV import functionality using real dealership data
 * This script processes a sample of real inventory data to test the import process
 */

import fetch from 'node-fetch';
import { storage } from '../server/storage';
import fs from 'fs';
import path from 'path';

// Helper for API requests
async function apiRequest(endpoint: string, method = 'GET', body?: any) {
  try {
    // Get the API key first
    const dealerships = await storage.getDealerships();
    if (!dealerships || dealerships.length === 0) {
      throw new Error('No dealerships found in the database');
    }

    const dealershipId = dealerships[0].id;
    
    // Get or create an API key for testing
    let apiKeys = await storage.getApiKeysByDealership(dealershipId);
    let apiKey;
    
    if (!apiKeys || apiKeys.length === 0) {
      console.log('No API key found, creating one...');
      const apiKeyData = await storage.generateApiKey(dealershipId, 'Test API Key');
      apiKey = apiKeyData.key;
    } else {
      apiKey = apiKeys[0].key;
    }

    // Make the API request
    const url = `http://localhost:5000${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error('API request error:', error);
    return { error: error.message };
  }
}

// Create a file with sample data from the actual dealership format
function createSampleDealershipFile(): string {
  const filePath = path.join(__dirname, 'sample_dealership_inventory.tsv');
  
  // Sample from the real dealership inventory
  const content = [
    'Condition\tYear\tMake\tModel\tVIN\tAdvertiser Name\tColor\tDescription\tDoors\tDrivetrain\tFormatted Price\tFuel Type\tImage Type\tImage URL\tMileage\tPrice\tTitle\tTransmission\tTrim\tType\tURL\tVehicle Type\tstock_number',
    'New\t2024\tHyundai\tIoniq 5\tKM8KRDDF3RU249012\tWorld Hyundai of Matteson\tWhite\tNew 2024 Hyundai Ioniq 5\t4\tAWD\t$59,277\tElectric\tStock\thttps://storage.googleapis.com/wackk-images-production-4f204ab/qnahp9rkvpo3adppu9kjfph2slto\t10\t$59,277.00\tNew 2024 Hyundai Ioniq 5 Limited AWD\tAutomatic\tLimited AWD\tSUV\thttps://worldhyundaimatteson.com/inventory/--Hyundai-KM8KRDDF3RU249012\tCar_Truck\t25713',
    'New\t2024\tHyundai\tIoniq 6\tKMHM34AC1RA060199\tWorld Hyundai of Matteson\tGrey\tNew 2024 Hyundai Ioniq 6\t4\tRWD\t$51,378\tElectric\tStock\thttps://storage.googleapis.com/wackk-images-production-4f204ab/olfqnfy1akji412u72x30v3riav5\t12\t$51,378.00\tNew 2024 Hyundai Ioniq 6 SEL AWD\tAutomatic\tSEL AWD\tSedan\thttps://worldhyundaimatteson.com/inventory/--Hyundai-KMHM34AC1RA060199\tCar_Truck\t25881',
    'New\t2024\tHyundai\tPalisade\tKM8R3DGE8RU801493\tWorld Hyundai of Matteson\tBlue\tNew 2024 Hyundai Palisade\t4\tAWD\t$44,028\tGasoline\tStock\thttps://storage.googleapis.com/wackk-images-production-4f204ab/0m3lz27eyc0h2pdha1m6uy7syjw8\t119\t$44,028.00\tNew 2024 Hyundai Palisade XRT AWD\tAutomatic\tXRT AWD\tSUV\thttps://worldhyundaimatteson.com/inventory/--Hyundai-KM8R3DGE8RU801493\tCar_Truck\tDT25256',
    'New\t2024\tHyundai\tPalisade\tKM8R4DGE8RU765916\tWorld Hyundai of Matteson\tBlack\tNew 2024 Hyundai Palisade\t4\tAWD\t$47,371\tGasoline\tStock\thttps://storage.googleapis.com/wackk-images-production-4f204ab/u3mpqm6s614mbrmercf4bauuy7ch\t11\t$47,371.00\tNew 2024 Hyundai Palisade SEL AWD\tAutomatic\tSEL AWD\tSUV\thttps://worldhyundaimatteson.com/inventory/--Hyundai-KM8R4DGE8RU765916\tCar_Truck\t26609',
    'New\t2024\tHyundai\tPalisade\tKM8R5DGE6RU737299\tWorld Hyundai of Matteson\tBrown\tNew 2024 Hyundai Palisade\t4\tFWD\t$50,965\tGasoline\tStock\thttps://storage.googleapis.com/wackk-images-production-4f204ab/pycod922mc14ux49e07hqgk43rl3\t20\t$50,965.00\tNew 2024 Hyundai Palisade Limited AWD\tAutomatic\tLimited AWD\tSUV\thttps://worldhyundaimatteson.com/inventory/--Hyundai-KM8R5DGE6RU737299\tCar_Truck\t26240',
    'New\t2025\tHyundai\tSanta Fe\t5NMP5DG19SH017565\tWorld Hyundai of Matteson\tWhite\tNew 2025 Hyundai Santa Fe\t5\t4X4\t$50,627\tGasoline\tStock\thttps://storage.googleapis.com/wackk-images-production-4f204ab/a1ub1j0idiooa71mkbdukxh5ecwu\t8\t$50,627.00\tNew 2025 Hyundai Santa Fe Calligraphy\t\tCalligraphy\tSUV\thttps://worldhyundaimatteson.com/inventory/--Hyundai-5NMP5DG19SH017565\tCar_Truck\t27251',
    'Used\t2021\tHyundai\tSanta Fe\t5NMS3DAJ6MH322835\tWorld Hyundai of Matteson\tBlue\tUsed 2021 Hyundai Santa Fe\t4\tAWD\t$25,983\tGasoline\tStock\thttps://storage.googleapis.com/wackk-images-production-4f204ab/j2h62k5osjodkkdcmrjn0t8uqtqz\t56825\t$25,983.00\tUsed 2021 Hyundai Santa Fe Limited AWD\tAutomatic\tLimited AWD\tSUV\thttps://worldhyundaimatteson.com/inventory/2021-Hyundai-Santa%20Fe-5NMS3DAJ6MH322835\tCar_Truck\t27170A',
    'Used\t2018\tHyundai\tKona\tKM8K1CAA5JU128341\tWorld Hyundai of Matteson\tDark Gray\tUsed 2018 Hyundai Kona\t4\tAWD\t$22,995\tGasoline\tDealer\thttps://worldhyundaimatteson.com/new/Hyundai/2024-Hyundai-Kona-09fa18c20a0e0ae914cc66dbb7254cc4.htm\t40201\t$22,995.00\tUsed 2018 Hyundai Kona Limited AWD\tAutomatic\tLimited AWD\tSUV\thttps://worldhyundaimatteson.com/inventory/2018-Hyundai-Kona-KM8K1CAA5JU128341\tCar_Truck\t26865A'
  ].join('\n');
  
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Test the inventory import API with real dealership data
async function testRealDealershipInventoryImport() {
  console.log('Creating sample TSV file with real dealership format...');
  const filePath = createSampleDealershipFile();
  
  try {
    // Get the first dealership for testing
    const dealerships = await storage.getDealerships();
    if (!dealerships || dealerships.length === 0) {
      throw new Error('No dealerships found in the database');
    }
    
    const dealershipId = dealerships[0].id;
    console.log(`Using dealership ID: ${dealershipId}`);
    
    // Read the TSV file
    const tsvContent = fs.readFileSync(filePath, 'utf8');
    
    // Send the file to the API
    console.log('Sending inventory data to API...');
    const response = await apiRequest('/api/inventory/import/tsv', 'POST', {
      dealershipId,
      attachmentContent: tsvContent,
      fileName: 'real_dealership_sample.tsv',
      emailSubject: 'Daily Inventory Update',
      emailSender: 'inventory@dealer-system.com',
      emailDate: new Date().toISOString()
    });
    
    console.log('API Response:', JSON.stringify(response, null, 2));
    
    // Get inventory stats
    console.log('Getting inventory stats...');
    const statsResponse = await apiRequest('/api/inventory/import/stats', 'GET');
    
    console.log('Inventory Stats:', JSON.stringify(statsResponse, null, 2));
    
    // Get the vehicles to verify import
    console.log('Verifying imported vehicles...');
    const vehicles = await storage.getVehiclesByDealership(dealershipId);
    
    console.log(`Found ${vehicles.length} vehicles in the database`);
    vehicles.forEach((vehicle, index) => {
      console.log(`Vehicle ${index + 1}: ${vehicle.year} ${vehicle.make} ${vehicle.model} (VIN: ${vehicle.vin})`);
      console.log(`  Price: $${vehicle.price}, Color: ${vehicle.exteriorColor}, Condition: ${vehicle.condition}`);
      console.log(`  URL: ${vehicle.url}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up the sample file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Sample TSV file deleted');
    }
  }
}

// Run the test
console.log('Real Dealership Inventory Import Test');
console.log('=====================================');
testRealDealershipInventoryImport().catch(console.error);