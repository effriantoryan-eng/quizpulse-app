const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { assertScope, getCallerScope, requireRole, ScopeError, ROLES, MUTATE_ALL_ROLES } = require('./shared/authz');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);
const teachersContainer = database.container(process.env.COSMOS_CONTAINER_TEACHERS);
const upvotesContainer = database.container(process.env.COSMOS_CONTAINER_QUESTION_UPVOTES);
const reportsContainer = database.container(process.env.COSMOS_CONTAINER_QUESTION_REPORTS);

const ALLOWED_TOPICS = ['Science', 'History', 'Mathematics', 'English', 'Geography'];
const ALLOWED_VISIBILITY = ['private', 'school', 'public'];
const MAX_PUBLIC_PER_TEACHER = 500;
const PAGE_SIZE = 50;
const MAX_REPORTS_PER_DAY = 20;

// GET /api/questions/reports — moderation queue (support/platform_admin only, must be registered
// before questionById so the static segment wins over the {id} parameter)
app.http('questionReports', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'questions/reports',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'questions/reports', method: 'GET', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const caller = getCallerScope(auth.claims);
      try { requireRole(caller, [ROLES.SUPPORT, ROLES.PLATFORM_ADMIN, ROLES.OWNER]); } catch (e) {
        return respond(404, { error: 'Not found' });
      }

      const offset = Math.max(0, parseInt(new URL(request.url).searchParams.get('offset') || '0', 10));

      // Return questions that have at least one report, newest first
      const { resources: reportedQids } = await reportsContainer.items.query({
        query: 'SELECT DISTINCT c.questionId FROM c OFFSET @offset LIMIT @limit',
        parameters: [{ name: '@offset', value: offset }, { name: '@limit', value: PAGE_SIZE }]
      }).fetchAll();

      if (reportedQids.length === 0) return respond(200, [], caller.teacherId);

      const idParams = reportedQids.map((r, i) => ({ name: `@qid${i}`, value: r.questionId }));
      const idList = idParams.map(p => p.name).join(', ');
      const { resources: questions } = await container.items.query({
        query: `SELECT * FROM c WHERE c.id IN (${idList})`,
        parameters: idParams
      }).fetchAll();

      return respond(200, questions, caller.teacherId);
    } catch (err) {
      context.error('questionReports error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});

// GET /api/questions — teacher's own questions, or community browse when ?visibility= is set
// POST /api/questions — create a new private question
app.http('questions', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const start = Date.now();
    const method = request.method;

    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'questions', method, status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const teacherId = auth.teacherId;

      if (method === 'GET') {
        const params = new URL(request.url).searchParams;
        const visibility = params.get('visibility');
        const offset = Math.max(0, parseInt(params.get('offset') || '0', 10));
        const topicFilter = params.get('topic');
        const yearFilter = parseInt(params.get('year') || '0', 10);
        const searchRaw = (params.get('q') || '').trim().toLowerCase().slice(0, 100);

        // Own questions — no visibility filter
        if (!visibility) {
          const { resources } = await container.items.query({
            query: 'SELECT * FROM c WHERE c.teacherId = @teacherId',
            parameters: [{ name: '@teacherId', value: teacherId }]
          }).fetchAll();
          return respond(200, resources, teacherId);
        }

        // Public community browse
        if (visibility === 'public') {
          let query = "SELECT c.id, c.text, c.options, c.topic, c.yearLevel, c.upvoteCount, c.authorId, c.teacherId, c.visibility, c.createdAt FROM c WHERE c.visibility = 'public'";
          const parameters = [];

          if (topicFilter && ALLOWED_TOPICS.includes(topicFilter)) {
            query += ' AND c.topic = @topic';
            parameters.push({ name: '@topic', value: topicFilter });
          }
          if (yearFilter >= 7 && yearFilter <= 12) {
            query += ' AND (c.yearLevel = @yearLevel OR NOT IS_DEFINED(c.yearLevel) OR IS_NULL(c.yearLevel))';
            parameters.push({ name: '@yearLevel', value: yearFilter });
          }
          if (searchRaw) {
            query += ' AND CONTAINS(LOWER(c.text), @search)';
            parameters.push({ name: '@search', value: searchRaw });
          }

          query += ' ORDER BY c.upvoteCount DESC OFFSET @offset LIMIT @limit';
          parameters.push({ name: '@offset', value: offset }, { name: '@limit', value: PAGE_SIZE });

          const { resources } = await container.items.query({ query, parameters }).fetchAll();
          return respond(200, resources, teacherId);
        }

        // School community browse — two-step: find school peers, then their school/public questions
        if (visibility === 'school') {
          const { resources: teacherDocs } = await teachersContainer.items.query({
            query: 'SELECT c.schoolId FROM c WHERE c.teacherId = @tid',
            parameters: [{ name: '@tid', value: teacherId }]
          }).fetchAll();

          const schoolId = teacherDocs[0]?.schoolId;
          if (!schoolId) return respond(200, [], teacherId);

          const { resources: peers } = await teachersContainer.items.query({
            query: 'SELECT c.teacherId FROM c WHERE c.schoolId = @schoolId',
            parameters: [{ name: '@schoolId', value: schoolId }]
          }).fetchAll();

          const peerIds = [...new Set(peers.map(p => p.teacherId).filter(Boolean))];
          if (peerIds.length === 0) return respond(200, [], teacherId);

          const idParams = peerIds.map((tid, i) => ({ name: `@tid${i}`, value: tid }));
          const idList = idParams.map(p => p.name).join(', ');
          let query = `SELECT c.id, c.text, c.options, c.topic, c.yearLevel, c.upvoteCount, c.authorId, c.teacherId, c.visibility, c.createdAt FROM c WHERE c.teacherId IN (${idList}) AND c.visibility IN ('school', 'public')`;
          const parameters = [...idParams];

          if (topicFilter && ALLOWED_TOPICS.includes(topicFilter)) {
            query += ' AND c.topic = @topic';
            parameters.push({ name: '@topic', value: topicFilter });
          }
          if (yearFilter >= 7 && yearFilter <= 12) {
            query += ' AND (c.yearLevel = @yearLevel OR NOT IS_DEFINED(c.yearLevel) OR IS_NULL(c.yearLevel))';
            parameters.push({ name: '@yearLevel', value: yearFilter });
          }
          if (searchRaw) {
            query += ' AND CONTAINS(LOWER(c.text), @search)';
            parameters.push({ name: '@search', value: searchRaw });
          }

          query += ' ORDER BY c.upvoteCount DESC OFFSET @offset LIMIT @limit';
          parameters.push({ name: '@offset', value: offset }, { name: '@limit', value: PAGE_SIZE });

          const { resources } = await container.items.query({ query, parameters }).fetchAll();
          return respond(200, resources, teacherId);
        }

        return respond(400, { error: "visibility must be 'school' or 'public'" }, teacherId);
      }

      if (method === 'POST') {
        const ip = getClientIp(request);
        if (!rateLimit(`questions:${ip}`, 30, 60000)) {
          return respond(429, { error: 'Too many requests. Please try again later.' });
        }

        const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
        if (contentLength > 65536) {
          return respond(413, { error: 'Request body too large. Maximum size is 64KB' });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return respond(400, { error: 'Request body must be a JSON object' });
        }

        const { text, options, correctIndex, topic, yearLevel } = body;

        if (typeof text !== 'string' || !text.trim()) return respond(400, { error: 'text is required and must be a string' }, teacherId);
        if (text.trim().length > 500) return respond(400, { error: 'text must be 500 characters or fewer' }, teacherId);
        if (!Array.isArray(options) || options.length !== 4) return respond(400, { error: 'options must be an array of exactly 4 items' }, teacherId);
        if (options.some(o => typeof o !== 'string' || !o.trim())) return respond(400, { error: 'each option must be a non-empty string' }, teacherId);
        if (options.some(o => o.trim().length > 200)) return respond(400, { error: 'each option must be 200 characters or fewer' }, teacherId);
        if (typeof correctIndex !== 'number' || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return respond(400, { error: 'correctIndex must be an integer between 0 and 3' }, teacherId);
        if (!ALLOWED_TOPICS.includes(topic)) return respond(400, { error: `topic must be one of: ${ALLOWED_TOPICS.join(', ')}` }, teacherId);
        if (yearLevel !== undefined && yearLevel !== null && (typeof yearLevel !== 'number' || !Number.isInteger(yearLevel) || yearLevel < 7 || yearLevel > 12)) {
          return respond(400, { error: 'yearLevel must be an integer between 7 and 12, or omitted' }, teacherId);
        }

        // Enforce 2000 questions per teacher limit
        const { resources: countResult } = await container.items.query({
          query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @teacherId',
          parameters: [{ name: '@teacherId', value: teacherId }]
        }).fetchAll();
        if ((countResult[0] || 0) >= 2000) {
          return respond(429, { error: 'You have reached the maximum of 2000 questions.' }, teacherId);
        }

        const question = {
          id: require('crypto').randomUUID(),
          teacherId,
          authorId: teacherId,
          visibility: 'private',
          text: text.trim(),
          options: options.map(o => o.trim()),
          correctIndex,
          topic,
          yearLevel: (yearLevel !== undefined && yearLevel !== null) ? yearLevel : null,
          upvoteCount: 0,
          usageCount: 0,
          createdAt: new Date().toISOString()
        };

        const { resource } = await container.items.create(question);
        return respond(201, resource, teacherId);
      }

      return respond(405, { error: 'Method not allowed' });

    } catch (err) {
      context.error('questions error:', err.message);
      logRequest(context, { endpoint: 'questions', method, status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});

// PUT /api/questions/{id} — edit content or toggle visibility
// DELETE /api/questions/{id} — remove question
app.http('questionById', {
  methods: ['PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'questions/{id}',
  handler: async (request, context) => {
    const start = Date.now();
    const method = request.method;
    const id = request.params.id;

    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'questions/:id', method, status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }

    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const teacherId = auth.teacherId;
      const caller = getCallerScope(auth.claims);

      if (method === 'DELETE') {
        const { resources } = await container.items.query({
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: id }]
        }).fetchAll();

        if (resources.length === 0) return respond(404, { error: 'Question not found' }, teacherId);
        try { assertScope(resources[0], caller, { mutate: true }); } catch (e) {
          if (e instanceof ScopeError) return respond(404, { error: 'Question not found' }, teacherId);
          throw e;
        }

        await container.item(id, teacherId).delete();
        return respond(204, null, teacherId);
      }

      if (method === 'PUT') {
        const ip = getClientIp(request);
        if (!rateLimit(`questions:${ip}`, 30, 60000)) {
          return respond(429, { error: 'Too many requests. Please try again later.' });
        }

        const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
        if (contentLength > 65536) {
          return respond(413, { error: 'Request body too large. Maximum size is 64KB' });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return respond(400, { error: 'Request body must be a JSON object' });
        }

        const { resources } = await container.items.query({
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: id }]
        }).fetchAll();

        if (resources.length === 0) return respond(404, { error: 'Question not found' }, teacherId);
        const existing = resources[0];

        // platform_admin can set any question's visibility to 'private' (moderation/unpublish)
        if (MUTATE_ALL_ROLES.includes(caller.role)) {
          if (body.visibility === 'private' && Object.keys(body).length === 1) {
            const unpublished = { ...existing, visibility: 'private' };
            const { resource } = await container.items.upsert(unpublished);
            return respond(200, resource, teacherId);
          }
        }

        // Regular teacher: must own the question
        try { assertScope(existing, caller, { mutate: true }); } catch (e) {
          if (e instanceof ScopeError) return respond(404, { error: 'Question not found' }, teacherId);
          throw e;
        }

        const { text, options, correctIndex, topic, yearLevel, visibility } = body;

        if (typeof text !== 'string' || !text.trim()) return respond(400, { error: 'text is required and must be a string' }, teacherId);
        if (text.trim().length > 500) return respond(400, { error: 'text must be 500 characters or fewer' }, teacherId);
        if (!Array.isArray(options) || options.length !== 4) return respond(400, { error: 'options must be an array of exactly 4 items' }, teacherId);
        if (options.some(o => typeof o !== 'string' || !o.trim())) return respond(400, { error: 'each option must be a non-empty string' }, teacherId);
        if (options.some(o => o.trim().length > 200)) return respond(400, { error: 'each option must be 200 characters or fewer' }, teacherId);
        if (typeof correctIndex !== 'number' || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return respond(400, { error: 'correctIndex must be an integer between 0 and 3' }, teacherId);
        // A stored topic outside the enum (e.g. 'Other' on AI-materialised questions,
        // api/generationDrafts.js) may round-trip unchanged — otherwise every edit or
        // visibility PUT on such a question 400s before reaching the real checks below.
        if (!ALLOWED_TOPICS.includes(topic) && topic !== existing.topic) return respond(400, { error: `topic must be one of: ${ALLOWED_TOPICS.join(', ')}` }, teacherId);
        if (yearLevel !== undefined && yearLevel !== null && (typeof yearLevel !== 'number' || !Number.isInteger(yearLevel) || yearLevel < 7 || yearLevel > 12)) {
          return respond(400, { error: 'yearLevel must be an integer between 7 and 12, or omitted' }, teacherId);
        }

        let resolvedVisibility = existing.visibility;
        if (visibility !== undefined) {
          if (!ALLOWED_VISIBILITY.includes(visibility)) {
            return respond(400, { error: `visibility must be one of: ${ALLOWED_VISIBILITY.join(', ')}` }, teacherId);
          }
          // v4.3.0: AI-generated questions can't be shared to the community bank yet — locked
          // 'private' at materialisation (api/generationDrafts.js), enforced again here so a
          // direct PUT can't route around that lock.
          if (existing.generatedBy === 'ai' && visibility !== existing.visibility) {
            return respond(400, { error: "AI-created questions can't be shared to the community bank yet" }, teacherId);
          }
          // Enforce 500 public questions per teacher when publishing to public
          if (visibility === 'public' && existing.visibility !== 'public') {
            const { resources: pubCount } = await container.items.query({
              query: "SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @teacherId AND c.visibility = 'public'",
              parameters: [{ name: '@teacherId', value: teacherId }]
            }).fetchAll();
            if ((pubCount[0] || 0) >= MAX_PUBLIC_PER_TEACHER) {
              return respond(429, { error: `You can have at most ${MAX_PUBLIC_PER_TEACHER} public questions.` }, teacherId);
            }
          }
          resolvedVisibility = visibility;
        }

        const updated = {
          ...existing,
          text: text.trim(),
          options: options.map(o => o.trim()),
          correctIndex,
          topic,
          yearLevel: (yearLevel !== undefined && yearLevel !== null) ? yearLevel : (existing.yearLevel ?? null),
          visibility: resolvedVisibility,
        };

        const { resource } = await container.items.upsert(updated);
        return respond(200, resource, teacherId);
      }

      return respond(405, { error: 'Method not allowed' });

    } catch (err) {
      context.error('questionById error:', err.message);
      logRequest(context, { endpoint: 'questions/:id', method, status: 500, durationMs: Date.now() - start });
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});

// POST /api/questions/{id}/copy — clone a school/public question as a private copy
app.http('questionCopy', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'questions/{id}/copy',
  handler: async (request, context) => {
    const start = Date.now();
    const id = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'questions/:id/copy', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const teacherId = auth.teacherId;

      const ip = getClientIp(request);
      if (!rateLimit(`question-copy:${ip}`, 20, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' });
      }

      const { resources } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      }).fetchAll();

      if (resources.length === 0) return respond(404, { error: 'Question not found' }, teacherId);
      const original = resources[0];

      // Only school/public questions can be copied; own private questions can also be copied
      if (original.visibility === 'private' && original.teacherId !== teacherId) {
        return respond(404, { error: 'Question not found' }, teacherId);
      }

      // Enforce per-teacher question limit
      const { resources: countResult } = await container.items.query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @teacherId',
        parameters: [{ name: '@teacherId', value: teacherId }]
      }).fetchAll();
      if ((countResult[0] || 0) >= 2000) {
        return respond(429, { error: 'You have reached the maximum of 2000 questions.' }, teacherId);
      }

      const clone = {
        id: require('crypto').randomUUID(),
        teacherId,
        authorId: original.authorId || original.teacherId,
        visibility: 'private',
        text: original.text,
        options: original.options,
        correctIndex: original.correctIndex,
        topic: original.topic,
        yearLevel: original.yearLevel ?? null,
        upvoteCount: 0,
        usageCount: 0,
        copiedFromId: original.id,
        createdAt: new Date().toISOString()
      };

      const { resource } = await container.items.create(clone);

      // Best-effort: increment usageCount on the original
      if (original.teacherId !== teacherId) {
        try {
          const updatedOriginal = { ...original, usageCount: (original.usageCount || 0) + 1 };
          await container.items.upsert(updatedOriginal);
        } catch (e) {
          context.warn('Failed to increment usageCount on copy:', e.message);
        }
      }

      return respond(201, resource, teacherId);
    } catch (err) {
      context.error('questionCopy error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});

// POST /api/questions/{id}/upvote — toggle upvote (1 per teacher per question)
app.http('questionUpvote', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'questions/{id}/upvote',
  handler: async (request, context) => {
    const start = Date.now();
    const id = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'questions/:id/upvote', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const teacherId = auth.teacherId;

      const ip = getClientIp(request);
      if (!rateLimit(`upvote:${ip}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' });
      }

      const { resources } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      }).fetchAll();

      if (resources.length === 0) return respond(404, { error: 'Question not found' }, teacherId);
      const question = resources[0];

      if (question.visibility === 'private' && question.teacherId !== teacherId) {
        return respond(404, { error: 'Question not found' }, teacherId);
      }

      // Check for existing upvote
      const { resources: existing } = await upvotesContainer.items.query({
        query: 'SELECT * FROM c WHERE c.questionId = @qid AND c.teacherId = @tid',
        parameters: [
          { name: '@qid', value: id },
          { name: '@tid', value: teacherId }
        ]
      }).fetchAll();

      if (existing.length > 0) {
        // Toggle off — remove upvote
        await upvotesContainer.item(existing[0].id, id).delete();
        const updated = { ...question, upvoteCount: Math.max(0, (question.upvoteCount || 0) - 1) };
        const { resource } = await container.items.upsert(updated);
        return respond(200, { upvoted: false, upvoteCount: resource.upvoteCount }, teacherId);
      } else {
        // Toggle on — add upvote
        const upvote = {
          id: require('crypto').randomUUID(),
          questionId: id,
          teacherId,
          createdAt: new Date().toISOString()
        };
        await upvotesContainer.items.create(upvote);
        const updated = { ...question, upvoteCount: (question.upvoteCount || 0) + 1 };
        const { resource } = await container.items.upsert(updated);
        return respond(200, { upvoted: true, upvoteCount: resource.upvoteCount }, teacherId);
      }
    } catch (err) {
      context.error('questionUpvote error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});

// POST /api/questions/{id}/report — flag a question for moderation
app.http('questionReport', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'questions/{id}/report',
  handler: async (request, context) => {
    const start = Date.now();
    const id = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'questions/:id/report', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const teacherId = auth.teacherId;

      const ip = getClientIp(request);
      if (!rateLimit(`report:${ip}`, 5, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' });
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 4096) {
        return respond(413, { error: 'Request body too large.' });
      }

      // Rate limit: 20 reports per teacher per day
      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
      const { resources: recentReports } = await reportsContainer.items.query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND c.createdAt > @since',
        parameters: [{ name: '@tid', value: teacherId }, { name: '@since', value: oneDayAgo }]
      }).fetchAll();
      if ((recentReports[0] || 0) >= MAX_REPORTS_PER_DAY) {
        return respond(429, { error: `You can submit at most ${MAX_REPORTS_PER_DAY} reports per day.` }, teacherId);
      }

      const { resources } = await container.items.query({
        query: 'SELECT c.id, c.visibility FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      }).fetchAll();

      if (resources.length === 0) return respond(404, { error: 'Question not found' }, teacherId);
      if (resources[0].visibility === 'private') return respond(404, { error: 'Question not found' }, teacherId);

      let reason = '';
      try {
        const body = await request.json();
        if (body && typeof body.reason === 'string') {
          reason = body.reason.trim().slice(0, 500);
        }
      } catch (_) { /* no body is fine */ }

      const report = {
        id: require('crypto').randomUUID(),
        questionId: id,
        teacherId,
        reason,
        createdAt: new Date().toISOString()
      };

      await reportsContainer.items.create(report);
      return respond(201, { reported: true }, teacherId);
    } catch (err) {
      context.error('questionReport error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});
