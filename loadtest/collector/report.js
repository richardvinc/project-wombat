const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const Redis = require('ioredis');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return fallback;
  }
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean);
}

function walkFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(absolutePath);
    }

    return [absolutePath];
  });
}

function buildRedisKey(prefix, saleId, suffix) {
  return `${prefix}sale:${saleId}:${suffix}`;
}

function countBy(values) {
  return values.reduce((accumulator, value) => {
    const key = String(value);
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function summarizeByRoute(entries) {
  return entries.reduce((accumulator, entry) => {
    const routeKey = `${entry.method || 'UNKNOWN'} ${entry.uri || '/'}`;

    if (!accumulator[routeKey]) {
      accumulator[routeKey] = {
        totalRequests: 0,
        statusBuckets: {},
        upstreamBuckets: {},
      };
    }

    const routeSummary = accumulator[routeKey];
    const statusKey = String(entry.status);
    const upstreamKey = String(entry.upstream_status || '-').split(',')[0] || '-';

    routeSummary.totalRequests += 1;
    routeSummary.statusBuckets[statusKey] =
      (routeSummary.statusBuckets[statusKey] || 0) + 1;
    routeSummary.upstreamBuckets[upstreamKey] =
      (routeSummary.upstreamBuckets[upstreamKey] || 0) + 1;

    return accumulator;
  }, {});
}

function summarizeNginx(entries) {
  const totalRequests = entries.length;
  const statusBuckets = countBy(entries.map((entry) => entry.status));
  const upstreamBuckets = countBy(
    entries.map((entry) => {
      const upstreamStatus = String(entry.upstream_status || '-').split(',')[0];
      return upstreamStatus === '' ? '-' : upstreamStatus;
    }),
  );
  const throttledEntries = entries.filter(
    (entry) =>
      Number(entry.status) === 429 &&
      ['-', '', 'undefined'].includes(String(entry.upstream_status || '-')),
  );

  return {
    totalRequests,
    throttledCount: throttledEntries.length,
    throttledPercent:
      totalRequests === 0 ? 0 : Number(((throttledEntries.length / totalRequests) * 100).toFixed(2)),
    statusBuckets,
    upstreamBuckets,
    routeBreakdown: summarizeByRoute(entries),
  };
}

function summarizeWaf(auditFiles) {
  const blockedTransactions = [];
  const ruleIds = [];
  const tags = [];

  for (const filePath of auditFiles) {
    const payload = readJson(filePath, null);

    if (!payload || !payload.transaction) {
      continue;
    }

    const transaction = payload.transaction;
    const responseCode = Number(
      transaction.response?.http_code ??
        transaction.response?.status ??
        transaction.response?.code ??
        0,
    );

    if (responseCode === 403) {
      blockedTransactions.push(payload);
    }

    for (const message of transaction.messages || []) {
      const details = message.details || {};

      if (details.ruleId || details.rule_id) {
        ruleIds.push(details.ruleId || details.rule_id);
      }

      for (const tag of details.tags || []) {
        tags.push(tag);
      }
    }
  }

  return {
    totalAudits: auditFiles.length,
    blockedCount: blockedTransactions.length,
    blockedPercent:
      auditFiles.length === 0 ? 0 : Number(((blockedTransactions.length / auditFiles.length) * 100).toFixed(2)),
    topRuleIds: Object.entries(countBy(ruleIds))
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([ruleId, count]) => ({ ruleId, count })),
    topTags: Object.entries(countBy(tags))
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count })),
  };
}

function extractK6Summary(summary) {
  const metrics = summary.metrics || {};

  return {
    checks: {
      passes: metrics.checks?.values?.passes ?? 0,
      fails: metrics.checks?.values?.fails ?? 0,
      rate: metrics.checks?.values?.rate ?? 0,
    },
    httpReqs: metrics.http_reqs?.values?.count ?? 0,
    httpReqFailedRate: metrics.http_req_failed?.values?.rate ?? 0,
    httpReqDuration: {
      p50: metrics.http_req_duration?.values?.['p(50)'] ?? null,
      p95: metrics.http_req_duration?.values?.['p(95)'] ?? null,
      avg: metrics.http_req_duration?.values?.avg ?? null,
    },
    custom: {
      buyReserved: metrics.buy_reserved?.values?.count ?? 0,
      buyThrottled: metrics.buy_throttled?.values?.count ?? 0,
      buyConflict: metrics.buy_conflict?.values?.count ?? 0,
      wafBlocked: metrics.waf_blocked?.values?.count ?? 0,
      paymentPaid: metrics.payment_paid?.values?.count ?? 0,
      paymentFailed: metrics.payment_failed?.values?.count ?? 0,
      paymentExpired: metrics.payment_expired?.values?.count ?? 0,
      paymentNotFound: metrics.payment_not_found?.values?.count ?? 0,
      paymentConflict: metrics.payment_conflict?.values?.count ?? 0,
      paymentUnexpected: metrics.payment_unexpected?.values?.count ?? 0,
      logicalSuccessRate: metrics.logical_success_rate?.values?.rate ?? 0,
      logicalFailuresRate:
        metrics.logical_success_rate?.values?.rate == null
          ? 0
          : 1 - metrics.logical_success_rate.values.rate,
    },
  };
}

async function scanKeys(redis, pattern) {
  const keys = [];
  let cursor = '0';

  do {
    const [nextCursor, batch] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      500,
    );

    cursor = nextCursor;

    if (Array.isArray(batch) && batch.length > 0) {
      keys.push(...batch);
    }
  } while (cursor !== '0');

  return keys;
}

async function collect() {
  const artifactsDir = process.env.ARTIFACTS_DIR || path.join(__dirname, '..', 'artifacts');
  const nginxLogFile = process.env.NGINX_LOG_FILE || path.join(__dirname, '..', 'logs', 'nginx', 'access.log');
  const modsecAuditDir =
    process.env.MODSEC_AUDIT_DIR || path.join(__dirname, '..', 'logs', 'modsecurity', 'audit', 'data');
  const saleId = process.env.FLASH_SALE_ID || 'main';
  const stock = Number(process.env.FLASH_SALE_TOTAL_STOCK || 300);
  const redisPrefix = process.env.REDIS_KEY_PREFIX || '';

  const k6Summary = readJson(path.join(artifactsDir, 'k6-summary.json'), {});
  const nginxEntries = readJsonLines(nginxLogFile);
  const wafAuditFiles = walkFiles(modsecAuditDir);
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
  });
  const postgres = new Client({
    host: process.env.DATABASE_HOST,
    port: 5432,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  await postgres.connect();

  const availableSlotsRaw = await redis.get(buildRedisKey(redisPrefix, saleId, 'available_slots'));
  const reservationKeys = await scanKeys(
    redis,
    buildRedisKey(redisPrefix, saleId, 'reservation:*'),
  );
  const paidKeys = await scanKeys(redis, buildRedisKey(redisPrefix, saleId, 'paid:*'));
  const ordersQuery = await postgres.query(
    'SELECT COUNT(*)::int AS count FROM orders WHERE "flashSaleId" = $1',
    [saleId],
  );

  await postgres.end();
  await redis.quit();

  const availableSlots = Number(availableSlotsRaw ?? 0);
  const paidOrdersCount = Number(ordersQuery.rows[0]?.count ?? 0);
  const nginxSummary = summarizeNginx(nginxEntries);
  const wafSummary = summarizeWaf(wafAuditFiles);
  const k6Extract = extractK6Summary(k6Summary);
  const report = {
    generatedAt: new Date().toISOString(),
    stock,
    nginx: nginxSummary,
    waf: wafSummary,
    redis: {
      availableSlots,
      reservationRecordCount: reservationKeys.length,
      paidMarkerCount: paidKeys.length,
    },
    postgres: {
      paidOrdersCount,
    },
    k6: k6Extract,
    invariants: {
      noOversell: paidOrdersCount <= stock,
      redisNonNegative: availableSlots >= 0,
      saleDrained: availableSlots === 0,
      paidOrdersWithinStock: paidOrdersCount <= stock,
    },
  };

  const reportLines = [
    'Flash sale load test summary',
    `Generated at: ${report.generatedAt}`,
    '',
    'NGINX',
    `- total requests: ${nginxSummary.totalRequests}`,
    `- throttled requests: ${nginxSummary.throttledCount} (${nginxSummary.throttledPercent}%)`,
    `- status buckets: ${JSON.stringify(nginxSummary.statusBuckets)}`,
    `- upstream buckets: ${JSON.stringify(nginxSummary.upstreamBuckets)}`,
    `- route breakdown: ${JSON.stringify(nginxSummary.routeBreakdown)}`,
    '',
    'WAF',
    `- blocked requests: ${wafSummary.blockedCount} (${wafSummary.blockedPercent}%)`,
    `- top rule ids: ${JSON.stringify(wafSummary.topRuleIds)}`,
    `- top tags: ${JSON.stringify(wafSummary.topTags)}`,
    '',
    'Redis',
    `- available slots: ${availableSlots}`,
    `- reservation records: ${reservationKeys.length}`,
    `- paid markers: ${paidKeys.length}`,
    '',
    'Postgres',
    `- paid orders: ${paidOrdersCount}`,
    '',
    'k6',
    `- checks: ${k6Extract.checks.passes}/${k6Extract.checks.passes + k6Extract.checks.fails}`,
    `- http reqs: ${k6Extract.httpReqs}`,
    `- http failure rate: ${k6Extract.httpReqFailedRate}`,
    `- latency p50/p95/avg: ${k6Extract.httpReqDuration.p50}/${k6Extract.httpReqDuration.p95}/${k6Extract.httpReqDuration.avg}`,
    `- custom counters: ${JSON.stringify(k6Extract.custom)}`,
    '',
    'Verdicts',
    `- no oversell: ${report.invariants.noOversell}`,
    `- redis non-negative: ${report.invariants.redisNonNegative}`,
    `- orders within stock: ${report.invariants.paidOrdersWithinStock}`,
    `- sale drained: ${report.invariants.saleDrained}`,
  ];

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, 'final-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(artifactsDir, 'final-report.txt'), `${reportLines.join('\n')}\n`);
  process.stdout.write(`${reportLines.join('\n')}\n`);

  if (!report.invariants.noOversell || !report.invariants.redisNonNegative) {
    process.exitCode = 1;
  }
}

collect().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
