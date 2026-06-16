const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { sendNotificationForQuiz } = require('./sendNotification');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);

// Timer-triggered every minute — finds quizzes whose scheduled send time has passed and
// sends them the same way a manual send would, then marks them 'sent' with a closedAt
// derived from their configured duration.
app.timer('scheduledQuizSend', {
  schedule: '0 * * * * *',
  handler: async (myTimer, context) => {
    try {
      const now = new Date().toISOString();
      const { resources: due } = await quizzesContainer.items.query({
        query: "SELECT * FROM c WHERE c.status = 'scheduled' AND c.scheduledFor <= @now",
        parameters: [{ name: '@now', value: now }],
      }).fetchAll();

      for (const quiz of due) {
        try {
          const sentAt = new Date();
          const minutes = typeof quiz.durationMinutes === 'number' && quiz.durationMinutes >= 5
            ? quiz.durationMinutes
            : 5;

          quiz.status = 'sent';
          quiz.sentAt = sentAt.toISOString();
          quiz.closedAt = new Date(sentAt.getTime() + minutes * 60000).toISOString();
          await quizzesContainer.items.upsert(quiz);

          const result = await sendNotificationForQuiz(quiz, context);
          if (result.error) {
            context.warn(`scheduled send for quiz ${quiz.id} failed: ${result.error}`);
          } else {
            context.log(`scheduled quiz ${quiz.id} sent: ${result.sent}/${result.total}`);
          }
        } catch (err) {
          context.error(`scheduled send for quiz ${quiz.id} errored:`, err.message);
        }
      }
    } catch (err) {
      context.error('scheduledQuizSend failed', err.message);
    }
  },
});
