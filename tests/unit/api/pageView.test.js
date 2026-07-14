const { buildPageViewDoc } = require('../../../api/pageView');

function baseBody(overrides = {}) {
  return {
    page: '/teacher/home',
    teacherId: 'device-uuid-1',
    sessionId: 'tab-session-1',
    referrer: 'https://example.com',
    userAgent: 'Mozilla/5.0 Chrome/100 Safari/537',
    language: 'en-AU',
    timezone: 'Australia/Sydney',
    screenWidth: 1280,
    screenHeight: 800,
    ...overrides,
  };
}

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

describe('buildPageViewDoc — student privacy posture (/quiz)', () => {
  test('strips browser-fingerprint fields even if the client sent them', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/quiz', quizId: 'quiz-abc' }));
    expect(doc.page).toBe('/quiz');
    expect(doc.referrer).toBeNull();
    expect(doc.userAgent).toBeNull();
    expect(doc.language).toBeNull();
    expect(doc.timezone).toBeNull();
    expect(doc.screenWidth).toBeNull();
    expect(doc.screenHeight).toBeNull();
  });

  test('keeps teacherId/sessionId/quizId on /quiz', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/quiz', quizId: 'quiz-abc' }));
    expect(doc.teacherId).toBe('device-uuid-1');
    expect(doc.sessionId).toBe('tab-session-1');
    expect(doc.quizId).toBe('quiz-abc');
  });

  test('quizId is null when not sent, and never carried on non-/quiz pages', () => {
    expect(buildPageViewDoc(baseBody({ page: '/quiz' })).doc.quizId).toBeNull();
    expect(buildPageViewDoc(baseBody({ page: '/teacher/home', quizId: 'quiz-abc' })).doc.quizId).toBeNull();
  });

  test('quizId is length-capped', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/quiz', quizId: 'q'.repeat(150) }));
    expect(doc.quizId).toHaveLength(100);
  });

  test('non-/quiz pages keep full telemetry', () => {
    const { doc } = buildPageViewDoc(baseBody({ page: '/teacher/home' }));
    expect(doc.referrer).toBe('https://example.com');
    expect(doc.userAgent).toContain('Chrome');
    expect(doc.screenWidth).toBe(1280);
  });
});

describe('buildPageViewDoc — field truncation and defaults', () => {
  test('missing teacherId defaults to "anonymous"', () => {
    const { doc } = buildPageViewDoc(baseBody({ teacherId: undefined }));
    expect(doc.teacherId).toBe('anonymous');
  });

  test('missing sessionId is null, not a string', () => {
    const { doc } = buildPageViewDoc(baseBody({ sessionId: undefined }));
    expect(doc.sessionId).toBeNull();
  });

  test('non-number screenWidth/screenHeight are stored as null', () => {
    const { doc } = buildPageViewDoc(baseBody({ screenWidth: 'wide', screenHeight: null }));
    expect(doc.screenWidth).toBeNull();
    expect(doc.screenHeight).toBeNull();
  });
});
