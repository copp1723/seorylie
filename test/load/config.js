// Load Testing Configuration
export const config = {
  // Base URL for the application
  baseUrl: __ENV.BASE_URL || 'http://localhost:3000',

  // Test scenarios configuration
  scenarios: {
    light_load: {
      users: 20,
      duration: '2m',
      rampUp: '30s'
    },
    medium_load: {
      users: 50,
      duration: '3m',
      rampUp: '1m'
    },
    heavy_load: {
      users: 100,
      duration: '5m',
      rampUp: '2m'
    }
  },

  // Performance thresholds
  thresholds: {
    // 95% of requests should be below 1000ms
    http_req_duration: ['p(95)<1000'],
    // 99% of requests should be below 2000ms
    'http_req_duration{expected_response:true}': ['p(99)<2000'],
    // Error rate should be below 1%
    http_req_failed: ['rate<0.01'],
    // WebSocket connection success rate
    ws_connecting: ['p(95)<500'],
    // Chat message latency
    chat_message_duration: ['p(95)<500'],
  },

  // Test data
  testData: {
    dealerships: [
      { id: 1, subdomain: 'test-dealership-1' },
      { id: 2, subdomain: 'test-dealership-2' },
      { id: 3, subdomain: 'test-dealership-3' }
    ],
    users: [
      { username: 'testuser1', password: 'testpass123' },
      { username: 'testuser2', password: 'testpass123' },
      { username: 'testuser3', password: 'testpass123' }
    ],
    vehicles: [
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2023,
        vin: 'TEST123456789ABCD',
        price: 25000,
        condition: 'new'
      },
      {
        make: 'Honda',
        model: 'Civic',
        year: 2022,
        vin: 'TEST987654321EFGH',
        price: 22000,
        condition: 'used'
      }
    ]
  },

  // Database configuration for direct queries
  database: {
    host: __ENV.DB_HOST || 'localhost',
    port: __ENV.DB_PORT || 5432,
    database: __ENV.DB_NAME || 'rylie',
    user: __ENV.DB_USER || 'postgres',
    password: __ENV.DB_PASSWORD || 'postgres'
  }
};

// Utility functions for load testing
export function getRandomDealership() {
  const dealerships = config.testData.dealerships;
  return dealerships[Math.floor(Math.random() * dealerships.length)];
}

export function getRandomUser() {
  const users = config.testData.users;
  return users[Math.floor(Math.random() * users.length)];
}

export function getRandomVehicle() {
  const vehicles = config.testData.vehicles;
  const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
  // Generate unique VIN for each test
  return {
    ...vehicle,
    vin: vehicle.vin + Math.random().toString(36).substr(2, 9).toUpperCase()
  };
}

export function generateChatMessage() {
  const messages[] = [
    "Hello, I'm interested in your vehicles",
    "Do you have any Toyota Camry available?",
    "What's the price range for used cars?",
    "Can I schedule a test drive?",
    "What financing options do you offer?",
    "I'm looking for a reliable family car",
    "Do you accept trade-ins?",
    "What's your warranty policy?",
    "Can you tell me about this vehicle's history?",
    "I'd like to speak with a sales representative"
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function sleep(seconds) {
  return new Promise<void>((resolve: () => void) => setTimeout(resolve, seconds * 1000));
}

// Performance monitoring utilities
export function startTimer() {
  return Date.now();
}

export function endTimer(startTime) {
  return Date.now() - startTime;
}

// Note: Custom metrics are defined in individual test files
// This avoids import issues with k6 modules in the config file
