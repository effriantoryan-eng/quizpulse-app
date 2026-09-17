const {
  getRangeStart,
  classifyAudience,
  classifyDevice,
  classifyBrowser,
  aggregateTraffic,
  computeFunnelRates,
  aggregateConsentFunnel,
  RANGE_DAYS,
} = require('../../../api/shared/trafficAggregate');

describe('getRangeStart', () => {
  const fixedNow = new Date('2026-07-15T12:34:56.000Z');

  test('"today" is UTC midnight of the current day', () => {
    expect(getRangeStart('today', fixedNow).toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });

  test('"7d" is 7 days before now', () => {
    expect(getRangeStart('7d', fixedNow).toISOString()).toBe('2026-07-08T12:34:56.000Z');
  });

  test('"30d" is 30 days before now', () => {
    expect(getRangeStart('30d', fixedNow).toISOString()).toBe('2026-06-15T12:34:56.000Z');
  });

  test('throws on an invalid range', () => {
    expect(() => getRangeStart('yesterday', fixedNow)).toThrow('Invalid range');
  });

  test('RANGE_DAYS matches the three allowed ranges', () => {
    expect(RANGE_DAYS).toEqual({ today: 1, '7d': 7, '30d': 30 });
  });
});

describe('classifyAudience', () => {
  test('/teacher* prefix is teacher traffic, including sub-tabs like /teacher/population', () => {
    expect(classifyAudience('/teacher/build')).toBe('teacher');
    expect(classifyAudience('/teacher/population')).toBe('teacher');
  });

  test('/quiz is student traffic', () => {
    expect(classifyAudience('/quiz')).toBe('student');
  });

  test('everything else is public traffic', () => {
    expect(classifyAudience('/')).toBe('public');
    expect(classifyAudience('/join')).toBe('public');
    expect(classifyAudience('/onboarding')).toBe('public');
    expect(classifyAudience('/login')).toBe('public');
  });

  test('non-string input is public (defensive default)', () => {
    expect(classifyAudience(undefined)).toBe('public');
  });
});

describe('classifyDevice', () => {
  test('767 is mobile (below the 768 boundary)', () => {
    expect(classifyDevice(767)).toBe('mobile');
  });

  test('768 is desktop (at the boundary)', () => {
    expect(classifyDevice(768)).toBe('desktop');
  });

  test('null/undefined/non-number is unknown', () => {
    expect(classifyDevice(null)).toBe('unknown');
    expect(classifyDevice(undefined)).toBe('unknown');
    expect(classifyDevice('1280')).toBe('unknown');
  });
});

describe('classifyBrowser', () => {
  const EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
  const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';

  test('Edge UA is classified as edge, not chrome (Edge UA also contains "Chrome/")', () => {
    expect(classifyBrowser(EDGE_UA)).toBe('edge');
  });

  test('Chrome UA is classified as chrome, not safari (Chrome UA also contains "Safari/")', () => {
    expect(classifyBrowser(CHROME_UA)).toBe('chrome');
  });

  test('Safari UA is classified as safari', () => {
    expect(classifyBrowser(SAFARI_UA)).toBe('safari');
  });

  test('Firefox UA is classified as firefox', () => {
    expect(classifyBrowser(FIREFOX_UA)).toBe('firefox');
  });

  test('unrecognised or missing UA is "other"', () => {
    expect(classifyBrowser('SomeBot/1.0')).toBe('other');
    expect(classifyBrowser(null)).toBe('other');
    expect(classifyBrowser(undefined)).toBe('other');
  });
});

describe('aggregateTraffic — legacy eventType regression (mandatory)', () => {
  test('a pageview doc with NO eventType field counts as a view', () => {
    const legacyDoc = { page: '/teacher/home', teacherId: 'd1', sessionId: 's1', visitedAt: '2026-07-14T10:00:00.000Z' };
    const result = aggregateTraffic([legacyDoc]);
    expect(result.totals.pageViews).toBe(1);
    expect(result.totals.uniqueVisitors).toBe(1);
    expect(result.topPages).toEqual([{ page: '/teacher/home', count: 1 }]);
  });

  test('a legacy doc contributes to audience/device/browser breakdowns like any view', () => {
    const legacyDoc = { page: '/quiz', teacherId: 'd1', sessionId: 's1', visitedAt: '2026-07-14T10:00:00.000Z' };
    const result = aggregateTraffic([legacyDoc]);
    expect(result.audience.student).toBe(1);
  });
});

describe('aggregateTraffic — pwa_install events', () => {
  test('pwa_install events are counted in pwaInstalls, excluded from view totals', () => {
    const docs = [
      { page: '/', teacherId: 'd1', sessionId: 's1', eventType: 'pwa_install', visitedAt: '2026-07-14T10:00:00.000Z' },
      { page: '/teacher/home', teacherId: 'd2', sessionId: 's2', eventType: 'view', visitedAt: '2026-07-14T10:00:00.000Z' },
    ];
    const result = aggregateTraffic(docs);
    expect(result.pwaInstalls).toBe(1);
    expect(result.totals.pageViews).toBe(1);
    expect(result.totals.uniqueVisitors).toBe(1);
  });
});

describe('aggregateTraffic — daily bucketing across a UTC day boundary', () => {
  test('docs either side of UTC midnight land in different day buckets', () => {
    const docs = [
      { page: '/', teacherId: 'd1', sessionId: 's1', visitedAt: '2026-07-14T23:59:59.000Z' },
      { page: '/', teacherId: 'd2', sessionId: 's2', visitedAt: '2026-07-15T00:00:01.000Z' },
    ];
    const result = aggregateTraffic(docs);
    expect(result.daily).toEqual([
      { date: '2026-07-14', pageViews: 1, uniqueVisitors: 1 },
      { date: '2026-07-15', pageViews: 1, uniqueVisitors: 1 },
    ]);
  });

  test('daily is sorted ascending by date regardless of input order', () => {
    const docs = [
      { page: '/', teacherId: 'd1', sessionId: 's1', visitedAt: '2026-07-16T01:00:00.000Z' },
      { page: '/', teacherId: 'd2', sessionId: 's2', visitedAt: '2026-07-14T01:00:00.000Z' },
    ];
    const result = aggregateTraffic(docs);
    expect(result.daily.map(d => d.date)).toEqual(['2026-07-14', '2026-07-16']);
  });
});

describe('aggregateTraffic — topPages', () => {
  test('sorted descending by count and capped to top 10', () => {
    const docs = [];
    for (let i = 0; i < 11; i++) {
      const count = 11 - i; // page-0 gets 11 hits, page-10 gets 1 hit
      for (let j = 0; j < count; j++) {
        docs.push({ page: `/page-${i}`, teacherId: `d${i}-${j}`, sessionId: `s${i}-${j}`, visitedAt: '2026-07-15T00:00:00.000Z' });
      }
    }
    const result = aggregateTraffic(docs);
    expect(result.topPages).toHaveLength(10);
    expect(result.topPages[0]).toEqual({ page: '/page-0', count: 11 });
    expect(result.topPages.map(p => p.page)).not.toContain('/page-10'); // 11th-ranked page dropped
  });
});

describe('aggregateTraffic — pagesPerSession', () => {
  test('divides pageViews by uniqueSessions, rounded to 2dp', () => {
    const docs = [
      { page: '/', teacherId: 'd1', sessionId: 's1', visitedAt: '2026-07-15T00:00:00.000Z' },
      { page: '/teacher/home', teacherId: 'd1', sessionId: 's1', visitedAt: '2026-07-15T00:01:00.000Z' },
      { page: '/', teacherId: 'd2', sessionId: 's2', visitedAt: '2026-07-15T00:02:00.000Z' },
    ];
    const result = aggregateTraffic(docs);
    expect(result.totals.pagesPerSession).toBe(1.5);
  });

  test('is 0 when there are no sessions (empty input), never a division-by-zero NaN', () => {
    const result = aggregateTraffic([]);
    expect(result.totals.pagesPerSession).toBe(0);
    expect(Number.isNaN(result.totals.pagesPerSession)).toBe(false);
  });
});

describe('computeFunnelRates — zero-division safety', () => {
  test('0 notifications sent → openRate is null, not NaN', () => {
    const rates = computeFunnelRates({ quizzesSent: 0, notificationsSent: 0, quizOpens: 0, responsesSubmitted: 0 });
    expect(rates.openRate).toBeNull();
    expect(rates.completionRate).toBeNull();
  });

  test('0 opens but notifications sent → completionRate is null (no responses possible)', () => {
    const rates = computeFunnelRates({ quizzesSent: 1, notificationsSent: 5, quizOpens: 0, responsesSubmitted: 0 });
    expect(rates.openRate).toBe(0);
    expect(rates.completionRate).toBeNull();
  });

  test('normal case computes percentages rounded to 2dp', () => {
    const rates = computeFunnelRates({ quizzesSent: 1, notificationsSent: 3, quizOpens: 1, responsesSubmitted: 1 });
    expect(rates.openRate).toBe(33.33);
    expect(rates.completionRate).toBe(100);
  });

  test('counts pass through unchanged', () => {
    const rates = computeFunnelRates({ quizzesSent: 4, notificationsSent: 10, quizOpens: 5, responsesSubmitted: 3 });
    expect(rates.quizzesSent).toBe(4);
    expect(rates.notificationsSent).toBe(10);
    expect(rates.quizOpens).toBe(5);
    expect(rates.responsesSubmitted).toBe(3);
  });
});

// ─── v4.9.0 — aggregateConsentFunnel ─────────────────────────────────────────

function makeConsentDoc(eventType, platform, extra = {}) {
  return { eventType, platform, teacherId: `d-${Math.random()}`, sessionId: 's1', visitedAt: '2026-09-16T10:00:00.000Z', ...extra };
}

describe('aggregateConsentFunnel — null when no consent events', () => {
  test('returns null on empty input', () => {
    expect(aggregateConsentFunnel([])).toBeNull();
  });

  test('returns null when all docs are view/pwa_install (no consent events)', () => {
    const docs = [
      { eventType: 'view', page: '/' },
      { eventType: 'pwa_install', page: '/' },
    ];
    expect(aggregateConsentFunnel(docs)).toBeNull();
  });
});

describe('aggregateConsentFunnel — all 5 event types are counted', () => {
  test('each event type increments its own counter', () => {
    const docs = [
      makeConsentDoc('push_prompted', 'ios'),
      makeConsentDoc('push_granted', 'ios'),
      makeConsentDoc('push_denied', 'android'),
      makeConsentDoc('install_accepted', 'desktop'),
      makeConsentDoc('install_dismissed', 'desktop'),
    ];
    const result = aggregateConsentFunnel(docs);
    expect(result.counts.push_prompted).toBe(1);
    expect(result.counts.push_granted).toBe(1);
    expect(result.counts.push_denied).toBe(1);
    expect(result.counts.install_accepted).toBe(1);
    expect(result.counts.install_dismissed).toBe(1);
  });

  test('view/pwa_install docs mixed in are NOT counted as consent events', () => {
    const docs = [
      makeConsentDoc('push_prompted', 'ios'),
      { eventType: 'view', page: '/teacher/home' },
      { eventType: 'pwa_install', page: '/' },
    ];
    const result = aggregateConsentFunnel(docs);
    expect(result.counts.push_prompted).toBe(1);
    // totals across all 5 consent types must be exactly 1
    const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(1);
  });
});

describe('aggregateConsentFunnel — grant rate math', () => {
  test('grantRate = push_granted / push_prompted × 100', () => {
    const docs = [
      makeConsentDoc('push_prompted', 'ios'),
      makeConsentDoc('push_prompted', 'android'),
      makeConsentDoc('push_granted', 'ios'),
    ];
    const result = aggregateConsentFunnel(docs);
    expect(result.grantRate).toBe(50);
  });

  test('grantRate is null when push_prompted count is 0', () => {
    const docs = [makeConsentDoc('push_granted', 'ios')];
    const result = aggregateConsentFunnel(docs);
    expect(result.grantRate).toBeNull();
  });
});

describe('aggregateConsentFunnel — accept rate math', () => {
  test('acceptRate = install_accepted / (accepted + dismissed) × 100', () => {
    const docs = [
      makeConsentDoc('install_accepted', 'android'),
      makeConsentDoc('install_accepted', 'android'),
      makeConsentDoc('install_dismissed', 'android'),
    ];
    const result = aggregateConsentFunnel(docs);
    expect(result.acceptRate).toBeCloseTo(66.67, 1);
  });

  test('acceptRate is null when no install events at all', () => {
    const docs = [makeConsentDoc('push_prompted', 'ios')];
    const result = aggregateConsentFunnel(docs);
    expect(result.acceptRate).toBeNull();
  });
});

describe('aggregateConsentFunnel — per-platform bucketing', () => {
  test('ios/android/desktop each get their own bucket', () => {
    const docs = [
      makeConsentDoc('push_granted', 'ios'),
      makeConsentDoc('push_granted', 'ios'),
      makeConsentDoc('push_granted', 'android'),
      makeConsentDoc('push_granted', 'desktop'),
    ];
    const result = aggregateConsentFunnel(docs);
    expect(result.byPlatform.ios.push_granted).toBe(2);
    expect(result.byPlatform.android.push_granted).toBe(1);
    expect(result.byPlatform.desktop.push_granted).toBe(1);
  });

  test('unknown/null platform falls into the "unknown" bucket', () => {
    const docs = [
      makeConsentDoc('push_prompted', null),
      makeConsentDoc('push_prompted', undefined),
      makeConsentDoc('push_prompted', 'fridge'),
    ];
    const result = aggregateConsentFunnel(docs);
    expect(result.byPlatform.unknown.push_prompted).toBe(3);
  });

  test('legacy docs with no platform field also fall into "unknown"', () => {
    const doc = { eventType: 'push_granted', teacherId: 'd1', sessionId: 's1', visitedAt: '2026-09-16T10:00:00.000Z' };
    const result = aggregateConsentFunnel([doc]);
    expect(result.byPlatform.unknown.push_granted).toBe(1);
  });
});
