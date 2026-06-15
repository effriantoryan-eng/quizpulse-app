const { app } = require('@azure/functions');
const { logRequest } = require('./logger');

const CLASSES = [
  { id: 'yr9-sci',  name: 'Year 9 Science',  students: 28, topic: 'Science'     },
  { id: 'yr10-mth', name: 'Year 10 Maths',   students: 25, topic: 'Mathematics' },
  { id: 'yr7-eng',  name: 'Year 7 English',  students: 22, topic: 'English'     },
];

app.http('classes', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const start = Date.now();
    logRequest(context, { endpoint: 'classes', method: 'GET', status: 200, durationMs: Date.now() - start });
    return { status: 200, jsonBody: CLASSES };
  }
});
