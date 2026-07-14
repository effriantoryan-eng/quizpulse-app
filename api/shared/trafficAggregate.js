// Pure aggregation helpers for GET /api/manage/traffic (api/traffic.js). Kept dependency-free
// and Cosmos-free so they're unit-testable without a DB — api/traffic.js does the query, these
// functions do the math.

const ALLOWED_RANGES = ['today', '7d', '30d'];
const RANGE_DAYS = { today: 1, '7d': 7, '30d': 30 };

// UTC start-of-window for a range. 'today' = UTC midnight of the current day; '7d'/'30d' are
// rolling windows (now minus N days) — there is no history/trend requirement that needs a fixed
// calendar boundary for those two, and a rolling window is simpler to reason about.
function getRangeStart(range, now = new Date()) {
  if (!ALLOWED_RANGES.includes(range)) {
    throw new Error(`Invalid range: ${range}`);
  }
  const start = new Date(now);
  if (range === 'today') {
    start.setUTCHours(0, 0, 0, 0);
  } else if (range === '7d') {
    start.setUTCDate(start.getUTCDate() - 7);
  } else {
    start.setUTCDate(start.getUTCDate() - 30);
  }
  return start;
}

// Legacy pageview docs (written before v4.4.0) have no eventType field at all — they must
// count as a 'view' in every aggregate, or all pre-sprint production data silently vanishes
// from the dashboard on day one.
function isViewEvent(doc) {
  return !doc.eventType || doc.eventType === 'view';
}

function isPwaInstallEvent(doc) {
  return doc.eventType === 'pwa_install';
}

// Path-prefix classification, exactly as documented in the sprint plan: /teacher* is teacher
// traffic, /quiz is student traffic, everything else (including /join, /onboarding, /login,
// /admin/log) buckets to public. This is a coarse traffic-source split, not an auth check.
function classifyAudience(page) {
  if (typeof page !== 'string') return 'public';
  if (page.startsWith('/teacher')) return 'teacher';
  if (page === '/quiz') return 'student';
  return 'public';
}

// screenWidth is never sent on /quiz beacons (student privacy posture, v4.4.0 Task 1) — those
// docs fall into 'unknown' here, which is correct: we deliberately don't know their device class.
function classifyDevice(screenWidth) {
  if (typeof screenWidth !== 'number') return 'unknown';
  return screenWidth < 768 ? 'mobile' : 'desktop';
}

// Coarse userAgent sniffing — no ua-parser dependency. Order matters: Edge's UA string also
// contains "Chrome/" and "Safari/" tokens, and Chrome's also contains "Safari/", so more
// specific browsers must be checked first.
function classifyBrowser(userAgent) {
  if (typeof userAgent !== 'string' || !userAgent) return 'other';
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/') || ua.includes('edga/') || ua.includes('edgios/')) return 'edge';
  if (ua.includes('firefox/') || ua.includes('fxios/')) return 'firefox';
  if (ua.includes('chrome/') || ua.includes('crios/')) return 'chrome';
  if (ua.includes('safari/')) return 'safari';
  return 'other';
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Aggregates a flat array of already-range-filtered pageview docs into the full traffic
// response shape (minus `funnel`, added by aggregateFunnel in v4.4.0 Task 3).
function aggregateTraffic(docs) {
  const viewDocs = docs.filter(isViewEvent);
  const pwaInstalls = docs.filter(isPwaInstallEvent).length;

  const visitorSet = new Set();
  const sessionSet = new Set();
  const pageCounts = new Map();
  const audience = { teacher: 0, student: 0, public: 0 };
  const devices = { mobile: 0, desktop: 0, unknown: 0 };
  const browsers = { chrome: 0, safari: 0, firefox: 0, edge: 0, other: 0 };
  const dailyMap = new Map(); // date (YYYY-MM-DD, UTC) -> { pageViews, visitors: Set }

  for (const doc of viewDocs) {
    if (doc.teacherId) visitorSet.add(doc.teacherId);
    if (doc.sessionId) sessionSet.add(doc.sessionId);

    pageCounts.set(doc.page, (pageCounts.get(doc.page) || 0) + 1);
    audience[classifyAudience(doc.page)]++;
    devices[classifyDevice(doc.screenWidth)]++;
    browsers[classifyBrowser(doc.userAgent)]++;

    const date = typeof doc.visitedAt === 'string' ? doc.visitedAt.slice(0, 10) : null;
    if (date) {
      if (!dailyMap.has(date)) dailyMap.set(date, { pageViews: 0, visitors: new Set() });
      const bucket = dailyMap.get(date);
      bucket.pageViews++;
      if (doc.teacherId) bucket.visitors.add(doc.teacherId);
    }
  }

  const pageViews = viewDocs.length;
  const uniqueVisitors = visitorSet.size;
  const uniqueSessions = sessionSet.size;
  const pagesPerSession = uniqueSessions > 0 ? round2(pageViews / uniqueSessions) : 0;

  const topPages = [...pageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([page, count]) => ({ page, count }));

  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, bucket]) => ({ date, pageViews: bucket.pageViews, uniqueVisitors: bucket.visitors.size }));

  return {
    totals: { pageViews, uniqueVisitors, uniqueSessions, pagesPerSession },
    topPages,
    daily,
    audience,
    devices,
    browsers,
    pwaInstalls,
  };
}

// Pure funnel-rate math — zero-division never produces NaN, it produces null (no meaningful
// rate to show yet). Counts pass through unchanged so the caller doesn't need two objects.
function computeFunnelRates({ quizzesSent, notificationsSent, quizOpens, responsesSubmitted }) {
  return {
    quizzesSent,
    notificationsSent,
    quizOpens,
    responsesSubmitted,
    openRate: notificationsSent > 0 ? round2((quizOpens / notificationsSent) * 100) : null,
    completionRate: quizOpens > 0 ? round2((responsesSubmitted / quizOpens) * 100) : null,
  };
}

module.exports = {
  ALLOWED_RANGES,
  RANGE_DAYS,
  getRangeStart,
  isViewEvent,
  isPwaInstallEvent,
  classifyAudience,
  classifyDevice,
  classifyBrowser,
  aggregateTraffic,
  computeFunnelRates,
};
