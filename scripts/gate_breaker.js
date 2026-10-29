const fs = require('fs');
const path = require('path');

const summaryPath = path.resolve(__dirname, '../reports/summary.json');
const baselinePath = path.resolve(__dirname, '../config/baseline_sla.json');

if (!fs.existsSync(summaryPath)) {
  console.error(`[ERROR] Summary file not found at: ${summaryPath}`);
  process.exit(1);
}

if (!fs.existsSync(baselinePath)) {
  console.error(`[ERROR] Baseline SLA file not found at: ${baselinePath}`);
  process.exit(1);
}

const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const baselineConfig = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

console.log('\n===============================================================');
console.log('       CI/CD PERFORMANCE QUALITY GATE EVALUATION');
console.log('===============================================================\n');

let gateFailed = false;
const failureReasons = [];

// 1. Global Checks Verification
const checksRate = summaryData.metrics.checks ? summaryData.metrics.checks.values.rate : 0;
const checksPassPercent = (checksRate * 100).toFixed(2);
const minChecksRequired = (baselineConfig.global_sla.checks_min_pass_rate * 100).toFixed(2);

if (checksRate < baselineConfig.global_sla.checks_min_pass_rate) {
  gateFailed = true;
  failureReasons.push(`Check pass rate (${checksPassPercent}%) fell below requirement (${minChecksRequired}%).`);
}

// 2. Global Request Failure Rate Verification
const failedReqsRate = summaryData.metrics.http_req_failed ? summaryData.metrics.http_req_failed.values.rate : 0;
const failurePercent = (failedReqsRate * 100).toFixed(2);
const maxAllowedFailure = (baselineConfig.global_sla.http_req_failed_max_rate * 100).toFixed(2);

if (failedReqsRate > baselineConfig.global_sla.http_req_failed_max_rate) {
  gateFailed = true;
  failureReasons.push(`Request failure rate (${failurePercent}%) exceeded maximum tolerance (${maxAllowedFailure}%).`);
}

// 3. Granular Step-by-Step API Evaluation
console.log('---------------------------------------------------------------------------------------------------------');
console.log('| Step / API Transaction        | Actual p95   | Baseline p95 | Max Acceptable | Regression % | Status  |');
console.log('---------------------------------------------------------------------------------------------------------');

for (const [stepName, sla] of Object.entries(baselineConfig.endpoints)) {
  const metricKey = `http_req_duration{name:${stepName}}`;
  const metric = summaryData.metrics[metricKey];

  if (!metric) {
    console.log(`| ${stepName.padEnd(29)} | Metric Not Found (Skipped)                                           |`);
    continue;
  }

  const actualP95 = metric.values['p(95)'];
  const baselineP95 = sla.target_p95_ms;
  const maxAcceptable = sla.max_acceptable_p95_ms;
  const diffPercent = (((actualP95 - baselineP95) / baselineP95) * 100).toFixed(1);
  const diffStr = diffPercent > 0 ? `+${diffPercent}%` : `${diffPercent}%`;

  let status = 'PASS';
  if (actualP95 > maxAcceptable) {
    status = 'FAIL';
    gateFailed = true;
    failureReasons.push(`${stepName} p95 (${actualP95.toFixed(2)}ms) degraded beyond SLA limit of ${maxAcceptable}ms (${diffStr}).`);
  }

  console.log(
    `| ${stepName.padEnd(29)} | ` +
    `${(actualP95.toFixed(1) + 'ms').padEnd(12)} | ` +
    `${(baselineP95 + 'ms').padEnd(12)} | ` +
    `${(maxAcceptable + 'ms').padEnd(14)} | ` +
    `${diffStr.padEnd(12)} | ` +
    `${status.padEnd(7)} |`
  );
}

console.log('---------------------------------------------------------------------------------------------------------\n');

if (gateFailed) {
  console.error('[GATE REJECTED] Performance regression detected. Breaking deployment pipeline:\n');
  failureReasons.forEach((reason, idx) => console.error(`  ${idx + 1}. ${reason}`));
  console.log('\n===============================================================\n');
  process.exit(1);
} else {
  console.log('[GATE APPROVED] All endpoints passed baseline SLA requirements.');
  console.log(`Global Check Rate: ${checksPassPercent}% | Failure Rate: ${failurePercent}%`);
  console.log('\n===============================================================\n');
  process.exit(0);
}