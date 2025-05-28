# Performance & Load Testing Suite

This directory contains comprehensive performance and load testing tools for the Rylie application, implementing the requirements from **Ticket #15: Performance & Load Basic Testing**.

## Overview

The testing suite includes:
- **API Load Testing**: Tests REST endpoints under various loads (20, 50, 100 concurrent users)
- **WebSocket/Chat Load Testing**: Tests real-time chat functionality and AI conversation flows
- **Inventory Load Testing**: Tests bulk operations and complex database queries
- **Database Performance Monitoring**: Tracks query performance and identifies bottlenecks
- **System Resource Monitoring**: Monitors CPU, memory, and network usage during tests

## Prerequisites

1. **k6 Load Testing Tool**: Already installed via Homebrew
   ```bash
   brew install k6  # Already done
   ```

2. **Application Running**: Ensure the Rylie application is running locally
   ```bash
   npm run dev
   ```

3. **Database Setup**: Ensure PostgreSQL is running and accessible

## Quick Start

### 1. Setup Test Data
```bash
# Create test dealerships, users, vehicles, and conversations
npm run test:setup-data

# Verify test data was created
npm run test:verify-data
```

### 2. Run Individual Load Tests
```bash
# API endpoints load test
npm run test:load:api

# WebSocket/Chat load test  
npm run test:load:chat

# Inventory operations load test
npm run test:load:inventory

# Complete load test suite
npm run test:load
```

### 3. Run Comprehensive Performance Testing
```bash
# Full performance test suite with monitoring
npm run test:performance:full
```

### 4. Cleanup Test Data
```bash
# Remove test data after testing
npm run test:cleanup-data
```

## Test Configuration

### Load Test Scenarios

#### API Load Test (`test/load/api-load-test.js`)
- **Light Load**: 20 concurrent users for 2 minutes
- **Medium Load**: 50 concurrent users for 3 minutes  
- **Heavy Load**: 100 concurrent users for 5 minutes

**Endpoints Tested**:
- Authentication (`/api/login`)
- Vehicle search (`/api/vehicles`)
- Admin endpoints (`/api/admin/*`)
- Health monitoring (`/api/metrics/health`)

#### Chat Load Test (`test/load/chat-load-test.js`)
- **WebSocket Connections**: Up to 50 concurrent connections
- **Message Throughput**: Multiple messages per connection
- **AI Conversation Flow**: Customer inquiries and AI responses
- **Agent Handover**: Escalation scenarios

#### Inventory Load Test (`test/load/inventory-load-test.js`)
- **Bulk Operations**: Up to 25 concurrent users
- **Complex Searches**: Multi-filter inventory queries
- **Bulk Imports**: CSV file uploads with 50+ vehicles
- **Concurrent Updates**: Simultaneous inventory modifications

### Performance Thresholds

#### Success Criteria (from Ticket #15)
- ✅ **API Response Time**: 95% of requests < 1000ms under 50 concurrent users
- ✅ **WebSocket Latency**: 95% of connections < 500ms
- ✅ **Database Queries**: Complex queries < 2000ms
- ✅ **Error Rate**: < 1% failed requests
- ✅ **Memory Stability**: No memory leaks, stable resource usage

#### Monitoring Thresholds
```javascript
thresholds: {
  http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  http_req_failed: ['rate<0.01'],
  ws_connecting: ['p(95)<500'],
  chat_message_duration: ['p(95)<500'],
}
```

## Test Files Structure

```
test/
├── load/
│   ├── config.js                 # Shared configuration and utilities
│   ├── api-load-test.js          # REST API load testing
│   ├── chat-load-test.js         # WebSocket/Chat load testing
│   ├── inventory-load-test.js    # Inventory operations load testing
│   └── load-test-suite.js        # Combined test suite
├── performance/
│   ├── db-performance-monitor.ts  # Database performance monitoring
│   ├── run-performance-tests.ts   # Comprehensive test runner
│   ├── setup-test-data.ts         # Test data management
│   └── README.md                  # This file
└── reports/                       # Generated test reports (auto-created)
```

## Test Data

The test suite creates realistic test data:

- **3 Test Dealerships**: Multi-tenant testing
- **5 Users per Dealership**: Admin and agent roles
- **100 Vehicles per Dealership**: Various makes, models, conditions
- **50 Conversations per Dealership**: With realistic message threads

## Monitoring & Reports

### Real-time Monitoring
- **Database Query Performance**: Tracks slow queries (>100ms)
- **Memory Usage**: Monitors heap usage every 5 seconds
- **System Resources**: CPU and load average tracking
- **WebSocket Connections**: Connection success rates and latency

### Generated Reports
- **HTML Reports**: Visual performance dashboards
- **JSON Reports**: Detailed metrics for analysis
- **Database Reports**: Query performance analysis
- **Recommendations**: Automated bottleneck identification

### Report Locations
```
test/performance/
├── load-test-report-[timestamp].html
├── load-test-summary-[timestamp].json
├── db-performance-report-[timestamp].json
└── performance-test-report-[timestamp].json
```

## Bottleneck Identification

The test suite automatically identifies:

1. **Slow Endpoints**: APIs taking >1s under load
2. **Database Issues**: Queries exceeding thresholds
3. **Memory Leaks**: Increasing memory usage patterns
4. **WebSocket Problems**: Connection failures or high latency
5. **Concurrency Issues**: Race conditions or deadlocks

## Environment Variables

Configure testing with environment variables:

```bash
# Application URL
export BASE_URL=http://localhost:5000

# Database connection (for direct monitoring)
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=rylie
export DB_USER=postgres
export DB_PASSWORD=your_password
```

## Troubleshooting

### Common Issues

1. **k6 Command Not Found**
   ```bash
   brew install k6
   ```

2. **Application Not Running**
   ```bash
   npm run dev
   # Wait for "Server running on port 5000"
   ```

3. **Database Connection Issues**
   - Verify PostgreSQL is running
   - Check DATABASE_URL environment variable
   - Ensure test data setup completed successfully

4. **WebSocket Connection Failures**
   - Check if WebSocket server is enabled
   - Verify port 5000 is accessible
   - Look for CORS or firewall issues

### Performance Issues

If tests are failing thresholds:

1. **Check Database Indexes**: Run `npm run db:studio` to verify indexes
2. **Monitor System Resources**: Use Activity Monitor during tests
3. **Review Slow Queries**: Check PostgreSQL logs
4. **Analyze Memory Usage**: Look for memory leak patterns

## Integration with CI/CD

Add to your CI pipeline:

```yaml
- name: Setup Test Data
  run: npm run test:setup-data

- name: Run Performance Tests
  run: npm run test:performance:full

- name: Cleanup Test Data
  run: npm run test:cleanup-data
```

## Next Steps

After running the performance tests:

1. **Review Reports**: Analyze generated HTML and JSON reports
2. **Address Bottlenecks**: Implement recommended optimizations
3. **Monitor Production**: Set up similar monitoring in production
4. **Regular Testing**: Schedule periodic performance testing
5. **Scale Planning**: Use results to plan infrastructure scaling

## Support

For issues with the performance testing suite:
1. Check the troubleshooting section above
2. Review generated error logs in test reports
3. Verify all prerequisites are met
4. Check application logs for errors during testing
