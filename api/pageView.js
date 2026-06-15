const { app }         = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');

const client   = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const database = client.database(process.env.COSMOS_DATABASE);

const CONTAINER_NAME = 'pageviews';

// Create container on first request if it doesn't exist
let containerReady = false;
async function getContainer() {
  if (!containerReady) {
    await database.containers.createIfNotExists({ id: CONTAINER_NAME, partitionKey: { paths: ['/teacherId'] } });
    containerReady = true;
  }
  return database.container(CONTAINER_NAME);
}

app.http('pageView', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'pageView',
  handler: async (request, context) => {
    // Rate limit: 60 per minute per IP
    const ip = getClientIp(request);
    if (!rateLimit(`pageview:${ip}`, 60, 60_000)) {
      return { status: 429, jsonBody: { error: 'Too many requests' } };
    }

    // Content-length guard
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > 4096) {
      return { status: 413, jsonBody: { error: 'Payload too large' } };
    }

    let body;
    try {
      body = await request.json();
      if (typeof body !== 'object' || Array.isArray(body)) throw new Error();
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const {
      page, teacherId, sessionId,
      referrer, userAgent, language,
      timezone, screenWidth, screenHeight,
    } = body;

    // Validate required field
    if (typeof page !== 'string' || page.length > 200) {
      return { status: 400, jsonBody: { error: 'Invalid page field' } };
    }

    const doc = {
      id:           crypto.randomUUID(),
      page:         page.slice(0, 200),
      teacherId:    typeof teacherId  === 'string' ? teacherId.slice(0, 100)  : 'anonymous',
      sessionId:    typeof sessionId  === 'string' ? sessionId.slice(0, 100)  : null,
      referrer:     typeof referrer   === 'string' ? referrer.slice(0, 500)   : null,
      userAgent:    typeof userAgent  === 'string' ? userAgent.slice(0, 500)  : null,
      language:     typeof language   === 'string' ? language.slice(0, 20)    : null,
      timezone:     typeof timezone   === 'string' ? timezone.slice(0, 100)   : null,
      screenWidth:  typeof screenWidth  === 'number' ? screenWidth  : null,
      screenHeight: typeof screenHeight === 'number' ? screenHeight : null,
      visitedAt:    new Date().toISOString(),
    };

    try {
      const container = await getContainer();
      await container.items.create(doc);
      return { status: 201, jsonBody: { ok: true } };
    } catch (err) {
      context.error('pageView write error', err);
      return { status: 500, jsonBody: { error: 'An unexpected error occurred' } };
    }
  }
});
