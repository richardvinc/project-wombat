import exec from 'k6/execution';
import http from 'k6/http';
import { Counter, Rate } from 'k6/metrics';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:8088';
const userCount = Number(__ENV.K6_USER_COUNT || 1000);
const buyerVus = Number(__ENV.K6_BUYER_VUS || 250);
const abuserVus = Number(__ENV.K6_ABUSER_VUS || 20);
const abuserDuration = __ENV.K6_ABUSER_DURATION || '20s';
const maliciousVus = Number(__ENV.K6_MALICIOUS_VUS || 10);
const maliciousIterations = Number(__ENV.K6_MALICIOUS_ITERATIONS || 3);
const buyRetries = Number(__ENV.K6_BUY_RETRIES || 2);
const paymentRetries = Number(__ENV.K6_PAYMENT_RETRIES || 2);

const buyReserved = new Counter('buy_reserved');
const buyThrottled = new Counter('buy_throttled');
const buyConflict = new Counter('buy_conflict');
const wafBlocked = new Counter('waf_blocked');
const paymentPaid = new Counter('payment_paid');
const paymentFailed = new Counter('payment_failed');
const paymentExpired = new Counter('payment_expired');
const paymentNotFound = new Counter('payment_not_found');
const paymentConflict = new Counter('payment_conflict');
const paymentUnexpected = new Counter('payment_unexpected');
const logicalSuccessRate = new Rate('logical_success_rate');

export const options = {
  setupTimeout: '2m',
  scenarios: {
    buyers: {
      executor: 'shared-iterations',
      exec: 'buyerFlow',
      vus: buyerVus,
      iterations: userCount,
      maxDuration: '3m',
    },
    abusers: {
      executor: 'constant-vus',
      exec: 'abuserFlow',
      vus: abuserVus,
      duration: abuserDuration,
      startTime: '2s',
    },
    malicious: {
      executor: 'per-vu-iterations',
      exec: 'maliciousFlow',
      vus: maliciousVus,
      iterations: maliciousIterations,
      startTime: '3s',
      maxDuration: '1m',
    },
  },
  thresholds: {
    checks: ['rate>=0.90'],
    logical_success_rate: ['rate>=0.65'],
  },
};

function jsonHeaders(username, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': username,
  };

  Object.keys(extraHeaders).forEach((key) => {
    headers[key] = extraHeaders[key];
  });

  return {
    headers,
    tags: {
      username,
    },
  };
}

function pause(minSeconds, maxSeconds) {
  sleep(minSeconds + Math.random() * (maxSeconds - minSeconds));
}

function parseBody(response) {
  try {
    return response.json();
  } catch (_error) {
    return null;
  }
}

function getBodyStatus(body) {
  return body && typeof body === 'object' ? body.status : null;
}

function getSaleStatus() {
  const response = http.get(`${baseUrl}/api/flash-sale/status`);
  const body = parseBody(response);

  if (response.status !== 200 || !body || typeof body !== 'object') {
    return null;
  }

  return body;
}

function shouldStopRetryingBuy(buyResult) {
  if (!buyResult || buyResult.response.status !== 409) {
    return false;
  }

  const buyStatus = getBodyStatus(buyResult.body);

  if (
    buyStatus !== 'slots_unavailable' &&
    buyStatus !== 'cooldown_active'
  ) {
    return false;
  }

  const saleStatus = getSaleStatus();

  if (!saleStatus) {
    return false;
  }

  return saleStatus.status === 'ended' || Number(saleStatus.availableSlots || 0) <= 0;
}

function getMetricValue(metric, key, fallback) {
  if (!metric || !metric.values || typeof metric.values[key] === 'undefined') {
    return fallback;
  }

  return metric.values[key];
}

function buy(username, extraHeaders = {}) {
  const response = http.post(
    `${baseUrl}/api/orders/buy`,
    JSON.stringify({ username }),
    jsonHeaders(username, extraHeaders),
  );
  const body = parseBody(response);

  if (response.status === 201 && getBodyStatus(body) === 'reserved') {
    buyReserved.add(1);
    logicalSuccessRate.add(1);
    return { response, body };
  }

  if (response.status === 403) {
    wafBlocked.add(1);
    logicalSuccessRate.add(1);
  } else if (response.status === 429) {
    buyThrottled.add(1);
    logicalSuccessRate.add(1);
  } else if (response.status === 409) {
    buyConflict.add(1);
    logicalSuccessRate.add(1);
  } else {
    logicalSuccessRate.add(0);
  }

  return { response, body };
}

function pay(username, reservationId) {
  const response = http.post(
    `${baseUrl}/api/orders/pay`,
    JSON.stringify({ username, reservationId }),
    jsonHeaders(username),
  );
  const body = parseBody(response);

  if (response.status === 201 && getBodyStatus(body) === 'paid') {
    paymentPaid.add(1);
    logicalSuccessRate.add(1);
    return { response, body };
  }

  if (response.status === 201 && getBodyStatus(body) === 'payment_failed') {
    paymentFailed.add(1);
    logicalSuccessRate.add(1);
    return { response, body };
  }

  if (response.status === 410) {
    paymentExpired.add(1);
    logicalSuccessRate.add(1);
  } else if (response.status === 404) {
    paymentNotFound.add(1);
    logicalSuccessRate.add(1);
  } else if (response.status === 409) {
    paymentConflict.add(1);
    logicalSuccessRate.add(1);
  } else if (response.status === 403) {
    wafBlocked.add(1);
    logicalSuccessRate.add(1);
  } else if (response.status === 429) {
    buyThrottled.add(1);
    logicalSuccessRate.add(1);
  } else {
    paymentUnexpected.add(1);
    logicalSuccessRate.add(0);
  }

  return { response, body };
}

export function setup() {
  const deadline = Date.now() + 90000;

  while (Date.now() < deadline) {
    const response = http.get(`${baseUrl}/api/flash-sale/status`);
    const body = parseBody(response);
    const ready =
      response.status === 200 &&
      body &&
      (body.status === 'upcoming' || body.status === 'active');

    if (ready) {
      if (body.status === 'active') {
        return { ready: true };
      }

      pause(1, 1.5);
      continue;
    }

    pause(1, 1.5);
  }

  return { ready: false };
}

export function buyerFlow(data) {
  check(data, {
    'setup reached sale window': (state) => state.ready,
  });

  const username = `buyer-${String(exec.scenario.iterationInTest).padStart(4, '0')}`;
  let attempt = 0;
  let buyResult = null;

  while (attempt <= buyRetries) {
    buyResult = buy(username);

    if (buyResult.response.status === 201) {
      break;
    }

    if (buyResult.response.status === 429) {
      pause(0.2, 0.8);
      attempt += 1;
      continue;
    }

    if (buyResult.response.status === 409) {
      const buyStatus = getBodyStatus(buyResult.body);

      if (shouldStopRetryingBuy(buyResult)) {
        break;
      }

      if (buyStatus === 'slots_unavailable') {
        pause(1.5, 4.0);
        attempt += 1;
        continue;
      }

      if (buyStatus === 'cooldown_active') {
        pause(1.0, 2.0);
        attempt += 1;
        continue;
      }
    }

    break;
  }

  check(buyResult.response, {
    'buyer buy returned expected family': (response) =>
      [201, 403, 409, 429].includes(response.status),
  });

  if (buyResult.response.status !== 201) {
    return;
  }

  pause(0.2, 2.0);

  let paymentAttempt = 0;

  while (paymentAttempt <= paymentRetries) {
    const paymentResult = pay(username, buyResult.body.reservationId);

    check(paymentResult.response, {
      'buyer pay returned expected family': (response) =>
        [201, 403, 404, 409, 410, 429].includes(response.status),
    });

    if (
      paymentResult.response.status === 201 &&
      getBodyStatus(paymentResult.body) === 'paid'
    ) {
      return;
    }

    if (
      paymentResult.response.status === 201 &&
      getBodyStatus(paymentResult.body) === 'payment_failed'
    ) {
      pause(0.2, 1.0);
      paymentAttempt += 1;
      continue;
    }

    if (paymentResult.response.status === 429) {
      pause(0.5, 1.2);
      paymentAttempt += 1;
      continue;
    }

    if (paymentResult.response.status === 404) {
      return;
    }

    if (paymentResult.response.status === 409) {
      return;
    }

    return;
  }
}

export function abuserFlow() {
  const username = `abuser-${exec.vu.idInTest % 10}`;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = buy(username);

    check(result.response, {
      'abuser buy returned expected family': (response) =>
        [201, 403, 409, 429].includes(response.status),
    });

    pause(0.05, 0.15);
  }
}

export function maliciousFlow() {
  const username = `malicious-${exec.vu.idInTest}-${exec.scenario.iterationInInstance}`;
  const forcedBlockResponse = http.get(
    `${baseUrl}/api/orders/status?username=${username}`,
    {
      headers: {
        'X-User-Id': username,
        'X-Force-Waf-Block': '1',
        'User-Agent': 'k6-malicious-forced',
      },
    },
  );
  const sqliResponse = http.get(
    `${baseUrl}/api/orders/status?username=' OR 1=1 --`,
    {
      headers: {
        'X-User-Id': username,
        'User-Agent': 'k6-malicious-sqli',
      },
    },
  );

  if (forcedBlockResponse.status === 403) {
    wafBlocked.add(1);
  }

  if (sqliResponse.status === 403) {
    wafBlocked.add(1);
  }

  check(forcedBlockResponse, {
    'forced WAF block works': (response) => response.status === 403,
  });
  check(sqliResponse, {
    'malicious probe returns expected family': (response) =>
      [200, 400, 403, 429].includes(response.status),
  });
}

export function handleSummary(data) {
  const summaryJson = JSON.stringify(data, null, 2);
  const checksPassed = getMetricValue(data.metrics.checks, 'passes', 0);
  const checksFailed = getMetricValue(data.metrics.checks, 'fails', 0);
  const httpReqCount = getMetricValue(data.metrics.http_reqs, 'count', 0);
  const httpReqDurationP95 = getMetricValue(
    data.metrics.http_req_duration,
    'p(95)',
    'n/a',
  );

  return {
    [__ENV.SUMMARY_OUTPUT_FILE || '/artifacts/k6-summary.json']: summaryJson,
    [__ENV.SUMMARY_TEXT_FILE || '/artifacts/k6-summary.txt']:
      `k6 run complete\nchecks=${checksPassed}/${checksPassed + checksFailed}\nhttp_reqs=${httpReqCount}\nhttp_req_duration_p95=${httpReqDurationP95}\n`,
    stdout: summaryJson,
  };
}
