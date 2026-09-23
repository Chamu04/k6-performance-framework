import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary, jUnit } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// ============================================================================
// 1. HELPERS & PARAMETER SANITIZATION
// ============================================================================
function cleanEnv(val, fallback = '') {
  if (!val) return fallback;
  const cleaned = val.replace(/^["']|["']$/g, '').trim();
  return cleaned === '' ? fallback : cleaned;
}

// ============================================================================
// 2. TARGET RESOLUTION
// ============================================================================
const envType = cleanEnv(__ENV.ENVIRONMENT_TYPE, 'Demo_Sandbox');
const testServerId = cleanEnv(__ENV.TEST_SERVER_ID, 'test1').toLowerCase();
const deviceType = cleanEnv(__ENV.DEVICE_TYPE, 'desktop').toLowerCase();
const pagePath = cleanEnv(__ENV.PATH_OR_ENDPOINT, '/order/ncf');
const fullUrlOverride = cleanEnv(__ENV.FULL_URL_OVERRIDE, '');

let BASE_HOST = 'https://reqres.in';
let GET_PAGE_URL = 'https://reqres.in/api/users?page=2';
let POST_SUBMIT_URL = 'https://reqres.in/api/users';

if (fullUrlOverride !== '') {
  GET_PAGE_URL = fullUrlOverride;
  BASE_HOST = fullUrlOverride.substring(0, fullUrlOverride.indexOf('/', 8));
  POST_SUBMIT_URL = fullUrlOverride;
} else if (envType === 'Demo_Sandbox') {
  BASE_HOST = 'https://reqres.in';
  GET_PAGE_URL = 'https://reqres.in/api/users?page=2';
  POST_SUBMIT_URL = 'https://reqres.in/api/users';
} else if (envType === 'Test_Server_Forms') {
  const cleanId = testServerId.startsWith('test') ? testServerId : `test${testServerId}`;
  BASE_HOST = `https://${cleanId}.app.editage.com`;
  GET_PAGE_URL = deviceType === 'mobile'
    ? `${BASE_HOST}/m${pagePath}`
    : `${BASE_HOST}${pagePath}`;
  POST_SUBMIT_URL = `${BASE_HOST}/api/v1/order/new-client-with-addon`;
}

// ============================================================================
// 3. DATA PREPARATION (CSV Parsing)
// ============================================================================
const csvData = new SharedArray('users', function () {
  return papaparse.parse(open('../data/users.csv'), { header: true, skipEmptyLines: true }).data;
});

// ============================================================================
// 4. LOAD PROFILES & THRESHOLDS
// ============================================================================
const TEST_PROFILE = cleanEnv(__ENV.PROFILE, 'smoke');

const profiles = {
  smoke: {
    stages: [{ duration: '5s', target: 1 }],
  },
  load: {
    stages: [
      { duration: '20s', target: 5 },  // Smooth ramp-up to 5 concurrent users
      { duration: '40s', target: 10 }, // Sustain 10 concurrent users
      { duration: '15s', target: 0 },  // Clean ramp-down
    ],
  },
  stress: {
    stages: [
      { duration: '30s', target: 20 },
      { duration: '1m', target: 40 },
      { duration: '30s', target: 0 },
    ],
  },
};

export const options = {
  insecureSkipTLSVerify: true,
  stages: profiles[TEST_PROFILE] ? profiles[TEST_PROFILE].stages : profiles.smoke.stages,
  thresholds: {
    'http_req_failed': ['rate<0.02'],
    'http_req_duration{name:01_Load_Data}': ['p(95)<2500'],
    'http_req_duration{name:02_Create_Record}': ['p(95)<3000'],
    'checks': ['rate>0.98'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ============================================================================
// 5. TEST EXECUTION
// ============================================================================
export default function () {
  const randomUser = csvData[Math.floor(Math.random() * csvData.length)] || { username: 'perf_user' };
  const safeName = (randomUser.username || 'Tester').replace(/[^a-zA-Z]/g, '') || 'Tester';

  // -------------------------------------------------------------
  // Step 1: GET Query / Page Fetch
  // -------------------------------------------------------------
  group('01_Load_Data', function () {
    const pageParams = {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      tags: { name: '01_Load_Data' },
      timeout: '15s',
    };

    const getRes = http.get(GET_PAGE_URL, pageParams);

    check(getRes, {
      'Fetch status is 200': (r) => r.status === 200,
      'Fetch latency < 2500ms': (r) => r.timings.duration < 2500,
    });
  });

  // User think time between actions
  sleep(1);

  // -------------------------------------------------------------
  // Step 2: POST Record Creation
  // -------------------------------------------------------------
  group('02_Create_Record', function () {
    const payload = JSON.stringify({
      name: safeName,
      job: 'QA Engineer',
      email: `test_${safeName.toLowerCase()}_${__VU}_${__ITER}@example.com`,
    });

    const postParams = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      tags: { name: '02_Create_Record' },
      timeout: '15s',
    };

    const postRes = http.post(POST_SUBMIT_URL, payload, postParams);

    console.log(`[POST Record] Status: ${postRes.status} | Latency: ${postRes.timings.duration.toFixed(2)}ms`);

    check(postRes, {
      'Record created (status 200 or 201)': (r) => [200, 201].includes(r.status),
      'Create latency < 3000ms': (r) => r.timings.duration < 3000,
    });
  });

  sleep(1);
}

// ============================================================================
// 6. REPORT GENERATION
// ============================================================================
export function handleSummary(data) {
  return {
    'reports/summary.html': htmlReport(data),
    'reports/junit.xml': jUnit(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}