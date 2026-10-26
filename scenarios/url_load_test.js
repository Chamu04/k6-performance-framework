import { SharedArray } from 'k6/data';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary, jUnit } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

import { getEnvironmentConfig } from '../config/environments.js';
import { getWorkloadProfile } from '../config/profiles.js';
import { runNcfFlow } from '../scenarios/ncfFlow.js';

// ============================================================================
// 1. DATA PREPARATION
// ============================================================================
const csvData = new SharedArray('users', function () {
  return papaparse.parse(open('../data/users.csv'), { header: true, skipEmptyLines: true }).data;
});

// ============================================================================
// 2. CONFIGURATION & WORKLOAD PROFILES
// ============================================================================
const envConfig = getEnvironmentConfig();
export const options = getWorkloadProfile();

// Attach discrete, granular SLA thresholds per API group to fulfill Goal 1
options.thresholds = {
  ...options.thresholds,
  'http_req_duration{name:01_Load_Order_Page}': ['p(95)<2500'],
  'http_req_duration{name:02_Fetch_Plans}': ['p(95)<2000'],
  'http_req_duration{name:03_Fetch_Addons}': ['p(95)<2000'],
  'http_req_duration{name:04_Calculate_TAT}': ['p(95)<2500'],
  'http_req_duration{name:05_Submit_Order}': ['p(95)<4000'],
};

// ============================================================================
// 3. EXECUTION
// ============================================================================
export default function () {
  const randomUser = csvData[Math.floor(Math.random() * csvData.length)] || { username: 'perf_user' };
  runNcfFlow(envConfig, randomUser);
}

// ============================================================================
// 4. REPORT GENERATION
// ============================================================================
export function handleSummary(data) {
  return {
    '../reports/summary.html': htmlReport(data),
    '../reports/junit.xml': jUnit(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}