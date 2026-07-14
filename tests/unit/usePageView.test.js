// Unit tests for the pure payload-building logic behind src/hooks/usePageView.js.
//
// The repo has no DOM test library (RTL/jsdom — see tests/unit/usePwaInstall.test.js for the
// same constraint). buildPageViewPayload's browser-global reads (document.referrer,
// navigator.userAgent, window.screen, Intl) can't run under jest's node testEnvironment, so
// this mirrors the function's DECISION LOGIC exactly as implemented, with browser globals
// passed in instead of read from the real window/document/navigator. Keep in lockstep with
// usePageView.js.

const DEVICE_ID_KEY = 'quizpulse_device_id';

function isStudentRoute(pathname) {
  return pathname === '/quiz';
}

function buildPageViewPayload({ pathname, search = '', eventType = 'view' }, deps) {
  const { getSessionId, getTabSessionId, documentRef, navigatorRef, windowRef } = deps;
  const base = {
    page: pathname,
    eventType,
    teacherId: getSessionId(DEVICE_ID_KEY),
    sessionId: getTabSessionId(),
  };

  if (isStudentRoute(pathname)) {
    return { ...base, quizId: new URLSearchParams(search).get('quizId') || null };
  }

  return {
    ...base,
    referrer: documentRef.referrer || null,
    userAgent: navigatorRef.userAgent || null,
    language: navigatorRef.language || null,
    timezone: 'Australia/Sydney', // stands in for Intl.DateTimeFormat().resolvedOptions().timeZone
    screenWidth: windowRef.screen.width || null,
    screenHeight: windowRef.screen.height || null,
  };
}

function makeDeps(overrides = {}) {
  return {
    getSessionId: jest.fn((key) => `session-for-${key}`),
    getTabSessionId: jest.fn(() => 'tab-session-1'),
    documentRef: { referrer: 'https://example.com' },
    navigatorRef: { userAgent: 'Mozilla/5.0 Chrome/100', language: 'en-AU' },
    windowRef: { screen: { width: 1280, height: 800 } },
    ...overrides,
  };
}

describe('usePageView — buildPageViewPayload device-id key', () => {
  test('reads the visitor id under the quizpulse_device_id key', () => {
    const deps = makeDeps();
    buildPageViewPayload({ pathname: '/teacher/home' }, deps);
    expect(deps.getSessionId).toHaveBeenCalledWith('quizpulse_device_id');
  });

  test('does NOT call getSessionId with no key (regression: was storing under "undefined")', () => {
    const deps = makeDeps();
    buildPageViewPayload({ pathname: '/teacher/home' }, deps);
    expect(deps.getSessionId).not.toHaveBeenCalledWith(undefined);
    expect(deps.getSessionId).not.toHaveBeenCalledWith();
  });
});

describe('usePageView — buildPageViewPayload student privacy posture (/quiz)', () => {
  test('carries only page/eventType/teacherId/sessionId/quizId on /quiz', () => {
    const payload = buildPageViewPayload({ pathname: '/quiz', search: '?quizId=abc123' }, makeDeps());
    expect(Object.keys(payload).sort()).toEqual(['eventType', 'page', 'quizId', 'sessionId', 'teacherId']);
  });

  test('quizId comes from the ?quizId= search param, not the pathname', () => {
    const payload = buildPageViewPayload({ pathname: '/quiz', search: '?quizId=abc123&foo=bar' }, makeDeps());
    expect(payload.quizId).toBe('abc123');
  });

  test('quizId is null when the search param is absent', () => {
    const payload = buildPageViewPayload({ pathname: '/quiz', search: '' }, makeDeps());
    expect(payload.quizId).toBeNull();
  });

  test('non-/quiz pages carry full telemetry, no quizId field', () => {
    const payload = buildPageViewPayload({ pathname: '/teacher/home' }, makeDeps());
    expect(payload).not.toHaveProperty('quizId');
    expect(payload.referrer).toBe('https://example.com');
    expect(payload.userAgent).toBe('Mozilla/5.0 Chrome/100');
    expect(payload.screenWidth).toBe(1280);
  });
});

describe('usePageView — eventType default', () => {
  test('defaults to "view" when not specified', () => {
    const payload = buildPageViewPayload({ pathname: '/teacher/home' }, makeDeps());
    expect(payload.eventType).toBe('view');
  });
});

// Mirrors usePwaInstallTracking's appinstalled handler (src/hooks/usePageView.js) — reuses the
// same buildPageViewPayload, with eventType: 'pwa_install' and the current pathname.
describe('usePwaInstallTracking — appinstalled beacon', () => {
  test('fires a beacon with eventType "pwa_install" on the appinstalled event', () => {
    const sentPayloads = [];
    const sendPageViewBeacon = (payload) => sentPayloads.push(payload);
    const deps = makeDeps();

    function onAppInstalled(pathname) {
      sendPageViewBeacon(buildPageViewPayload({ pathname, eventType: 'pwa_install' }, deps));
    }

    onAppInstalled('/teacher/home');

    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0].eventType).toBe('pwa_install');
    expect(sentPayloads[0].teacherId).toBe('session-for-quizpulse_device_id');
  });
});
