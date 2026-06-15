const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');

const NAME_LIST_MAX = 50;
const NAME_LIST_SAVES_PER_HR = 10;
const STUDENT_NAME_MAX = 80;

// PUT /api/classes/{id}/namelist — update a class's name list (teacher auth)
app.http('classesNameList', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'classes/{id}/namelist',
  handler: async (request, context) => {
    const start = Date.now();
    const classId = request.params.id;
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: `classes/${classId}/namelist`, method: 'PUT', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`namelist:${teacherId}`, NAME_LIST_SAVES_PER_HR, 3600000)) {
        return respond(429, { error: 'Too many name list saves. Please wait before trying again.' }, teacherId);
      }
      if (!rateLimit(`namelist-ip:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 8192) return respond(413, { error: 'Request body too large.' }, teacherId);

      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return respond(400, { error: 'Request body must be a JSON object' }, teacherId);
      }

      let existing;
      try {
        const { resource } = await classesContainer.item(classId, teacherId).read();
        existing = resource;
      } catch (err) {
        if (err.code === 404) return respond(404, { error: 'Class not found' }, teacherId);
        throw err;
      }
      if (!existing || existing.teacherId !== teacherId) {
        return respond(403, { error: 'Forbidden' }, teacherId);
      }

      const { nameList, nameListEnabled } = body;

      if (nameList !== undefined) {
        if (!Array.isArray(nameList)) {
          return respond(400, { error: 'nameList must be an array of strings' }, teacherId);
        }
        // Trim entries, remove blanks, deduplicate
        const cleaned = [...new Set(
          nameList
            .filter(n => typeof n === 'string')
            .map(n => n.trim())
            .filter(n => n.length > 0)
        )];
        for (const entry of cleaned) {
          if (entry.length > STUDENT_NAME_MAX) {
            return respond(400, { error: `Each name must be ${STUDENT_NAME_MAX} characters or fewer` }, teacherId);
          }
        }
        if (cleaned.length > NAME_LIST_MAX) {
          return respond(400, { error: `Name list cannot exceed ${NAME_LIST_MAX} entries` }, teacherId);
        }
        existing.nameList = cleaned;
      }

      if (nameListEnabled !== undefined) {
        if (typeof nameListEnabled !== 'boolean') {
          return respond(400, { error: 'nameListEnabled must be a boolean' }, teacherId);
        }
        existing.nameListEnabled = nameListEnabled;
      }

      const { resource: updated } = await classesContainer.item(classId, teacherId).replace(existing);
      return respond(200, updated, teacherId);
    } catch (err) {
      context.error('classesNameList error:', err.message);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  },
});
