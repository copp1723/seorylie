/**
 * Test script for the inventory TSV import functionality
 * This script simulates receiving a TSV file and processing it
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as csv from 'csv-parser';
import { db } from '../server/db';
import { vehicles, dealerships } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Create readline interface for interactive mode
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for input
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to make API requests to the server
async function apiRequest(endpoint: string, method = 'GET', body?: any) {
  try {
    const url = `http://localhost:5000/api${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API request failed: ${data.message || response.statusText}`);
    }
    
    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// Function to create a sample TSV file for testing
function createSampleTsvFile(): string {
  const tempDir = path.join(process.cwd(), 'test-data');
  const filePath = path.join(tempDir, `inventory-sample-${Date.now()}.tsv`);
  
  // Create a very simple inventory TSV with a few vehicles
  const fileContent = `Condition\tYear\tMake\tModel\tVIN\tAdvertiser Name\tColor\tDescription\tDoors\tDrivetrain\tFormatted Price\tFuel Type\tImage Type\tImage URL\tMileage\tPrice\tTitle\tTransmission\tTrim\tType\tURL\tVehicle Type\tstock_number
New\t2024\tHyundai\tSanta Fe\t5NMP5DGL3RH067292\tTest Dealership\tWhite\tNew 2024 Hyundai Santa Fe\t4\tAWD\t$49,198\tGasoline\tStock\thttps://example.com/image1.jpg\t12\t$49,198.00\tNew 2024 Hyundai Santa Fe Calligraphy AWD\tAutomatic\tCalligraphy AWD\tSUV\thttps://example.com/vehicle1\tCar_Truck\t27181
New\t2024\tHyundai\tTucson\t5NMJECDE3RH437937\tTest Dealership\tBurgundy\tNew 2024 Hyundai Tucson\t4\tAWD\t$39,202\tGasoline\tStock\thttps://example.com/image2.jpg\t9\t$39,202.00\tNew 2024 Hyundai Tucson Limited AWD\tAutomatic\tLimited AWD\tSUV\thttps://example.com/vehicle2\tCar_Truck\t26989
Pre-Owned\t2022\tHyundai\tSanta Fe\tABC123456789XYZ\tTest Dealership\tBlue\tPre-Owned 2022 Hyundai Santa Fe\t4\tFWD\t$32,995\tGasoline\tStock\thttps://example.com/image3.jpg\t24500\t$32,995.00\tPre-Owned 2022 Hyundai Santa Fe SE\tAutomatic\tSE\tSUV\thttps://example.com/vehicle3\tCar_Truck\t25001
Pre-Owned\t2021\tToyota\tRAV4\tXYZ987654321ABC\tTest Dealership\tSilver\tPre-Owned 2021 Toyota RAV4\t4\tAWD\t$28,750\tGasoline\tStock\thttps://example.com/image4.jpg\t32750\t$28,750.00\tPre-Owned 2021 Toyota RAV4 XLE AWD\tAutomatic\tXLE AWD\tSUV\thttps://example.com/vehicle4\tCar_Truck\t24890`;
  
  fs.writeFileSync(filePath, fileContent);
  console.log(`Created sample TSV file at: ${filePath}`);
  
  return filePath;
}

// Function to test inventory import
async function testInventoryImport() {
  console.log('\n=== Rylie AI Inventory Import Test ===\n');
  
  // First check if we have dealerships in the database
  const existingDealerships = await db.select().from(dealerships);
  
  if (!existingDealerships.length) {
    console.log('No dealerships found in the database. Creating a test dealership...');
    
    // Create a test dealership
    await db.insert(dealerships).values({
      name: 'Test Dealership',
      address: '123 Test Street',
      city: 'Testville',
      state: 'TS',
      zip: '12345',
      phone: '(555) 123-4567',
      website: 'https://example.com',
      email: 'test@example.com'
    });
    
    console.log('Test dealership created.');
  }
  
  // Get all dealerships to select one for the test
  const dealershipList = await db.select().from(dealerships);
  
  console.log('\nAvailable dealerships:');
  dealershipList.forEach((dealership, index) => {
    console.log(`${index + 1}. ${dealership.name} (ID: ${dealership.id})`);
  });
  
  const dealershipIndex = parseInt(await prompt('\nSelect dealership to import inventory for (number): ')) - 1;
  const selectedDealership = dealershipList[dealershipIndex] || dealershipList[0];
  
  console.log(`\nSelected dealership: ${selectedDealership.name} (ID: ${selectedDealership.id})`);
  
  // Ask if the user wants to use an existing file or create a sample
  const useExistingFile = (await prompt('\nUse existing inventory TSV file? (y/n): ')).toLowerCase() === 'y';
  
  let tsvFilePath;
  
  if (useExistingFile) {
    tsvFilePath = await prompt('\nEnter the path to the TSV file: ');
  } else {
    tsvFilePath = createSampleTsvFile();
  }
  
  // Confirm the import
  const confirmImport = (await prompt(`\nImport inventory from ${tsvFilePath} for ${selectedDealership.name}? (y/n): `)).toLowerCase() === 'y';
  
  if (!confirmImport) {
    console.log('Import cancelled.');
    rl.close();
    return;
  }
  
  console.log('\nImporting inventory...');
  
  // Count current vehicles
  const currentVehicles = await db.select().from(vehicles).where(eq(vehicles.dealershipId, selectedDealership.id));
  console.log(`Current vehicle count for dealership: ${currentVehicles.length}`);
  
  // Import the inventory
  // Read the TSV file
  const rows: any[] = [];
  
  fs.createReadStream(tsvFilePath)
    .pipe(csv({ separator: '\t' }))
    .on('data', (row) => {
      rows.push(row);
    })
    .on('end', async () => {
      console.log(`Read ${rows.length} vehicles from TSV file.`);
      
      // Prepare the vehicles for import
      const vehiclesToImport = rows.map(row => ({
        dealershipId: selectedDealership.id,
        vin: row.VIN,
        make: row.Make,
        model: row.Model,
        year: parseInt(row.Year),
        trim: row.Trim,
        color: row.Color,
        mileage: parseFloat(row.Mileage),
        price: parseFloat(row.Price?.replace(/[^0-9.]/g, '') || '0'),
        condition: row.Condition,
        drivetrain: row.Drivetrain,
        transmission: row.Transmission,
        fuelType: row['Fuel Type'],
        doors: parseInt(row.Doors) || 4,
        type: row.Type,
        stockNumber: row.stock_number,
        description: row.Description,
        imageUrl: row['Image URL'],
        vehicleUrl: row.URL
      }));
      
      // Process in batches to avoid overwhelming the database
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < vehiclesToImport.length; i += batchSize) {
        batches.push(vehiclesToImport.slice(i, i + batchSize));
      }
      
      console.log(`Processing ${batches.length} batches of vehicles...`);
      
      let importedCount = 0;
      
      for (const [index, batch] of batches.entries()) {
        console.log(`Importing batch ${index + 1}/${batches.length}...`);
        
        for (const vehicle of batch) {
          try {
            // Check if the vehicle already exists
            const existingVehicle = await db
              .select()
              .from(vehicles)
              .where(eq(vehicles.vin, vehicle.vin));
            
            if (existingVehicle.length > 0) {
              // Update the vehicle
              await db
                .update(vehicles)
                .set(vehicle)
                .where(eq(vehicles.vin, vehicle.vin));
              
              console.log(`Updated vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.vin})`);
            } else {
              // Insert the vehicle
              await db
                .insert(vehicles)
                .values(vehicle);
              
              console.log(`Imported vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.vin})`);
            }
            
            importedCount++;
          } catch (error) {
            console.error(`Error importing vehicle ${vehicle.vin}:`, error);
          }
        }
      }
      
      console.log(`\nImport completed. Imported/updated ${importedCount} vehicles.`);
      
      // Count updated vehicles
      const updatedVehicles = await db.select().from(vehicles).where(eq(vehicles.dealershipId, selectedDealership.id));
      console.log(`New vehicle count for dealership: ${updatedVehicles.length}`);
      
      rl.close();
    });
}

// Main function
async function main() {
  try {
    await testInventoryImport();
  } catch (error) {
    console.error('Error during inventory import test:', error);
  } finally {
    rl.close();
  }
}

// Run the test directly
main();

export { testInventoryImport };