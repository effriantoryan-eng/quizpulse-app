const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);

const LIMIT = 1000;

app.http('usageLog', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'usageLog',
  handler: async (request, context) => {
    try {
      const params = new URL(request.url).searchParams;
      const limit = Math.min(parseInt(params.get('limit') || LIMIT, 10), LIMIT);

      const questionsContainer  = database.container(process.env.COSMOS_CONTAINER_QUESTIONS);
      const quizzesContainer    = database.container(process.env.COSMOS_CONTAINER_QUIZZES);
      const responsesContainer  = database.container(process.env.COSMOS_CONTAINER_RESPONSES);
      const pageviewsContainer  = database.container('pageviews');

      const [questionsResult, quizzesResult, responsesResult, pageviewsResult] = await Promise.all([
        questionsContainer.items.query( { query: `SELECT TOP ${limit} * FROM c` }).fetchAll(),
        quizzesContainer.items.query(   { query: `SELECT TOP ${limit} * FROM c` }).fetchAll(),
        responsesContainer.items.query( { query: `SELECT TOP ${limit} * FROM c` }).fetchAll(),
        pageviewsContainer.items.query( { query: `SELECT TOP ${limit} * FROM c` }).fetchAll().catch(() => ({ resources: [] })),
      ]);

      return {
        status: 200,
        jsonBody: {
          retrievedAt: new Date().toISOString(),
          truncatedAt: limit,
          counts: {
            questions:  questionsResult.resources.length,
            quizzes:    quizzesResult.resources.length,
            responses:  responsesResult.resources.length,
            pageviews:  pageviewsResult.resources.length,
          },
          questions:  questionsResult.resources,
          quizzes:    quizzesResult.resources,
          responses:  responsesResult.resources,
          pageviews:  pageviewsResult.resources,
        }
      };
    } catch (err) {
      context.error('adminLog error', err);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});
