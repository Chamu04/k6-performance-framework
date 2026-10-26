import http from 'k6/http';
import { check } from 'k6';
import { getStandardHeaders } from '../common/utils.js';

export function fetchPlans(envConfig, csrfToken = '') {
  const headers = getStandardHeaders(envConfig.device, envConfig.uiUrl, envConfig.baseHost);
  if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken;

  // In sandbox mode, routes to standard get endpoint; on test servers, hits plans API
  const url = envConfig.isSandbox
    ? `${envConfig.apiBaseUrl}/users?page=1`
    : `${envConfig.apiBaseUrl}/order/plans`;

  const res = http.get(url, {
    headers: headers,
    tags: { name: '02_Fetch_Plans', type: 'read' },
    timeout: '15s',
  });

  check(res, {
    'Plans fetch status is 200': (r) => r.status === 200,
    'Plans fetch latency < 2000ms': (r) => r.timings.duration < 2000,
  });

  return res;
}

export function fetchAddons(envConfig, csrfToken = '') {
  const headers = getStandardHeaders(envConfig.device, envConfig.uiUrl, envConfig.baseHost);
  if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken;

  const url = envConfig.isSandbox
    ? `${envConfig.apiBaseUrl}/users?page=2`
    : `${envConfig.apiBaseUrl}/order/addons`;

  const res = http.get(url, {
    headers: headers,
    tags: { name: '03_Fetch_Addons', type: 'read' },
    timeout: '15s',
  });

  check(res, {
    'Addons fetch status is 200': (r) => r.status === 200,
    'Addons fetch latency < 2000ms': (r) => r.timings.duration < 2000,
  });

  return res;
}

export function calculateTAT(envConfig, csrfToken = '', wordCount = 500) {
  const headers = getStandardHeaders(envConfig.device, envConfig.uiUrl, envConfig.baseHost);
  headers['Content-Type'] = 'application/json';
  if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken;

  const url = envConfig.isSandbox
    ? `${envConfig.apiBaseUrl}/users`
    : `${envConfig.apiBaseUrl}/order/calculate-tat`;

  const payload = JSON.stringify({
    word_count: wordCount,
    service_id: 36,
  });

  const res = http.post(url, payload, {
    headers: headers,
    tags: { name: '04_Calculate_TAT', type: 'read' },
    timeout: '15s',
  });

  check(res, {
    'TAT calculation status is 200 or 201': (r) => [200, 201].includes(r.status),
    'TAT calculation latency < 2500ms': (r) => r.timings.duration < 2500,
  });

  return res;
}