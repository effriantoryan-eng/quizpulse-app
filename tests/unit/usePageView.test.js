// Unit tests for the pure payload-building logic behind src/hooks/usePageView.js.
//
// The repo has no DOM test library (RTL/jsdom — see tests/unit/usePwaInstall.test.js for the
// same constraint). buildPageViewPayload's browser-global reads (navigator.userAgent,
// window.screen) can't run under jest's node testEnvironment, so this mirrors the function's
// DECISION LOGIC exactly as implemented, with browser globals and getDeviceId passed in instead
// of read from the real window/navigator/localStorage. Keep in lockstep with usePageView.js.
//
// v4.12.0 (R3): the beacon NEVER mints a device id (getDeviceId is read-only, returns null when
// absent), and non-student pages carry only userAgent + screenWidth (for the server's coarse
// device/browser bucketing) — referrer, language, timezone and screenHeight are gone.

function isStudentRoute(pathname) {
  return pathname === '/quiz';
}

function buildPageViewPayload({ pathname, search = '', eventType = 'view' }, deps) {
  const { getDeviceId, getTabSessionId, navigatorRef, windowRef } = deps;
  const base = {
    page: pathname,
    eventType,
    teacherId: getDeviceId(),
    sessionId: getTabSessionId(),
  };

  if (isStudentRoute(pathname)) {
    return { ...base, quizId: new URLSearchParams(search).get('quizId') || null };
  }

  return {
    ...base,
    userAgent: navigatorRef.userAgent || null,
    screenWidth: windowRef.screen.width || null,
  };
}

function makeDeps(overrides = {}) {
  return {
    getDeviceId: jest.fn(() => 'device-abc'),
    createDeviceId: jest.fn(() => 'device-new'),
    getTabSessionId: jest.fn(() => 'tab-session-1'),
    navigatorRef: { userAgent: 'Mozilla/5.0 Chrome/100', language: 'en-AU' },
    windowRef: { screen: { width: 1280, height: 800 } },
    ...overrides,
  };
}

describe('usePageView — the beacon never creates an ID (R3)', () => {
  test('teacherId is null when no device ID is stored, and no create function is called', () => {
    const deps = makeDeps({ getDeviceId: jest.fn(() => null) });
    const payload = buildPageViewPayload({ pathname: '/teacher/home' }, deps);
    expect(payload.teacherId).toBeNull();
    expect(deps.createDeviceId).not.toHaveBeenCalled();
  });

  test('teacherId equals the stored ID when one exists', () => {
    const deps = makeDeps({ getDeviceId: jest.fn(() => 'stored-id-123') });
    const payload = buildPageViewPayload({ pathname: '/teacher/home' }, deps);
    expect(payload.teacherId).toBe('stored-id-123');
    expect(deps.createDeviceId).not.toHaveBeenCalled();
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
});

describe('usePageView — non-student pages carry only bucketing fields (R3)', () => {
  test('userAgent + screenWidth sent; referrer/language/timezone/screenHeight dropped', () => {
    const payload = buildPageViewPayload({ pathname: '/teacher/home' }, makeDeps());
    expect(payload).not.toHaveProperty('quizId');
    expect(payload.userAgent).toBe('Mozilla/5.0 Chrome/100');
    expect(payload.screenWidth).toBe(1280);
    expect(payload).not.toHaveProperty('referrer');
    expect(payload).not.toHaveProperty('language');
    expect(payload).not.toHaveProperty('timezone');
    expect(payload).not.toHaveProperty('screenHeight');
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
    expect(sentPayloads[0].teacherId).toBe('device-abc');
  });
});
