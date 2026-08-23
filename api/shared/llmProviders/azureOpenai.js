// Real provider: Azure OpenAI. Live-verified 2026-08-23 against a gpt-5-mini deployment (see
// docs/azure/LLM_PROVIDER_SETUP.md). Env var is LLM_API_KEY (underscores — hyphens are invalid
// Linux app-setting names); the Key Vault SECRET stays LLM-API-KEY per the VAPID convention.

const { buildSystemPrompt, buildUserPrompt } = require('../llmPrompts');

const requiredEnv = ['LLM_API_KEY', 'LLM_ENDPOINT', 'LLM_MODEL'];

async function generate({ chunks, questionCount, topicTag, questionStyle }) {
  const endpoint = process.env.LLM_ENDPOINT.replace(/\/$/, '');
  const model = process.env.LLM_MODEL;
  const res = await fetch(`${endpoint}/openai/deployments/${model}/chat/completions?api-version=2024-02-15-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.LLM_API_KEY },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt({ chunks, questionCount, topicTag, questionStyle }) },
      ],
      response_format: { type: 'json_object' },
      // ponytail: no fixed temperature — reasoning-family deployments (e.g. gpt-5-mini) reject
      // any non-default value ("Unsupported value: 'temperature' does not support 0.4 with this
      // model"). Omitting lets each deployment use its own default; upgrade to a per-model
      // override table only if a future deployment needs a specific non-default temperature.
    }),
  });
  if (!res.ok) throw new Error(`Azure OpenAI request failed: ${res.status}`);
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  const parsed = JSON.parse(content || '{}');
  return { questions: parsed.questions || [], usedChunkIndexes: [...new Set(chunks.map(c => c.index))] };
}

module.exports = { generate, requiredEnv };
