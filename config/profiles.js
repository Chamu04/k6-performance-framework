import { cleanEnv } from '../modules/common/utils.js';

export function getWorkloadProfile() {
  const profileName = cleanEnv(__ENV.PROFILE, 'smoke').toLowerCase();

  const profileMap = {
    // 1. Sanity & verification
    smoke: {
      stages: [{ duration: '5s', target: 1 }],
    },

    // 2. Standard concurrent load (ramps to 10 VUs, holds, ramps down)
    load: {
      stages: [
        { duration: '20s', target: 5 },
        { duration: '40s', target: 10 },
        { duration: '15s', target: 0 },
      ],
    },

    // 3. Stress testing (pushes system beyond standard capacity to find degradation points)
    stress: {
      stages: [
        { duration: '30s', target: 15 },
        { duration: '1m', target: 30 },
        { duration: '30s', target: 0 },
      ],
    },

    // 4. Spike testing (sudden traffic surge to test autoscaling and resilience)
    spike: {
      stages: [
        { duration: '10s', target: 2 },
        { duration: '10s', target: 40 },
        { duration: '20s', target: 40 },
        { duration: '10s', target: 0 },
      ],
    },

    // 5. Soak / Endurance (low to moderate load sustained to uncover memory leaks)
    soak: {
      stages: [
        { duration: '1m', target: 5 },
        { duration: '30m', target: 5 },
        { duration: '1m', target: 0 },
      ],
    },

    // 6. Breakpoint (progressive step-climb until failure)
    breakpoint: {
      stages: [
        { duration: '30s', target: 10 },
        { duration: '30s', target: 20 },
        { duration: '30s', target: 30 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  };

  const selectedStages = profileMap[profileName] ? profileMap[profileName].stages : profileMap.smoke.stages;

  return {
    insecureSkipTLSVerify: true,
    stages: selectedStages,
    thresholds: {
      // Global gates
      'http_req_failed': ['rate<0.02'], // Max 2% failure rate allowed
      'checks': ['rate>0.98'],          // 98%+ checks must pass
      // Per-API group SLA tags will attach here dynamically
      'http_req_duration{type:read}': ['p(95)<2500'],
      'http_req_duration{type:write}': ['p(95)<4000'],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  };
}