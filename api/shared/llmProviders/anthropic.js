// Real provider: Anthropic. Not exercised against a live endpoint in this build session (no key
// configured) — structurally correct, activation requires the steps in
// docs/azure/LLM_PROVIDER_SETUP.md. Env var is LLM_API_KEY (underscores — hyphens are invalid
// Linux app-setting names); the Key Vault SECRET stays LLM-API-KEY per the VAPID convention.

const { buildSystemPrompt, buildUserPrompt } = require('../llmPrompts');

const requiredEnv = ['LLM_API_KEY'];
const DEFAULT_MODEL = 'claude-sonnet-5';

async function generate({ chunks, questionCount, topicTag }) {
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.LLM_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt({ chunks, questionCount, topicTag }) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic request failed: ${res.status}`);
  const data = await res.json();
  const text = data.content && data.content[0] && data.content[0].text;
  const parsed = JSON.parse(text || '{}');
  return { questions: parsed.questions || [], usedChunkIndexes: [...new Set(chunks.map(c => c.index))] };
}

module.exports = { generate, requiredEnv };
