const { buildPageViewDoc } = require('../../../api/pageView');

// v4.12.0 (R3): buildPageViewDoc no longer stores raw browser-fingerprint fields. A full legacy
// payload (with all six raw fields) is still ACCEPTED — old cached clients keep working — but the
// raw fields are discarded and only coarse device/browser buckets are kept.
function baseBody(overrides = {}) {
  return {
    page: '/teacher/home',
    teacherId: 'device-uuid-1',
    sessionId: 'tab-session-1',
    referrer: 'https://example.com',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/100 Safari/537',
    language: 'en-AU',
    timezone: 'Australia/Sydney',
    screenWidth: 1280,
    screenHeight: 800,
    ...overrides,
  };
}

const FINGERPRINT_KEYS = ['referrer', 'userAgent', 'language', 'timezone', 'screenWidth', 'screenHeight'];

describe('buildPageViewDoc — validation', () => {
  test('rejects a missing page field', () => {
    const { error, doc } = buildPageViewDoc(baseBody({ page: undefined }));
    expect(error).toBe('Invalid page field');
    expect(doc).toBeUndefined();
  });

  test('rejects a page field over 200 chars', () => {
    const { error } = buildPageViewDoc(baseBody({ page: '/' + 'a'.repeat(201) }));
    expect(error).toBe('Invalid page field');
  });

  test('rejects an unrecognised eventType', () => {
    const { error } = buildPageViewDoc(baseBody({ eventType: 'click' }));
    expect(error).toBe('Invalid eventType field');
  });

  test('accepts "view" and "pwa_install" eventTypes', () => {
    expect(buildPageViewDoc(baseBody({ eventType: 'view' })).error).toBeUndefined();
    expect(buildPageViewDoc(baseBody({ eventType: 'pwa_install' })).error).toBeUndefined();
  });

  test('defaults eventType to "view" when omitted', () => {
    const { doc } = buildPageViewDoc(baseBody({ eventType: undefined }));
    expect(doc.eventType).toBe('view');
  });
});

describe('buildPageViewDoc — page allowlist bucketing', () => {
  test('an unrecognised page is stored bucketed as "other", never rejected', () => {
    const { error, doc } = buildPageViewDoc(baseBody({ page: '/totally-made-up-page' }));
    expect(error).toBeUndefined();
    expect(doc.page).toBe('other');
  });

  test('a known page passes through unchanged', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/teacher/build' }));
    expect(doc.page).toBe('/teacher/build');
  });
});

describe('buildPageViewDoc — no browser fingerprint is stored on any route (R3)', () => {
  // Test-contract row: full legacy payloads for /, /join, /login, /quiz, /teacher/home + a
  // consent event — the stored doc must never carry any raw fingerprint key.
  const routes = ['/', '/join', '/login', '/quiz', '/teacher/home'];
  for (const page of routes) {
    test(`stores no fingerprint keys for a full legacy payload on ${page}`, () => {
      const { doc } = buildPageViewDoc(baseBody({ page, quizId: 'q1' }));
      for (const k of FINGERPRINT_KEYS) {
        expect(doc).not.toHaveProperty(k);
      }
    });
  }

  test('stores no fingerprint keys for a consent event', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/join', eventType: 'push_granted', platform: 'android' }));
    for (const k of FINGERPRINT_KEYS) {
      expect(doc).not.toHaveProperty(k);
    }
  });
});

describe('buildPageViewDoc — coarse buckets are computed (R3)', () => {
  test('width 390 + Safari UA → device mobile / browser safari', () => {
    const { doc } = buildPageViewDoc(baseBody({
      page: '/', screenWidth: 390,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605 Version/17.0 Mobile Safari/604.1',
    }));
    expect(doc.device).toBe('mobile');
    expect(doc.browser).toBe('safari');
  });

  test('width 1440 + Chrome UA → device desktop / browser chrome', () => {
    const { doc } = buildPageViewDoc(baseBody({
      page: '/', screenWidth: 1440,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537 Chrome/120 Safari/537',
    }));
    expect(doc.device).toBe('desktop');
    expect(doc.browser).toBe('chrome');
  });
});

describe('buildPageViewDoc — student / consent routes are not device-classified (R3)', () => {
  test('/quiz gets device unknown / browser other even with real UA + width', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/quiz', quizId: 'quiz-abc', screenWidth: 390 }));
    expect(doc.page).toBe('/quiz');
    expect(doc.device).toBe('unknown');
    expect(doc.browser).toBe('other');
    expect(doc.quizId).toBe('quiz-abc');
  });

  test('/student/class is not classified', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/student/class', screenWidth: 1440 }));
    expect(doc.device).toBe('unknown');
    expect(doc.browser).toBe('other');
  });

  test('a consent event is not classified regardless of route', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/join', eventType: 'push_prompted', screenWidth: 1440 }));
    expect(doc.device).toBe('unknown');
    expect(doc.browser).toBe('other');
  });

  test('quizId is null when not sent, and never carried on non-/quiz pages', () => {
    expect(buildPageViewDoc(baseBody({ page: '/quiz' })).doc.quizId).toBeNull();
    expect(buildPageViewDoc(baseBody({ page: '/teacher/home', quizId: 'quiz-abc' })).doc.quizId).toBeNull();
  });
});

describe('buildPageViewDoc — platform (consent events only)', () => {
  test('a coarse platform is kept on a consent event', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/join', eventType: 'push_denied', platform: 'ios' }));
    expect(doc.platform).toBe('ios');
  });

  test('platform is null on a plain view even if sent', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/', platform: 'ios' }));
    expect(doc.platform).toBeNull();
  });

  test('an unrecognised platform on a consent event is null', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/join', eventType: 'push_granted', platform: 'blackberry' }));
    expect(doc.platform).toBeNull();
  });
});

describe('buildPageViewDoc — identity defaults (R3)', () => {
  test('missing teacherId is null, not the old "anonymous" sentinel', () => {
    const { doc } = buildPageViewDoc(baseBody({ teacherId: undefined }));
    expect(doc.teacherId).toBeNull();
  });

  test('a present teacherId is kept and length-capped', () => {
    expect(buildPageViewDoc(baseBody({ teacherId: 'dev-1' })).doc.teacherId).toBe('dev-1');
    expect(buildPageViewDoc(baseBody({ teacherId: 'x'.repeat(150) })).doc.teacherId).toHaveLength(100);
  });

  test('missing sessionId is null, not a string', () => {
    const { doc } = buildPageViewDoc(baseBody({ sessionId: undefined }));
    expect(doc.sessionId).toBeNull();
  });
});
