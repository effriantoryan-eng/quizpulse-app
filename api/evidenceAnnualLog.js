// GET /api/evidence/annual-log?from=&to= — annual aggregate APST/VIT PL log PDF.
// v4.1.0 (APST Evidence Export). Teacher-facing, scoped to the caller's own quizzes only.

const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { loadQuizAnalytics, buildQuestionBreakdown } = require('./analytics');
const { andExcludeDemo } = require('./shared/excludeDemo');
const { APST_DEFAULTS, domainCoverage } = require('./shared/apstContent');
const { calculateHours, validateDateRange } = require('./shared/evidenceHelpers');
const { buildAnnualLogPdf } = require('./shared/pdfEvidence');

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const database = client.database(process.env.COSMOS_DATABASE);
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);

const RATE_MAX = 10; // Security limits table — Evidence export rate/teacher, 10/hr
const RATE_WINDOW_MS = 3600000;

app.http('evidenceAnnualLog', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'evidence/annual-log',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'evidence/annual-log', method: 'GET', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`evidence-annual-log:${teacherId}`, RATE_MAX, RATE_WINDOW_MS)) {
        return respond(429, { error: 'Evidence export limit reached. Try again later.' }, teacherId);
      }

      const params = new URL(request.url).searchParams;
      const from = params.get('from');
      const to = params.get('to');
      if (!from || !to) return respond(400, { error: 'from and to query parameters are required' }, teacherId);

      const rangeCheck = validateDateRange(from, to);
      if (!rangeCheck.valid) return respond(400, { error: rangeCheck.error }, teacherId);

      // List/GET endpoints scope the Cosmos query itself — never fetch broadly and filter in code.
      const { resources: quizzes } = await quizzesContainer.items.query({
        query: `SELECT * FROM c WHERE ${andExcludeDemo("c.teacherId = @tid AND c.status = 'sent' AND c.sentAt >= @from AND c.sentAt <= @to")} ORDER BY c.sentAt ASC`,
        parameters: [
          { name: '@tid', value: teacherId },
          { name: '@from', value: new Date(from).toISOString() },
          { name: '@to', value: new Date(to).toISOString() },
        ],
      }).fetchAll();

      const loadedQuizzes = await Promise.all(quizzes.map(q => loadQuizAnalytics(q.id, teacherId)));

      const classNames = new Set();
      const subjects = new Set();
      let confidentButIncorrectTotal = 0;
      const correctnessTrend = [];

      for (const loaded of loadedQuizzes) {
        const { quiz, questions, responses, classesMeta } = loaded;
        classesMeta.forEach(c => classNames.add(c.name));
        if (quiz.topicTag) subjects.add(quiz.topicTag);

        const breakdown = buildQuestionBreakdown(questions, responses);
        let totalAnswers = 0, totalCorrect = 0;
        for (const q of breakdown) {
          const fc = q.fourCell;
          totalCorrect += fc.correctConfident + fc.correctUnsure;
          totalAnswers += fc.correctConfident + fc.correctUnsure + fc.incorrectConfident + fc.incorrectUnsure;
          confidentButIncorrectTotal += q.confidentButIncorrect;
        }
        correctnessTrend.push({
          sentAt: quiz.sentAt,
          pctCorrect: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 1000) / 10 : 0,
        });
      }

      // ponytail: descriptor selections aren't persisted per-activity (nothing is stored
      // server-side by design — see "no server-side storage" rule). The annual log summarises
      // using APST_DEFAULTS for every included quiz rather than re-deriving a per-quiz choice
      // that was never recorded; upgrade to real per-export tracking if teachers need it.
      const descriptorCounts = {};
      for (const id of APST_DEFAULTS) {
        descriptorCounts[id] = quizzes.length;
      }

      const pdf = await buildAnnualLogPdf({
        from,
        to,
        quizzes: quizzes.map(q => ({ name: q.name, sentAt: q.sentAt, topicTag: q.topicTag || null })),
        totalHours: calculateHours(quizzes.length),
        classes: [...classNames],
        subjects: [...subjects],
        descriptorCounts,
        domainCoverage: domainCoverage(APST_DEFAULTS),
        correctnessTrend,
        confidentButIncorrectTotal,
      });

      logRequest(context, { endpoint: 'evidence/annual-log', method: 'GET', status: 200, durationMs: Date.now() - start, teacherId });
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="quizpulse-annual-log-${from}-${to}.pdf"`,
        },
        body: pdf,
      };
    } catch (err) {
      if (err && err.status) return respond(err.status, { error: err.error }, null);
      context.error('evidenceAnnualLog error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
