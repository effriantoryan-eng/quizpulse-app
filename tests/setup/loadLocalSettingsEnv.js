// Integration tests mint dev-bypass JWTs whose `aud` claim must match the same
// AUTH_CLIENT_ID/ADMIN_AUTH_CLIENT_ID the func host resolves from api/local.settings.json — but
// nothing previously loaded that file into the jest process's env, so a plain `npm run
// test:integration` (or a direct `npx jest tests/integration/...`) minted tokens with a
// mismatched fallback `aud`, causing every admin-audience test to 401 before its actual
// assertion ran. Root cause found running v4.4.0's Known-issue-#14 suite for the first time
// (2026-07-27) — see docs/azure/V460_STEP_ZERO_RUNBOOK.md B2.
//
// No-op outside integration runs (mirrors the it_int gate in the test files themselves) and
// no-op if local.settings.json doesn't exist (CI / fresh clone) — a real env var already set
// in the process always wins, matching the same "env vars beat local.settings.json Values"
// precedence CLAUDE.md documents for the Functions host itself.
if (process.env.RUN_INTEGRATION === 'true') {
  try {
    const settings = require('../../api/local.settings.json');
    const values = settings.Values || {};
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (_) {
    // local.settings.json absent (CI, fresh clone) — nothing to load.
  }
}
