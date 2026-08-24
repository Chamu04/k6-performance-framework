import http from 'k6/http';
import { check, sleep } from 'k6';

// Import reporting tools for HTML and Jenkins (XML)
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary, jUnit } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// ============================================================================
// 1. CONFIGURATION (The Permanent Rules & Fail Cases)
// ============================================================================
export const options = {
  // Virtual User (VU) Stages: Ramp-up, Steady State, Ramp-down
  stages: [
    { duration: '10s', target: 5 },  // Scale up to 5 users over 10 seconds
    { duration: '20s', target: 5 },  // Hold at 5 users for 20 seconds
    { duration: '10s', target: 0 },  // Scale back down to 0 users
  ],

  // THRESHOLDS: These are your hard "Fail Cases". 
  // If these are breached, the test fails and Jenkins will turn red.
  thresholds: {
    // 95% of requests < 500ms AND 99% of requests < 800ms
    http_req_duration: ['p(95)<500', 'p(99)<800'],
    // The error rate must be strictly less than 1%
    http_req_failed: ['rate<0.01'],
  },

  // Force the terminal to display the p(99) metric
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Accept dynamic URL from the command line, or use a safe default
const TARGET_URL = __ENV.TARGET_URL || 'https://httpbin.test.k6.io/get';

// ============================================================================
// 2. EXECUTION (The Logic Each User Runs)
// ============================================================================
export default function () {
  // The Virtual User makes a GET request to the URL
  const response = http.get(TARGET_URL);

  // CHECKS: These are "Soft Asserts". 
  // If a check fails, the test continues, but logs the failure in the report.
  check(response, {
    'Response status is 200': (res) => res.status === 200,
    'Response time is under 800ms': (res) => res.timings.duration < 800,
  });

  // Think Time: The user pauses for 1 second before looping again
  sleep(1);
}

// ============================================================================
// 3. REPORTING (Triggered once at the end)
// ============================================================================
export function handleSummary(data) {
  return {
    // Generate the Visual HTML Report
    'reports/summary.html': htmlReport(data),
    // Generate the XML file for Jenkins Historical Trends
    'reports/junit.xml': jUnit(data),
    // Print the standard output to the console
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}