import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary, jUnit } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// ============================================================================
// 1. TARGET FORM & ENDPOINT RESOLUTION
// ============================================================================
const envType = (__ENV.ENVIRONMENT_TYPE || 'Safe_Sandbox_Mock').trim();
const testServerId = (__ENV.TEST_SERVER_ID || 'test1').toLowerCase().trim();
const deviceType = (__ENV.DEVICE_TYPE || 'desktop').toLowerCase().trim();
const pathOrEndpoint = (__ENV.PATH_OR_ENDPOINT || '/order/ncf').trim();
const fullUrlOverride = (__ENV.FULL_URL_OVERRIDE || '').trim();

let resolvedUrl = 'https://httpbin.org/post'; // Default safe sandbox endpoint

if (fullUrlOverride !== '') {
  resolvedUrl = fullUrlOverride;
} else if (envType === 'Safe_Sandbox_Mock') {
  resolvedUrl = 'https://httpbin.org/post';
} else if (envType === 'Test_Server_Forms') {
  const cleanId = testServerId.startsWith('test') ? testServerId : `test${testServerId}`;
  
  // Automatically handles desktop vs mobile (/m/) paths for any form/endpoint
  resolvedUrl = deviceType === 'mobile'
    ? `https://${cleanId}.app.editage.com/m${pathOrEndpoint}`
    : `https://${cleanId}.app.editage.com${pathOrEndpoint}`;
}

// Self-Healing URL Sanitizer
const cleanUrlMatch = resolvedUrl.match(/https?:\/\/[^\s)]+/);
const TARGET_URL = cleanUrlMatch ? cleanUrlMatch[0] : 'https://httpbin.org/post';

// ============================================================================
// 2. DATA PREPARATION (CSV Parsing)
// ============================================================================
const csvData = new SharedArray('users', function () {
  return papaparse.parse(open('../data/users.csv'), { header: true, skipEmptyLines: true }).data;
});

// ============================================================================
// 3. CONFIGURATION (Dynamic Load Profiles)
// ============================================================================
const TEST_PROFILE = __ENV.PROFILE || 'load';

const profiles = {
  smoke: { stages: [{ duration: '5s', target: 1 }] },
  load: {
    stages: [
      { duration: '20s', target: 10 }, 
      { duration: '40s', target: 10 },
      { duration: '10s', target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: '30s', target: 50 }, 
      { duration: '1m', target: 50 },  
      { duration: '30s', target: 0 },
    ],
  },
  spike: {
    stages: [
      { duration: '10s', target: 10 },  
      { duration: '10s', target: 200 }, 
      { duration: '30s', target: 200 }, 
      { duration: '10s', target: 10 },  
      { duration: '10s', target: 0 },
    ],
  },
  soak: {
    stages: [
      { duration: '2m', target: 20 },  
      { duration: '2h', target: 20 },  
      { duration: '2m', target: 0 },   
    ],
  }
};

export const options = {
  stages: profiles[TEST_PROFILE].stages,
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<2500'], // Adjusted for public internet variance
    http_req_failed: ['rate<0.01'], 
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ============================================================================
// 4. EXECUTION (The Logic Each User Runs)
// ============================================================================
export default function () {
  const randomUser = csvData[Math.floor(Math.random() * csvData.length)];

  const payload = JSON.stringify({
    username: randomUser.username,
    password: randomUser.password,
    action: 'submit_form',
    targetMode: envType,
    testedUrl: TARGET_URL
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  const response = http.post(TARGET_URL, payload, params);

  check(response, {
    'Response status is 200': (res) => res.status === 200,
    'Response time is under 2000ms': (res) => res.timings.duration < 2000,
  });

  sleep(1);
}

// ============================================================================
// 5. REPORTING (Triggered once at the end)
// ============================================================================
export function handleSummary(data) {
  return {
    'reports/summary.html': htmlReport(data),
    'reports/junit.xml': jUnit(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}