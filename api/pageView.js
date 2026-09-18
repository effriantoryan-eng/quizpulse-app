const { app }         = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { classifyPage } = require('./shared/pageViewAllowlist');
const { classifyDevice, classifyBrowser } = require('./shared/trafficAggregate');

// Lazy container init — mirrors api/metrics.js's getContainers() pattern (keeps
// require('./pageView') from constructing a CosmosClient when no Cosmos env is configured).
// Provisioning (container, TTL, RU cap) is manual — see docs/azure/V440_CONTAINERS_SETUP.md.
let _container = null;
function getContainer() {
  if (!_container) {
    const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
    const database = client.database(process.env.COSMOS_DATABASE);
    _container = database.container(process.env.COSMOS_CONTAINER_PAGEVIEWS || 'pageviews');
  }
  return _container;
}

const ALLOWED_EVENT_TYPES = ['view', 'pwa_install', 'push_prompted', 'push_granted', 'push_denied', 'install_accepted', 'install_dismissed'];
// Consent/install events — fingerprint fields are stripped regardless of route (B1, v4.9.0).
const CONSENT_EVENT_TYPES = new Set(['push_prompted', 'push_granted', 'push_denied', 'install_accepted', 'install_dismissed']);
// Coarse platform values accepted on consent/install events only (review D4, user-approved).
// Three buckets can't identify a device; enables the iOS vs Android denial-rate split.
const ALLOWED_PLATFORMS = new Set(['ios', 'android', 'desktop']);
const MAX_QUIZ_ID_LENGTH = 100;

// Pure: validates + shapes a pageview doc from a raw request body. Returns { error } on
// validation failure, or { doc } (missing id/visitedAt — the caller stamps those) on success.
// No Cosmos, no crypto — testable without a DB or a running Function host.
//
// v4.12.0 (R3 data minimisation, audit B2/B3): the raw browser-fingerprint fields (referrer,
// userAgent, language, timezone, screenWidth, screenHeight) are NO LONGER STORED. Instead we
// derive two coarse buckets server-side — device (mobile/desktop/unknown) and browser
// (chrome/safari/firefox/edge/other) — then discard the raw values. Unknown body fields are
// ignored (old cached clients that still send the raw six keep working; we just don't persist
// them).
function buildPageViewDoc(body) {
  const {
    page, teacherId, sessionId,
    userAgent, screenWidth,
    eventType, quizId,
  } = body || {};

  if (typeof page !== 'string' || page.length > 200) {
    return { error: 'Invalid page field' };
  }

  const resolvedEventType = eventType === undefined ? 'view' : eventType;
  if (!ALLOWED_EVENT_TYPES.includes(resolvedEventType)) {
    return { error: 'Invalid eventType field' };
  }

  // Junk-page cardinality guard — buckets to 'other', never rejects the write. The IP rate
  // limit in the handler is spoofable via x-forwarded-for on a direct Function App call, so
  // this is what actually caps what an anonymous flood can do to topPages/audience cardinality.
  const classifiedPage = classifyPage(page.slice(0, 200));

  // Student privacy posture: /quiz beacons never carry browser detail — enforced here even if the
  // client sent it, since the student-facing route has no auth and nothing here can be trusted to
  // have stripped it client-side. quizId is the one extra field /quiz beacons DO carry, since it's
  // what makes the traffic funnel (v4.4.0 Task 3) attribute opens to a specific send. The
  // /quiz/* prefix covers the /quiz/review + /quiz/practice sub-routes (v4.8), and /student/class.
  //
  // v4.9.0: consent/install events (push_*/install_*) also strip regardless of route.
  const isStudentRoute = classifiedPage === '/quiz' || classifiedPage.startsWith('/quiz/') || classifiedPage === '/student/class';
  const isConsentEvent = CONSENT_EVENT_TYPES.has(resolvedEventType);
  const stripFingerprint = isStudentRoute || isConsentEvent;

  // Deliberate exception (review D4, user-approved): consent/install events keep a coarse
  // `platform` field ('ios'|'android'|'desktop' only). Three buckets can't identify a device,
  // but enable the highest-value cut: iOS vs Android notification denial rates. Never stored
  // for plain 'view' events — only for consent/install types.
  const { platform } = body || {};
  const resolvedPlatform = isConsentEvent && ALLOWED_PLATFORMS.has(platform) ? platform : null;

  // Coarse device/browser buckets derived server-side, then the raw values are discarded (never
  // stored). Gated on stripFingerprint (eng review): on /quiz*, /student/class and consent events
  // we deliberately don't classify the device at all — those routes are minimised, and
  // aggregateTraffic already treats 'unknown'/'other' as "we don't know" there.
  const device  = stripFingerprint ? 'unknown' : classifyDevice(screenWidth);
  const browser = stripFingerprint ? 'other'   : classifyBrowser(userAgent);

  const doc = {
    page:      classifiedPage,
    eventType: resolvedEventType,
    // Absent teacherId → null (NOT the old 'anonymous' sentinel): a pre-join visitor has no
    // device id, and D3.2 counts unique visitors as devices that joined a class. A truthy
    // sentinel would count every anonymous visit as one phantom visitor (aggregateTraffic guards
    // on truthiness).
    teacherId: typeof teacherId === 'string' ? teacherId.slice(0, 100) : null,
    sessionId: typeof sessionId === 'string' ? sessionId.slice(0, 100) : null,
    quizId:    isStudentRoute && typeof quizId === 'string' ? quizId.slice(0, MAX_QUIZ_ID_LENGTH) : null,
    device,
    browser,
    platform:  resolvedPlatform,
  };

  return { doc };
}

app.http('pageView', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'pageView',
  handler: async (request, context) => {
    // Rate limit: 60 per minute per IP
    const ip = getClientIp(request);
    if (!rateLimit(`pageview:${ip}`, 60, 60_000)) {
      return { status: 429, jsonBody: { error: 'Too many requests' } };
    }

    // Content-length guard
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > 4096) {
      return { status: 413, jsonBody: { error: 'Payload too large' } };
    }

    let body;
    try {
      body = await request.json();
      if (typeof body !== 'object' || Array.isArray(body)) throw new Error();
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const { error, doc } = buildPageViewDoc(body);
    if (error) return { status: 400, jsonBody: { error } };

    doc.id = crypto.randomUUID();
    doc.visitedAt = new Date().toISOString();

    try {
      const container = getContainer();
      await container.items.create(doc);
      return { status: 201, jsonBody: { ok: true } };
    } catch (err) {
      context.error('pageView write error', err);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});

module.exports = { buildPageViewDoc };
