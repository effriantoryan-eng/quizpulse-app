// The one entry point every generation/regeneration/expand call goes through (v4.3.0). Resolves
// the active provider (LLM_PROVIDER env, default "mock"), applies the shared ~60k-char input cap
// identically across every provider (mock included, so behaviour never diverges at activation —
// CEO review addendum §3.7), and logs the one structured observability line per call (§3.10).

const mockProvider = require('./llmProviders/mock');
const azureOpenaiProvider = require('./llmProviders/azureOpenai');
const anthropicProvider = require('./llmProviders/anthropic');

const PROVIDERS = { mock: mockProvider, azureOpenai: azureOpenaiProvider, anthropic: anthropicProvider };
const INPUT_CHAR_CAP = 60000;

class MissingProviderKeyError extends Error {
  constructor(message) { super(message); this.status = 503; }
}
class UnknownProviderError extends Error {
  constructor(message) { super(message); this.status = 500; }
}

function getProviderName() {
  return process.env.LLM_PROVIDER || 'mock';
}

// Selection order (§3.7): the teacher's explicit range first, then even sampling across the
// remaining chunks to fit the char cap. Chunks are never reordered — index order is preserved.
function selectChunks(allChunks, range) {
  let selected = allChunks;
  if (range && Number.isInteger(range.start) && Number.isInteger(range.end)) {
    selected = allChunks.filter(c => c.index >= range.start && c.index <= range.end);
  }

  const totalChars = selected.reduce((sum, c) => sum + c.text.length, 0);
  if (totalChars <= INPUT_CHAR_CAP || selected.length <= 1) return selected;

  // Even sampling: walk the chunk list at a stride that spreads the selection across the whole
  // range rather than just taking a contiguous prefix, stopping once the cap would be exceeded.
  const avgChunkChars = totalChars / selected.length;
  const targetCount = Math.max(1, Math.floor(INPUT_CHAR_CAP / avgChunkChars));
  const stride = Math.max(1, Math.floor(selected.length / targetCount));

  const sampled = [];
  let runningChars = 0;
  for (let i = 0; i < selected.length; i += stride) {
    const chunk = selected[i];
    if (runningChars + chunk.text.length > INPUT_CHAR_CAP) break;
    sampled.push(chunk);
    runningChars += chunk.text.length;
  }
  return sampled.length > 0 ? sampled : [selected[0]];
}

// Distinct page numbers (PDF) used by the selected chunks, sorted — the UI displays this as
// "pages 3, 5-6" style, or the raw list for docx/txt.
function derivePagesUsed(selectedChunks) {
  const pages = [...new Set(selectedChunks.map(c => c.page).filter(p => p != null))];
  return pages.sort((a, b) => a - b);
}

// context: an Azure Functions InvocationContext (has .log/.error) — optional, so this stays unit
// testable without a real Functions host.
async function generateDraft({ context, sourceId, chunks, questionCount, range, topicTag }) {
  const providerName = getProviderName();
  const provider = PROVIDERS[providerName];
  const start = Date.now();

  if (!provider) {
    throw new UnknownProviderError(`Unknown LLM_PROVIDER "${providerName}"`);
  }

  if (providerName !== 'mock') {
    const missing = (provider.requiredEnv || []).filter(key => !process.env[key]);
    if (missing.length > 0) {
      if (context) context.error(JSON.stringify({ sourceId, provider: providerName, questionCount, durationMs: Date.now() - start, outcome: 'error', rejectReason: 'missing-provider-key' }));
      throw new MissingProviderKeyError(`The AI generation provider isn't fully configured yet.`);
    }
  }

  const selected = selectChunks(chunks, range);
  const chunkChars = selected.reduce((sum, c) => sum + c.text.length, 0);

  try {
    const result = await provider.generate({ sourceId, chunks: selected, questionCount, topicTag });
    if (context) context.log(JSON.stringify({ sourceId, provider: providerName, chunkChars, questionCount, durationMs: Date.now() - start, outcome: 'success' }));
    return { ...result, chunkChars, provider: providerName, pagesUsed: derivePagesUsed(selected) };
  } catch (err) {
    if (context) context.error(JSON.stringify({ sourceId, provider: providerName, chunkChars, questionCount, durationMs: Date.now() - start, outcome: 'error', rejectReason: err.message }));
    throw err;
  }
}

module.exports = { generateDraft, selectChunks, derivePagesUsed, getProviderName, MissingProviderKeyError, UnknownProviderError, INPUT_CHAR_CAP };
