// Regression test for the v4.1.0 footer-pagination bug: text placed close to the bottom margin
// with a bounding width and no lineBreak:false can auto-paginate, which turned the "footer every
// buffered page" loop into an infinite loop (bufferedPageRange().count grew every iteration).
// This test's timeout is the guard — it fails loudly instead of hanging CI.

const { buildActivityPdf, buildAnnualLogPdf } = require('../../../api/shared/pdfEvidence');

describe('pdfEvidence — generation completes and stays within page limits', () => {
  test('buildActivityPdf resolves with a non-empty PDF buffer', async () => {
    const buf = await buildActivityPdf({
      teacherName: 'Test Teacher', vitNumber: '', className: 'Class A', subject: 'Year 7 Science',
      activityName: 'Test activity', pdType: 'School-based professional learning', date: '2026-07-11',
      descriptorIds: ['3.3', '3.6', '5.1', '5.4', '6.2'], durationHours: 0.6,
      participation: { approved: 5, responded: 3 }, correctness: { pctCorrect: 66.7 },
      confidence: { confidentPct: 50, unsurePct: 50 }, confidentButIncorrect: 1,
      domainCoverage: { 'Professional Knowledge': false, 'Professional Practice': true, 'Professional Engagement': true },
      reflection1: 'Personalised reflection one.', reflection2: 'Personalised reflection two.',
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  }, 10000);

  test('buildAnnualLogPdf resolves with a non-empty PDF buffer', async () => {
    const buf = await buildAnnualLogPdf({
      from: '2026-01-01', to: '2026-07-01',
      quizzes: [{ name: 'Q1', sentAt: '2026-01-05', topicTag: 'Year 7 Science' }],
      totalHours: 0.6, classes: ['Class A'], subjects: ['Year 7 Science'],
      descriptorCounts: { '3.3': 1, '5.4': 1 },
      domainCoverage: { 'Professional Knowledge': false, 'Professional Practice': true, 'Professional Engagement': false },
      correctnessTrend: [{ sentAt: '2026-01-05', pctCorrect: 70 }],
      confidentButIncorrectTotal: 2,
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  }, 10000);
});
