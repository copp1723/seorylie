import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { config, getRandomDealership, getRandomVehicle } from './config.js';

// Custom metrics
const inventoryImportTime = new Trend('inventory_import_time');
const bulkOperationTime = new Trend('bulk_operation_time');
const searchQueryTime = new Trend('search_query_time');
const importErrors = new Counter('import_errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Start with 5 users for bulk operations
    { duration: '1m', target: 5 },    // Stay at 5 users
    { duration: '30s', target: 15 },  // Ramp up to 15 users
    { duration: '2m', target: 15 },   // Stay at 15 users
    { duration: '30s', target: 25 },  // Ramp up to 25 users
    { duration: '2m', target: 25 },   // Stay at 25 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Inventory operations can be slower
    inventory_import_time: ['p(95)<5000'],
    bulk_operation_time: ['p(95)<3000'],
    search_query_time: ['p(95)<1000'],
    import_errors: ['rate<0.05'],
  },
};

export function setup() {
  console.log('Inventory Load Test Setup');
  
  // Generate test CSV data for bulk import
  const testCsvData = generateTestInventoryCSV(50); // 50 vehicles
  
  return { 
    baseUrl: config.baseUrl,
    testCsvData: testCsvData
  };
}

export default function(data) {
  const baseUrl = data.baseUrl;
  
  // Test 1: Individual vehicle operations
  testVehicleOperations(baseUrl);
  
  // Test 2: Bulk inventory search with complex filters
  testComplexInventorySearch(baseUrl);
  
  // Test 3: Bulk import simulation (every 10th iteration)
  if (__ITER % 10 === 0) {
    testBulkInventoryImport(baseUrl, data.testCsvData);
  }
  
  // Test 4: Concurrent inventory updates
  testInventoryUpdates(baseUrl);
  
  sleep(2); // Longer think time for inventory operations
}

function testVehicleOperations(baseUrl) {
  const dealership = getRandomDealership();
  
  // Test vehicle creation
  const vehicle = getRandomVehicle();
  const createPayload = {
    ...vehicle,
    dealershipId: dealership.id
  };
  
  const createResponse = http.post(
    `${baseUrl}/api/vehicles`,
    JSON.stringify(createPayload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(createResponse, {
    'vehicle creation status is 200, 201, or 401': (r) => 
      r.status === 200 || r.status === 201 || r.status === 401,
    'vehicle creation response time < 2000ms': (r) => r.timings.duration < 2000,
  });
  
  // If creation was successful, test update and delete
  if (createResponse.status === 201) {
    try {
      const createdVehicle = JSON.parse(createResponse.body);
      const vehicleId = createdVehicle.id;
      
      // Test vehicle update
      const updatePayload = {
        price: vehicle.price + 1000,
        status: 'available'
      };
      
      const updateResponse = http.put(
        `${baseUrl}/api/vehicles/${vehicleId}`,
        JSON.stringify(updatePayload),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
      
      check(updateResponse, {
        'vehicle update status is 200 or 401': (r) => r.status === 200 || r.status === 401,
        'vehicle update response time < 1500ms': (r) => r.timings.duration < 1500,
      });
      
    } catch (e) {
      console.log('Error parsing vehicle creation response:', e);
    }
  }
}

function testComplexInventorySearch(baseUrl) {
  const startTime = Date.now();
  
  // Test various complex search scenarios
  const searchScenarios = [
    // Multi-filter search
    '?make=Toyota&model=Camry&year=2023&minPrice=20000&maxPrice=35000&condition=new',
    // Text search with filters
    '?search=reliable family car&minPrice=15000&maxPrice=40000',
    // Sorting and pagination
    '?sortBy=price&sortOrder=desc&page=1&limit=20',
    // Year range search
    '?minYear=2020&maxYear=2024&condition=used',
    // Price range with make
    '?make=Honda&minPrice=18000&maxPrice=28000',
    // Status and condition filters
    '?status=available&condition=certified',
    // Complex text search
    '?search=SUV automatic transmission&minPrice=25000'
  ];
  
  const randomScenario = searchScenarios[Math.floor(Math.random() * searchScenarios.length)];
  
  const searchResponse = http.get(`${baseUrl}/api/vehicles${randomScenario}`);
  
  const searchDuration = Date.now() - startTime;
  searchQueryTime.add(searchDuration);
  
  check(searchResponse, {
    'complex search status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'complex search response time < 2000ms': (r) => r.timings.duration < 2000,
    'search results have pagination': (r) => {
      if (r.status === 200) {
        try {
          const body = JSON.parse(r.body);
          return body.pagination !== undefined;
        } catch (e) {
          return false;
        }
      }
      return true;
    },
  });
  
  // Test inventory analytics endpoint
  const analyticsResponse = http.get(`${baseUrl}/api/vehicles/analytics`);
  
  check(analyticsResponse, {
    'analytics status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'analytics response time < 1500ms': (r) => r.timings.duration < 1500,
  });
}

function testBulkInventoryImport(baseUrl, csvData) {
  const startTime = Date.now();
  
  // Create form data for file upload
  const formData = {
    file: http.file(csvData, 'test-inventory.csv', 'text/csv'),
  };
  
  const importResponse = http.post(`${baseUrl}/api/vehicles/import`, formData);
  
  const importDuration = Date.now() - startTime;
  inventoryImportTime.add(importDuration);
  
  check(importResponse, {
    'bulk import status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'bulk import response time < 10000ms': (r) => r.timings.duration < 10000,
    'import response has stats': (r) => {
      if (r.status === 200) {
        try {
          const body = JSON.parse(r.body);
          return body.stats !== undefined;
        } catch (e) {
          return false;
        }
      }
      return true;
    },
  });
  
  if (importResponse.status !== 200 && importResponse.status !== 401) {
    importErrors.add(1);
  }
}

function testInventoryUpdates(baseUrl) {
  const startTime = Date.now();
  
  // Test bulk status updates
  const bulkUpdatePayload = {
    vehicleIds: [1, 2, 3, 4, 5], // Test with some IDs
    updates: {
      status: 'available',
      lastUpdated: new Date().toISOString()
    }
  };
  
  const bulkUpdateResponse = http.patch(
    `${baseUrl}/api/vehicles/bulk-update`,
    JSON.stringify(bulkUpdatePayload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  const bulkDuration = Date.now() - startTime;
  bulkOperationTime.add(bulkDuration);
  
  check(bulkUpdateResponse, {
    'bulk update status is 200, 401, or 404': (r) => 
      r.status === 200 || r.status === 401 || r.status === 404,
    'bulk update response time < 3000ms': (r) => r.timings.duration < 3000,
  });
}

function generateTestInventoryCSV(vehicleCount) {
  const makes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'BMW', 'Mercedes', 'Audi'];
  const models = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Hatchback', 'Convertible'];
  const conditions = ['new', 'used', 'certified'];
  
  let csv = 'make,model,year,vin,price,condition,mileage,color,transmission\n';
  
  for (let i = 0; i < vehicleCount; i++) {
    const make = makes[Math.floor(Math.random() * makes.length)];
    const model = models[Math.floor(Math.random() * models.length)];
    const year = 2018 + Math.floor(Math.random() * 7); // 2018-2024
    const vin = `TEST${i.toString().padStart(13, '0')}`;
    const price = 15000 + Math.floor(Math.random() * 50000);
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const mileage = condition === 'new' ? 0 : Math.floor(Math.random() * 100000);
    const color = ['Black', 'White', 'Silver', 'Red', 'Blue'][Math.floor(Math.random() * 5)];
    const transmission = Math.random() > 0.2 ? 'Automatic' : 'Manual';
    
    csv += `${make},${model},${year},${vin},${price},${condition},${mileage},${color},${transmission}\n`;
  }
  
  return csv;
}

export function teardown(data) {
  console.log('Inventory Load Test Complete');
}
