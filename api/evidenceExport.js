// POST /api/evidence/export — per-activity APST/VIT evidence PDF for a single quiz.
// v4.1.0 (APST Evidence Export). Teacher-facing (authenticateTeacher), never admin.

const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { loadQuizAnalytics, buildQuestionBreakdown } = require('./analytics');
const { descriptorById, domainCoverage } = require('./shared/apstContent');
const { calculateHours, containsUnpersonalisedMarker } = require('./shared/evidenceHelpers');
const { buildActivityPdf } = require('./shared/pdfEvidence');

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const database = client.database(process.env.COSMOS_DATABASE);

// Security limits table — Evidence export rate/teacher, 10/hr (matches CSV-export precedent).
const EXPORT_RATE_MAX = 10;
const EXPORT_RATE_WINDOW_MS = 3600000;
const MAX_BODY_BYTES = 16384;

app.http('evidenceExport', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'evidence/export',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'evidence/export', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`evidence-export:${teacherId}`, EXPORT_RATE_MAX, EXPORT_RATE_WINDOW_MS)) {
        return respond(429, { error: 'Evidence export limit reached. Try again later.' }, teacherId);
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_BODY_BYTES) {
        return respond(413, { error: 'Request body too large' }, teacherId);
      }

      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return respond(400, { error: 'Request body must be a JSON object' }, teacherId);
      }

      const {
        quizId, teacherName, vitNumber, className, subject, activityName, pdType,
        descriptorIds, durationHours, reflection1, reflection2,
      } = body;

      if (typeof quizId !== 'string' || !quizId.trim()) {
        return respond(400, { error: 'quizId is required' }, teacherId);
      }
      if (typeof reflection1 !== 'string' || typeof reflection2 !== 'string' || !reflection1.trim() || !reflection2.trim()) {
        return respond(400, { error: 'Both reflection fields are required' }, teacherId);
      }
      if (containsUnpersonalisedMarker(reflection1) || containsUnpersonalisedMarker(reflection2)) {
        return respond(400, { error: 'Reflection fields must be personalised before export' }, teacherId);
      }

      const requestedIds = Array.isArray(descriptorIds) ? descriptorIds : [];
      const validIds = requestedIds.filter(id => descriptorById.has(id));

      // Ownership: 404 on mismatch, never 403, per the house authorization convention —
      // loadQuizAnalytics already compares quiz.teacherId === teacherId and throws { status: 404 }.
      let loaded;
      try {
        loaded = await loadQuizAnalytics(quizId, teacherId);
      } catch (err) {
        if (err && err.status) return respond(err.status, { error: err.error }, teacherId);
        throw err;
      }
      const { quiz, questions, responses, approvedStudents, classesMeta } = loaded;

      const breakdown = buildQuestionBreakdown(questions, responses);
      let totalAnswers = 0, totalCorrect = 0, totalConfident = 0, totalConfidentButIncorrect = 0;
      for (const q of breakdown) {
        const fc = q.fourCell;
        totalCorrect += fc.correctConfident + fc.correctUnsure;
        totalConfident += fc.correctConfident + fc.incorrectConfident;
        totalAnswers += fc.correctConfident + fc.correctUnsure + fc.incorrectConfident + fc.incorrectUnsure;
        totalConfidentButIncorrect += q.confidentButIncorrect;
      }
      const pctCorrect = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 1000) / 10 : 0;
      const confidentPct = totalAnswers > 0 ? Math.round((totalConfident / totalAnswers) * 1000) / 10 : 0;
      const unsurePct = totalAnswers > 0 ? Math.round((100 - confidentPct) * 10) / 10 : 0;

      const pdf = await buildActivityPdf({
        teacherName: typeof teacherName === 'string' ? teacherName.slice(0, 200) : '',
        vitNumber: typeof vitNumber === 'string' ? vitNumber.slice(0, 100) : '',
        className: (typeof className === 'string' && className) || classesMeta.map(c => c.name).join(', '),
        subject: (typeof subject === 'string' && subject) || quiz.topicTag || '',
        activityName: (typeof activityName === 'string' && activityName) || `Retrieval Practice Quiz — ${quiz.topicTag || quiz.name} — ${(quiz.sentAt || '').slice(0, 10)}`,
        pdType: (typeof pdType === 'string' && pdType) || 'School-based professional learning',
        date: (quiz.sentAt || new Date().toISOString()).slice(0, 10),
        descriptorIds: validIds,
        durationHours: typeof durationHours === 'number' && durationHours > 0 ? durationHours : calculateHours(1),
        participation: { approved: approvedStudents.length, responded: responses.length },
        correctness: { pctCorrect },
        confidence: { confidentPct, unsurePct },
        confidentButIncorrect: totalConfidentButIncorrect,
        domainCoverage: domainCoverage(validIds),
        reflection1: reflection1.trim(),
        reflection2: reflection2.trim(),
      });

      logRequest(context, { endpoint: 'evidence/export', method: 'POST', status: 200, durationMs: Date.now() - start, teacherId });
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="quizpulse-evidence-${quiz.id}.pdf"`,
        },
        body: pdf,
      };
    } catch (err) {
      if (err && err.status) return respond(err.status, { error: err.error }, null);
      context.error('evidenceExport error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
