import http from 'k6/http';
import { check } from 'k6';
import { getStandardHeaders } from '../common/utils.js';

export function loadFormPage(envConfig) {
  const headers = getStandardHeaders(envConfig.device);
  const targetUrl = envConfig.uiUrl;

  const res = http.get(targetUrl, {
    headers: headers,
    tags: { name: '01_Load_Form_Page', type: 'read' },
    timeout: '15s',
  });

  check(res, {
    'Page load status is 200': (r) => r.status === 200,
    'Page load latency < 2500ms': (r) => r.timings.duration < 2500,
  });

  let csrfToken = '';
  if (res.status === 200 && !envConfig.isSandbox) {
    const doc = res.html();
    csrfToken = doc.find('meta[name="csrf-token"]').attr('content') ||
                doc.find('input[name="_token"]').val() || '';
  }

  return { response: res, csrfToken: csrfToken };
}