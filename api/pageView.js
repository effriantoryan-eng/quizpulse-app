const { app }         = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { classifyPage } = require('./shared/pageViewAllowlist');

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
function buildPageViewDoc(body) {
  const {
    page, teacherId, sessionId,
    referrer, userAgent, language,
    timezone, screenWidth, screenHeight,
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

  // Student privacy posture: /quiz beacons never carry browser-fingerprint fields (userAgent,
  // screen size, language, timezone, referrer) — enforced here even if the client sent them,
  // since the student-facing route has no auth and nothing here can be trusted to have
  // stripped them client-side. quizId is the one extra field /quiz beacons DO carry, since
  // it's what makes the traffic funnel (v4.4.0 Task 3) attribute opens to a specific send.
  // startsWith('/quiz/') covers the /quiz/review + /quiz/practice student sub-routes (v4.8) so
  // their beacons get the same fingerprint-stripping as /quiz itself — and any future /quiz/*
  // route is student-private by default.
  //
  // v4.9.0 extension (review B1): consent/install events (push_*/install_*) also strip
  // fingerprint fields regardless of route — they fire on student routes (/join, /student/class)
  // where device identity is linkable to quiz identity, same posture as /quiz itself.
  const isStudentRoute = classifiedPage === '/quiz' || classifiedPage.startsWith('/quiz/') || classifiedPage === '/student/class';
  const isConsentEvent = CONSENT_EVENT_TYPES.has(resolvedEventType);
  const stripFingerprint = isStudentRoute || isConsentEvent;

  // Deliberate exception (review D4, user-approved): consent/install events keep a coarse
  // `platform` field ('ios'|'android'|'desktop' only). Three buckets can't identify a device,
  // but enable the highest-value cut: iOS vs Android notification denial rates. Never stored
  // for plain 'view' events — only for consent/install types.
  const { platform } = body || {};
  const resolvedPlatform = isConsentEvent && ALLOWED_PLATFORMS.has(platform) ? platform : null;

  const doc = {
    page:         classifiedPage,
    eventType:    resolvedEventType,
    teacherId:    typeof teacherId  === 'string' ? teacherId.slice(0, 100)  : 'anonymous',
    sessionId:    typeof sessionId  === 'string' ? sessionId.slice(0, 100)  : null,
    quizId:       isStudentRoute && typeof quizId === 'string' ? quizId.slice(0, MAX_QUIZ_ID_LENGTH) : null,
    referrer:     stripFingerprint ? null : (typeof referrer   === 'string' ? referrer.slice(0, 500)   : null),
    userAgent:    stripFingerprint ? null : (typeof userAgent  === 'string' ? userAgent.slice(0, 500)  : null),
    language:     stripFingerprint ? null : (typeof language   === 'string' ? language.slice(0, 20)    : null),
    timezone:     stripFingerprint ? null : (typeof timezone   === 'string' ? timezone.slice(0, 100)   : null),
    screenWidth:  stripFingerprint ? null : (typeof screenWidth  === 'number' ? screenWidth  : null),
    screenHeight: stripFingerprint ? null : (typeof screenHeight === 'number' ? screenHeight : null),
    platform:     resolvedPlatform,
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
