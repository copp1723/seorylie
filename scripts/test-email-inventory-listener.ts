/**
 * Test script for the email inventory listener functionality
 * This simulates receiving an email with a TSV attachment
 */

import { simulateIncomingEmail } from '../server/services/email-listener';
import fs from 'fs';
import path from 'path';

// Create a sample TSV file for testing
function createSampleTsvFile(): string {
  const filePath = path.join(__dirname, 'sample_email_inventory.tsv');
  
  // Use the actual dealership inventory format
  const content = [
    'Condition\tYear\tMake\tModel\tVIN\tAdvertiser Name\tColor\tDescription\tDoors\tDrivetrain\tFormatted Price\tFuel Type\tImage Type\tImage URL\tMileage\tPrice\tTitle\tTransmission\tTrim\tType\tURL\tVehicle Type\tstock_number',
    'New\t2024\tHyundai\tIoniq 5\tKM8KRDDF3RU249012\tWorld Hyundai of Matteson\tWhite\tNew 2024 Hyundai Ioniq 5\t4\tAWD\t$59,277\tElectric\tStock\thttps://storage.googleapis.com/wackk-images-production-4f204ab/qnahp9rkvpo3adppu9kjfph2slto\t10\t$59,277.00\tNew 2024 Hyundai Ioniq 5 Limited AWD\tAutomatic\tLimited AWD\tSUV\thttps://worldhyundaimatteson.com/inventory/--Hyundai-KM8KRDDF3RU249012\tCar_Truck\t25713',
    'New\t2024\tHyundai\tIoniq 6\tKMHM34AC1RA060199\tWorld Hyundai of Matteson\tGrey\tNew 2024 Hyundai Ioniq 6\t4\tRWD\t$51,378\tElectric\tStock\thttps://storage.googleapis.com/wackk-images-production-4f204ab/olfqnfy1akji412u72x30v3riav5\t12\t$51,378.00\tNew 2024 Hyundai Ioniq 6 SEL AWD\tAutomatic\tSEL AWD\tSedan\thttps://worldhyundaimatteson.com/inventory/--Hyundai-KMHM34AC1RA060199\tCar_Truck\t25881',
    'New\t2024\tHyundai\tPalisade\tKM8R3DGE8RU801493\tWorld Hyundai of Matteson\tBlue\tNew 2024 Hyundai Palisade\t4\tAWD\t$44,028\tGasoline\tStock\thttps://storage.googleapis.com/wackk-images-production-4f204ab/0m3lz27eyc0h2pdha1m6uy7syjw8\t119\t$44,028.00\tNew 2024 Hyundai Palisade XRT AWD\tAutomatic\tXRT AWD\tSUV\thttps://worldhyundaimatteson.com/inventory/--Hyundai-KM8R3DGE8RU801493\tCar_Truck\tDT25256',
    'Used\t2021\tHyundai\tSanta Fe\t5NMS3DAJ6MH322835\tWorld Hyundai of Matteson\tBlue\tUsed 2021 Hyundai Santa Fe\t4\tAWD\t$25,983\tGasoline\tStock\thttps://storage.googleapis.com/wackk-images-production-4f204ab/j2h62k5osjodkkdcmrjn0t8uqtqz\t56825\t$25,983.00\tUsed 2021 Hyundai Santa Fe Limited AWD\tAutomatic\tLimited AWD\tSUV\thttps://worldhyundaimatteson.com/inventory/2021-Hyundai-Santa%20Fe-5NMS3DAJ6MH322835\tCar_Truck\t27170A',
    'Used\t2018\tHyundai\tKona\tKM8K1CAA5JU128341\tWorld Hyundai of Matteson\tDark Gray\tUsed 2018 Hyundai Kona\t4\tAWD\t$22,995\tGasoline\tDealer\thttps://worldhyundaimatteson.com/new/Hyundai/2024-Hyundai-Kona-09fa18c20a0e0ae914cc66dbb7254cc4.htm\t40201\t$22,995.00\tUsed 2018 Hyundai Kona Limited AWD\tAutomatic\tLimited AWD\tSUV\thttps://worldhyundaimatteson.com/inventory/2018-Hyundai-Kona-KM8K1CAA5JU128341\tCar_Truck\t26865A'
  ].join('\n');
  
  fs.writeFileSync(filePath, content);
  return filePath;
}

async function testEmailInventoryListener() {
  try {
    console.log('Creating sample TSV file...');
    const tsvFilePath = createSampleTsvFile();
    
    console.log('Simulating incoming email with TSV attachment...');
    const result = await simulateIncomingEmail(
      'inventory@dealership-system.com',
      'Daily Inventory Update - World Hyundai',
      tsvFilePath
    );
    
    console.log('Email processing result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Clean up
    if (fs.existsSync(tsvFilePath)) {
      fs.unlinkSync(tsvFilePath);
      console.log('Sample TSV file deleted');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
console.log('Email Inventory Listener Test');
console.log('=============================');
testEmailInventoryListener().catch(console.error);