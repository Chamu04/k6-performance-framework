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
const envType = cleanEnv(__ENV.ENVIRONMENT_TYPE, 'Safe_Sandbox_Mock');
const testServerId = cleanEnv(__ENV.TEST_SERVER_ID, 'test1').toLowerCase();
const deviceType = cleanEnv(__ENV.DEVICE_TYPE, 'desktop').toLowerCase();
const pagePath = cleanEnv(__ENV.PATH_OR_ENDPOINT, '/order/ncf');
const fullUrlOverride = cleanEnv(__ENV.FULL_URL_OVERRIDE, '');

let BASE_HOST = 'https://httpbin.org';
let GET_PAGE_URL = 'https://httpbin.org/get';
let POST_SUBMIT_URL = 'https://httpbin.org/post';

if (fullUrlOverride !== '') {
  GET_PAGE_URL = fullUrlOverride;
  BASE_HOST = fullUrlOverride.substring(0, fullUrlOverride.indexOf('/', 8));
  POST_SUBMIT_URL = `${BASE_HOST}/api/v1/order/new-client-with-addon`;
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
  smoke: { stages: [{ duration: '5s', target: 1 }] },
  load: {
    stages: [
      { duration: '30s', target: 5 },
      { duration: '1m', target: 5 },
      { duration: '15s', target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 20 },
      { duration: '30s', target: 0 },
    ],
  },
};

export const options = {
  insecureSkipTLSVerify: true,
  stages: profiles[TEST_PROFILE] ? profiles[TEST_PROFILE].stages : profiles.smoke.stages,
  thresholds: {
    // Generous threshold to accommodate Cactus microservice write/sync latency
    'http_req_duration': ['p(95)<20000'],
    'http_req_failed': ['rate<0.10'],
    'checks': ['rate>0.90'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ============================================================================
// 5. TEST EXECUTION (GET Order Page -> POST Order Submission)
// ============================================================================
export default function () {
  const randomUser = csvData[Math.floor(Math.random() * csvData.length)];
  let csrfToken = '';

  // -------------------------------------------------------------
  // Step 1: GET Order Form Page
  // -------------------------------------------------------------
  group('01_Load_Order_Form', function () {
    const pageParams = {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      tags: { name: '01_Order_Page' },
      timeout: '20s',
    };

    const getRes = http.get(GET_PAGE_URL, pageParams);

    check(getRes, {
      'Page load status is 200': (r) => r.status === 200,
      'Page load time < 5000ms': (r) => r.timings.duration < 5000,
    });

    if (getRes.status === 200) {
      const doc = getRes.html();
      csrfToken = doc.find('meta[name="csrf-token"]').attr('content') ||
                  doc.find('input[name="_token"]').val() || '';
    }
  });

  sleep(1);

  // -------------------------------------------------------------
  // Step 2: POST Order Submission
  // -------------------------------------------------------------
  group('02_Submit_New_Client_Order', function () {
    const validFileUuid = 'fc6787c5-a155-41a2-97e4-588ec3c09452';
    const validAwsKey = '15-09-26/enquiry/crm_fc6787c5-a155-41a2-97e4-588ec3c09452.docx';

    // Calculate dynamic 3-day future deadline to pass backend validation
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const rawDeadlineDate = threeDaysLater.toISOString().slice(0, 19).replace('T', ' ');
    const deadlineTimestamp = Math.floor(threeDaysLater.getTime() / 1000);

    const dynamicEmail = `tywu+perf_${__VU}_${__ITER}_${Date.now()}@mailinator.com`;

    const orderPayload = {
      place_order: {
        plan_id: 879,
        partner_id: 11,
        user_id: 222174,
        client_type: 'individual',
        'r-upskill': false,
        user: {
          email_id: dynamicEmail,
          user_profile_details: {
            salutation: '17',
            first_name: 'Zahir',
            last_name: 'Parker',
            address: { country: 'in' },
            payment_profile_address: { country: 'in' },
            cell_phone_number: { code: 'in' },
            client_profile_primary_phone_number: { code: 'in', number: '1122112211' },
            secondary_phone_number: {},
            reference_source: '13248',
          },
          user_publication_profile_details: {},
        },
        referral_details: { referral_identifier: '' },
        enquiry_details: {
          psa_id: 245,
          express_submission: 'no',
          parent_service: 3,
          coupon_list: [],
          form_type: 'new-client-with-addon',
          job_files_url: [
            {
              id: 0,
              aws_file_key: validAwsKey,
              name: 'Test1.docx',
              org_name: 'Test1.docx',
              uuid: validFileUuid,
            },
          ],
          ref_files_url: [],
          exclusion_journal_added: false,
          is_express_tat_bme_flow: false,
          enquiry: { service_id: 36, language_style: 'american' },
          pre_validation_flow: false,
          component: {
            subject_area_id: 1521,
            unit_count: 11,
            co_authors: {},
            service_level_question: {
              field_enq_ex_plan: 879,
              field_enq_ex_type_of_doc: '186',
              field_enq_ex_can_we_start: 'Yes',
              field_enq_ex_formatng_info: 'No',
              field_editor_selected_via_eos: 'Yes',
              field_enq_ex_formatting_special_instruction: false,
            },
            invoice_level_question: {
              invoice_master_id: '1256',
              field_psit_fields: {},
            },
            client_edit_all: 'yes',
            add_on_selected: { selected: [106362], mandatory: [], splitAddOns: [] },
            add_on_deadline: {
              addons_deadlines: {
                '106362': {
                  date: threeDaysLater.toDateString(),
                  raw_date: rawDeadlineDate,
                  deadline_date_timestamp: deadlineTimestamp,
                },
              },
              core_edit_deadline: {
                date: threeDaysLater.toDateString(),
                raw_date: rawDeadlineDate,
              },
              split_addons_deadlines: {},
            },
            add_on_type: 'individual',
            premium_details: [
              {
                premium: '$0.22',
                name: 'One round of re-editing (up to 365 days)',
                raw_premium: 0.22,
                addon_core_id: 90747,
              },
            ],
            upgrade_service: { upgrade: false, upgrade_plan_rate: false, upgrade_discount: 0 },
            data: {
              client_type: 'individual',
              geo_based_pricing: { countryCode: 'IN', currency: 'INR', symbol: '₹' },
              form_url_params: {
                doc: 'df',
                loop: 'enter-wc',
                addonskip: 'yes',
                planskip: 'yes',
                coupon: 'NEWSEM24',
                units: '11',
                plan: '3-day-delivery',
              },
              enquiry_form_type: 'one_page_form',
              ai_subject_areas: { subject_area_ai: {}, subject_area_user: 1521 },
              use_reward_points: false,
            },
          },
          instruction: {
            editing_instruction: '',
            document_information: '',
            target_journal: '',
            word_count_specification: '',
          },
          geo_location: { ip: '103.173.137.161', country_code: 'IN', country_name: 'India' },
          zero_pay_order: true,
        },
        bigint: { host: `${testServerId}.app.editage.com` },
        utm: {},
        app_lang: 'en',
        plus_prospect: false,
        consent_details: {
          privacy_date_of_consent: now.toISOString(),
          privacy_consent_expiry_date: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          privacy_consent_value: 'optIn',
          privacy_version: '1.1',
          privacy_consent_method: 'ncf-form',
          newsletters_date_of_consent: now.toISOString(),
        },
      },
    };

    const postHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Referer': GET_PAGE_URL,
      'Origin': BASE_HOST,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    };

    if (csrfToken) {
      postHeaders['X-CSRF-TOKEN'] = csrfToken;
    }

    const postParams = {
      headers: postHeaders,
      tags: { name: '02_Order_Submit' },
      timeout: '30s',
    };

    const postRes = http.post(POST_SUBMIT_URL, JSON.stringify(orderPayload), postParams);

    console.log(`[POST Order] Status: ${postRes.status} | Latency: ${postRes.timings.duration.toFixed(2)}ms`);
    if (postRes.status !== 200) {
      console.log(`[Backend Error Body]: ${postRes.body}`);
    }

    check(postRes, {
      'Order submit status is 200': (r) => r.status === 200,
      'Submit latency < 20000ms': (r) => r.timings.duration < 20000,
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