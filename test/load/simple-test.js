import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 2, // 2 virtual users
  duration: '10s', // 10 seconds
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const baseUrl = 'http://localhost:5000';
  
  // Test health endpoint
  const healthResponse = http.get(`${baseUrl}/api/metrics/health`);
  check(healthResponse, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  sleep(1);
}
